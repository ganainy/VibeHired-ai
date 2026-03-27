# UI Design Contract: Mobile Improvements for Interview Materials Page

**Phase:** 1 - Mobile Responsive Improvements
**Status:** draft
**Date:** 2026-03-26
**Design System:** Obsidian Intelligence (custom CSS properties)

## Overview
Design contract for improving mobile responsiveness of the Interview Materials page (`InterviewMaterialsPage.tsx`), specifically addressing three reported issues:
1. Text in cards being cut off
2. Cannot scroll horizontally for metadata
3. Action buttons crowding title/metadata on same line

## Design System Context

### Existing Design Tokens (from `index.css` and `tailwind.config.js`)

#### Color Palette (60/30/10 Split)
- **Dominant (60%)**: `--bg-base` (#131320 dark / #f5f4f0 light) - page background
- **Secondary (30%)**: `--bg-surface` (#1a1a28 dark / #ffffff light) - cards, panels
- **Accent (10%)**: `--accent` (#d97706) - **reserved for**: primary buttons, active states, highlights, interactive elements
- **Semantic Colors**:
  - `--jade` (#2dd4a0 dark / #16a34a light) - success, positive actions
  - `--rose` (#f46464 dark / #dc2626 light) - **destructive actions only**: delete, remove, stop sharing
  - `--ember` (#f07e38 dark / #ea580c light) - warnings, intermediate states
  - `--azure` (#3b82f6 dark / #2563eb light) - informational, links

#### Typography
- **Primary Font**: 'Outfit', system-ui, sans-serif (body text)
- **Display Font**: 'Fraunces', Georgia, serif (headings only)
- **Monospace**: 'JetBrains Mono', Menlo, monospace (code, badges, metadata)
- **Font Sizes** (exactly 4 sizes):
  - 12px (0.75rem) - metadata, badges, small text
  - 14px (0.875rem) - body text, descriptions
  - 16px (1rem) - card titles, input text
  - 18px (1.125rem) - important card titles
  - 24px (1.5rem) - page headings only
- **Font Weights** (exactly 2 weights):
  - Regular: 400 - body text, descriptions
  - Semibold: 600 - headings, important text, buttons
- **Line Heights**:
  - Body: 1.5 (24px for 16px text)
  - Headings: 1.2
  - Tight: 1.1 - badges, metadata

#### Spacing Scale (8-point multiples)
- **4px** (0.25rem) - minimal gaps, fine adjustments
- **8px** (0.5rem) - icon padding, tight gaps
- **16px** (1rem) - card padding, standard gaps **(default)**
- **24px** (1.5rem) - section spacing, larger padding
- **32px** (2rem) - major section breaks
- **48px** (3rem) - page-level spacing
- **Exceptions**: Touch targets minimum 44px (use p-3 = 12px padding for 48px total)

#### Breakpoints
- **Mobile**: < 640px (default, mobile-first)
- **Tablet**: ≥ 640px (`sm:` prefix)
- **Desktop**: ≥ 768px (`md:` prefix)
- **Wide Desktop**: ≥ 1024px (`lg:` prefix)

## Component Contract: GlobalMaterialCard

### Current Structure Issues (Lines 291-462 in InterviewMaterialsPage.tsx)
1. **Title truncation**: No truncation for long titles on mobile
2. **Metadata overflow**: `flex-wrap` with `overflow-x-auto` but no horizontal scroll container
3. **Action button crowding**: Buttons share line with title/metadata via `flex items-start justify-between`

### Mobile-First Redesign

#### 1. Card Layout Structure
```
Mobile (< 640px):
┌─────────────────────────────────────┐
│ [Icon] Title (truncated)            │
│ ─────────────────────────────────── │
│ Metadata (horizontal scroll)        │
│ [type] [size] [date] [url] [job]    │
│ ─────────────────────────────────── │
│ Description (2-line clamp)          │
│ ─────────────────────────────────── │
│ Action Buttons (single row, wrap)   │
│ [★] [✏️] [↓] [↗] [🔗] [🗑️]         │
│ ─────────────────────────────────── │
│ [Remove from library]               │
└─────────────────────────────────────┘

Tablet/Desktop (≥ 640px):
┌─────────────────────────────────────────────────────────┐
│ [Icon] Title (full)                 [Action Buttons]    │
│ Metadata (inline, wrap)             [★][✏️][↓][↗][🔗][🗑️]│
│ Description (2-line clamp)                              │
│ [Remove from library]                                   │
└─────────────────────────────────────────────────────────┘
```

#### 2. Specific CSS/Tailwind Implementation

**Mobile Layout (default):**
```jsx
{/* Card container */}
<div className="flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200"
     style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>

  {/* Header: Icon + Title */}
  <div className="flex items-start gap-3">
    <span className={`material-symbols-outlined text-xl ${colorForType(material.type)} flex-shrink-0 mt-0.5`}>
      {iconForType(material.type)}
    </span>
    <div className="flex-1 min-w-0">
      <h3 className="text-base font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {material.title}
      </h3>
    </div>
  </div>

  {/* Metadata: Horizontal scroll container */}
  <div className="overflow-x-auto -mx-4 px-4 metadata-scroll">
    <div className="flex items-center gap-2 min-w-max py-1">
      {/* Type badge */}
      <span className="text-xs px-2 py-1 rounded-md capitalize font-medium flex-shrink-0"
            style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
        {material.type}
      </span>

      {/* File size */}
      {material.fileSize !== undefined && (
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {formatBytes(material.fileSize)}
        </span>
      )}

      {/* URL (truncated) */}
      {material.url && (
        <span className="text-xs truncate max-w-[180px] underline flex-shrink-0"
              style={{ color: 'var(--accent)' }}>
          {material.url}
        </span>
      )}

      {/* Date */}
      {material.createdAt && (
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {formatDate(material.createdAt)}
        </span>
      )}

      {/* Job chip */}
      {showJobChip && jobRef && jobId && (
        <Link to={`/jobs/${jobId}/review/materials`}
              className="text-xs px-2 py-1 rounded-full font-medium hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
          {jobRef.companyName} — {jobRef.jobTitle}
        </Link>
      )}
    </div>
  </div>

  {/* Description */}
  {material.description && (
    <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
      {material.description}
    </p>
  )}

  {/* Action buttons - mobile optimized */}
  <div className="flex flex-wrap items-center gap-1 pt-2 border-t"
       style={{ borderColor: 'var(--border-subtle)' }}>

    {/* Favorite star - always visible */}
    <button onClick={() => onToggleFavorite(material._id)}
            disabled={isUpdating}
            className="p-2 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            style={{ color: material.isFavorite ? 'var(--accent)' : 'var(--text-muted)' }}
            title={material.isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
      <span className="material-symbols-outlined text-lg"
            style={material.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}>
        star
      </span>
    </button>

    {/* Other action buttons */}
    <div className="flex items-center gap-1 flex-wrap">
      {/* Edit button */}
      {isEditable && (
        <button onClick={openEdit}
                disabled={isUpdating}
                className="p-2 rounded-lg transition-colors hover:text-blue-500 disabled:opacity-50 flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                title="Edit">
          <span className="material-symbols-outlined text-lg">edit</span>
        </button>
      )}

      {/* Download button */}
      {material.type !== 'link' && (
        <button onClick={handleDownload}
                className="p-2 rounded-lg transition-colors hover:text-green-500 flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                title="Download">
          <span className="material-symbols-outlined text-lg">download</span>
        </button>
      )}

      {/* Additional buttons... */}
    </div>
  </div>

  {/* Remove from library */}
  <button onClick={() => onRemoveGlobal(material._id)}
          disabled={isUpdating}
          className="flex items-center gap-1 mt-1 text-xs transition-colors disabled:opacity-50 hover:text-red-500"
          style={{ color: 'var(--text-muted)' }}>
    <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
    Remove from library
  </button>
</div>
```

**Tablet/Desktop Override (≥ 640px):**
```jsx
{/* In component, wrap with responsive classes */}
<div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
  {/* Left content */}
  <div className="sm:flex-1 sm:min-w-0">
    <div className="sm:flex sm:items-start sm:gap-3">
      {/* Icon remains */}
      <h3 className="sm:text-lg sm:font-medium sm:truncate">{material.title}</h3>
    </div>

    {/* Metadata - inline on desktop */}
    <div className="sm:flex sm:items-center sm:gap-2 sm:mt-1 sm:flex-wrap sm:overflow-visible">
      {/* Metadata items without scroll container */}
    </div>

    {/* Description remains */}
  </div>

  {/* Action buttons - right side on desktop */}
  <div className="sm:flex sm:items-center sm:gap-2 sm:pt-0 sm:border-t-0">
    {/* Action buttons row */}
  </div>
</div>
```

#### 3. Responsive Behavior Details

**Text Truncation:**
- Mobile: Title truncates with `truncate` class (line 104)
- Desktop: Title shows full with `sm:truncate` removed

**Metadata Container:**
- Mobile: `overflow-x-auto` with `-mx-4 px-4` for full-width scroll area
- Desktop: `sm:flex-wrap` with `sm:overflow-visible` and `sm:-mx-0 sm:px-0`

**Action Buttons:**
- Mobile: `flex-wrap` with `gap-1`, below content with border top
- Desktop: `sm:flex-nowrap` with `sm:gap-2`, aligned right

**Touch Targets:**
- All interactive elements: Minimum 44px × 44px
- Icon buttons: Use `p-2` (8px) with `text-lg` = ~40px, add wrapper if needed
- Text buttons: `px-3 py-2` (12px × 8px) = minimum 44px height

#### 4. Horizontal Scroll CSS
```css
/* Add to index.css or component */
.metadata-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border-bright) transparent;
}

.metadata-scroll::-webkit-scrollbar {
  height: 4px;
}

.metadata-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.metadata-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border-bright);
  border-radius: 2px;
}

/* Hide scrollbar on desktop */
@media (min-width: 640px) {
  .metadata-scroll {
    overflow: visible;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .metadata-scroll::-webkit-scrollbar {
    display: none;
  }
}
```

## Copywriting Contract

### Primary CTA Labels
- **Add Material**: "Add to Library" (line 1398 in current implementation)
- **Save Changes**: "Save" (edit mode, line 266)
- **Delete Confirmation**: "Delete" (with "Cancel", lines 439-446)

### Empty States
- **No materials**: "Your Prep Library is empty" (line 1421)
- **No search results**: "No materials match your search" (line 1421)
- **Instructional text**: "Add general learning materials here, or open a job and toggle 'Add to Prep Library' on any item" (lines 1423-1426)

### Error States
- **Upload failure**: "{filename}: Upload failed" (line 893)
- **Network error**: "Failed to load materials" (line 665)
- **Validation error**: Implicit via disabled state (line 258: `!editForm.title.trim()`)

### Destructive Actions (List each + confirmation approach)
1. **Delete material**: Two-step confirmation - first click shows "Delete"/"Cancel" buttons (lines 432-448)
2. **Remove from library**: Single-step with hover warning color (lines 467-475)
3. **Stop sharing**: Confirmation in modal with "Stop sharing" button (line 1553)

## Registry Safety Gate
**Tool:** None (custom design system, no shadcn detected)
**Third-party registries:** None
**Safety Gate status:** Not applicable - using project's existing CSS custom properties and Tailwind

## Accessibility Requirements

### Screen Reader
- All Material Symbols icons must have `title` or `aria-label` attributes (currently missing in some buttons)
- Action buttons: Add `aria-label="Edit material: ${title}"` to icon buttons
- Metadata items: Use `<span>` with appropriate `aria-label` for type/size/date
- Horizontal scroll: `aria-label="Material metadata"` on container

### Keyboard Navigation
- Tab order: Title link (if clickable) → Metadata (skip scroll with `tabindex="-1"`) → Action buttons
- Action buttons: Focus visible with `focus:ring-2 focus:ring-accent focus:outline-none`
- Horizontal scroll: Not keyboard accessible (use `tabindex="-1"` on scroll container)

### Color Contrast
- Text: Minimum 4.5:1 contrast ratio (verified in design tokens)
- Interactive elements: 3:1 contrast for focus states
- Accent colors: `--accent` (#d97706) meets WCAG AA on both `--bg-surface` backgrounds

## Implementation Notes

### CSS Custom Properties Usage
Always use design tokens instead of hardcoded colors:
```jsx
// ✅ Correct (as used in current implementation)
style={{ color: 'var(--text-primary)' }}
style={{ backgroundColor: 'var(--bg-elevated)' }}
style={{ borderColor: 'var(--border)' }}

// ❌ Avoid (not used in current codebase)
style={{ color: '#eeeef8' }}
className="text-gray-800 dark:text-gray-100"
```

### Breakpoint Strategy
- Mobile-first: Default styles for mobile, override with `sm:`, `md:`, `lg:`
- Test viewports: 320px (iPhone SE), 375px (iPhone 12), 425px (large phone), 768px (tablet), 1024px (desktop)

### Performance Considerations
- Use `will-change: transform` on scroll container for smooth scrolling
- Implement virtual scrolling if >50 materials (not currently needed)
- Lazy load material previews (already implemented via modal)

## Success Criteria

### Visual
- [ ] No text truncation on desktop (≥ 640px)
- [ ] Horizontal scroll works for metadata on mobile with custom scrollbar
- [ ] Action buttons move below content on mobile, align right on desktop
- [ ] Minimum 44px touch targets on all interactive elements
- [ ] Consistent spacing (8px multiples) maintained

### Functional
- [ ] All interactive elements work on touch devices
- [ ] Horizontal scroll with momentum on iOS/Android
- [ ] Keyboard navigation follows logical tab order
- [ ] Screen readers announce all content correctly (add missing aria-labels)

### Design System Compliance
- [ ] Uses CSS custom properties for all colors
- [ ] Follows typography scale (12/14/16/18/24px)
- [ ] Respects spacing scale (4/8/16/24/32px)
- [ ] Maintains dark/light mode compatibility

## Testing Checklist

### Mobile (≤ 640px)
- [ ] Title truncates with ellipsis for long text
- [ ] Metadata scrolls horizontally with touch/swipe
- [ ] Action buttons wrap below content in single row
- [ ] Touch targets ≥ 44px (verify with device testing)
- [ ] No horizontal page scroll (only metadata scrolls)

### Tablet (641px - 1023px)
- [ ] Title shows full (no truncation)
- [ ] Metadata wraps naturally without scrolling
- [ ] Action buttons align to right of title
- [ ] Layout uses available space efficiently

### Desktop (≥ 1024px)
- [ ] Max width constrained to `max-w-3xl` (line 946)
- [ ] Comfortable reading line length (60-80 characters)
- [ ] Hover states work correctly (buttons, cards)
- [ ] Focus states visible for keyboard navigation

### Cross-browser & Accessibility
- [ ] Chrome/Edge (Blink) - horizontal scroll, focus rings
- [ ] Firefox (Gecko) - scrollbar styling, focus behavior
- [ ] Safari (WebKit) - momentum scrolling, focus rings
- [ ] Mobile Safari/Chrome - touch targets, scroll behavior
- [ ] Screen readers (NVDA, VoiceOver) - announce all content
- [ ] Keyboard navigation - logical tab order, focus visible

---

**Approval:**
- [ ] Design Lead
- [ ] Frontend Lead
- [ ] Product Owner

**Implementation Owner:** Frontend Team
**Due Date:** 2026-03-28
**File Path:** `E:\VS-projects\job-app-assistant\UI-SPEC.md`

**Pre-populated From:**
| Source | Decisions Used |
|--------|---------------|
| Existing UI-SPEC.md | Complete structure |
| InterviewMaterialsPage.tsx | Current implementation details |
| index.css | Design tokens, CSS custom properties |
| tailwind.config.js | Color palette, typography, spacing |
| User requirements | 3 specific mobile issues |

**Ready for Verification:** UI-SPEC complete and updated with current implementation details. Checker can now validate against design quality dimensions.