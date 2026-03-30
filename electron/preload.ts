import { contextBridge, ipcRenderer } from 'electron';

export interface AuthPayload {
  token: string;
  jobId: string;
  apiUrl: string;
  jobLanguage?: string;
  referenceMaterialIds?: string[];
  activeCvId?: string;
}

export type HotkeyAction = 'push-to-talk-start' | 'push-to-talk-stop' | 'clear-answer' | 'ask-ai' | 'toggle-listening';

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

  /** Close the overlay window and quit the desktop app. */
  closeWindow: () => ipcRenderer.invoke('close-window'),

  /** Read whether overlay capture protection is currently enabled. */
  getContentProtection: () => ipcRenderer.invoke('get-content-protection') as Promise<boolean>,

  /** Toggle whether this window is excluded from screenshots/screen-share. */
  setContentProtection: (enabled: boolean) => ipcRenderer.invoke('set-content-protection', enabled) as Promise<boolean>,

  /** Resize the overlay window to explicit dimensions. */
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),
});
