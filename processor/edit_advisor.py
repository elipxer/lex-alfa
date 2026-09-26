"""Small semantic choices; code owns every operation and its parameters."""
import json
import math
import os
from pathlib import Path
import urllib.error
import urllib.request

CHOICES = {
    'template': {'classica':'Leitura neutra e profissional', 'minimalista':'Discreto, elegante, sem excesso visual',
                 'manchete':'Destaque para números, benefícios ou manchetes', 'karaoke':'Acompanhamento progressivo da fala',
                 'pop-palavra':'Uma palavra por vez, energético', 'caixa-destaque':'Alto contraste em fundo movimentado',
                 'elegante-cursiva':'Narrativa delicada e emocional'},
    'animation': {'none':'Sem movimento, legibilidade e sobriedade', 'fade':'Entrada e saída suaves',
                  'zoom':'Entrada curta crescendo', 'slide':'Entrada vertical curta', 'bounce':'Entrada com pequeno ressalto, tom divertido'},
    'zoom': {'none':'Manter enquadramento, informação insuficiente ou plano aberto',
             'gentle':'Aproximar 8% em plano de fala para dar ênfase', 'punch':'Aproximar 15% em plano de fala enfático'}
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        # Never forward an Authorization header to another domain.
        raise ValueError('Redirecionamento inesperado da API TypeSafe.')


def suggest(brief, cancel=None, transport=None):
    if not isinstance(brief, str) or not 10 <= len(brief.strip()) <= 3000:
        raise ValueError('Descreva o vídeo em 10 a 3.000 caracteres.')
    questions = {name: {'type':'choice', 'instructions': instruction, 'criteria':CHOICES[name]} for name, instruction in {
        'template':'Qual estilo de legenda combina melhor com o objetivo e público descritos em `brief`?',
        'animation':'Qual movimento de entrada do texto combina melhor com o tom descrito em `brief`?',
        'zoom':'O enquadramento descrito em `brief` justifica uma aproximação central? Sem informação sobre enquadramento, escolha none.'
    }.items()}
    payload = {'model':'jev-latest', 'state':{'brief':brief.strip()}, 'questions':questions}
    if transport:
        response = transport(payload)
    else:
        key = os.environ.get('TYPESAFE_API_KEY')
        if not key:
            try:
                key = Path('C:/Users/Elias Sales/Documents/apijev.txt').read_text(encoding='utf-8-sig').strip()
            except OSError:
                raise ValueError('Configure TYPESAFE_API_KEY no processador para usar as sugestões por IA.') from None
        if not key or '\n' in key or '\r' in key:
            raise ValueError('A credencial TypeSafe deve conter somente a chave em uma linha.')
        request = urllib.request.Request('https://api.typesafe.ai/v1/systemone',
            data=json.dumps(payload,ensure_ascii=False).encode('utf-8'),
            headers={'Content-Type':'application/json','Authorization':'Bearer '+key}, method='POST')
        try:
            with urllib.request.build_opener(NoRedirect).open(request,timeout=30) as result:
                response = json.load(result)
        except urllib.error.HTTPError as error:
            code = error.code; error.close()
            raise ValueError(f'TypeSafe indisponível (HTTP {code}). Confira a credencial ou tente novamente mais tarde.') from None
        except (urllib.error.URLError, TimeoutError):
            raise ValueError('Não foi possível conectar ao TypeSafe. Tente novamente.') from None
    if cancel and cancel.is_set():
        raise ValueError('Sugestão cancelada.')
    suggestions = {}
    for name, options in CHOICES.items():
        answer = response.get('answers',{}).get(name,{})
        selected = answer.get('choice')
        confidence = answer.get('confidence')
        if selected not in options or not isinstance(confidence,(int,float)) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError('O TypeSafe retornou uma sugestão inválida. Nada foi aplicado.')
        suggestions[name] = {'value':selected,'label':options[selected],'confidence':confidence}
    return {'suggestions':suggestions, 'message':'Sugestões prontas. Confira antes de aplicar; foram baseadas somente na sua descrição.'}
