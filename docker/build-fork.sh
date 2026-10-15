#!/usr/bin/env bash
set -euo pipefail
fork_source_dir=$(cd "$(dirname "$0")/.." && pwd)
fork_build_dir=${1:?Usage: build-fork.sh /absolute/build-directory}
mkdir -p "$fork_build_dir"
mkdir -p "$fork_build_dir/node-cache"
# CMake's generated version header embeds the configure time. Keep one timestamp
# per build directory so a test-link edit does not rebuild every precompiled header.
fork_build_epoch=$(python3 - "$fork_build_dir" <<'PY'
from pathlib import Path
from datetime import datetime, timezone
import re, sys, time
root = Path(sys.argv[1])
stamp = root / 'source-date-epoch'
if not stamp.exists():
    header = root / 'src/libslic3r/libslic3r_version.h'
    match = re.search(r'SLIC3R_BUILD_TIME "(\d{8}-\d{6})"', header.read_text()) if header.exists() else None
    epoch = int(datetime.strptime(match[1], '%Y%m%d-%H%M%S').replace(tzinfo=timezone.utc).timestamp()) if match else int(time.time())
    stamp.write_text(str(epoch) + '\n')
print(stamp.read_text().strip())
PY
)
docker run --rm --name joseph-bambu-fork-builder \
  --user "$(id -u):$(id -g)" --cpus=12 --memory=64g \
  --mount "type=bind,src=$fork_source_dir,dst=/source" \
  --mount "type=bind,src=$fork_build_dir,dst=/build/app" \
  --mount "type=bind,src=$fork_build_dir/node-cache,dst=/node-cache" \
  --env CMAKE_BUILD_PARALLEL_LEVEL=12 \
  --env "SOURCE_DATE_EPOCH=$fork_build_epoch" \
  --workdir /source joseph-bambustudio-deps:2.8.4 bash -c '
    set -euo pipefail
    if [ ! -f /build/app/build.ninja ]; then
      cmake -S /source -B /build/app -G Ninja \
      -DCMAKE_PREFIX_PATH=/build/deps/destdir/usr/local \
      -DSLIC3R_STATIC=1 -DSLIC3R_GTK=3 -DCMAKE_BUILD_TYPE=Release \
      -DBBL_RELEASE_TO_PUBLIC=1 -DBBL_INTERNAL_TESTING=0 \
        -DSLIC3R_BUILD_TESTS=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5
    fi
    cmake --build /build/app --parallel 12 \
      --target BambuStudio filament_spool_resolution_tests filament_inventory_cache_tests filament_shared_ams_tests
    ctest --test-dir /build/app --output-on-failure --no-tests=error \
      -R "^filament_(spool_resolution|inventory_cache|shared_ams)_tests$"
  '
