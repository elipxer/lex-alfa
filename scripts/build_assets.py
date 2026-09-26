"""Reproducible, original synthetic sound effects and panel icon."""
from pathlib import Path
import math
import random
import struct
import wave
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RATE = 48000


def main():
    folder = ROOT / 'assets' / 'sfx'
    folder.mkdir(parents=True, exist_ok=True)
    random.seed(17)
    for name, duration in [('clique', .12), ('whoosh', .7), ('pop', .22), ('ding', 1.1), ('impacto', .8)]:
        samples = []
        for i in range(round(duration * RATE)):
            t = i / RATE
            attack = min(1, t * 1000)
            noise = random.uniform(-1, 1)
            if name == 'clique':
                value = (noise * .5 + math.sin(2 * math.pi * 1700 * t) * .5) * math.exp(-65 * t)
            elif name == 'whoosh':
                value = noise * math.sin(math.pi * t / duration) ** 3 * .55
            elif name == 'pop':
                value = math.sin(2 * math.pi * (650 * t - 1100 * t * t)) * math.exp(-24 * t)
            elif name == 'ding':
                value = (math.sin(2 * math.pi * 1500 * t) + .35 * math.sin(2 * math.pi * 3010 * t)) * math.exp(-5 * t) * .6
            else:
                value = (math.sin(2 * math.pi * (85 * t - 25 * t * t)) * .7 + noise * .3 * math.exp(-12 * t)) * math.exp(-7 * t)
            samples.append(struct.pack('<h', int(max(-1, min(1, value * attack * .5)) * 32767)))
        with wave.open(str(folder / f'{name}.wav'), 'wb') as out:
            out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            out.writeframes(b''.join(samples))
    icons = ROOT / 'icons'
    icons.mkdir(exist_ok=True)
    for size, name in [(23, 'icon.png'), (46, 'icon@2x.png')]:
        factor = 4
        im = Image.new('RGBA', (size * factor, size * factor), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        scale = size * factor / 23
        def box(coords): return tuple(round(v * scale) for v in coords)
        d.rounded_rectangle(box((0, 0, 22, 22)), radius=round(5 * scale), fill='#EF9F27')
        d.line(box((6, 5, 6, 17)), fill='#191919', width=round(3 * scale))
        d.line(box((6, 17, 16, 17)), fill='#191919', width=round(3 * scale))
        d.polygon([tuple(round(v * scale) for v in p) for p in [(12, 5), (18, 9), (12, 13)]], fill='#191919')
        im.resize((size, size), Image.Resampling.LANCZOS).save(icons / name)
    overlays = ROOT / 'assets' / 'overlays'
    overlays.mkdir(exist_ok=True)
    width,height = 1920,1080
    for name in ['grao','vinheta','luz-quente','linhas']:
        im=Image.new('RGBA',(width,height))
        pixels=im.load()
        for y in range(height):
            for x in range(width):
                if name=='grao':
                    value=random.choice([0,255]); pixel=(value,value,value,random.randrange(0,25))
                elif name=='vinheta':
                    distance=math.hypot((x-width/2)/(width/2),(y-height/2)/(height/2))
                    pixel=(0,0,0,min(160,max(0,round((distance-.45)*170))))
                elif name=='luz-quente':
                    alpha=round(120*math.exp(-((x/width)*4)**2)*(.6+.4*math.sin(y/height*math.pi)))
                    pixel=(255,135,45,alpha)
                else: pixel=(0,0,0,20 if y%4==0 else 0)
                pixels[x,y]=pixel
        im.save(overlays/f'{name}.png')


if __name__ == '__main__':
    main()
