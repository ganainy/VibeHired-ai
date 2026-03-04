import { contextBridge, ipcRenderer } from 'electron';

export interface AuthPayload {
  token: string;
  jobId: string;
  apiUrl: string;
}

export type HotkeyAction = 'toggle-mic' | 'clear-answer';

// Expose a minimal, typed API to the renderer — no direct Node/Electron access.
contextBridge.exposeInMainWorld('electronAPI', {
  /** Called once the renderer is mounted and ready to receive auth data. */
  signalReady: () => ipcRenderer.invoke('renderer-ready'),

  /** Register a callback that fires when the main process delivers the auth payload. */
  onAuthPayload: (cb: (payload: AuthPayload) => void) => {
    ipcRenderer.on('auth-payload', (_event, payload: AuthPayload) => cb(payload));
  },

  /** Register a callback for OS-level hotkey presses. */
  onHotkey: (cb: (action: HotkeyAction) => void) => {
    ipcRenderer.on('hotkey', (_event, action: HotkeyAction) => cb(action));
  },

  /** Toggle window visibility from the renderer. */
  toggleVisibility: () => ipcRenderer.invoke('toggle-visibility'),
});
