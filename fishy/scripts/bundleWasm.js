/**
 * Copies the CanvasKit WebAssembly binary into a web export.
 *
 * On a device Skia is a native module. In a browser it is this file, and the
 * exporter does not know it is needed, so a web build without it loads to a
 * blank screen. Run as part of `npm run build:web`.
 */
const fs = require('node:fs');
const path = require('node:path');

const source = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm');
const outDir = process.argv[2] ?? 'dist';
const target = path.join(outDir, 'canvaskit.wasm');

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`canvaskit.wasm -> ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(1)} MB)`);
