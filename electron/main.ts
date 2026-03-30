import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  protocol,
  nativeTheme,
  session,
} from 'electron';
import path from 'path';
import { URL } from 'url';

// Electron extends Node's process with some extra properties at runtime.
declare const process: NodeJS.Process & { defaultApp?: boolean };

// ── Parse deep-link payload ───────────────────────────────────────────────────
interface LaunchPayload {
  token: string;
  jobId: string;
  apiUrl: string;
  jobLanguage?: string;
  referenceMaterialIds?: string[];
  activeCvId?: string;
}

function findDeepLinkArg(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith('vibehired://'));
}

function parseDeepLink(rawUrl: string): LaunchPayload | null {
  try {
    const u = new URL(rawUrl);
    const token = u.searchParams.get('token') ?? '';
    const jobId = u.searchParams.get('jobId') ?? '';
    const apiUrl = u.searchParams.get('apiUrl') ?? 'http://localhost:5001/api';
    const jobLanguage = (u.searchParams.get('jobLanguage') ?? '').toLowerCase();
    const activeCvId = (u.searchParams.get('activeCvId') ?? '').trim();
    const referenceMaterialIds = (u.searchParams.get('referenceMaterialIds') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (!token || !jobId) return null;
    return { token, jobId, apiUrl, jobLanguage, referenceMaterialIds, activeCvId };
  } catch {
    return null;
  }
}

// ── Singleton lock ────────────────────────────────────────────────────────────
// Always enforce a single instance so deep-link launches route to the
// existing Interview Buddy window instead of creating another process.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Route Chromium cache to a writable temp folder in dev to reduce
// "Unable to create cache" errors on Windows machines with restricted folders.
if (!app.isPackaged) {
  const tempBase = process.env.TEMP || process.env.TMP || process.cwd();
  app.commandLine.appendSwitch('disk-cache-dir', path.join(tempBase, 'interview-buddy-dev-cache'));
}

// ── Register custom protocol BEFORE app is ready ─────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('vibehired', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('vibehired');
}

nativeTheme.themeSource = 'dark';
app.setName('Interview Buddy');

let win: BrowserWindow | null = null;
let pendingPayload: LaunchPayload | null = null;
let contentProtectionEnabled = true;

// Windows can deliver protocol URLs to the first launched instance via argv.
// Capture early so renderer-ready can consume it after window bootstraps.
if (process.platform === 'win32') {
  const startupUrl = findDeepLinkArg(process.argv);
  if (startupUrl) {
    const startupPayload = parseDeepLink(startupUrl);
    if (startupPayload) {
      pendingPayload = startupPayload;
    }
  }
}

// ── Create the stealth overlay window ────────────────────────────────────────
function createWindow() {
  const windowIconPath = path.join(app.getAppPath(), 'assets', 'icon.png');

  const isDev = !app.isPackaged;

  win = new BrowserWindow({
    width: 480,
    height: 520,
    minWidth: 400,
    minHeight: 420,
    x: 40,
    y: 40,
    // In dev, show immediately so local runs are visible without deep-link auth.
    show: isDev,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,       // invisible on taskbar / dock
    focusable: true,
    resizable: true,
    // Keep a native resize frame on Windows even when frameless.
    // This allows edge/corner resize gestures to work reliably.
    thickFrame: process.platform === 'win32',
    hasShadow: false,
    icon: windowIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Ensure DevTools cannot be opened in production builds.
      devTools: isDev,
    },
  });

  // ── STEALTH: exclude from OS screen capture ───────────────────────────────
  // setContentProtection(true) is cross-platform in Electron 35+:
  //   Windows → SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE): invisible to Zoom, Teams, OBS
  //   macOS   → prevents any screen recording tool from capturing this window
  win.setContentProtection(contentProtectionEnabled);

  if (isDev) {
    // Use 127.0.0.1 instead of localhost to avoid CORS issues with Speech API
    win.loadURL('http://127.0.0.1:5174');
    // Open DevTools for debugging
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Defense-in-depth: ignore common DevTools shortcuts in production.
    win.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase();
      const opensDevToolsShortcut =
        key === 'f12' ||
        ((input.control || input.meta) && input.shift && key === 'i');

      if (opensDevToolsShortcut) {
        event.preventDefault();
      }
    });
  }

  win.on('closed', () => {
    win = null;
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Grant microphone permission so Web Speech API can capture audio.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media';
  });

  createWindow();
  registerGlobalShortcuts();

  // macOS: handle deep links delivered after app is ready
  app.on('open-url', (_event, rawUrl) => {
    const payload = parseDeepLink(rawUrl);
    if (payload) deliverPayload(payload);
  });
});

// Windows: deep link arrives as a second-instance argument
app.on('second-instance', (_event, argv) => {
  const rawUrl = findDeepLinkArg(argv);
  if (rawUrl) {
    const payload = parseDeepLink(rawUrl);
    if (payload) deliverPayload(payload);
  }
  // Bring focus to the existing window
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

function deliverPayload(payload: LaunchPayload) {
  if (win && win.webContents) {
    win.webContents.send('auth-payload', payload);
    win.show();
    win.focus();
  } else {
    pendingPayload = payload;
  }
}

// ── IPC: renderer signals it is ready; deliver any pending payload ────────────
ipcMain.handle('renderer-ready', () => {
  if (pendingPayload && win) {
    win.webContents.send('auth-payload', pendingPayload);
    pendingPayload = null;
    win.show();
    win.focus();
  }
});

// ── IPC: show/hide from renderer ─────────────────────────────────────────────
ipcMain.handle('toggle-visibility', () => {
  if (!win) return;
  win.isVisible() ? win.hide() : win.show();
});

ipcMain.handle('close-window', () => {
  if (!win) return;
  win.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-content-protection', () => {
  return contentProtectionEnabled;
});

ipcMain.handle('set-content-protection', (_event, enabled: boolean) => {
  contentProtectionEnabled = Boolean(enabled);
  if (win) {
    win.setContentProtection(contentProtectionEnabled);
  }
  return contentProtectionEnabled;
});

ipcMain.handle('resize-window', (_event, width: number, height: number) => {
  if (!win) return;
  const nextWidth = Math.max(400, Math.round(width));
  const nextHeight = Math.max(420, Math.round(height));
  win.setSize(nextWidth, nextHeight, true);
});

// ── Global shortcuts (OS-level, undetectable by web apps) ───────────────────
function registerGlobalShortcuts() {
  // Hide / show overlay
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });

  // Toggle listening mode
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    win?.webContents.send('hotkey', 'toggle-listening');
  });

  // Clear current answer
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    win?.webContents.send('hotkey', 'clear-answer');
  });

  // Submit captured questions to AI
  globalShortcut.register('CommandOrControl+Shift+Enter', () => {
    win?.webContents.send('hotkey', 'ask-ai');
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (win === null) createWindow();
});
