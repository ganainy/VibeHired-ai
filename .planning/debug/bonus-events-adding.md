---
status: awaiting_human_verify
trigger: "In /work-tracker, the logic to add bonus events is not working. When adding a bonus, it doesn't appear and doesn't get applied to shifters that have the prerequisites for that bonus."
created: 2026-04-29T00:00:00Z
updated: 2026-04-29T00:35:00Z
---

## Current Focus

hypothesis: CONFIRMED - Bonus input fields inside the main form cause Enter key to submit the form instead of adding the bonus. Also added useRef for defensive access to bonuses state.
test: Added onKeyDown handler on bonus section to intercept Enter key and call handleAddBonus instead. Also use bonusesRef in handleSubmit.
expecting: Bonuses now correctly added when user presses Enter in bonus fields, and handleSubmit reads latest bonuses via ref
next_action: User verifies the fix works end-to-end

## Symptoms

expected: When a user adds a bonus event, it should appear in the UI and get applied to eligible shifters that meet the bonus prerequisites
actual: After adding a bonus, nothing appears — the bonus is not saved and not applied to any shifters
errors: No errors at all — silent failure
reproduction: Go to work-tracker page, attempt to add a bonus event
timeline: Feature has never worked — this appears to be a bug in initial implementation

## Eliminated

- hypothesis: Missing fetchEntries() after employer save was the PRIMARY issue
  evidence: User verified that the server receives bonuses as "[]" — the data never reaches the server at all. The fetchEntries fix addressed a secondary issue (stale display after save), but the primary problem is that bonus data is not sent from the frontend form.
  timestamp: 2026-04-29T00:15:00Z

## Evidence

- timestamp: 2026-04-29T00:15:00Z
  checked: Server logs from user checkpoint response
  found: |
    Server log shows `[parseBonuses] Input type: string | value preview: "[]"` — the server receives bonuses as the literal string "[]", which parses to an empty array. This means the frontend form is sending an empty bonuses array in the multipart/form-data PUT request.
  implication: The primary bug is in the frontend — the EmployerModal's handleSubmit constructs FormData with bonuses as "[]" instead of the actual bonus data.

- timestamp: 2026-04-29T00:25:00Z
  checked: EmployerModal JSX structure - bonus input fields relative to the <form> element
  found: |
    The bonus input fields (name text input at line 1965, multiplier number input at line 1975) are INSIDE the <form onSubmit={handleSubmit}> element. When a user focuses on these inputs and presses Enter, the browser submits the form. This calls handleSubmit with the current bonuses state, which doesn't include the bonus the user was typing (because handleAddBonus was never called).
  implication: This is the root cause. The user fills in bonus fields, presses Enter (expecting to "add" the bonus), but instead submits the entire employer form with empty bonuses.

- timestamp: 2026-04-29T00:01:00Z
  checked: Full code flow from client bonus addition through server persistence to display
  found: |
    Bonus data flow:
    - Client: EmployerModal handleAddBonus() adds bonus to local state
    - Client: handleSubmit() serializes bonuses as JSON in FormData, sends to PUT /api/employers/:id
    - Server: parseBonuses() parses JSON string, validates fields, returns array
    - Server: employer.bonuses = parseBonuses(req.body.bonuses) + employer.markModified('bonuses')
    - Server: employer.save() persists to MongoDB
    - Client: handleEmployerSaved() updates employers state with server response, does NOT call fetchEntries()
    - Entry display: Uses entry.employerId.bonuses from populated data (stale if entries not re-fetched)
    - Sidebar earnings: Uses employers state (updated after save, should be correct)
    - Entry card bonuses: Uses entry.employerId.bonuses from populated data (stale)
  implication: After employer save, entries are NOT re-fetched, so they still have old populated employer data without new bonuses

- timestamp: 2026-04-29T00:02:00Z
  checked: Server-side parseBonuses function and employer save logic
  found: |
    parseBonuses() appears correct: parses JSON string, validates each field, filters out entries with empty names.
    Server PUT route calls employer.markModified('bonuses') which is needed for Mongoose subdocument arrays.
    Server returns the full employer document including bonuses.
  implication: Server-side persistence likely works correctly, but needs logging to verify

- timestamp: 2026-04-29T00:03:00Z
  checked: handleEmployerSaved callback
  found: |
    handleEmployerSaved updates employers state but does NOT call fetchEntries().
    This means existing entries keep their stale populated employer data.
    The entries would show bonuses from the populated data at fetch time, not the current employer data.
  implication: Missing fetchEntries() call is a definite bug causing stale bonus display in entries

- timestamp: 2026-04-29T00:04:00Z
  checked: Server GET /api/work-tracker population
  found: |
    Line 127: .populate('employerId', 'name logoUrl hourlyRate bonuses')
    The bonuses field IS included in the population, so if entries are re-fetched after bonus save, they should have the correct data.
  implication: The fix of adding fetchEntries() to handleEmployerSaved should fully resolve the stale data issue

## Resolution

root_cause: Two issues found. (1) PRIMARY: The bonus input fields (name, multiplier) are inside the main <form> element in EmployerModal. When a user types a bonus name or multiplier and presses Enter (a natural interaction pattern), the browser submits the entire form via the <form onSubmit={handleSubmit}> handler instead of calling handleAddBonus(). This sends the form with the CURRENT bonuses state (which hasn't been updated because handleAddBonus was never called), resulting in "[]" being sent to the server. (2) SECONDARY: After an employer is saved, fetchEntries() was not called, causing stale populated employer data in entries.
fix: |
  1. Added onKeyDown handler on the bonus section container div that intercepts Enter key presses (except in textarea) and calls handleAddBonus() instead of allowing form submission.
  2. Added bonusesRef (useRef) to track latest bonuses value and use it in handleSubmit for defensive access.
  3. Added enhanced logging in handleSubmit to show both state and ref bonus counts, the JSON being sent, and the FormData content.
  4. (Previously applied) Added fetchEntries() to handleEmployerSaved() for stale data issue.
verification: (pending user verification)
files_changed:
  - client/src/pages/WorkTrackerPage.tsx
