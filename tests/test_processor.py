import json
import math
from pathlib import Path
import struct
import tempfile
import threading
import unittest
import wave
import subprocess
from processor.server import Worker, parse_silences, kept_ranges, handler, ThreadingHTTPServer
import urllib.request
import urllib.error


class ProcessorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'áudio teste.wav'
        rate = 16000
        with wave.open(str(self.source), 'wb') as audio:
            audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
            audio.writeframes(b''.join(struct.pack('<h', int(math.sin(2 * math.pi * 440 * i / rate) * 6000) if i < rate * 2 or i >= rate * 2.5 else 0) for i in range(rate * 5)))
        self.worker = Worker(self.root / 'output', self.root / 'model.bin')

    def tearDown(self):
        self.temp.cleanup()

    def execute(self, operation, **data):
        key = ('a' if operation == 'detect' else 'b') * 32
        job = {'id':key, 'cancel':threading.Event(), 'state':'queued'}
        self.worker.jobs[key] = job
        self.worker.execute(job, {'operation':operation, 'path':str(self.source), **data})
        return job

    def test_detect_and_cut_real_audio(self):
        original = self.source.read_bytes()
        job = self.execute('detect', sensitivity=50, minDuration=.15)
        self.assertEqual(job['state'],'done',job.get('error'))
        segment = job['result']['segments'][0]
        self.assertAlmostEqual(segment['start'],2.04,places=2)
        self.assertAlmostEqual(segment['end'],2.46,places=2)
        cut = self.execute('cut',analysisId=job['id'],indices=[0])
        self.assertEqual(cut['state'],'done',cut.get('error'))
        output = Path(cut['result']['files'][0])
        with wave.open(str(output)) as audio:
            self.assertAlmostEqual(audio.getnframes()/audio.getframerate(),4.58,places=2)
        self.assertEqual(original,self.source.read_bytes())

    def test_file_change_rejects_stale_analysis(self):
        job = self.execute('detect',sensitivity=50,minDuration=.15)
        with self.source.open('ab') as output:
            output.write(b'x')
        cut = self.execute('cut',analysisId=job['id'],indices=[0])
        self.assertEqual(cut['state'],'error')
        self.assertIn('mudou',cut['error'])

    def test_cut_keeps_video_and_audio_in_sync(self):
        video = self.root / 'vídeo.mp4'
        subprocess.run([self.worker.ffmpeg, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=25',
                        '-i', str(self.source), '-t', '5', '-c:v', 'libx264', '-c:a', 'aac', str(video)], check=True)
        self.source = video
        detected = self.execute('detect',sensitivity=50,minDuration=.15)
        self.assertEqual(detected['state'],'done',detected.get('error'))
        cut = self.execute('cut',analysisId=detected['id'],indices=[0])
        self.assertEqual(cut['state'],'done',cut.get('error'))
        output = Path(cut['result']['files'][0])
        duration, has_video = self.worker.probe(cut,output)
        self.assertTrue(has_video)
        self.assertAlmostEqual(duration,4.6,delta=.08)

    def test_normalization_measures_output(self):
        job = self.execute('normalize',targetLufs=-16,limiterDb=-1)
        self.assertEqual(job['state'],'done',job.get('error'))
        self.assertLess(abs(job['result']['measuredLufs']+16), .5)
        self.assertLessEqual(job['result']['measuredPeak'], -.9)

    def test_preserve_long_and_validation(self):
        log = 'silence_start: 0\nsilence_end: 1.2\nsilence_start: 2\nsilence_end: 2.5'
        self.assertEqual(len(parse_silences(log,3,.1,True)),1)
        with self.assertRaises(ValueError):
            kept_ranges([{'start':1,'end':.5}],2)
        job = self.execute('normalize',targetLufs=float('nan'))
        self.assertEqual(job['state'],'error')

    def test_missing_model_never_reports_captions_generated(self):
        job = self.execute('transcribe')
        self.assertEqual(job['state'],'error')
        self.assertIn('Modelo Whisper ausente',job['error'])

    def test_cancelled_job_has_no_output(self):
        job = {'id':'c'*32,'cancel':threading.Event(),'state':'queued'}
        job['cancel'].set()
        self.worker.execute(job, {'operation':'normalize','path':str(self.source)})
        self.assertEqual(job['state'],'cancelled')
        self.assertNotIn('result',job)

    def test_http_requires_authentication(self):
        server = ThreadingHTTPServer(('127.0.0.1',0),handler(self.worker,'test-secret'))
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            url = f'http://127.0.0.1:{server.server_port}/health'
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(url)
            self.assertEqual(error.exception.code,401)
            error.exception.close()
            request = urllib.request.Request(url,headers={'Authorization':'Bearer test-secret'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)['app'],'lex-alfa')
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
