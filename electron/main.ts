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
}

function parseDeepLink(rawUrl: string): LaunchPayload | null {
  try {
    const u = new URL(rawUrl);
    const token = u.searchParams.get('token') ?? '';
    const jobId = u.searchParams.get('jobId') ?? '';
    const apiUrl = u.searchParams.get('apiUrl') ?? 'http://localhost:5001/api';
    if (!token || !jobId) return null;
    return { token, jobId, apiUrl };
  } catch {
    return null;
  }
}

// ── Singleton lock ────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
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

let win: BrowserWindow | null = null;
let pendingPayload: LaunchPayload | null = null;

// ── Create the stealth overlay window ────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 520,
    x: 40,
    y: 40,
    show: false,             // start hidden; shown only after deep-link auth
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,       // invisible on taskbar / dock
    focusable: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ── STEALTH: exclude from OS screen capture ───────────────────────────────
  // setContentProtection(true) is cross-platform in Electron 35+:
  //   Windows → SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE): invisible to Zoom, Teams, OBS
  //   macOS   → prevents any screen recording tool from capturing this window
  win.setContentProtection(true);

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5174');
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
  const rawUrl = argv.find((arg) => arg.startsWith('vibehired://'));
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

// ── Global shortcuts (OS-level, undetectable by web apps) ───────────────────
function registerGlobalShortcuts() {
  // Toggle mic
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win?.webContents.send('hotkey', 'toggle-mic');
  });

  // Hide / show overlay
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!win) return;
    win.isVisible() ? win.hide() : win.show();
  });

  // Clear current answer
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    win?.webContents.send('hotkey', 'clear-answer');
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
