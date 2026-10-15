# device_page runtime bundle

BambuStudio loads the embedded Web UI from **`dist/`** under this directory
(`file://…/web/device_page/dist/index.html` or the Debug HTTP server on port 13628).

## Source vs output

| Path | Role |
|------|------|
| `src/slic3r/GUI/DeviceWeb/device_page/` | React/TypeScript source, `package.json`, Vite config |
| `resources/web/device_page/dist/` | **Runtime bundle** (generated, gitignored) |

Do not commit `index.html` / `assets/` next to this README. Those were legacy copies and are removed.

## When `dist/` is rebuilt

CMake target `device_page_build` runs automatically before **`libslic3r_gui`**, **`BambuStudio`**, or **`BambuStudio_app_gui`** when any tracked frontend input changes (sources, locales, `public/`, lockfile, Vite/TS configs).

Manual rebuild:

```bash
cmake --build <build_dir> --target device_page_build --config Release
```

Or from the source tree:

```bash
cd src/slic3r/GUI/DeviceWeb/device_page
pnpm install
pnpm build
# then run device_page_build to copy into resources/web/device_page/dist
```

See also `src/slic3r/GUI/DeviceWeb/device_page/README.md`.


## Shared inventory workspace (fork, 2026-10-15)

The `inventory` feature is the default Filament Manager surface when the
versioned local backend capability is enabled. Other builds retain the upstream
manager. Source lives in `src/features/inventory` under the device_page project;
its route wrapper owns the host bridge. The `init` response also acknowledges
WebView health so the host does not mistake local startup for a failed page.

The companion Plasma-UI helper's `inventory_workspace.py` uses the existing
canonical register/lock, exact nullable decimal strings, field-aware conflicts,
private write-ahead transactions, idempotency keys and guarded inverse edits.
`shared_metadata.json` holds display/profile preferences only. Private sibling
`workspace_events.json` retains before/after rows and event IDs;
`workspace_pending.json` is an interrupted transaction to recover before writes.
Never commit these files. Recovery finishes only when every authority file still
matches its before or after state. A post-crash external change blocks recovery
for explicit reconciliation; do not delete the intent or restore an old whole
register to bypass that guard. Widget edits and print accounting retain their
existing canonical paths. The UI never issues printer Load, cloud inventory
writes or automatic consumption debits.

`pnpm build` checks the ordinary app plus `tsconfig.inventory.json` with
noUncheckedIndexedAccess, exactOptionalPropertyTypes and noImplicitOverride.
Legacy upstream modules have separate stricter-mode diagnostics; the new core
has no dependency on their unchecked DTOs. Scoped lint:
`pnpm exec eslint src/features/inventory/`.

For browser QA, run Vite on loopback port5174 and the repository's
`tools/inventory-fixture-server.py --helper-dir /path/to/widget/contents/code`.
Open `http://127.0.0.1:5174/?inventory-demo=1#/filament_manager`.
The server creates temporary ledgers only and never reads personal configuration.
Vite excludes this fixture transport from production bundles. Tests cover
independent physical IDs, exact/unknown stock, net/gross/tare and percentage
entries, stale edits/slots, swaps, archive/restore, retries, restart-visible
Undo, and interrupted transaction recovery/conflicts.
