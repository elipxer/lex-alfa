import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from processor.runtime import installed_connection, write_connection
from processor.server import Worker, handler, ThreadingHTTPServer


class RuntimeTests(unittest.TestCase):
    def test_connection_is_atomic_and_does_not_include_credentials(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            write_connection(folder,'test-token')
            data=json.loads((folder/'connection.json').read_text())
            self.assertEqual(set(data),{'token','pid','version'})
            self.assertEqual(list(folder.glob('*.tmp')),[])

    def test_discovery_verifies_local_service_and_rejects_wrong_token(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            worker=Worker(folder/'outputs',folder/'model',ffmpeg='unused',ffprobe='unused')
            server=ThreadingHTTPServer(('127.0.0.1',0),handler(worker,'right-token'))
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                with patch('processor.runtime.PORT',server.server_port):
                    write_connection(folder,'right-token')
                    self.assertEqual(installed_connection(folder)['version'],'2.1.0')
                    write_connection(folder,'wrong-token')
                    self.assertIsNone(installed_connection(folder))
            finally:
                server.shutdown();server.server_close();thread.join()
