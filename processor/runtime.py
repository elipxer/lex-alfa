"""Paths and lifecycle shared by the packaged engine and development entry point."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.request
import urllib.error

VERSION = '2.0.1'
PORT = 47831


def state_directory():
    # UXP's os.homedir() resolves the same location, including non-ASCII names.
    return Path.home() / 'AppData' / 'Local' / 'LexAlfa'


def bundle_directory():
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent))


def installed_connection(directory=None):
    try:
        data = json.loads(((directory or state_directory()) / 'connection.json').read_text(encoding='utf-8'))
        request = urllib.request.Request(f'http://127.0.0.1:{PORT}/health', headers={'Authorization':'Bearer '+data['token']})
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request,timeout=2) as response:
            health = json.load(response)
        return health if health.get('app') == 'lex-alfa' else None
    except urllib.error.HTTPError as error:
        error.close()
        return None
    except (OSError, ValueError, KeyError):
        return None


def write_connection(directory, token):
    directory.mkdir(parents=True,exist_ok=True)
    target = directory / 'connection.json'
    temporary = directory / f'connection-{os.getpid()}.tmp'
    temporary.write_text(json.dumps({'token':token,'pid':os.getpid(),'version':VERSION}),encoding='utf-8')
    temporary.replace(target)


def record_startup_error(error):
    directory = state_directory()
    directory.mkdir(parents=True,exist_ok=True)
    (directory/'startup-error.json').write_text(json.dumps({'message':str(error),'time':time.time()}),encoding='utf-8')
