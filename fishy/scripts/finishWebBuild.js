/**
 * Finishes a web export so it can be served from anywhere.
 *
 * Two things the exporter leaves undone:
 *
 * 1. CanvasKit. On a device Skia is a native module; in a browser it is this
 *    WebAssembly binary, and the exporter has no idea it is needed. Without it
 *    the page loads to a blank screen.
 * 2. Absolute paths. The generated index.html points at `/_expo/...`, which is
 *    correct only at a domain root. A GitHub Pages project site lives under
 *    `/<repo>/`, where those become 404s. Rewriting them relative to the page
 *    makes one build work at any depth, which is simpler than threading a base
 *    URL through the build.
 *
 * Run as part of `npm run build:web`.
 */
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv[2] ?? 'dist';

const wasmSource = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
const wasmTarget = path.join(outDir, 'canvaskit.wasm');
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(wasmSource, wasmTarget);
console.log(
  `canvaskit.wasm -> ${wasmTarget} (${(fs.statSync(wasmTarget).size / 1024 / 1024).toFixed(1)} MB)`,
);

// With FISHY_BASE_URL set, the exporter has already written correct paths for
// that subdirectory and rewriting them would prefix them twice.
if (process.env.FISHY_BASE_URL) {
  console.log(`index.html: left as exported, base URL ${process.env.FISHY_BASE_URL}`);
} else {
  const indexPath = path.join(outDir, 'index.html');
  const before = fs.readFileSync(indexPath, 'utf8');
  const after = before.replace(/(src|href)="\/(?!\/)/g, '$1="./');
  if (after === before) {
    console.log('index.html: no absolute paths to rewrite');
  } else {
    fs.writeFileSync(indexPath, after);
    const count = (before.match(/(src|href)="\/(?!\/)/g) ?? []).length;
    console.log(`index.html: ${count} absolute path(s) made relative`);
  }
}
