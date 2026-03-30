// Thin type overlay for the contextBridge API exposed by preload.ts
export interface AuthPayload {
  token: string;
  jobId: string;
  apiUrl: string;
  jobLanguage?: string;
  referenceMaterialIds?: string[];
  activeCvId?: string;
}

export type HotkeyAction = 'push-to-talk-start' | 'push-to-talk-stop' | 'clear-answer' | 'ask-ai' | 'toggle-listening';

interface ElectronAPI {
  signalReady: () => Promise<void>;
  onAuthPayload: (cb: (payload: AuthPayload) => void) => void;
  onHotkey: (cb: (action: HotkeyAction) => void) => void;
  toggleVisibility: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getContentProtection: () => Promise<boolean>;
  setContentProtection: (enabled: boolean) => Promise<boolean>;
  resizeWindow: (width: number, height: number) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
