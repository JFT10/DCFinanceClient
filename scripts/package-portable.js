#!/usr/bin/env node
/**
 * scripts/package-portable.js
 *
 * Builds the Svelte frontend and assembles a zero-install portable bundle.
 *
 * Output layout:
 *   portable-release/
 *     dist/           ← production build
 *     server.js       ← tiny Node static file server (no external deps)
 *     start.sh        ← macOS / Linux launcher
 *     start.bat       ← Windows launcher
 *     key.env.example ← credential template
 *     key.env         ← user's actual key (copied only if present; gitignored)
 *     README.md       ← project readme
 *
 * Usage:
 *   node scripts/package-portable.js
 *   npm run package:portable
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'portable-release');

// ── Embedded file contents (must be defined before use) ───────────────────────

const SERVER_JS = `/**
 * server.js — zero-dependency static file server for the portable bundle.
 * Run with:  node server.js [port]
 * Default port: 1420
 */
import http from 'node:http';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.argv[2]) || 1420;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const KEY_ENV = path.join(__dirname, 'key.env');

function readKey() {
  try {
    const raw = fs.readFileSync(KEY_ENV, 'utf8');
    const match = raw.match(/^TREASURY_API_KEY=(.+)$/m);
    return match ? match[1].trim() : '';
  } catch { return ''; }
}

function writeKey(newKey) {
  const line = 'TREASURY_API_KEY=' + newKey.trim();
  let existing = '';
  try { existing = fs.readFileSync(KEY_ENV, 'utf8'); } catch {}
  const lines = existing.split(/\\r?\\n/).filter(l => !l.startsWith('TREASURY_API_KEY='));
  lines.unshift(line);
  fs.writeFileSync(KEY_ENV, lines.join('\\n') + '\\n');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Key env API
  if (url.pathname === '/__api/env-key') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ key: readKey() }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { key } = JSON.parse(body);
          writeKey(key || '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400); res.end('Bad JSON');
        }
      });
      return;
    }
  }

  // Static files
  let filePath = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html'); // SPA fallback
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`DC Finance Client running at http://localhost:\${PORT}\`);
});
`;

const START_SH = `#!/usr/bin/env bash
# DC Finance Client — portable launcher (macOS / Linux)
# Requires Node.js 18+
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=\${DC_PORT:-1420}
URL="http://localhost:$PORT"

if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install from https://nodejs.org (LTS) and retry."
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/key.env" ]; then
  if [ -f "$SCRIPT_DIR/key.env.example" ]; then
    cp "$SCRIPT_DIR/key.env.example" "$SCRIPT_DIR/key.env"
  fi
fi

echo "🚀  Starting DC Finance Client on $URL …"
node "$SCRIPT_DIR/server.js" "$PORT" &
SERVER_PID=$!

for i in $(seq 1 10); do
  sleep 0.5
  if curl -sf "$URL" > /dev/null 2>&1; then break; fi
done

if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v open &>/dev/null; then
  open "$URL"
else
  echo "Open your browser and navigate to $URL"
fi

echo "(Press Ctrl+C to stop the server)"
wait $SERVER_PID
`;

const START_BAT = `@echo off
:: DC Finance Client — portable launcher (Windows)
:: Requires Node.js 18+ (https://nodejs.org)

setlocal
set PORT=1420
set URL=http://localhost:%PORT%
set SCRIPT_DIR=%~dp0

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Install from https://nodejs.org ^(LTS^) and retry.
    pause
    exit /b 1
)

if not exist "%SCRIPT_DIR%key.env" (
    if exist "%SCRIPT_DIR%key.env.example" (
        copy "%SCRIPT_DIR%key.env.example" "%SCRIPT_DIR%key.env" >nul
    )
)

echo Starting DC Finance Client on %URL% ...
start "" /b node "%SCRIPT_DIR%server.js" %PORT%

timeout /t 2 /nobreak >nul

start "" "%URL%"

echo Server is running. Close this window to stop.
pause
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

// ── 1. Build frontend ─────────────────────────────────────────────────────────
console.log('\n[1/4] Building frontend (npm run build)…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

// ── 2. Clean / create output dir ──────────────────────────────────────────────
console.log('\n[2/4] Preparing portable-release/ directory…');
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 3. Write bundled files ─────────────────────────────────────────────────────
console.log('\n[3/4] Writing files…');

copyDir(path.join(ROOT, 'dist'), path.join(OUT, 'dist'));
copyIfExists(path.join(ROOT, 'key.env.example'), path.join(OUT, 'key.env.example'));
copyIfExists(path.join(ROOT, 'README.md'),        path.join(OUT, 'README.md'));
copyIfExists(path.join(ROOT, 'key.env'),          path.join(OUT, 'key.env'));

fs.writeFileSync(path.join(OUT, 'server.js'),  SERVER_JS);
fs.writeFileSync(path.join(OUT, 'start.sh'),   START_SH);
fs.writeFileSync(path.join(OUT, 'start.bat'),  START_BAT);
fs.chmodSync(path.join(OUT, 'start.sh'), 0o755);
// Minimal package.json so Node treats server.js as ESM (no warning)
fs.writeFileSync(
  path.join(OUT, 'package.json'),
  JSON.stringify({ name: 'dc-finance-client-portable', version: '1.0.0', private: true, type: 'module' }, null, 2) + '\n'
);

// ── 4. Done ───────────────────────────────────────────────────────────────────
console.log('\n[4/4] Done!');
console.log(`\nPortable bundle ready at: ${OUT}`);
console.log('  → Share the entire portable-release/ folder (or zip it).');
console.log('  → Users run  start.sh  (Mac/Linux) or  start.bat  (Windows).');
console.log('  → They must have Node.js ≥ 18 installed (free, one-click).\n');
