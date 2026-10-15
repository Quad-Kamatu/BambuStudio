#!/usr/bin/env python3
"""Loopback UI fixture. Only temporary ledgers; never reads shared_config.json."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import sys
import tempfile
import zipfile

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
    rows = LEDGER.split('### Print usage ledger')[0].replace('| BLACK-001 |', '| **BLACK-001** — original physical roll |').replace('| WHITE-001 |', '| `WHITE-001` — current white roll |')
    for n in range(max(0, count-3)):
        amount = 'Unknown' if n == 0 else '0 g user-confirmed empty' if n == 1 else f'{10 if n == 2 else 900} g estimate; not weighed'
        location = 'AMS 1 slot 3' if n == 3 else 'Storage'
        rows += f'| SAMPLE-{n+1:03d} | PLA / Sample {n+1} #9e83c3 / Independent | 1000 g | Unknown | {amount} | {location} | Fixture only | Unknown |\n'
    log.write_text(rows + '\n### Print usage ledger\n' + LEDGER.split('### Print usage ledger')[1])
    meta.write_text(json.dumps({'rolls': {}}))
    for path in inventory_workspace.paths(meta):
        path.unlink(missing_ok=True)
seed()

def print_scenario(state):
    seed()
    archive = Path(root.name) / 'fixture.3mf'
    with zipfile.ZipFile(archive, 'w') as z:
        z.writestr('Metadata/plate_1.gcode', '; fixture sliced file\nG1 E1\n')
        z.writestr('Metadata/slice_info.config', '<config><plate><metadata key="index" value="1"/><filament id="1" used_g="12.5"/></plate></config>')
    attempt = 'b' * 32
    commands = [dict(op='print_prepare', attempt=attempt, title='Fixture print_u'+attempt[:12], path=str(archive), plate=1, mapping=[0]),
                dict(op='print_bind', attempt=attempt, job_id='45678'),
                dict(op='print_observe', job_id='45678', state='RUNNING', mapping=[0])]
    if state == 'refill': commands.append(dict(op='print_observe', job_id='45678', state='RUNNING', mapping=[3], active_slot=3))
    if state != 'running': commands.append(dict(op='print_observe', job_id='45678', state='FAILED' if state == 'failed' else 'FINISH', mapping=[3] if state == 'refill' else [0]))
    for n, command in enumerate(commands):
        inventory_workspace.execute(log, meta, config, {'request_id': f'fixture-print-command-{n:04d}', 'command': {**command, 'device_id': 'fixture'}})

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
            if body.get('print') in ('running', 'complete', 'failed', 'refill'): print_scenario(body['print'])
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
