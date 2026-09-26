import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from processor.captions import prepare_cues, srt_text, build_ass
from processor.edit_advisor import suggest, CHOICES
from processor.server import Worker


class EditingTests(unittest.TestCase):
    def test_reflow_preserves_text_and_interval(self):
        text = '1\n00:00:01,000 --> 00:00:05,000\num dois três quatro cinco seis sete oito\n'
        cues = prepare_cues(text, 2, 2)
        self.assertEqual(cues, [(1,3,'um dois três quatro'),(3,5,'cinco seis sete oito')])
        self.assertEqual(prepare_cues(srt_text(cues)),cues)
        for invalid in ['1\n00:99:00,000 --> 01:40:00,000\nerro', text+'\n2\ninvalid --> invalid\nerro']:
            with self.assertRaises(ValueError): prepare_cues(invalid)

    def test_margin_and_motion_reach_rendered_ass(self):
        ass = build_ass([(0,2,'Teste de movimento')], {'position':'top','safeTop':20,'safeHorizontal':15,'animation':'fade'},320,180)
        self.assertIn(',8,48,48,36,1',ass)
        self.assertIn('\\fad(',ass)
        with self.assertRaises(ValueError): build_ass([(0,1,'oi')],{'safeTop':float('nan')})

    def test_advisor_is_limited_to_declared_choices(self):
        def transport(payload):
            self.assertEqual(set(payload['state']),{'brief'})
            self.assertEqual(set(payload['questions']),set(CHOICES))
            return {'answers':{k:{'choice':next(iter(v)), 'confidence':.75} for k,v in CHOICES.items()}}
        result = suggest('Vídeo educativo para estudantes.',transport=transport)
        self.assertEqual(result['suggestions']['template']['value'],'classica')
        with self.assertRaises(ValueError):
            suggest('Vídeo educativo para estudantes.',transport=lambda _: {'answers':{'template':{'choice':'execute-code','confidence':1}}})

    def test_render_srt_needs_no_source_or_whisper(self):
        with tempfile.TemporaryDirectory() as tmp:
            worker = Worker(Path(tmp)/'output',Path(tmp)/'missing.bin')
            job={'id':'d'*32,'cancel':threading.Event()}
            worker.execute(job,{'operation':'renderSrt','srt':'1\n00:00:00,000 --> 00:00:01,000\nOlá mundo\n','style':{'template':'pilha'}})
            self.assertEqual(job['state'],'done',job.get('error'))
            self.assertEqual(job['result']['captions'],1)
            self.assertEqual(job['result']['srt'],Path(job['result']['files'][0]).read_text(encoding='utf-8'))
            self.assertIn('Olá mundo',Path(job['result']['files'][0]).read_text(encoding='utf-8'))

    def test_zoom_preserves_source_dimensions_and_duration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); worker=Worker(root/'output',root/'missing.bin'); source=root/'source.mp4'
            subprocess.run([worker.ffmpeg,'-v','error','-y','-f','lavfi','-i','testsrc2=s=160x90:r=25','-t','1','-c:v','libx264',str(source)],check=True)
            original=source.read_bytes()
            job={'id':'e'*32,'cancel':threading.Event()}
            worker.execute(job,{'operation':'zoom','path':str(source),'zoom':'punch'})
            self.assertEqual(job['state'],'done',job.get('error'))
            output=job['result']['files'][0]
            result=subprocess.run([worker.ffprobe,'-v','error','-show_streams','-of','json',output],capture_output=True,text=True,check=True)
            video=json.loads(result.stdout)['streams'][0]
            self.assertEqual((video['width'],video['height']),(160,90))
            self.assertAlmostEqual(float(video['duration']),1,places=2)
            self.assertEqual(original,source.read_bytes())
