---
phase: quick
plan: 260328-twj
subsystem: UI/UX
tags: [loading-state, transcription, user-feedback, interview-buddy]
dependency_graph:
  requires: []
  provides: [UX-loading-transcription]
  affects: [electron/src/hooks/useAudioRecording.ts, electron/src/App.tsx, electron/src/components/TranscriptBar.tsx]
tech_stack:
  added: []
  patterns: [state-prop-drilling, loading-indicator, reactive-ui]
key_files:
  created: []
  modified:
    - electron/src/hooks/useAudioRecording.ts
    - electron/src/App.tsx
    - electron/src/components/TranscriptBar.tsx
decisions: []
metrics:
  duration: 46 seconds
  completed_date: 2026-03-28T20:34:47Z
---

# Phase Quick Plan 260328-twj: Show a loading indicator in the Interview Buddy UI when transcription is in progress Summary

Add visual feedback to Interview Buddy's transcript bar during the transcription phase, showing users that the system is processing their audio after they release the record button.

## Overview

After releasing the push-to-talk button, users previously saw no feedback while the audio was being transcribed by the AssemblyAI API. This plan adds an `isTranscribing` state that bridges the gap between recording stop and answer generation, displaying a "Transcribing..." indicator with a spinning animation.

## Implementation Details

### Task 1: Expose isTranscribing state from useAudioRecording hook

Modified `electron/src/hooks/useAudioRecording.ts`:

- Added `isTranscribing` boolean state variable
- Set `isTranscribing=true` in `mediaRecorder.onstop` handler (when recording stops)
- Reset `isTranscribing=false` after transcription completes (success path)
- Reset `isTranscribing=false` after transcription errors (failure path)
- Reset `isTranscribing=false` when starting new recording (cleanup)
- Exported `isTranscribing` in `UseAudioRecordingReturn` interface

**Key insight:** The state must be set to `true` before the async `transcribeAudio` call begins (in the `onstop` handler) and reset to `false` in both success and error paths of `transcribeAudio` to prevent stuck states.

### Task 2: Wire isTranscribing through App and show indicator in TranscriptBar

**Modified `electron/src/App.tsx`:**
- Destructured `isTranscribing` from the `useAudioRecording()` hook
- Passed `isTranscribing={isTranscribing}` prop to `<TranscriptBar>`

**Modified `electron/src/components/TranscriptBar.tsx`:**
- Added `isTranscribing: boolean` to `TranscriptBarProps` interface
- Destructured `isTranscribing` from props
- Updated mic button styling to show accent colors during transcription (same as recording state)
- Changed mic button label: shows "WAIT" during transcription (instead of "HOLD" or "REC")
- Added spinning loader icon in mic button during transcription
- Updated transcript text area to show "Transcribing..." with a spinner when no display text exists
- Added `@keyframes spin` animation for the loading indicator

**Visual design:**
- Spinner uses `var(--accent)` color with `animation: spin 1s linear infinite`
- Text "Transcribing..." in `var(--text-muted)` color
- Mic button uses accent styling (`var(--accent-bg)` background, `var(--accent)` border)
- Layout matches existing placeholder text pattern with spinner + text side by side

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

**Files modified:**
- electron/src/hooks/useAudioRecording.ts: Added isTranscribing state ✓
- electron/src/App.tsx: Wired isTranscribing through to TranscriptBar ✓
- electron/src/components/TranscriptBar.tsx: Added visual loading indicator ✓

**Commits:**
- ff17d05: feat(260328-twj): add isTranscribing state to useAudioRecording hook ✓
- f744f4c: feat(260328-twj): wire isTranscribing to TranscriptBar with visual indicator ✓

**Verification:**
- isTranscribing boolean exported from hook: 3 occurrences (interface, state, return) ✓
- isTranscribing used in App.tsx: destructured and passed as prop ✓
- isTranscribing used in TranscriptBar.tsx: 10 occurrences (props, styling, logic) ✓

## Success Criteria Met

- [x] useAudioRecording hook exposes isTranscribing boolean state
- [x] isTranscribing is true from the moment recording stops until transcription API responds
- [x] TranscriptBar shows a visual "Transcribing..." spinner during this window
- [x] Mic button shows "WAIT" label during transcription
- [x] No new TypeScript compilation errors introduced (pre-existing errors unrelated to changes)
