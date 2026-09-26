"""Styled subtitle overlays. Word animation timing is estimated within each cue."""
import re
import wave
import math

TEMPLATES = {'classica','negrito-impacto','karaoke','minimalista','bold-limpo-reels','manchete',
             'elegante-cursiva','caixa-destaque','contorno-grosso','pop-palavra','maquina-escrever',
             'balao-fala','meme','caixa-karaoke','neon','placa-escura','faixa-editorial','cinema','sublinhado',
             'duotone','caps-espacado','pilha','contorno-colorido','sombra-longa'}
FONTS = {'Montserrat','Arial','Bebas Neue','Georgia','Courier New'}


def read_cues(text):
    def seconds(value):
        hour, minute, second, milli = map(int, re.split('[:,.]', value))
        if minute > 59 or second > 59:
            raise ValueError('Minutos e segundos do SRT devem estar entre 00 e 59.')
        return hour * 3600 + minute * 60 + second + milli / 1000
    cues = []
    for block in re.split(r'\n\s*\n', text.replace('\r\n', '\n').strip()):
        lines = block.splitlines()
        for index, line in enumerate(lines):
            match = re.match(r'(\d+:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d{3})', line)
            if match:
                start, end = seconds(match[1]), seconds(match[2])
                content = re.sub('<[^>]*>', '', ' '.join(lines[index + 1:])).strip()
                if content and end > start:
                    cues.append((start, end, content))
                break
    return cues


def prepare_cues(text, words_per_line=0, max_lines=2):
    if not isinstance(text,str) or not 1 <= len(text) <= 200000:
        raise ValueError('Informe um SRT com até 200.000 caracteres.')
    cues = read_cues(text)
    if not cues or len(cues) != text.count('-->') or len(cues) > 5000:
        raise ValueError('SRT inválido: confira todos os tempos e textos (máximo 5.000 legendas).')
    words_per_line, max_lines = int(words_per_line), int(max_lines)
    if not 0 <= words_per_line <= 12 or not 1 <= max_lines <= 3:
        raise ValueError('Use até 12 palavras por linha e de 1 a 3 linhas.')
    result = []
    for start, end, content in sorted(cues):
        if not all(math.isfinite(v) for v in (start,end)) or start < 0 or end > 7200:
            raise ValueError('Tempos do SRT devem estar entre 0 e 2 horas.')
        words = content.split()
        count = words_per_line * max_lines or len(words)
        for index in range(0,len(words),count):
            stop = min(len(words),index+count)
            result.append((start+(end-start)*index/len(words),start+(end-start)*stop/len(words),' '.join(words[index:stop])))
            if len(result) > 5000:
                raise ValueError('A divisão excedeu 5.000 legendas. Aumente as palavras por linha.')
    return result


def srt_text(cues):
    def timestamp(value):
        ms=round(value*1000)
        return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    return '\n\n'.join(f'{i}\n{timestamp(start)} --> {timestamp(end)}\n{text}' for i,(start,end,text) in enumerate(cues,1))+'\n'


def stamp(seconds):
    centiseconds = round(seconds * 100)
    return f'{centiseconds // 360000}:{centiseconds // 6000 % 60:02}:{centiseconds // 100 % 60:02}.{centiseconds % 100:02}'


def escape(text):
    return text.replace('\\', '＼').replace('{', '｛').replace('}', '｝').replace('\n', ' ')


def build_ass(cues, style, width=1080, height=1920):
    template = style.get('template', 'classica')
    if template not in TEMPLATES:
        raise ValueError('Template desconhecido.')
    font = style.get('fonte', 'Arial')
    if font not in FONTS:
        raise ValueError('Fonte inválida.')
    color = style.get('cor', '#EF9F27')
    if not isinstance(color, str) or not re.fullmatch('#[a-fA-F0-9]{6}', color):
        raise ValueError('Cor inválida.')
    accent = '&H' + color[5:7] + color[3:5] + color[1:3] + '&'
    size = float(style.get('tamanho', 14))
    if not 10 <= size <= 32:
        raise ValueError('Tamanho inválido.')
    font_size = round(size * width / 300)
    top, bottom, horizontal = (float(style.get(key,default)) for key,default in [('safeTop',10),('safeBottom',18),('safeHorizontal',10)])
    if not all(math.isfinite(v) and 0 <= v <= 35 for v in (top,bottom,horizontal)):
        raise ValueError('As margens devem estar entre 0% e 35%.')
    position = style.get('position','bottom')
    if position not in ('bottom','center','top'):
        raise ValueError('Posição inválida.')
    alignment = {'bottom':2,'center':5,'top':8}[position]
    margin = round(height * (top if position == 'top' else bottom) / 100)
    animation = style.get('animation','none')
    if animation not in ('none','fade','zoom','slide','bounce'):
        raise ValueError('Animação inválida.')
    words_per_line = int(style.get('wordsPerLine',0))
    if not 0 <= words_per_line <= 12:
        raise ValueError('Quantidade de palavras inválida.')
    headline_count = int(style.get('manchQtd', 2))
    if not 1 <= headline_count <= 6:
        raise ValueError('Quantidade de palavras inválida.')
    header = f'''[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{font_size},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,{alignment},{round(width*horizontal/100)},{round(width*horizontal/100)},{margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    events = []
    def event(start, end, text, tags=''):
        if end - start >= .01:
            ms=max(1,min(180,round((end-start)*1000/3)))
            y = height-margin if position == 'bottom' else margin if position == 'top' else height//2
            motion = {'none':'', 'fade':f'\\fad({ms},{ms})',
                      'zoom':f'\\fscx85\\fscy85\\t(0,{ms},\\fscx100\\fscy100)',
                      'slide':f'\\move({width//2},{y+round(height*.025)},{width//2},{y},0,{ms})',
                      'bounce':f'\\fscx80\\fscy80\\t(0,{ms},\\fscx110\\fscy110)\\t({ms},{ms*2},\\fscx100\\fscy100)'}[animation]
            if words_per_line:
                # Spaces outside ASS tags delimit visible words; tags themselves have no spaces.
                tokens = text.split(' ')
                text = ''.join(('\\N' if i and i%words_per_line==0 else ' ' if i else '')+word for i,word in enumerate(tokens))
            events.append(f'Dialogue: 0,{stamp(start)},{stamp(end)},Default,,0,0,0,,{{{motion}{tags}}}{text}')
    for start, end, text in cues:
        words = text.split()
        clean = escape(text)
        if template == 'maquina-escrever':
            # Reveal characters over the first 65% of the cue, retaining the final text.
            chars = clean[:160]
            step = (end - start) * .65 / max(1,len(chars))
            for i in range(len(chars)):
                event(start + i * step, start + (i+1)*step if i < len(chars)-1 else end, chars[:i+1], r'\fnCourier New\b0')
        elif template in ('pop-palavra','caixa-karaoke'):
            for i, word in enumerate(words):
                left = start + (end - start) * i / len(words)
                right = start + (end - start) * (i+1) / len(words)
                if template == 'pop-palavra':
                    event(left,right,escape(word),r'\1c' + accent + r'\fscx115\fscy115\t(0,90,\fscx100\fscy100)')
                else:
                    highlighted = ' '.join((r'{\bord4\3c' + accent + r'\1c&H101010&}' + escape(w) + r'{\bord0\1c&HFFFFFF&}') if j == i else escape(w) for j,w in enumerate(words))
                    event(left,right,highlighted,r'\bord0')
        elif template == 'karaoke':
            centis = max(1,round((end-start)*100/max(1,len(words))))
            animated = ' '.join(f'{{\\k{centis}}}' + escape(word) for word in words)
            event(start,end,animated,r'\1c' + accent + r'\2c&HFFFFFF&')
        elif template == 'manchete':
            highlighted = r'{\1c' + accent + '}' + escape(' '.join(words[:headline_count])) + r'{\1c&HFFFFFF&} ' + escape(' '.join(words[headline_count:]))
            event(start,end,highlighted,r'\b1')
        elif template == 'duotone':
            colored = ' '.join(r'{\1c'+(accent if i%2 else '&HFFFFFF&')+'}'+escape(word) for i,word in enumerate(words))
            event(start,end,colored)
        elif template == 'pilha':
            stacked = r'\N'.join(escape(' '.join(words[i:i+2])) for i in range(0,len(words),2))
            event(start,end,stacked,r'\b1')
        else:
            tags = {'classica':r'\bord2', 'negrito-impacto':r'\b1\bord4', 'minimalista':r'\b0\bord0\1c&HDDDDDD&',
                    'bold-limpo-reels':r'\b1\bord1', 'elegante-cursiva':r'\i1\b0',
                    'caixa-destaque':r'\bord6\3c' + accent + r'\1c&H101010&',
                    'contorno-grosso':r'\bord6', 'balao-fala':r'\bord8\3c&HFFFFFF&\1c&H101010&',
                    'meme':r'\frz-3\b1\bord3', 'neon':r'\1c'+accent+r'\3c'+accent+r'\bord1\blur1',
                    'placa-escura':r'\1c'+accent+r'\3c&H151515&\bord7',
                    'faixa-editorial':r'\3c'+accent+r'\bord6', 'cinema':r'\fnGeorgia\b0\bord1\fsp1',
                    'sublinhado':r'\u1\1c'+accent, 'caps-espacado':r'\fsp3\b1',
                    'contorno-colorido':r'\3c'+accent+r'\bord2', 'sombra-longa':r'\shad5\4c&H000000&\bord1'}[template]
            event(start,end,clean.upper() if template in ('negrito-impacto','contorno-grosso','caps-espacado') else clean,tags)
    # Opaque boxes use ASS BorderStyle 3; rounded bubble shapes are approximated.
    if template in ('caixa-destaque','balao-fala','caixa-karaoke','placa-escura','faixa-editorial'):
        header = header.replace(f',0,0,1,2,0,{alignment},', f',0,0,3,2,0,{alignment},')
    return header + '\n'.join(events) + '\n'


def write_click_track(cues, click_file, destination):
    with wave.open(str(click_file), 'rb') as audio:
        params = audio.getparams()
        click = audio.readframes(audio.getnframes())
    rate, width = params.framerate, params.sampwidth * params.nchannels
    with wave.open(str(destination), 'wb') as output:
        output.setparams(params)
        cursor = 0
        for start, _, _ in cues:
            position = max(cursor, round(start * rate))
            remaining = position - cursor
            while remaining:
                length = min(remaining, rate)
                output.writeframesraw(bytes(length * width)); remaining -= length
            output.writeframesraw(click)
            cursor = position + len(click) // width
        remaining = max(0, round(cues[-1][1] * rate) - cursor)
        while remaining:
            length = min(remaining, rate)
            output.writeframesraw(bytes(length * width)); remaining -= length
