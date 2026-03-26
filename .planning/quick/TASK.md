# Deep Debug: Hold Button Still Stops Immediately

## Problem
Hold button still stops listening immediately after starting, even after the document-level mouseup fix.

## Investigation Needed

1. **App.tsx flow** - Check if something in App.tsx is stopping the recording
2. **useSpeechRecognition** - Check if the hook itself is stopping the recognition
3. **IPC handlers** - Check if main process hotkey handlers are interfering
4. **Speech recognition errors** - Check if recognition is failing and stopping itself

## Hypotheses

1. **Speech recognition auto-stops** - Chromium's SpeechRecognition might be auto-stopping due to permissions or errors
2. **Multiple stop calls** - Something else in the code is calling `stopListening`
3. **State race condition** - `isListeningRef` vs `isListening` state mismatch
4. **Main process interference** - IPC handlers might be sending stop signals

## Files to Deep Dive

- `electron/src/App.tsx` - Recording state management
- `electron/src/hooks/useSpeechRecognition.ts` - Recognition lifecycle
- `electron/main.ts` - IPC hotkey handlers
- Browser console logs for errors
