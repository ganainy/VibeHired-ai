import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'tour_dismissed_';

/**
 * Per-page tour state backed by localStorage.
 *
 * @param pageKey  Unique identifier for the page (e.g. 'dashboard').
 * @returns        `showTour` — whether the tour banner should be visible,
 *                 `dismiss`  — call this to permanently hide the tour for this page.
 */
export function usePageTour(pageKey: string): {
  showTour: boolean;
  dismiss: () => void;
} {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // localStorage unavailable — still dismiss in-memory
    }
    setDismissed(true);
  }, [storageKey]);

  return { showTour: !dismissed, dismiss };
}
