"""Build an offline CCX. Only explicit public resources enter the package."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ffmpeg-dir',type=Path,required=True,help='Directory containing ffmpeg.exe and ffprobe.exe')
    parser.add_argument('--model',type=Path,default=ROOT/'.runtime/models/ggml-base.bin')
    args=parser.parse_args()
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    version=manifest['version']
    build=ROOT/'.runtime/package-build'
    dist=ROOT/'.runtime/engine-dist'
    release=ROOT/'releases'
    for path in (build,dist,release):path.mkdir(parents=True,exist_ok=True)
    for name in ('ffmpeg.exe','ffprobe.exe'):
        if not (args.ffmpeg_dir/name).is_file():raise SystemExit(f'Arquivo ausente: {name}')
    if not args.model.is_file():raise SystemExit('Instale o modelo Whisper antes de empacotar.')
    # Pin the model used and verified in this release.
    digest=hashlib.file_digest(args.model.open('rb'),'sha256').hexdigest()
    if digest!='60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe':
        raise SystemExit('O modelo não corresponde ao Whisper base multilíngue esperado.')
    ffmpeg=str(args.ffmpeg_dir/'ffmpeg.exe')
    filters=subprocess.run([ffmpeg,'-hide_banner','-filters'],check=True,capture_output=True,text=True).stdout
    for feature in ('whisper','silencedetect','loudnorm','subtitles'):
        if feature not in filters:raise SystemExit(f'O FFmpeg incluído não oferece o filtro {feature}.')
    encoders=subprocess.run([ffmpeg,'-hide_banner','-encoders'],check=True,capture_output=True,text=True).stdout
    if 'prores_ks' not in encoders:raise SystemExit('FFmpeg sem o codificador ProRes 4444.')
    command=[sys.executable,'-m','PyInstaller','--noconfirm','--onedir','--windowed','--noupx',
             '--name','LexAlfaEngine','--paths',str(ROOT),'--distpath',str(dist),'--workpath',str(build/'work'),
             '--specpath',str(build),'--add-data',str(ROOT/'assets/sfx/clique.wav')+':assets/sfx',
             str(ROOT/'processor/desktop.py')]
    env=dict(os.environ,PYINSTALLER_CONFIG_DIR=str(build/'cache'))
    subprocess.run(command,cwd=ROOT,env=env,check=True)
    ccx=release/f'Lex-Alfa-{version}-Windows.ccx'
    temp=ccx.with_suffix('.building')
    included=[]
    def add(archive,path,name):
        archive.write(path,name);included.append(name)
    with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
        for name in ('manifest.json','index.html'):
            add(archive,ROOT/name,name)
        for directory in ('js','css','icons','assets'):
            for path in sorted((ROOT/directory).rglob('*')):
                if path.is_file():add(archive,path,path.relative_to(ROOT).as_posix())
        for path in sorted((dist/'LexAlfaEngine').rglob('*')):
            if path.is_file():add(archive,path,'runtime/'+path.relative_to(dist/'LexAlfaEngine').as_posix())
        for name in ('ffmpeg.exe','ffprobe.exe'):
            add(archive,args.ffmpeg_dir/name,'runtime/_internal/binaries/'+name)
        add(archive,args.model,'runtime/_internal/models/ggml-base.bin')
        license_path=args.ffmpeg_dir.parent/'LICENSE'
        if not license_path.is_file():raise SystemExit('Licença da distribuição FFmpeg ausente.')
        add(archive,license_path,'licenses/FFmpeg-GPL.txt')
        add(archive,args.ffmpeg_dir.parent/'README.txt','licenses/FFmpeg-build.txt')
        for path in (ROOT/'licenses').glob('*'):
            if path.is_file():add(archive,path,'licenses/'+path.name)
        add(archive,ROOT/'docs/INSTALAR.md','COMO-INSTALAR.txt')
    with zipfile.ZipFile(temp) as archive:
        if archive.testzip():raise SystemExit('O pacote não passou na verificação de integridade.')
    temp.replace(ccx)
    checksum=hashlib.file_digest(ccx.open('rb'),'sha256').hexdigest()
    (release/(ccx.name+'.sha256')).write_text(checksum+'  '+ccx.name+'\n',encoding='ascii')
    (build/'package-inventory.json').write_text(json.dumps(included,indent=2),encoding='utf-8')
    shutil.copyfile(ROOT/'docs/INSTALAR.md',release/'LEIA-ME.txt')
    print(f'Pacote pronto: {ccx} ({ccx.stat().st_size/1024/1024:.1f} MB)')


if __name__=='__main__':main()
