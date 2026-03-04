// Thin type overlay for the contextBridge API exposed by preload.ts
export interface AuthPayload {
  token: string;
  jobId: string;
  apiUrl: string;
}

export type HotkeyAction = 'toggle-mic' | 'clear-answer';

interface ElectronAPI {
  signalReady: () => Promise<void>;
  onAuthPayload: (cb: (payload: AuthPayload) => void) => void;
  onHotkey: (cb: (action: HotkeyAction) => void) => void;
  toggleVisibility: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
