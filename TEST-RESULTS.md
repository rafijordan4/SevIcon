# Hasil tes SevIcon 1.0.0

Dijalankan: `node test/test.js` (Node v22.22.2), 2026-10-19.

```
PASS  plugin.json valid and referenced files exist
PASS  registry: unique ids, every built-in SVG passes validation, required icons present
PASS  extension matching is case-insensitive, names and fallback work
PASS  default pack is read-only; assign/reset work on a copy
PASS  custom extension: add, assign, duplicates and bad input rejected, remove
PASS  missing icon falls back to generic file icon
PASS  SVG/image validation rejects unsafe content and accepts safe
PASS  imported icon limits and magic bytes
PASS  pack create/rename/duplicate/delete/activate/reset
PASS  export/import round trip preserves assignments and icons; never overwrites
PASS  import accepts a single wrapper folder (SevIcon-Pack/manifest.json)
PASS  import rejects malformed/unsafe archives
PASS  import skips bad icons with warnings (unsafe svg, missing file, bad assignment)
PASS  import reads real DEFLATE zips and rejects corrupted data
PASS  storage restoration, migration keeps data, corrupt data falls back safely
PASS  settings validation, export/import, reset and restore defaults
PASS  search, category filter and real stats
PASS  native CSS generator is data-URI only (no remote URLs)
PASS  built main.js loads; plugin init registers the command and unmount removes it (stubbed acode)

19 passed, 0 failed
```

## Yang TIDAK diuji
- UI/DOM (navigasi, pencarian/filter di layar, tata letak layar sempit): belum dijalankan, tidak ada browser/jsdom di lingkungan ini. Kodenya hanya lolos pemeriksaan sintaks (`node --check`).
- Instalasi dan perilaku di aplikasi Acode asli (page/WCPage, sidebarApps, fileBrowser, penyimpanan cache, native styling): belum diuji.
- Tes siklus hidup memakai stub `acode`/`editorManager`, bukan Acode sungguhan.
