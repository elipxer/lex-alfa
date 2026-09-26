"""Download the multilingual Whisper base model used by FFmpeg's whisper filter."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
REPO = 'ggerganov/whisper.cpp'
NAME = 'ggml-base.bin'


def main():
    folder = ROOT / '.runtime' / 'models'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / NAME
    # Verify the download against the publisher's LFS SHA-256 metadata.
    request = urllib.request.Request(f'https://huggingface.co/api/models/{REPO}/tree/main?recursive=false', headers={'User-Agent': 'LexAlfa/1.1'})
    with urllib.request.urlopen(request, timeout=30) as response:
        entries = json.load(response)
    entry = next(item for item in entries if item.get('path') == NAME)
    expected = entry['lfs']['oid']
    def digest(path):
        with path.open('rb') as handle:
            return hashlib.file_digest(handle, 'sha256').hexdigest()
    if target.is_file() and digest(target) == expected:
        print('Modelo Whisper já instalado e verificado.')
        return
    temporary = folder / (NAME + '.download')
    print('Baixando modelo Whisper base multilíngue (~142 MB)…', flush=True)
    try:
        with urllib.request.urlopen(f'https://huggingface.co/{REPO}/resolve/main/{NAME}', timeout=60) as source, temporary.open('wb') as output:
            while chunk := source.read(1024 * 1024):
                output.write(chunk)
        if digest(temporary) != expected:
            raise RuntimeError('A verificação SHA-256 do modelo falhou. Tente novamente.')
        temporary.replace(target)
        print('Modelo instalado. A transcrição será executada localmente.')
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
