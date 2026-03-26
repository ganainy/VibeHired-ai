# Quick Fix: Replace Pointer Events with Mouse/Touch Events in TranscriptBar

**Problem:** Pointer Events (`onPointerDown`, `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`) are not firing reliably in Electron's transparent, frameless window. The keyboard shortcut (Ctrl+Shift+Space) works correctly, confirming the recording logic is functional.

**Root Cause:** Electron's transparent window has known issues with Pointer Events API. Mouse/Touch events are more consistently supported.

**Solution:** Replace Pointer Events with hybrid Mouse/Touch event handlers that work reliably across Electron's rendering context.

---

## Implementation Steps

### Step 1: Update Event Handler References

**File:** `electron/src/components/TranscriptBar.tsx`

**Remove these handlers (lines 24-49):**
- `handlePointerDown` - Uses `event.pointerId` and `setPointerCapture`
- `stopActivePointer` - Uses `hasPointerCapture` and `releasePointerCapture`
- `handlePointerCancel` - Pointer cancellation handler
- `activePointerIdRef` - No longer needed

**Add these handlers:**

```typescript
// Simple tracking for touch/mouse state
const isPressedRef = useRef(false);

const handleMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
  if (event.button !== 0 || isPressedRef.current) return; // Left click only
  event.preventDefault();
  isPressedRef.current = true;
  onPushStart();
}, [onPushStart]);

const handleMouseUp = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
  if (!isPressedRef.current) return;
  event.preventDefault();
  isPressedRef.current = false;
  onPushStop();
}, [onPushStop]);

const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
  if (!isPressedRef.current) return;
  event.preventDefault();
  isPressedRef.current = false;
  onPushStop();
}, [onPushStop]);

// Touch support for mobile/touch devices
const handleTouchStart = useCallback((event: React.TouchEvent<HTMLButtonElement>) => {
  if (isPressedRef.current) return;
  event.preventDefault(); // Prevent scroll/zoom
  isPressedRef.current = true;
  onPushStart();
}, [onPushStart]);

const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLButtonElement>) => {
  if (!isPressedRef.current) return;
  event.preventDefault();
  isPressedRef.current = false;
  onPushStop();
}, [onPushStop]);
```

### Step 2: Update Button Event Props

**Replace (lines 65-68):**
```typescript
onPointerDown={handlePointerDown}
onPointerUp={stopActivePointer}
onPointerCancel={handlePointerCancel}
onLostPointerCapture={handlePointerCancel}
```

**With:**
```typescript
onMouseDown={handleMouseDown}
onMouseUp={handleMouseUp}
onMouseLeave={handleMouseLeave}
onTouchStart={handleTouchStart}
onTouchEnd={handleTouchEnd}
```

### Step 3: Update Styles for Electron

**Add to button style (after line 88):**
```typescript
outline: 'none',          // Remove focus outline
WebkitAppRegion: 'no-drag', // Double-no-drag protection
```

The existing `className="no-drag"` should remain (CSS class).

---

## Electron-Specific Considerations

1. **Prevent Default Drag Behavior:**
   - `event.preventDefault()` is called on all handlers to prevent Electron's window drag
   - `className="no-drag"` is already in place - keep it
   - Consider adding `-webkit-app-region: no-drag` to the button's inline style for double protection

2. **Window Focus Issues:**
   - Transparent windows can lose focus unexpectedly
   - Mouse events are more resilient to focus changes than pointer events
   - The `isPressedRef` ensures we don't double-trigger if focus flickers

3. **Touch vs Mouse:**
   - Desktop Electron = Mouse events fire
   - Touch devices = Touch events fire
   - Using both ensures cross-device compatibility
   - `isPressedRef` prevents double-triggering if both fire (rare but possible)

---

## Testing Checklist

### Manual Testing

1. **Basic Click/Hold:**
   - [ ] Click and hold button starts recording (REC appears, pulse animation)
   - [ ] Release button stops recording and generates answer
   - [ ] Transcript text appears after release

2. **Drag Outside:**
   - [ ] Hold button, drag cursor outside button area, release → should stop recording
   - [ ] Hold button, drag cursor back, release → should stop recording

3. **Edge Cases:**
   - [ ] Rapid click-click (no hold) → should not start recording
   - [ ] Hold for <100ms → should handle gracefully (either start or no-op)
   - [ ] Hold during active recording → should ignore (already handled via `isPressedRef`)

4. **Keyboard Shortcut Still Works:**
   - [ ] Ctrl+Shift+Space still starts/stops recording
   - [ ] Both keyboard and mouse should work interchangeably

5. **Visual Feedback:**
   - [ ] Pulse animation appears when recording
   - [ ] Button color changes (accent when active)
   - [ ] "REC" / "HOLD" text toggles correctly

### Regression Testing

- [ ] Clear button still works
- [ ] Transcript text displays correctly
- [ ] No console errors in Electron DevTools
- [ ] Performance is smooth (no lag on button press)

---

## Rollback Plan

If the fix introduces new issues:
1. Git revert to current commit
2. Alternative: Add `-webkit-app-region: no-drag` inline style to existing pointer events
3. Alternative: Use `onMouseDown`/`onMouseUp` only (drop touch events)

---

## Success Criteria

- [ ] Hold button reliably starts recording on click-hold
- [ ] Release button reliably stops and generates
- [ ] Keyboard shortcut (Ctrl+Shift+Space) still works
- [ ] No console errors in Electron DevTools
- [ ] Works across multiple clicks/drags without state corruption
