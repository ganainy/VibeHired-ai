---
phase: quick
plan: 260328-twj
type: execute
wave: 1
depends_on: []
files_modified:
  - electron/src/hooks/useAudioRecording.ts
  - electron/src/App.tsx
  - electron/src/components/TranscriptBar.tsx
autonomous: true
requirements: [UX-loading-transcription]
must_haves:
  truths:
    - "User sees a 'Transcribing...' indicator in the transcript bar after releasing the record button"
    - "Indicator disappears once transcription completes and answer generation begins"
    - "Indicator disappears if transcription fails with an error"
  artifacts:
    - path: "electron/src/hooks/useAudioRecording.ts"
      provides: "isTranscribing boolean state"
      contains: "isTranscribing"
    - path: "electron/src/App.tsx"
      provides: "Passes isTranscribing to TranscriptBar"
      contains: "isTranscribing"
    - path: "electron/src/components/TranscriptBar.tsx"
      provides: "Visual loading indicator during transcription"
      contains: "isTranscribing"
  key_links:
    - from: "electron/src/hooks/useAudioRecording.ts"
      to: "electron/src/App.tsx"
      via: "isTranscribing returned from hook, passed as prop"
      pattern: "isTranscribing"
    - from: "electron/src/App.tsx"
      to: "electron/src/components/TranscriptBar.tsx"
      via: "prop on TranscriptBar"
      pattern: "isTranscribing"
---

<objective>
Show a loading indicator in the Interview Buddy UI when transcription is in progress.

Purpose: After the user releases the record button, there is a silent gap while the audio blob is sent to the /transcribe API and a response comes back. The user currently sees the idle state ("Hold button to record") with no feedback. This plan adds a visible "Transcribing..." state so the user knows the system is working.

Output: A transcribing indicator in the TranscriptBar that appears between recording stop and answer generation start.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@electron/src/hooks/useAudioRecording.ts
@electron/src/App.tsx
@electron/src/components/TranscriptBar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expose isTranscribing state from useAudioRecording hook</name>
  <files>electron/src/hooks/useAudioRecording.ts</files>
  <action>
Add an `isTranscribing` boolean state to the `useAudioRecording` hook:

1. Add `const [isTranscribing, setIsTranscribing] = useState(false);` alongside existing state declarations.

2. Set `setIsTranscribing(true)` inside the `mediaRecorder.onstop` handler, right after `setIsRecording(false)` and BEFORE calling `transcribeAudio`. This marks the start of the transcription phase.

3. Set `setIsTranscribing(false)` inside `transcribeAudio`:
   - After `setTranscript(result.text)` on success (line ~127)
   - Inside the catch block after setting the error (line ~130)
   - This ensures the state resets regardless of success or failure.

4. Add `isTranscribing` to the `UseAudioRecordingReturn` interface and the returned object.

5. Also reset `isTranscribing` to false inside `startRecording` (alongside `setTranscript('')`) so it does not linger if the user starts a new recording before the previous transcription finishes.
  </action>
  <verify>
    <automated>cd "E:/VS-projects/job-app-assistant" && grep -n "isTranscribing" electron/src/hooks/useAudioRecording.ts | head -10</automated>
  </verify>
  <done>useAudioRecording exports isTranscribing boolean. It is true during the transcription API call and false otherwise.</done>
</task>

<task type="auto">
  <name>Task 2: Wire isTranscribing through App and show indicator in TranscriptBar</name>
  <files>electron/src/App.tsx, electron/src/components/TranscriptBar.tsx</files>
  <action>
**In electron/src/App.tsx:**

1. Destructure `isTranscribing` from the `useAudioRecording()` call (alongside `isRecording`, `transcript`, etc.).

2. Pass `isTranscribing={isTranscribing}` as a new prop to `<TranscriptBar>`.

**In electron/src/components/TranscriptBar.tsx:**

1. Add `isTranscribing: boolean;` to the `TranscriptBarProps` interface.

2. Destructure `isTranscribing` from props.

3. In the transcript text area (the `<div style={{ flex: 1 }}>` section, around line 199), update the fallback text logic. Currently when `displayText` is falsy:
   - If `isListening` is true: shows "Listening... speak the interview question"
   - Otherwise: shows "Hold button (or Ctrl+Shift+Space) to record"

   Add a new condition: when `isTranscribing` is true (and not `isListening`, and no `displayText`), show a transcribing indicator:
   - A small spinner (reuse the `spin` animation from OverlayPanel or the `pulse` animation already in TranscriptBar's style tag)
   - Text: "Transcribing..."
   - Style: same layout as the existing placeholder text but with a spinning indicator, using `var(--accent)` color for the spinner and `var(--text-muted)` for the text.

   Also update the mic button's label: when `isTranscribing` is true, the label below the mic icon should show "WAIT" instead of "HOLD" (same 8px font style as existing REC/HOLD label). The button border and background should use `var(--accent-bg)` and `var(--accent)` border (same as recording state but without the pulse rings).

4. Keep the existing `<style>` block. Add `@keyframes spin { to { transform: rotate(360deg); } }` if not already present (it is not in TranscriptBar currently -- add it alongside the existing `pulse-ring` keyframe).
  </action>
  <verify>
    <automated>cd "E:/VS-projects/job-app-assistant" && grep -n "isTranscribing" electron/src/App.tsx electron/src/components/TranscriptBar.tsx</automated>
  </verify>
  <done>After releasing the record button, the TranscriptBar shows a spinning indicator with "Transcribing..." text, and the mic button label reads "WAIT". This persists until transcription completes or errors out, at which point it returns to the normal idle state.</done>
</task>

</tasks>

<verification>
1. Run `cd "E:/VS-projects/job-app-assistant" && grep -n "isTranscribing" electron/src/hooks/useAudioRecording.ts electron/src/App.tsx electron/src/components/TranscriptBar.tsx` -- should show isTranscribing used in all three files.
2. Build the electron app: `cd "E:/VS-projects/job-app-assistant/electron" && npx tsc --noEmit` to verify no TypeScript errors.
</verification>

<success_criteria>
- useAudioRecording hook exposes isTranscribing boolean state
- isTranscribing is true from the moment recording stops until transcription API responds
- TranscriptBar shows a visual "Transcribing..." spinner during this window
- Mic button shows "WAIT" label during transcription
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/260328-twj-show-a-loading-indicator-in-the-intervie/260328-twj-SUMMARY.md`
</output>
