#!/usr/bin/env python3
"""Loopback UI fixture. Only temporary ledgers; never reads shared_config.json."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import sys
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--helper-dir', type=Path, required=True)
args = parser.parse_args()
sys.path.insert(0, str(args.helper_dir))
import inventory_workspace
from test_studio_inventory import LEDGER

root = tempfile.TemporaryDirectory(prefix='inventory-ui-fixture-')
log = Path(root.name) / 'log.md'; meta = Path(root.name) / 'metadata.json'
config = {'device': {'dev_id': 'fixture', 'device_name': 'Fixture', 'ams_type': 3, 'ams_sn': ''}}
theme = 'dark'; fail = False

def seed(count=11):
    rows = LEDGER.split('### Print usage ledger')[0]
    for n in range(max(0, count-3)):
        amount = 'Unknown' if n == 0 else '0 g user-confirmed empty' if n == 1 else f'{10 if n == 2 else 900} g estimate; not weighed'
        location = 'AMS 1 slot 3' if n == 3 else 'Storage'
        rows += f'| SAMPLE-{n+1:03d} | PLA / Sample {n+1} #9e83c3 / Independent | 1000 g | Unknown | {amount} | {location} | Fixture only | Unknown |\n'
    log.write_text(rows + '\n### Print usage ledger\n' + LEDGER.split('### Print usage ledger')[1])
    meta.write_text(json.dumps({'rolls': {}}))
    for path in inventory_workspace.paths(meta):
        path.unlink(missing_ok=True)
seed()

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        global theme, fail
        size = int(self.headers.get('Content-Length', '0'))
        if size > 2_000_000:
            self.send_error(413); return
        body = json.loads(self.rfile.read(size))
        if self.path == '/fixture':
            if 'count' in body: seed(min(1000, max(3, int(body['count']))))
            theme = body.get('theme', theme); fail = body.get('fail', fail)
            response = {'ok': True}
        else:
            try:
                if fail: raise ValueError('Fixture backend unavailable; saved inventory retained')
                response = inventory_workspace.execute(log, meta, config, body)
                response.update(enabled=True, theme=theme)
            except (ValueError, OSError, KeyError, TypeError) as error:
                response = {'ok': False, 'enabled': True, 'error': str(error)}
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:5174')
        self.send_header('Content-Type', 'application/json')
        self.end_headers(); self.wfile.write(json.dumps(response).encode())
    def log_message(self, *_args): pass

print('Temporary inventory fixture on 127.0.0.1:8875', flush=True)
HTTPServer(('127.0.0.1', 8875), Handler).serve_forever()
