#!/usr/bin/env node
/**
 * register-protocol.js
 *
 * Manually registers the vibehired:// custom URL protocol in the Windows registry.
 * Run this once after npm run pack:win, from an elevated command prompt:
 *
 *   node scripts/register-protocol.js
 *
 * This is only needed when using the unpacked (--dir) build, since the NSIS
 * installer registers the protocol automatically.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

if (os.platform() !== 'win32') {
  console.log('Protocol registration via registry is Windows-only.');
  console.log('On macOS, Info.plist handles vibehired:// via CFBundleURLSchemes.');
  process.exit(0);
}

// Locate the RuntimeBroker.exe in the unpacked release directory
const rootDir = path.resolve(__dirname, '..');
const exePath = path.join(rootDir, 'release', 'win-unpacked', 'RuntimeBroker.exe');

if (!fs.existsSync(exePath)) {
  console.error(`\nCannot find the built executable at:\n  ${exePath}\n`);
  console.error('Run "npm run pack:win" first, then re-run this script.');
  process.exit(1);
}

const regKey = 'HKEY_CURRENT_USER\\Software\\Classes\\vibehired';

const commands = [
  `reg add "${regKey}"                               /ve /d "URL:VibeHired Interview Buddy" /f`,
  `reg add "${regKey}"                               /v "URL Protocol" /d "" /f`,
  `reg add "${regKey}\\DefaultIcon"                  /ve /d "${exePath},1" /f`,
  `reg add "${regKey}\\shell"                        /ve /d "" /f`,
  `reg add "${regKey}\\shell\\open"                  /ve /d "" /f`,
  `reg add "${regKey}\\shell\\open\\command"         /ve /d "\\"${exePath}\\" \\"%1\\"" /f`,
];

console.log(`\nRegistering vibehired:// protocol for:\n  ${exePath}\n`);

try {
  for (const cmd of commands) {
    execSync(cmd, { stdio: 'pipe' });
  }
  console.log('✓ Protocol registered successfully.\n');
  console.log('You can now click "Launch Interview Buddy" in VibeHired and the app will open automatically.');
} catch (err) {
  console.error('\n✗ Failed to register protocol:', err.message);
  console.error('Try running this script from an elevated (administrator) command prompt.');
  process.exit(1);
}
