# Phase 1: Pre-warmed Gemini Chat Sessions & Streaming Responses - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize the Interview Buddy's AI answer generation pipeline for real-time speed (<2 seconds). This includes: (1) pre-warming Gemini chat sessions with CV + job context before recording starts, (2) simplifying answer format to direct content only, and (3) streaming responses word-by-word to the Electron overlay. Transcription (AssemblyAI) is out of scope — only the post-transcription AI pipeline changes.

</domain>

<decisions>
## Implementation Decisions

### Chat Session Lifecycle
- **D-01:** Gemini chat session is created as a preload when the user starts the interview (launches Interview Buddy from the web app). This happens BEFORE any recording begins.
- **D-02:** The initial prompt sent during pre-seeding includes: the user's CV (selected for that job) + full job context (title, company, description, requirements).
- **D-03:** Subsequent questions are sent as short follow-up messages to the existing chat session — no re-sending of full context each time.
- **D-04:** Session is stored server-side, keyed by jobId. Session persists for the duration of the interview session.

### Answer Format & Length
- **D-05:** Remove the structured opener/keyPoints/closing JSON format. The answer should be only the direct answer content related to the question — no pre-text or after-text.
- **D-06:** Answers should be concise — short enough to read quickly during a live interview. The model should give brief, to-the-point responses.
- **D-07:** Use maxTokens to constrain output length and reduce generation time.

### CV Integration
- **D-08:** Use the CV already selected/associated with the job application. The system has `CV.getJobCv(jobApplicationId)` and `JobApplication.baseCvId` for this.
- **D-09:** The CV content (from `cvJson`) is included in the pre-seeded prompt so the AI can reference the user's actual experience in answers.

### Streaming Display (Claude's Discretion)
- **D-10:** Stream words from Gemini as they generate — the Electron overlay should display text as it arrives, not wait for the full response.
- **D-11:** Implementation approach is Claude's discretion: word-by-word streaming via SSE or chunked transfer, with the overlay updating incrementally.

### Claude's Discretion
- Exact streaming protocol (SSE vs chunked transfer encoding vs WebSocket)
- Server-side session storage mechanism (in-memory Map, Redis, etc.)
- Session expiry/cleanup strategy
- Whether to use Gemini's `responseMimeType: "text/plain"` or keep JSON parsing with streaming
- Exact word/chunk display rate in the overlay
- Error handling during mid-stream failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Interview Buddy Core
- `server/src/services/interviewService.ts` — Current answer generation logic (generateAnswer function, prompt template, job context extraction)
- `server/src/controllers/interviewController.ts` — API endpoint handlers for interview routes
- `server/src/routes/interview.ts` — Route definitions for interview API
- `electron/src/services/api.ts` — Electron-side API client (fetchAnswer function)
- `electron/src/App.tsx` — Main Electron app component (state management, hotkey handlers, triggerAnswer flow)
- `electron/src/components/OverlayPanel.tsx` — Answer display component

### Gemini Integration
- `server/src/adapters/geminiAdapter.ts` — Current Gemini adapter (no streaming/chat methods yet)
- `server/src/utils/aiService.ts` — AI service wrapper (getModelAdapter, generateStructuredResponse)
- `server/src/constants/geminiModels.ts` — Model IDs (GEMINI_FLASH, GEMINI_PRO, etc.)

### CV Data
- `server/src/models/CV.ts` — CV model with `getJobCv()` static method, `cvJson` field
- `server/src/models/JobApplication.ts` — JobApplication model with `baseCvId` field

### Transcription (context only — not changing)
- `server/src/services/transcriptionService.ts` — AssemblyAI integration
- `electron/src/hooks/useAudioRecording.ts` — Audio recording hook

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateStructuredResponse<T>()` in aiService.ts — currently used for JSON responses, may need a streaming equivalent
- `getOwnedJob()` in interviewService.ts — helper to fetch and validate job ownership
- `CV.getJobCv(jobApplicationId)` — static method to get the CV for a specific job
- `JobApplication.baseCvId` — links a job to its base CV

### Established Patterns
- `GeminiAdapter` uses `@google/generative-ai` SDK — supports `startChat()` and `generateContentStream()` natively (not yet used)
- All API calls go through Express routes → controller → service pattern
- Electron uses `fetch()` for HTTP — supports `ReadableStream` for streaming responses
- `OverlayPanel` renders answer from `AnswerResult` interface (opener/keyPoints/closing) — will need simplification

### Integration Points
- Server: new streaming endpoint or modified `/api/interview/:jobId/answer-question`
- Server: new session creation endpoint (called when interview starts)
- Electron: `fetchAnswer()` in api.ts needs streaming support
- Electron: `App.tsx` state management needs streaming state (partial answer accumulation)
- Electron: `OverlayPanel.tsx` needs to render streaming text incrementally

</code_context>

<specifics>
## Specific Ideas

- "I think we can make one continuous conversation with Gemini. We start even before recording with an initial response so that the upcoming questions are answered much faster."
- "The main thing is to have a stream of words so that the answer is faster and I don't have to wait for the whole answer to load."
- "I want to keep only the answer that is related to the question. I don't want to have a pre-text or after-text."

</specifics>

<deferred>
## Deferred Ideas

- Real-time transcription via AssemblyAI WebSocket (streaming partial transcripts while user is still speaking) — significant architecture change, separate phase
- Speculative pre-generation (start generating based on partial transcript before user stops recording) — depends on real-time transcription

</deferred>

---

*Phase: 01-interview-buddy-speed-optimization*
*Context gathered: 2026-03-28*
