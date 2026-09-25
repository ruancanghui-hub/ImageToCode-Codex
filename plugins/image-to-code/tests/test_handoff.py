import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.request
import urllib.error
import uuid

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).parents[1] / 'scripts/annotator-server.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class HandoffTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.server = bridge.Server(('127.0.0.1', 0), self.root, self.root, 'bound-task')
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        self.payload = {
            'requestId': str(uuid.uuid4()),
            'annotationJson': {'pageSlug': 'profile', 'targetStack': 'flutter',
                               'annotations': [{'type': 'regionCallout', 'calloutCopy': ['慢一点，更专注。']}]},
            'project': {'pageSlug': 'profile'},
            'source': {'type': 'image/png', 'base64': base64.b64encode(b'original').decode()},
            'annotatedPng': base64.b64encode(b'\x89PNG\r\n\x1a\nannotated').decode(),
        }

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join()
        self.temp.cleanup()

    def post(self, origin=None):
        request = urllib.request.Request(self.url + '/api/handoff',
            data=json.dumps(self.payload).encode(),
            headers={'Content-Type': 'application/json', 'Origin': origin or self.url})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    @patch.object(bridge.subprocess, 'run')
    def test_delivery_queues_saved_bundle_path_and_preserves_exact_copy(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, 'queued', '')
        status, receipt = self.post()
        self.assertEqual(status, 200)
        bundle = Path(receipt['bundlePath'])
        self.assertEqual((bundle / 'source.png').read_bytes(), b'original')
        doc = json.loads((bundle / 'annotation.json').read_text())
        self.assertEqual(doc['annotations'][0]['calloutCopy'], ['慢一点，更专注。'])
        args = run.call_args.args[0]
        self.assertEqual(args[0:4], ['codex', 'queue', '--thread', 'bound-task'])
        self.assertEqual(args, ['codex', 'queue', '--thread', 'bound-task', '--message', args[5]])
        self.assertIn(str(bundle), args[5])
        self.assertIn('Read annotated.png, source image, and annotation.json', args[5])
        self.assertIn('$original-image-design-json-to-flutter-page', args[5])
        self.assertIn('design-system-profile.json', args[5])
        self.assertEqual(self.post(), (status, receipt))
        run.assert_called_once()

    @patch.object(bridge.subprocess, 'run')
    def test_queue_failure_is_not_reported_as_sent(self, run):
        run.return_value = subprocess.CompletedProcess([], 1, '', 'task not found')
        status, receipt = self.post()
        self.assertEqual(status, 502)
        self.assertIn('task not found', receipt['error'])
        self.assertTrue((Path(receipt['bundlePath']) / 'annotated.png').exists())

    @patch.object(bridge.subprocess, 'run')
    def test_cross_origin_cannot_start_codex(self, run):
        self.assertEqual(self.post('https://example.com')[0], 403)
        run.assert_not_called()

    @patch.object(bridge.subprocess, 'run')
    def test_unsafe_path_rejected(self, run):
        self.payload['annotationJson']['pageSlug'] = '../escape'
        self.assertEqual(self.post()[0], 400)
        run.assert_not_called()

    @patch.object(bridge.subprocess, 'run')
    def test_timeout_not_automatically_resent(self, run):
        run.side_effect = subprocess.TimeoutExpired('codex', 45)
        self.assertEqual(self.post()[0], 504)
        self.assertEqual(self.post()[0], 504)
        run.assert_called_once()

    @patch.object(bridge.subprocess, 'run')
    def test_unbound_server_does_not_send(self, run):
        self.server.thread_id = ''
        self.assertEqual(self.post()[0], 409)
        run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
