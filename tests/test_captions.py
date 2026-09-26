from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
import wave
from processor.captions import TEMPLATES, build_ass, read_cues, write_click_track
from processor.server import Worker, ROOT


class CaptionTests(unittest.TestCase):
    def test_parse_and_escape_transcript(self):
        cues = read_cues('1\n00:00:00,120 --> 00:00:01,200\n<b>olá</b> {texto}\\N\n')
        self.assertEqual(cues[0][0], .12)
        ass = build_ass(cues, {'template':'classica','fonte':'Arial','cor':'#FFCC00','tamanho':14})
        self.assertIn('｛texto｝＼N', ass)
        self.assertNotIn('<b>', ass)

    def test_every_template_has_timed_events(self):
        for template in TEMPLATES:
            ass = build_ass([(0,2,'Uma frase para teste')],{'template':template},320,180)
            self.assertIn('Dialogue:', ass)
            self.assertIn('PlayResX: 320', ass)

    def test_overlay_has_transparent_background_and_visible_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            worker = Worker(folder/'output',folder/'missing.bin')
            job = {'cancel':threading.Event()}
            output = worker.render_overlay(job,[(0,.5,'Lex Alfa')],{'template':'caixa-destaque','fonte':'Arial'},folder,320,180)
            result = subprocess.run([worker.ffmpeg,'-v','error','-i',str(output),'-frames:v','1','-pix_fmt','rgba','-f','rawvideo','-'],capture_output=True,check=True)
            alpha = result.stdout[3::4]
            self.assertEqual(len(alpha),320*180)
            self.assertEqual(min(alpha),0)
            self.assertGreater(max(alpha),200)
            self.assertGreater(alpha.count(0),len(alpha)*.8)

    def test_click_track_keeps_caption_start_offsets(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)/'clicks.wav'
            write_click_track([(1,1.5,'primeiro'),(2,2.5,'segundo')],ROOT/'assets'/'sfx'/'clique.wav',output)
            with wave.open(str(output)) as audio:
                rate = audio.getframerate()
                self.assertEqual(audio.readframes(rate),bytes(rate*2))
                self.assertNotEqual(audio.readframes(rate//10),bytes((rate//10)*2))
                self.assertEqual(audio.getnframes(),round(rate*2.5))


if __name__ == '__main__':
    unittest.main()
