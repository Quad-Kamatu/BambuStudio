"""Install a locally built Studio binary using a compatible official Linux runtime."""
from pathlib import Path
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile

build, base, destination = map(lambda p: Path(p).resolve(), sys.argv[1:4])
source = Path(__file__).resolve().parents[1]
binary = build / 'src/bambu-studio'
if not binary.is_file():
    raise SystemExit('Build Studio and pass its tests before packaging.')
destination.parent.mkdir(parents=True, exist_ok=True)
stage = Path(tempfile.mkdtemp(prefix='runtime-stage-', dir=destination.parent))
shutil.copytree(base, stage, dirs_exist_ok=True, symlinks=True)
shutil.copy2(binary, stage / 'bin/bambu-studio')
for library in (build / 'src').glob('*.so*'):
    target = stage / 'bin' / library.name
    if target.exists() or target.is_symlink():
        target.unlink()
    if library.is_symlink():
        target.symlink_to(os.readlink(library))
    else:
        shutil.copy2(library, target)
shutil.copytree(source / 'resources', stage / 'resources', dirs_exist_ok=True, symlinks=True)
env = dict(os.environ, LD_LIBRARY_PATH=str(stage / 'bin'))
check = subprocess.run(['ldd', str(stage / 'bin/bambu-studio')], env=env, capture_output=True, text=True)
missing = [line.strip() for line in check.stdout.splitlines() if 'not found' in line]
if check.returncode or missing:
    raise SystemExit('Runtime dependency check failed: ' + '; '.join(missing))
if destination.exists():
    backup = Path(tempfile.mkdtemp(prefix='runtime-before-', dir=destination.parent))
    backup.rmdir()
    destination.rename(backup)
stage.rename(destination)
profile = Path.home() / '.config/BambuStudioFork'
launcher = Path.home() / '.local/bin/bambu-studio-fork'
launcher.parent.mkdir(parents=True, exist_ok=True)
shared_config = profile / 'filament_inventory/shared_config.json'
shared_environment = ''
if shared_config.is_file():
    settings = json.loads(shared_config.read_text())
    helper = Path(settings['helper'])
    if not helper.is_absolute() or not helper.is_file():
        raise SystemExit('Configured shared inventory helper is unavailable')
    shared_environment = (f'export BAMBU_FORK_SHARED_INVENTORY={shlex.quote(str(helper))}\n'
        f'export FILAMENT_SHARED_CONFIG={shlex.quote(str(shared_config))}\n')
launcher.write_text('#!/bin/sh\n'
    'export SSL_CERT_FILE=/etc/ssl/cert.pem\nexport CURL_CA_BUNDLE=/etc/ssl/cert.pem\n'
    'export LC_ALL=en_US.UTF-8\nexport LANG=en_US.UTF-8\n'
    f'export LD_LIBRARY_PATH={shlex.quote(str(destination / "bin"))}\n'
    f'export BAMBU_FORK_LOCAL_INVENTORY={shlex.quote(str(profile / "filament_inventory/spools.json"))}\n'
    + shared_environment +
    f'exec {shlex.quote(str(destination / "bin/bambu-studio"))} --datadir {shlex.quote(str(profile))} "$@"\n')
launcher.chmod(0o755)
desktop = Path.home() / '.local/share/applications/bambu-studio-fork.desktop'
desktop.parent.mkdir(parents=True, exist_ok=True)
desktop.write_text('[Desktop Entry]\nType=Application\nName=Bambu Studio Fork\n'
    'Comment=Local third-party filament support build\n'
    f'Exec="{launcher}" %F\nIcon={destination / "resources/images/BambuStudio_192px.png"}\n'
    'Terminal=false\nCategories=Graphics;3DGraphics;Engineering;\nStartupWMClass=BambuStudio\n')
report = dict(binary_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),
              installed_binary_sha256=hashlib.sha256((destination / 'bin/bambu-studio').read_bytes()).hexdigest(),
              source=str(source), runtime=str(destination), profile=str(profile),
              launcher=str(launcher), runtime_dependencies='PASS',
              local_inventory_cache_enabled=True, automatic_consumption_deductions=False)
report['shared_inventory_backend_enabled'] = bool(shared_environment)
report['web_resources_sha256'] = {str(p.relative_to(destination / 'resources')): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in (destination / 'resources/web/device_page/dist').rglob('*') if p.is_file() and p.suffix in ('.js', '.css', '.html')}
report['local_inventory_cache_enabled'] = not bool(shared_environment)
manifest = destination.parent / 'installed_build.json'
manifest.write_text(json.dumps(report, indent=2) + '\n')
manifest.chmod(0o600)
print('FORK_PACKAGED', destination, report['binary_sha256'])
