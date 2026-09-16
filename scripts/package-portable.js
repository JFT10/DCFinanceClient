#!/usr/bin/env node
/**
 * scripts/package-portable.js
 *
 * Builds the Svelte frontend and compiles server.js into a self-contained
 * native binary (no Node.js install required by end-users).
 *
 * Output — portable-release/
 *   dist/         ← Svelte production build
 *   server        ← compiled native binary (macOS/Linux)
 *   server.exe    ← compiled native binary (Windows)
 *   start.sh      ← macOS/Linux launcher  (just runs ./server)
 *   start.bat     ← Windows launcher       (just runs server.exe)
 *   key.env       ← user key (copied if present)
 *   key.env.example
 *   README.md
 *   package.json  ← marks bundle as ESM (used during pkg compilation only)
 *
 * Usage:
 *   npm run package:portable            ← current platform only
 *   CI calls this per-platform runner
 */

import { execSync } from 'node:child_process';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'portable-release');

// ── Platform detection ────────────────────────────────────────────────────────
const PLAT = process.platform;           // 'darwin' | 'linux' | 'win32'
const ARCH = process.arch;               // 'x64' | 'arm64'

let pkgTarget, serverBin, isWindows;
if (PLAT === 'win32') {
  pkgTarget  = 'node20-win-x64';
  serverBin  = 'server.exe';
  isWindows  = true;
} else if (PLAT === 'darwin') {
  pkgTarget  = `node20-macos-${ARCH}`;
  serverBin  = 'server';
  isWindows  = false;
} else {
  pkgTarget  = `node20-linux-${ARCH}`;
  serverBin  = 'server';
  isWindows  = false;
}

// ── Embedded server source (CommonJS — required for pkg compatibility) ────────
// Written to OUT so pkg can compile it, then removed after compilation.

const SERVER_JS = `'use strict';
/**
 * server.js — zero-dependency static file server for the portable bundle.
 * Compiled to a native binary via @yao-pkg/pkg; users never run this directly.
 * Run with:  ./server [port]    (or server.exe on Windows)
 * Default port: 1420
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

// Inside a pkg binary process.pkg is defined; use execPath dir for on-disk files
const EXEC_DIR = typeof process.pkg !== 'undefined'
  ? path.dirname(process.execPath)
  : __dirname;

const DIST    = path.join(EXEC_DIR, 'dist');
const KEY_ENV = path.join(EXEC_DIR, 'key.env');
const PORT    = Number(process.argv[2]) || 1420;

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.ico':   'image/x-icon',
  '.json':  'application/json',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

function readKey() {
  try {
    const raw   = fs.readFileSync(KEY_ENV, 'utf8');
    const match = raw.match(/^TREASURY_API_KEY=(.+)$/m);
    return match ? match[1].trim() : '';
  } catch (e) { return ''; }
}

function writeKey(newKey) {
  const line = 'TREASURY_API_KEY=' + newKey.trim();
  let existing = '';
  try { existing = fs.readFileSync(KEY_ENV, 'utf8'); } catch (e) {}
  const lines = existing.split(/\\r?\\n/).filter(function(l) { return !l.startsWith('TREASURY_API_KEY='); });
  lines.unshift(line);
  fs.writeFileSync(KEY_ENV, lines.join('\\n') + '\\n');
}

http.createServer(function(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__api/env-key') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ key: readKey() }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', function(c) { body += c; });
      req.on('end', function() {
        try {
          const parsed = JSON.parse(body);
          writeKey(parsed.key || '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) { res.writeHead(400); res.end('Bad JSON'); }
      });
      return;
    }
  }

  let filePath = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, '127.0.0.1', function() {
  console.log('DC Finance Client running at http://localhost:' + PORT);
});
`;

// Launchers — no Node.js check needed; binary is self-contained
const START_SH = `#!/usr/bin/env bash
# DC Finance Client — portable launcher (macOS / Linux)
# No external dependencies required.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=\${DC_PORT:-1420}
URL="http://localhost:$PORT"

chmod +x "$SCRIPT_DIR/server" 2>/dev/null || true

echo "Starting DC Finance Client on $URL ..."
"$SCRIPT_DIR/server" "$PORT" &
SERVER_PID=$!

# Give the server a moment to bind
sleep 1

# Open in default browser
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v open &>/dev/null; then
  open "$URL"
else
  echo "Open your browser and go to $URL"
fi

echo "(Press Ctrl+C to stop)"
wait $SERVER_PID
`;

const START_BAT = `@echo off
:: DC Finance Client — portable launcher (Windows)
:: No external dependencies required.
setlocal
set PORT=1420
set SCRIPT_DIR=%~dp0
set URL=http://localhost:%PORT%

echo Starting DC Finance Client on %URL% ...
start "" /b "%SCRIPT_DIR%server.exe" %PORT%
timeout /t 1 /nobreak >nul
start "" "%URL%"
echo Server is running. Close this window to stop.
pause
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

// ── 1. Build frontend ─────────────────────────────────────────────────────────
console.log('\n[1/5] Building frontend (npm run build)…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

// ── 2. Prepare output dir ─────────────────────────────────────────────────────
console.log('\n[2/5] Preparing portable-release/ directory…');
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 3. Stage server source + pkg-required package.json ───────────────────────
console.log('\n[3/5] Staging server source…');
fs.writeFileSync(path.join(OUT, 'server.js'), SERVER_JS);
fs.writeFileSync(
  path.join(OUT, 'package.json'),
  JSON.stringify({ name: 'dc-finance-server', version: '1.0.0', private: true, type: 'commonjs' }, null, 2) + '\n'
);

// ── 4. Compile server.js → native binary ─────────────────────────────────────
console.log(`\n[4/5] Compiling server.js for ${pkgTarget} (this may download a Node binary the first time)…`);
execSync(
  `node "${path.join(ROOT, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js')}" server.js --target ${pkgTarget} --output server`,
  { cwd: OUT, stdio: 'inherit' }
);

// Remove source files — users only need the binary
fs.rmSync(path.join(OUT, 'server.js'));
fs.rmSync(path.join(OUT, 'package.json'));

// ── 5. Copy assets and write launchers ───────────────────────────────────────
console.log('\n[5/5] Copying assets and writing launchers…');
copyDir(path.join(ROOT, 'dist'), path.join(OUT, 'dist'));
copyIfExists(path.join(ROOT, 'key.env.example'), path.join(OUT, 'key.env.example'));
copyIfExists(path.join(ROOT, 'README.md'),        path.join(OUT, 'README.md'));
copyIfExists(path.join(ROOT, 'key.env'),          path.join(OUT, 'key.env'));

if (isWindows) {
  fs.writeFileSync(path.join(OUT, 'start.bat'), START_BAT);
} else {
  fs.writeFileSync(path.join(OUT, 'start.sh'), START_SH);
  fs.chmodSync(path.join(OUT, 'start.sh'), 0o755);
  fs.chmodSync(path.join(OUT, 'server'), 0o755);
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log('\n✅  Done!');
console.log(`\nPortable bundle ready at: ${OUT}`);
console.log('  → Zip and share the entire portable-release/ folder.');
console.log('  → macOS/Linux: run  ./start.sh');
console.log('  → Windows:     run  start.bat');
console.log('  → No Node.js or any other install required.\n');
