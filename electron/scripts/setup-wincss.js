#!/usr/bin/env node
/**
 * scripts/setup-wincss.js
 *
 * electron-builder downloads a winCodeSign archive to patch Windows PE
 * resources (app name, version, etc.). The archive contains macOS symlinks
 * (darwin/10.12/lib/libcrypto.dylib etc.) that Windows refuses to create
 * without Developer Mode enabled, causing 7-zip to exit with code 2 and
 * the entire build to fail.
 *
 * This script pre-populates the electron-builder winCodeSign cache with the
 * real Windows binaries (extracted via PowerShell's Expand-Archive / direct
 * 7-zip with ignore-errors flags) and creates empty placeholder files for the
 * macOS symlinks. Once the cache directory exists, electron-builder skips the
 * download + extraction on every subsequent build.
 *
 * Run once before the first build:
 *   node scripts/setup-wincss.js
 *
 * It is also called automatically via the "prepack:win" hook in package.json.
 */

'use strict';

const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const { execSync } = require('child_process');

const VERSION   = 'winCodeSign-2.6.0';
const CACHE_DIR = path.join(
  os.homedir(),
  'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign', VERSION
);
const ARCHIVE_URL =
  'https://github.com/electron-userland/electron-builder-binaries/releases/download/' +
  `${VERSION}/${VERSION}.7z`;
const SEVEN_ZIP  = path.resolve(
  __dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'
);

if (fs.existsSync(CACHE_DIR)) {
  console.log('✓ winCodeSign cache already present — skipping setup.');
  process.exit(0);
}

console.log('Setting up winCodeSign cache to avoid Windows symlink build errors…\n');
console.log('  Cache dir :', CACHE_DIR);
console.log('  Archive   :', ARCHIVE_URL);
console.log();

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    const get = (u) => {
      protocol.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total > 0) {
            const pct = Math.round((received / total) * 100);
            process.stdout.write(`  Downloading… ${pct}%\r`);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); console.log(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };

    get(url);
  });
}

(async () => {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'wcs-'));
  const archive = path.join(tmpDir, `${VERSION}.7z`);

  try {
    // 1. Download the archive
    await download(ARCHIVE_URL, archive);
    console.log('  Downloaded:', archive);

    // 2. Extract — tell 7-zip to ignore individual-file errors (exit 1 = warning, 2 = partial)
    //    We instruct it to ignore the two macOS symlinks by continuing on errors.
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    try {
      execSync(
        `"${SEVEN_ZIP}" x "${archive}" -o"${CACHE_DIR}" -y -bd -r`,
        { stdio: 'pipe', windowsHide: true }
      );
    } catch (e) {
      // Exit code 2 = "some sub-items had errors" — safe to ignore on Windows.
      // The Windows binaries (win/ subtree) extracted fine.
      if (!e.status || e.status === 1 || e.status === 2) {
        console.log('  (7-zip reported non-fatal errors for macOS symlinks — ignored)');
      } else {
        throw e;
      }
    }

    // 3. Create empty placeholders for the macOS symlinks so the dir is "complete"
    const stubs = [
      'darwin/10.12/lib/libcrypto.dylib',
      'darwin/10.12/lib/libssl.dylib',
    ];
    for (const s of stubs) {
      const p = path.join(CACHE_DIR, s);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      if (!fs.existsSync(p)) fs.writeFileSync(p, '');
    }

    console.log('\n✓ winCodeSign cache ready.');
    console.log('  Future builds will use:', CACHE_DIR);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
})().catch((err) => {
  console.error('\n✗ setup-wincss failed:', err.message);
  // Don't fail the build process — electron-builder will retry on its own.
  process.exit(0);
});
