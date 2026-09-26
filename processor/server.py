"""Local, authenticated FFmpeg worker. No media is sent to the internet."""
from __future__ import annotations

import argparse
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
try:
    from .captions import build_ass, read_cues, write_click_track, prepare_cues, srt_text
    from .edit_advisor import suggest
    from .runtime import VERSION, PORT, state_directory, bundle_directory, installed_connection, write_connection
except ImportError:
    from captions import build_ass, read_cues, write_click_track, prepare_cues, srt_text
    from edit_advisor import suggest
    from runtime import VERSION, PORT, state_directory, bundle_directory, installed_connection, write_connection

ROOT = bundle_directory()
MEDIA = {'.wav', '.mp3', '.m4a', '.aac', '.aif', '.aiff', '.flac', '.ogg', '.wma', '.mp4', '.mov', '.mkv', '.avi', '.webm'}


class Cancelled(Exception):
    pass


def number(value, low, high):
    if isinstance(value, bool):
        raise ValueError('Número inválido.')
    result = float(value)
    if not math.isfinite(result) or not low <= result <= high:
        raise ValueError(f'Valor fora do intervalo {low} a {high}.')
    return result


def fingerprint(path):
    stat = path.stat()
    return f'{path.resolve()}:{stat.st_size}:{stat.st_mtime_ns}'


def parse_silences(log, duration, minimum, preserve_long=False):
    result, start = [], None
    for match in re.finditer(r'silence_(start|end):\s*([\d.eE+-]+)', log):
        value = max(0.0, min(duration, float(match[2])))
        if match[1] == 'start':
            start = value
        elif start is not None:
            if value - start + 1e-6 >= minimum and not (preserve_long and value - start >= 1.0):
                left, right = start + .04, value - .04
                if right > left:
                    result.append({'start': round(left, 6), 'end': round(right, 6)})
            start = None
    if start is not None and duration - start >= minimum and not (preserve_long and duration - start >= 1):
        if duration - .04 > start + .04:
            result.append({'start': round(start + .04, 6), 'end': round(duration - .04, 6)})
    return result


def kept_ranges(segments, duration):
    previous, result = 0.0, []
    for seg in sorted(segments, key=lambda s: s['start']):
        start, end = number(seg['start'], 0, duration), number(seg['end'], 0, duration)
        if end <= start or start < previous:
            raise ValueError('Intervalos de corte inválidos ou sobrepostos.')
        if start > previous:
            result.append((previous, start))
        previous = end
    if previous < duration:
        result.append((previous, duration))
    if not result:
        raise ValueError('Os cortes removeriam o arquivo inteiro.')
    return result


def loudness_json(log):
    blocks = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', log, re.S)
    if not blocks:
        raise ValueError('O FFmpeg não retornou a medição de volume.')
    data = json.loads(blocks[-1])
    for key in ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'):
        if not math.isfinite(float(data[key])):
            raise ValueError('Áudio silencioso ou curto demais para medir LUFS com segurança.')
    return data


def filter_path(path):
    return "'" + str(path).replace('\\', '/').replace(':', '\\:').replace("'", "'\\''") + "'"


class Worker:
    def __init__(self, output_dir, model, ffmpeg=None, ffprobe=None):
        self.output = Path(output_dir).resolve()
        self.model = Path(model).resolve()
        self.ffmpeg = ffmpeg or shutil.which('ffmpeg')
        self.ffprobe = ffprobe or shutil.which('ffprobe')
        if not self.ffmpeg or not self.ffprobe:
            raise ValueError('Instale FFmpeg e ffprobe e adicione-os ao PATH.')
        self.jobs = {}
        self.lock = threading.Lock()
        self.stopping = False
        self.last_activity = time.monotonic()

    def source(self, data):
        path = Path(data.get('path', '')).expanduser().resolve()
        if not path.is_file() or path.suffix.lower() not in MEDIA:
            raise ValueError('Escolha um arquivo de áudio ou vídeo disponível no computador.')
        return path

    def run_command(self, job, args, cwd=None):
        if job['cancel'].is_set():
            raise Cancelled()
        flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, creationflags=flags)
        started = time.monotonic()
        while True:
            try:
                stdout, stderr = process.communicate(timeout=.25)
                break
            except subprocess.TimeoutExpired:
                if job['cancel'].is_set() or time.monotonic() - started > 7200:
                    process.kill()
                    process.communicate()
                    if job['cancel'].is_set():
                        raise Cancelled()
                    raise ValueError('Processamento excedeu o limite de duas horas.')
        if job['cancel'].is_set():
            raise Cancelled()
        if process.returncode:
            detail = stderr.decode('utf-8', errors='replace')[-1800:]
            raise ValueError('FFmpeg não concluiu o processamento. ' + detail)
        return stdout.decode('utf-8', errors='replace'), stderr.decode('utf-8', errors='replace')

    def probe(self, job, path, require_audio=True):
        out, _ = self.run_command(job, [self.ffprobe, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)])
        info = json.loads(out)
        if require_audio and not any(s.get('codec_type') == 'audio' for s in info['streams']):
            raise ValueError('O arquivo não contém uma faixa de áudio.')
        duration = float(info['format'].get('duration', 0))
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError('Duração inválida ou desconhecida.')
        # Ignore album artwork when deciding whether to preserve video.
        video = any(s.get('codec_type') == 'video' and not s.get('disposition', {}).get('attached_pic') for s in info['streams'])
        return duration, video

    def command(self, path, *args):
        return [self.ffmpeg, '-hide_banner', '-nostdin', '-y', '-i', str(path), *args]

    def submit(self, data):
        if data.get('operation') not in ('detect', 'cut', 'normalize', 'transcribe', 'renderSrt', 'suggestEdit', 'zoom'):
            raise ValueError('Operação desconhecida.')
        with self.lock:
            if self.stopping:
                raise ValueError('O processador está encerrando. Inicie-o novamente.')
            if any(job['state'] in ('queued', 'running') for job in self.jobs.values()):
                raise ValueError('Já existe um processamento em andamento.')
            # Keep bounded metadata; a cut always references a recent detection.
            if len(self.jobs) > 100:
                for key in list(self.jobs)[:-50]:
                    del self.jobs[key]
            job_id = uuid.uuid4().hex
            job = {'id': job_id, 'state': 'queued', 'message': 'Preparando…', 'cancel': threading.Event()}
            self.jobs[job_id] = job
        threading.Thread(target=self.execute, args=(job, data), daemon=True).start()
        return job_id

    def execute(self, job, data):
        job['state'] = 'running'
        folder = None
        try:
            if job['cancel'].is_set(): raise Cancelled()
            operation = data['operation']
            if operation == 'suggestEdit':
                job['message'] = 'Consultando sugestões de estilo no TypeSafe…'
                result = suggest(data.get('brief'),job['cancel'])
                if job['cancel'].is_set(): raise Cancelled()
                job.update(state='done',result=result,message=result['message'])
                return
            if operation == 'renderSrt':
                folder = self.output / (time.strftime('%Y%m%d-%H%M%S') + '-' + job['id'][:8])
                folder.mkdir(parents=True,exist_ok=False)
                result = self.finish_captions(job,data,data.get('srt'),folder)
                if job['cancel'].is_set(): raise Cancelled()
                job.update(state='done',result=result,message=result['message'])
                return
            if operation == 'cut':
                analysis = self.jobs.get(data.get('analysisId'))
                if not analysis or analysis['state'] != 'done' or 'analysis' not in analysis:
                    raise ValueError('A análise expirou. Analise o arquivo novamente.')
                stored = analysis['analysis']
                path = Path(stored['path'])
                if fingerprint(path) != stored['fingerprint']:
                    raise ValueError('O arquivo mudou desde a análise. Analise novamente antes de cortar.')
            else:
                path = self.source(data)
            original_stamp = fingerprint(path)
            duration, has_video = self.probe(job, path, require_audio=operation != 'zoom')
            if operation == 'transcribe' and duration > 7200:
                raise ValueError('Transcreva arquivos de até 2 horas por operação.')
            if operation == 'detect':
                minimum = number(data.get('minDuration', .15), .03, 2)
                threshold = -60 + number(data.get('sensitivity', 55), 0, 100) * .4
                job['message'] = 'Analisando silêncio no áudio…'
                _, log = self.run_command(job, self.command(path, '-map', '0:a:0', '-af', f'silencedetect=noise={threshold}dB:d={minimum}', '-f', 'null', '-'))
                segments = parse_silences(log, duration, minimum, data.get('preserveLong') is True)
                result = {'segments': segments, 'duration': duration, 'thresholdDb': threshold}
                job['analysis'] = {**result, 'path': str(path), 'fingerprint': original_stamp}
            else:
                folder = self.output / (time.strftime('%Y%m%d-%H%M%S') + '-' + job['id'][:8])
                folder.mkdir(parents=True, exist_ok=False)
                if operation == 'cut':
                    result = self.cut(job, data, stored, path, folder, duration, has_video)
                elif operation == 'normalize':
                    result = self.normalize(job, data, path, folder)
                elif operation == 'zoom':
                    if not has_video: raise ValueError('Selecione um arquivo com vídeo para aplicar zoom.')
                    result = self.zoom(job,data,path,folder)
                else:
                    result = self.transcribe(job, data, path, folder)
            if fingerprint(path) != original_stamp:
                raise ValueError('O arquivo de origem mudou durante o processamento. Repita a operação.')
            if job['cancel'].is_set():
                raise Cancelled()
            job.update(state='done', result=result, message=result.get('message', 'Concluído.'))
        except Cancelled:
            job.update(state='cancelled', error='Operação cancelada.', message='Cancelado.')
        except Exception as error:
            if job['cancel'].is_set():
                job.update(state='cancelled', error='Operação cancelada.', message='Cancelado.')
            else:
                job.update(state='error', error=str(error), message='Não foi possível concluir.')
        finally:
            # Only this job's uniquely-created output directory can be cleaned up.
            if folder and job['state'] != 'done' and folder.parent == self.output and folder.name.endswith(job['id'][:8]):
                shutil.rmtree(folder, ignore_errors=True)

    def cut(self, job, data, stored, path, folder, duration, video):
        indices = data.get('indices', [])
        if not isinstance(indices, list) or not indices or len(indices) > 300:
            raise ValueError('Selecione entre 1 e 300 intervalos por operação.')
        if any(type(i) is not int or i < 0 or i >= len(stored['segments']) for i in indices):
            raise ValueError('Seleção de intervalos inválida.')
        selected = [stored['segments'][i] for i in sorted(set(indices))]
        ranges = kept_ranges(selected, duration)
        n = len(ranges)
        graph = [f'[0:a:0]asplit={n}' + ''.join(f'[as{i}]' for i in range(n))]
        if video:
            graph.append(f'[0:V:0]split={n}' + ''.join(f'[vs{i}]' for i in range(n)))
        for i, (start, end) in enumerate(ranges):
            graph.append(f'[as{i}]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]')
            if video:
                graph.append(f'[vs{i}]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]')
        inputs = ''.join((f'[v{i}]' if video else '') + f'[a{i}]' for i in range(n))
        graph.append(inputs + f'concat=n={n}:v={int(video)}:a=1' + ('[v]' if video else '') + '[a]')
        script = folder / 'cuts.ffgraph'
        script.write_text(';\n'.join(graph), encoding='utf-8')
        output = folder / ('cortado.mp4' if video else 'cortado.wav')
        args = self.command(path, '-filter_complex_script', str(script))
        if video:
            args += ['-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']
        args += ['-map', '[a]', '-c:a', 'aac' if video else 'pcm_s24le', '-ar', '48000', str(output)]
        job['message'] = 'Gerando cópia com os cortes selecionados…'
        self.run_command(job, args)
        script.unlink()
        removed = sum(s['end'] - s['start'] for s in selected)
        return {'files': [str(output)], 'removedSeconds': removed, 'message': f'Cópia gerada: {len(selected)} cortes, {removed:.2f} s removidos. Importe o resultado abaixo.'}

    def normalize(self, job, data, path, folder):
        target = number(data.get('targetLufs', -16), -30, -6)
        peak = number(data.get('limiterDb', -1), -6, 0)
        base = f'loudnorm=I={target}:TP={peak}:LRA=11'
        job['message'] = 'Medindo loudness — primeira passagem…'
        _, log = self.run_command(job, self.command(path, '-map', '0:a:0', '-af', base + ':print_format=json', '-f', 'null', '-'))
        measured = loudness_json(log)
        settings = base + ''.join(f':{key}={float(measured[value])}' for key, value in (
            ('measured_I', 'input_i'), ('measured_TP', 'input_tp'), ('measured_LRA', 'input_lra'),
            ('measured_thresh', 'input_thresh'), ('offset', 'target_offset')))
        output = folder / 'normalizado.wav'
        job['message'] = 'Normalizando áudio — segunda passagem…'
        self.run_command(job, self.command(path, '-map', '0:a:0', '-af', settings + ':linear=true', '-ar', '48000', '-c:a', 'pcm_s24le', str(output)))
        job['message'] = 'Conferindo volume do arquivo final…'
        _, final_log = self.run_command(job, self.command(output, '-af', base + ':print_format=json', '-f', 'null', '-'))
        final = loudness_json(final_log)
        return {'files': [str(output)], 'measuredLufs': float(final['input_i']), 'measuredPeak': float(final['input_tp']),
                'message': f"WAV gerado. Medição final: {final['input_i']} LUFS / {final['input_tp']} dBTP. Importe o resultado abaixo."}

    def transcribe(self, job, data, path, folder):
        if not self.model.is_file():
            raise ValueError('Modelo Whisper ausente. Execute python processor/setup_model.py e tente novamente.')
        language = data.get('language', 'pt')
        if language not in ('pt', 'en', 'es', 'auto'):
            raise ValueError('Idioma inválido.')
        output = folder / 'legendas.srt'
        job['message'] = 'Transcrevendo localmente com Whisper. A primeira execução pode demorar…'
        options = f'whisper=model={filter_path(self.model)}:language={language}:queue=20:use_gpu=false:destination=legendas.srt:format=srt:max_len=42'
        self.run_command(job, self.command(path, '-map', '0:a:0', '-af', options, '-f', 'null', '-'), cwd=folder)
        if not output.is_file() or '-->' not in output.read_text(encoding='utf-8'):
            raise ValueError('Nenhuma fala foi transcrita. Confira o áudio e o idioma selecionado.')
        # FFmpeg's whisper filter numbers cues from zero. Emit conventional 1-based SRT.
        text = output.read_text(encoding='utf-8').replace('\r\n', '\n')
        cues = [cue for cue in re.split(r'\n\s*\n', text.strip()) if '-->' in cue]
        normalized = []
        for index, cue in enumerate(cues, 1):
            lines = cue.strip().splitlines()
            if lines and lines[0].strip().isdigit():
                lines = lines[1:]
            normalized.append(str(index) + '\n' + '\n'.join(lines))
        output.write_text('\n\n'.join(normalized) + '\n', encoding='utf-8')
        count = len(normalized)
        return self.finish_captions(job,data,output.read_text(encoding='utf-8'),folder)

    def finish_captions(self,job,data,text,folder):
        style = data.get('style', {})
        if not isinstance(style, dict):
            raise ValueError('Estilo inválido.')
        cues = prepare_cues(text,style.get('wordsPerLine',0),style.get('maxLines',2))
        output = folder / 'legendas.srt'
        output.write_text(srt_text(cues),encoding='utf-8')
        count = len(cues)
        (folder / 'estilo-referencia.json').write_text(json.dumps({'note': 'Referência visual; não aplicada ao SRT.', 'style': style}, ensure_ascii=False, indent=2), encoding='utf-8')
        files = [str(output)]
        if data.get('overlay') is True:
            layout = data.get('layout', 'vertical')
            if layout not in ('vertical','horizontal','quadrado'):
                raise ValueError('Formato de vídeo inválido.')
            width, height = {'vertical':(1080,1920),'horizontal':(1920,1080),'quadrado':(1080,1080)}[layout]
            overlay = self.render_overlay(job, cues, style, folder, width, height)
            files.append(str(overlay))
            if style.get('template') == 'manchete' and data.get('clicks') is True:
                clicks = folder / 'cliques-manchete.wav'
                write_click_track(cues, ROOT / 'assets' / 'sfx' / 'clique.wav', clicks)
                files.append(str(clicks))
        return {'files': files, 'captions': count, 'message': f'{count} legendas geradas. Importe os resultados abaixo; alinhe ao início do arquivo original e revise a transcrição.'}

    def zoom(self,job,data,path,folder):
        zoom = data.get('zoom','gentle')
        if zoom not in ('gentle','punch'): raise ValueError('Escolha zoom leve ou forte.')
        ratio = 1.08 if zoom == 'gentle' else 1.15
        info,_ = self.run_command(job,[self.ffprobe,'-v','error','-select_streams','V:0','-show_entries','stream=width,height','-of','json',str(path)])
        dimensions = json.loads(info)['streams'][0]
        w,h = dimensions['width']//2*2,dimensions['height']//2*2
        output = folder/'zoom.mp4'
        effect=f'scale={math.ceil(w*ratio/2)*2}:{math.ceil(h*ratio/2)*2},crop={w}:{h},setsar=1'
        job['message']='Gerando cópia com aproximação central…'
        self.run_command(job,self.command(path,'-map','0:V:0','-map','0:a:0?','-vf',effect,'-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac',str(output)))
        return {'files':[str(output)],'message':f'Cópia com zoom central de {round((ratio-1)*100)}% gerada. Confira se o enquadramento preserva o assunto.'}

    def render_overlay(self, job, cues, style, folder, width, height):
        if not cues:
            raise ValueError('Não há legendas para renderizar.')
        ass = folder / 'legendas.ass'
        ass.write_text(build_ass(cues, style, width, height), encoding='utf-8')
        overlay = folder / 'legendas-transparente.mov'
        job['message'] = 'Renderizando legenda transparente com o template escolhido…'
        source = f'color=c=black@0:s={width}x{height}:r=30,format=rgba'
        self.run_command(job, [self.ffmpeg, '-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', source,
                              '-vf', 'subtitles=legendas.ass:alpha=1', '-t', str(max(cue[1] for cue in cues)), '-an',
                              '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', str(overlay)], cwd=folder)
        return overlay

    def public_job(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError('Processamento não encontrado. Pode ter expirado após reiniciar o serviço.')
        return {k: v for k, v in job.copy().items() if k not in ('cancel', 'analysis')}


def handler(worker, token):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, data):
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.end_headers()

        def authorized(self):
            supplied = self.headers.get('Authorization', '')
            return hmac.compare_digest(supplied.encode(), ('Bearer ' + token).encode())

        def do_GET(self):
            if not self.authorized():
                return self.reply(401, {'error': 'Conexão expirada. Verifique o processador novamente.'})
            try:
                if self.path == '/health':
                    worker.last_activity = time.monotonic()
                    return self.reply(200, {'app': 'lex-alfa', 'version': VERSION, 'whisper': worker.model.is_file(), 'outputDir': str(worker.output), 'bundled':bool(getattr(sys,'frozen',False))})
                if re.fullmatch(r'/jobs/[a-f0-9]{32}', self.path):
                    return self.reply(200, worker.public_job(self.path.split('/')[2]))
                return self.reply(404, {'error': 'Rota inexistente.'})
            except ValueError as error:
                self.reply(400, {'error': str(error)})

        def do_POST(self):
            if not self.authorized():
                return self.reply(401, {'error': 'Conexão expirada. Verifique o processador novamente.'})
            try:
                length = int(self.headers.get('Content-Length', 0))
                if length <= 0 or length > 1048576:
                    raise ValueError('Requisição inválida ou muito grande.')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('Requisição inválida.')
                if self.path == '/jobs':
                    worker.last_activity = time.monotonic()
                    return self.reply(202, {'id': worker.submit(data)})
                if self.path == '/shutdown':
                    with worker.lock:
                        if any(job['state'] in ('queued', 'running') for job in worker.jobs.values()):
                            raise ValueError('Há uma tarefa em andamento. Cancele pelo painel e aguarde antes de encerrar.')
                        worker.stopping = True
                    self.reply(200, {'ok': True})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                if re.fullmatch(r'/jobs/[a-f0-9]{32}/cancel', self.path):
                    job = worker.jobs.get(self.path.split('/')[2])
                    if not job:
                        raise ValueError('Processamento não encontrado.')
                    if job['state'] in ('queued', 'running'):
                        job['cancel'].set()
                    return self.reply(200, {'ok': True})
                return self.reply(404, {'error': 'Rota inexistente.'})
            except (ValueError, TypeError) as error:
                self.reply(400, {'error': str(error)})
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', default=str(Path.home() / 'Documents' / 'Lex Alfa' / 'Exports'))
    frozen = bool(getattr(sys,'frozen',False))
    parser.add_argument('--model', default=str(ROOT / ('models' if frozen else '.runtime/models') / 'ggml-base.bin'))
    parser.add_argument('--state-dir', default=str(state_directory()))
    args = parser.parse_args()
    runtime = Path(args.state_dir).resolve()
    current = installed_connection(runtime)
    if current:
        if current.get('version') != VERSION:
            raise ValueError('Outra versão do Lex Alfa está aberta. Use Reconectar no painel.')
        return
    bin_dir = ROOT / 'binaries'
    worker = Worker(args.output_dir, args.model, str(bin_dir/'ffmpeg.exe') if frozen else None, str(bin_dir/'ffprobe.exe') if frozen else None)
    worker.output.mkdir(parents=True,exist_ok=True)
    if frozen and (not Path(worker.ffmpeg).is_file() or not Path(worker.ffprobe).is_file() or not worker.model.is_file()):
        raise ValueError('A instalação está incompleta. Reinstale o pacote Lex Alfa no Creative Cloud.')
    token = secrets.token_urlsafe(48)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), handler(worker, token))
    except OSError:
        # A second launch may race the first. Never kill another process.
        if installed_connection(runtime): return
        raise ValueError('O endereço local está ocupado. Use Reconectar; se persistir, reinicie o computador.') from None
    write_connection(runtime,token)
    (runtime/'startup-error.json').unlink(missing_ok=True)
    if not frozen:
        write_connection(ROOT/'.runtime',token)  # Compatibility with developer scripts.
    if sys.stdout:
        print('Lex Alfa: processador local pronto.',flush=True)
    def idle_shutdown():
        while not worker.stopping:
            time.sleep(30)
            with worker.lock:
                active = any(job['state'] in ('queued','running') for job in worker.jobs.values())
                if time.monotonic()-worker.last_activity > 1200 and not active:
                    worker.stopping = True
                    server.shutdown()
                    return
    if frozen:
        threading.Thread(target=idle_shutdown,daemon=True).start()
    try:
        server.serve_forever()
    finally:
        worker.stopping = True
        server.server_close()


if __name__ == '__main__':
    main()
