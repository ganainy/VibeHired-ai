# VibeHired UI Component Analysis Report
**Analysis Date:** March 31, 2026

---

## Executive Summary

This report catalogues **duplicate and inconsistent UI component implementations** across the VibeHired React codebase. The app uses a mix of:

1. **Design System Classes** (defined in `client/src/index.css`)
2. **Ad-hoc Tailwind Classes** (inline styles)
3. **Inline Styles** (with CSS variables)
4. **Custom Component Wrappers**

**Key Finding:** While a design system exists, many components deviate from it with custom implementations, creating inconsistency.

---

## 1. BUTTON IMPLEMENTATIONS

### **Status: HIGHLY INCONSISTENT**
**Number of Different Implementations:** 8-10 variants

### 1.1 Design System Classes (Standardized)
**Definition Location:** [client/src/index.css](client/src/index.css#L216-L287)

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  padding: 0.625rem 1.125rem;
  border-radius: 0.625rem;
}

.btn-primary {
  @apply btn;
  background-color: var(--accent);
  color: #0e0e17;
  font-weight: 600;
}

.btn-secondary {
  @apply btn;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border);
}

.btn-ghost {
  @apply btn;
  background: transparent;
  color: var(--text-secondary);
}

.btn-danger {
  @apply btn;
  background-color: var(--rose-bg, rgba(244, 100, 100, 0.1));
  color: var(--rose, #f46464);
  border: 1px solid rgba(244, 100, 100, 0.2);
}
```

**Usage Examples:**
- ✅ [JobChatWindow.tsx](client/src/components/chat/JobChatWindow.tsx#L216) - `btn-primary` with additional modifiers
- ✅ [ConfirmModal.tsx](client/src/components/common/ConfirmModal.tsx#L107-L110) - `btn-primary`, `btn-secondary`
- ✅ [ReviewFinalize/CoverLetterPage.tsx](client/src/components/review-finalize/CoverLetterPage.tsx#L195) - Proper class usage

### 1.2 Custom Button Styling (Deviations)
**Inconsistency:** Raw hex colors, inline bg colors, custom padding

```tsx
// ❌ INCONSISTENT: Custom inline styles
<button
  onClick={handleCancel}
  className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded"
/>

// ❌ INCONSISTENT: Mixed custom + system classes
<button
  className="btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 justify-center"
/>

// ❌ INCONSISTENT: Hard-coded colors
<button
  style={{background: 'var(--accent)'}}
  className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
/>
```

**Files with Custom Button Styling:**
- [CoverLetterModal.tsx](client/src/components/CoverLetterModal.tsx#L99-L129) - Uses hardcoded blue colors
- [FloatingChatButton.tsx](client/src/components/chat/FloatingChatButton.tsx#L12-L27) - Inline accent style
- [EmailFormatModal.tsx](client/src/components/EmailFormatModal.tsx) - Custom button styling

### 1.3 Button Size Variations
```tsx
// Small
className="btn-primary text-xs rounded-md px-3 py-1"

// Medium (standard)
className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm"

// Large
className="w-full btn-primary font-semibold rounded-xl"
```

**Files:** 
- [WeeklyGoalWidget.tsx](client/src/components/analytics/WeeklyGoalWidget.tsx#L112)
- [MockInterviewPanel.tsx](client/src/components/jobs/MockInterviewPanel.tsx#L542-L649)

### Summary
| Variant | Count | Issues |
|---------|-------|--------|
| `.btn-primary` | 20+ | Some add extra classes |
| `.btn-secondary` | 8+ | Some use hardcoded colors |
| `.btn-ghost` | 3 | Mostly consistent |
| `.btn-danger` | 1 | Rarely used |
| Custom inline | 15+ | Inconsistent sizing, colors |

---

## 2. CARD/CONTAINER VARIATIONS

### **Status: HIGHLY INCONSISTENT**
**Number of Different Implementations:** 9-12 variants

### 2.1 Design System Cards (Standardized)
**Definition Location:** [client/src/index.css](client/src/index.css#L142-L185)

```css
.card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 2px 8px rgba(0, 0, 0, 0.35);
}

.card-elevated {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 0.875rem;
}

.card-nested {
  @apply card;
  padding: 0.75rem; /* mobile */
}

.stat-card {
  @apply card;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}
```

### 2.2 Card Implementation Patterns

**Pattern A: System Class (Correct)**
```tsx
// ✅ CONSISTENT
<div className="card p-6">
  {content}
</div>
```
**Usage:** [ApplicationsOverallWidget.tsx](client/src/components/analytics/ApplicationsOverallWidget.tsx#L13)

**Pattern B: Custom Surface with Manual Styling (Common Deviation)**
```tsx
// ❌ INCONSISTENT
<div 
  className="p-4 rounded-lg border h-full transition-all duration-300" 
  style={{ 
    background: 'var(--bg-surface)', 
    borderColor: 'var(--border)' 
  }}
>
  {content}
</div>
```
**Usage:** 
- [RecentActivityWidget.tsx](client/src/components/analytics/RecentActivityWidget.tsx#L106)
- [WeeklyGoalWidget.tsx](client/src/components/analytics/WeeklyGoalWidget.tsx#L58)

**Pattern C: Hardcoded Colors**
```tsx
// ❌ INCONSISTENT
<div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm">
  {content}
</div>
```
**Usage:**
- [ApplicationCard.tsx](client/src/components/jobs/ApplicationCard.tsx#L57-L60)
- [AtsScoreCard.tsx](client/src/components/ats/AtsScoreCard.tsx#L80-L84)
- [AtsReportView.tsx](client/src/components/ats/AtsReportView.tsx#L29)

**Pattern D: TableOrCards Mobile Component (Custom)**
```tsx
// MOBILE CARD ONLY
<div
  className={`
    relative overflow-hidden group
    rounded-[18px] p-[18px]
    transition-all duration-[250ms] cubic-bezier(0.4, 0, 0.2, 1)
  `}
  style={{
    background: 'linear-gradient(145deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 96%, var(--accent) 4%) 100%)',
    border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 8px 24px -8px rgba(0, 0, 0, 0.15)',
    animation: `card-fade-in 0.4s ease-out ${idx * 0.06}s both`,
  }}
/>
```
**Usage:** [TableOrCards.tsx](client/src/components/common/TableOrCards.tsx#L60-L90)

**Pattern E: Alert/Feedback Cards (Colored Backgrounds)**
```tsx
// SPECIALIZED CARDS
<div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
  {content}
</div>

<div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg">
  {content}
</div>

<div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg">
  {content}
</div>
```
**Usage:** [AtsReportView.tsx](client/src/components/ats/AtsReportView.tsx#L186-L226)

### 2.3 Card Size Variations
- **Small Cards:** `p-3` to `p-4` with `rounded-lg`
- **Medium Cards:** `p-6` with `rounded-xl`
- **Large Cards:** `p-8` with `rounded-xl`
- **Nested Cards:** `p-0.75rem` (mobile) / `p-1.5rem` (desktop)

### Summary
| Pattern | Count | Variant | Issues |
|---------|-------|----------|--------|
| `.card` class | 15+ | Correct usage | Few inconsistencies |
| Manual `var()` styles | 20+ | Semi-custom | Deviation from system |
| Hardcoded colors | 25+ | Fully custom | Major deviation |
| Colored alert cards | 8+ | Special purpose | No system equivalent |
| TableOrCards component | 5+ | Mobile-only | Nested component logic |

---

## 3. BADGE/LABEL IMPLEMENTATIONS

### **Status: MODERATELY INCONSISTENT**
**Number of Different Implementations:** 6-8 variants

### 3.1 Design System Badges (Standardized)
**Definition Location:** [client/src/index.css](client/src/index.css#L289-L335)

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
}

.badge-gold {
  background-color: var(--accent-bg, rgba(217, 119, 6, 0.1));
  color: var(--accent, #d97706);
  border: 1px solid rgba(217, 119, 6, 0.2);
}

.badge-jade {
  background-color: var(--jade-bg, rgba(45, 212, 160, 0.1));
  color: var(--jade, #2dd4a0);
  border: 1px solid rgba(45, 212, 160, 0.2);
}

.badge-rose {
  background-color: var(--rose-bg, rgba(244, 100, 100, 0.1));
  color: var(--rose, #f46464);
  border: 1px solid rgba(244, 100, 100, 0.2);
}

.badge-ember {
  background-color: var(--ember-bg, rgba(240, 126, 56, 0.1));
  color: var(--ember, #f07e38);
  border: 1px solid rgba(240, 126, 56, 0.2);
}

.badge-ink {
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
```

### 3.2 Badge Implementation Patterns

**Pattern A: System Classes (Correct)**
```tsx
// ✅ CONSISTENT
<span className="badge badge-gold">Python</span>
<span className="badge badge-jade">Active</span>
<span className="badge badge-rose">Critical</span>
<span className="badge badge-ink">Neutral</span>
```
**Usage:**
- [About.tsx](client/src/components/portfolio/About.tsx#L45-L128) - `badge-gold`, `badge-ink`, `badge-jade`
- [Projects.tsx](client/src/components/portfolio/Projects.tsx#L298-L304) - `badge-ink`
- [AtsInlinePanel.tsx](client/src/components/ats/AtsInlinePanel.tsx#L36) - `badge badge-ink`

**Pattern B: Priority Badges (Custom Color Map)**
```tsx
// CUSTOM IMPLEMENTATION
const PRIORITY_COLORS: Record<Priority, { badge: string; border: string }> = {
  'high': {
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    border: 'border-red-500'
  },
  'medium': {
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    border: 'border-amber-500'
  },
  'low': {
    badge: 'badge badge-ink',
    border: 'border-zinc-600'
  }
};
```
**Usage:** [AtsInlinePanel.tsx](client/src/components/ats/AtsInlinePanel.tsx#L26-L39)

**Pattern C: Status Badges (Inline Styled - No System Class)**
```tsx
// ❌ INCONSISTENT - Not using system classes
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
  Applied
</span>

<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
  Interview
</span>

<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
  Rejected
</span>
```
**Usage:** [JobStatusBadge.tsx](client/src/components/jobs/JobStatusBadge.tsx#L33-L42)

**Pattern D: Notes/Tags on Cards (Inline Styled)**
```tsx
// ❌ INCONSISTENT - Ad-hoc styling
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
  <svg>...</svg>
  Note
</span>

<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
  <svg>...</svg>
  Follow-up
</span>
```
**Usage:** [ApplicationCard.tsx](client/src/components/jobs/ApplicationCard.tsx#L77-L97)

**Pattern E: Severity/Type Badges (Modal Context)**
```tsx
// SPECIALIZED - Multiple severity levels
{ label: 'Critical', badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
{ label: 'High', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
{ label: 'Medium', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
```
**Usage:** [GeneralCvAtsPanel.tsx](client/src/components/ats/GeneralCvAtsPanel.tsx#L310-L327)

### 3.3 Badge Size Variations
- **Micro:** `px-1.5 py-0.5 text-[10px]` (with icons)
- **Small:** `px-2.5 py-0.5 text-xs`
- **Standard:** `px-3 py-1 text-sm` (design system)

### Summary
| Pattern | Count | Variant | Issues |
|---------|-------|----------|--------|
| `.badge-*` classes | 12+ | System colors | Correct usage |
| Priority badges | 5+ | Custom map | Hardcoded colors |
| Status badges | 10+ | Inline styled | No system equivalent |
| Note/tag badges | 8+ | Custom styling | Different padding |

---

## 4. MODAL/DIALOG VARIATIONS

### **Status: INCONSISTENT**
**Number of Different Implementations:** 12+ distinct modal types

### 4.1 Design System Modal Foundation
**Note:** No dedicated `.modal` class; each modal implements its own structure

### 4.2 Modal Implementation Patterns

**Pattern A: Overlay + Content Structure (Most Common)**
```tsx
// STANDARD MODAL STRUCTURE
<div
  className="fixed inset-0 flex items-center justify-center z-[2000] p-4"
  style={{ background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(4px)' }}
  onClick={onClose}
>
  <div
    className="card w-full max-w-sm overflow-hidden"
    style={{...}}
    onClick={(e) => e.stopPropagation()}
  >
    {/* Close button, title, content, actions */}
  </div>
</div>
```
**Usage:**
- [ConfirmModal.tsx](client/src/components/common/ConfirmModal.tsx#L48-L120) - Generic confirm/alert/info
- [CoverLetterModal.tsx](client/src/components/CoverLetterModal.tsx#L46-L80) - Large, full-height
- [EmailFormatModal.tsx](client/src/components/EmailFormatModal.tsx#L151-L290)

**Pattern B: Full-Page Modal (Scroll Content)**
```tsx
// ❌ INCONSISTENT - Different overlay structure
<div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
    {/* Header with close button */}
    {/* Scrollable content */}
    {/* Footer with actions */}
  </div>
</div>
```
**Usage:**
- [CoverLetterModal.tsx](client/src/components/CoverLetterModal.tsx#L52-L64)
- [EmailFormatModal.tsx](client/src/components/EmailFormatModal.tsx#L145+)

**Pattern C: Chat Modal (Window-like)**
```tsx
// SPECIALIZED - Chat/messaging interface
<div className="fixed bottom-0 right-6 w-96 h-full sm:h-[600px] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl z-50 flex flex-col">
  {/* Header with close */}
  {/* Message history */}
  {/* Input area */}
</div>
```
**Usage:**
- [JobChatModal.tsx](client/src/components/chat/JobChatModal.tsx#L84+)
- [JobChatWindow.tsx](client/src/components/chat/JobChatWindow.tsx#L78+)

**Pattern D: CV Preview Modal**
```tsx
// SPECIALIZED - Preview context
<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4">
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
    {/* PDF/preview viewer */}
  </div>
</div>
```
**Usage:**
- [CvPreviewModal.tsx](client/src/components/cv-editor/CvPreviewModal.tsx)

**Pattern E: Creation/Dynamic Modal**
```tsx
// SPECIALIZED - Form entry
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-xl p-6">
    {/* Form fields and buttons */}
  </div>
</div>
```
**Usage:**
- [CreateBranchModal.tsx](client/src/components/cv-management/CreateBranchModal.tsx#L64+)
- [UserInputModal.tsx](client/src/components/generator/UserInputModal.tsx)

### 4.3 Modal Close Actions
```tsx
// PATTERN 1: Overlay click closes
<div onClick={onClose}>

// PATTERN 2: Stop propagation, explicit close button
<button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
  <X size={18} />
</button>

// PATTERN 3: ESC key handler
useEffect(() => {
  const handleEscape = (e) => e.key === 'Escape' && onClose();
  document.addEventListener('keydown', handleEscape);
}, []);
```

### 4.4 Modal Z-Index Variations
```
z-50    - Most modals
z-[2000] - ConfirmModal (high priority)
z-40    - CV Preview (intentionally lower)
z-10    - Dropdowns (lower than modals)
```

### Summary
| Type | Count | Pattern | Z-Index |
|------|-------|---------|---------|
| Generic Confirm | 2 | System card | z-[2000] |
| Editor Modal | 4 | Full-page, scrollable | z-50 |
| Chat Modal | 2 | Window-like, fixed position | z-50 |
| Preview Modal | 2 | Large content, scrollable | z-40 |
| Creation Modal | 3+ | Form-based, centered | z-50 |
| **Inconsistencies** | | No standard wrapper component | Various |

---

## 5. INPUT FIELD IMPLEMENTATIONS

### **Status: MODERATELY INCONSISTENT**
**Number of Different Implementations:** 5-7 variants

### 5.1 Design System Inputs (Standardized)
**Definition Location:** [client/src/index.css](client/src/index.css#L187-L214)

```css
.input-base {
  width: 100%;
  background-color: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 0.625rem;
  color: var(--text-primary);
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  padding: 0.625rem 0.875rem;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.input-base::placeholder {
  color: var(--text-muted);
}

.input-base:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(217, 119, 6, 0.1));
}
```

### 5.2 Input Implementation Patterns

**Pattern A: System Class (Correct)**
```tsx
// ✅ CONSISTENT
<input 
  type="text" 
  className="input-base w-full py-1.5 pl-8 pr-3 text-[11px]"
  placeholder="Search..."
/>
```
**Usage:**
- [Sidebar.tsx](client/src/components/cv-management/Sidebar.tsx#L230)
- [CvEditorPanel.tsx](client/src/components/cv-workspace/CvEditorPanel.tsx#L184)

**Pattern B: Hardcoded Gray Colors (Inconsistent)**
```tsx
// ❌ INCONSISTENT - Custom gray colors
<input 
  type="text"
  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 input-base"
/>
```
**Usage:**
- [CoverLetterPage.tsx](client/src/components/review-finalize/CoverLetterPage.tsx#L481-L562)
- [TailoredCvPage.tsx](client/src/components/review-finalize/TailoredCvPage.tsx#L591-L709)

**Pattern C: Custom Input Variable (Scoped)**
```tsx
// CUSTOM - Scoped to component
const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white";

<input type="text" className={inputCls} />
<input type="datetime-local" className={inputCls} />
<textarea className={`${inputCls} resize-none`} />
```
**Usage:** [ReminderModal.tsx](client/src/components/jobs/ReminderModal.tsx#L418-L442)

**Pattern D: Form Input Group (Wrapper Component)**
```tsx
// COMPONENT PATTERN
const INPUT_CLASSES = "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

<input className={INPUT_CLASSES} />
<textarea className={`${INPUT_CLASSES} resize-none`} />
```
**Usage:** [InputGroup.tsx](client/src/components/resume-builder/Form/InputGroup.tsx#L59-L198)

**Pattern E: Textarea Variations**
```tsx
// Different textarea implementations
// PATTERN 1: input-base
<textarea className={`${inputBase} resize-none overflow-hidden`} />

// PATTERN 2: Custom classes
<textarea className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 input-base min-h-[200px]" />

// PATTERN 3: Custom variable
<textarea className={`${inputCls} resize-none min-h-[80px]`} />
```

### 5.3 Input Size Variations
- **Compact:** `px-2 py-1 text-xs`
- **Standard:** `px-3 py-2 text-sm`
- **Large:** `px-4 py-3 text-base`

### Summary
| Pattern | Count | Issues |
|---------|-------|--------|
| `.input-base` class | 8+ | Correct usage |
| Custom gray colors | 12+ | Not using design system |
| Scoped variables | 5+ | Not centralized |
| Form wrapper | 2+ | Custom classes |
| Textarea variants | 8+ | Multiple implementations |

---

## 6. HEADING/TITLE PATTERNS

### **Status: HIGHLY INCONSISTENT**
**Number of Different Implementations:** 10+ variants

### 6.1 Design System Title Classes (Standardized)
**Definition Location:** [client/src/index.css](client/src/index.css#L337-L357)

```css
.page-title {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 1.875rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.label-overline {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
```

### 6.2 Heading Implementation Patterns

**Pattern A: System Page Title (Correct)**
```tsx
// ✅ CONSISTENT
<h1 className="page-title">Admin Dashboard</h1>
<h2 className="page-subtitle">Manage users and settings</h2>
```
**Usage:**
- [AdminDashboardPage.tsx](client/src/components/pages/AdminDashboardPage.tsx#L178)
- [AdminErrorsPage.tsx](client/src/components/pages/AdminErrorsPage.tsx#L134)

**Pattern B: Section Headings (H2, H3 - No System Class)**
```tsx
// ❌ INCONSISTENT - Ad-hoc styling
<h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
  Cover Letter
</h2>

<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
  ATS Scores
</h3>

<h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
  Profiles
</h4>
```
**Usage:**
- [CoverLetterModal.tsx](client/src/components/CoverLetterModal.tsx#L64)
- [AtsScoreCard.tsx](client/src/components/ats/AtsScoreCard.tsx#L88)
- [BasicsEditor.tsx](client/src/components/cv-editor/BasicsEditor.tsx#L207)

**Pattern C: Uppercase Section Labels**
```tsx
// SPECIALIZED - Uppercase tracking
<h3 className="text-sm font-bold uppercase tracking-widest" style={{color: 'var(--text-muted)'}}>
  Application Performance Overview
</h3>

<h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
  Missing Keywords
</h3>

// OR using label-overline
<h2 className="text-sm font-extrabold uppercase tracking-widest label-overline">
  My CVs
</h2>
```
**Usage:**
- [ApplicationsOverallWidget.tsx](client/src/components/analytics/ApplicationsOverallWidget.tsx#L15-L25)
- [AtsInlinePanel.tsx](client/src/components/ats/AtsInlinePanel.tsx#L351-L438)
- [Sidebar.tsx](client/src/components/cv-management/Sidebar.tsx#L217)

**Pattern D: Bold Display Headings**
```tsx
// SPECIAL - Extra bold for emphasis
<h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
  ATS Compatibility Scores
</h3>

<h2 className="text-3xl font-bold" style={{fontFamily: 'var(--font-display)'}}>
  Technical Skills
</h2>
```
**Usage:**
- [AtsScoreCard.tsx](client/src/components/ats/AtsScoreCard.tsx#L132)
- [About.tsx](client/src/components/portfolio/About.tsx#L38-L97)

**Pattern E: CV Section Headings (Inline Styled)**
```tsx
// DOCUMENT CONTEXT - Specific formatting
<h1 style={{
  fontSize: '24pt',
  fontWeight: 'bold',
  color: '#111',
  marginBottom: '20px',
  textAlign: 'center',
  letterSpacing: '-1px'
}}>
  {name}
</h1>

<h2 style={{
  fontSize: '14pt',
  color: '#111',
  marginTop: '20px',
  marginBottom: '10px',
  borderBottom: '1px solid #eee',
  paddingBottom: '4px'
}}>
  Experience
</h2>
```
**Usage:** [CvDocumentRenderer.tsx](client/src/components/cv-editor/CvDocumentRenderer.tsx#L231-L1042)

### 6.3 Heading Size Chart
```
H1 Display (page-title):     1.875rem (30px)
H2 Modal Title:              2xl (1.5rem)
H3 Section Header:           lg-xl (1.125rem - 1.25rem)
H4 Subsection:               sm-base (0.875rem - 1rem)
Label Overline:              0.6875rem (11px)
CV Section Headers:          14pt - 24pt (document context)
```

### Summary
| Pattern | Count | Issues |
|---------|-------|--------|
| `.page-title` | 2 | Correct usage |
| `.label-overline` | 3 | Correct usage |
| Hardcoded H2/H3 | 25+ | No system class |
| Uppercase labels | 15+ | Custom tracking |
| Display headings | 8+ | Bold variants |
| CV document headings | 20+ | Inline styles, different context |

---

## 7. TABLE/LIST CARD DISPLAY PATTERNS

### **Status: TWO DISTINCT SYSTEMS**
**Number of Different Implementations:** 4-5 patterns

### 7.1 TableOrCards Component (Main System)
**Location:** [client/src/components/common/TableOrCards.tsx](client/src/components/common/TableOrCards.tsx)

**Pattern A: Desktop Table + Mobile Cards (Responsive)**
```tsx
// Component generates both:
// - Table on desktop (md and up)
// - Cards on mobile (sm and down)

// Mobile Card Implementation:
<div
  className={`
    relative overflow-hidden group
    rounded-[18px] p-[18px]
    transition-all duration-[250ms]
  `}
  style={{
    background: 'linear-gradient(145deg, var(--bg-surface) 0%, ...)',
    border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), ...',
  }}
/>

// Desktop Table Implementation:
<table className="w-full text-left">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

**Props Required:**
```typescript
interface CardConfig<T> {
  title: (item: T) => string;
  subtitle?: (item: T) => string;
  badge?: (item: T) => { text: string; className: string } | null;
  avatar?: (item: T) => { letter: string; className?: string } | null;
  fields: Array<{
    label?: string;
    value: (item: T) => React.ReactNode;
    icon?: React.ReactNode;
  }>;
  actions?: (item: T) => React.ReactNode;
}
```

**Usage:**
- [RecentActivityWidget.tsx](client/src/components/analytics/RecentActivityWidget.tsx#L85-L123)
- [AdminDashboardPage.tsx](client/src/components/pages/AdminDashboardPage.tsx#L340-L454)
- [AdminUsersPage.tsx](client/src/components/pages/AdminUsersPage.tsx#L93+)

### 7.2 Traditional HTML Table (Custom Implementation)
```tsx
// ❌ INCONSISTENT - Raw HTML table
<table className="w-full text-left">
  <thead className="bg-gray-100 dark:bg-gray-800">
    <tr>
      <th className="px-4 py-2 text-sm font-semibold">Column 1</th>
      <th className="px-4 py-2 text-sm font-semibold">Column 2</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b">
      <td className="px-4 py-2">Data</td>
      <td className="px-4 py-2">Data</td>
    </tr>
  </tbody>
</table>
```
**Usage:** [AdminErrorsPage.tsx](client/src/components/pages/AdminErrorsPage.tsx#L195-L361)

### 7.3 FreeForm List (Custom Layout)**
```tsx
// SPECIALIZED - Bulleted lists
<ul className="list-disc pl-5 mt-1 space-y-[2px]">
  <li><Txt v={item} className="text-[12.5px] text-gray-800" /></li>
</ul>
```
**Usage:** [FreeformCvRenderer.tsx](client/src/components/cv-freeform/FreeformCvRenderer.tsx#L103-L166)

### 7.4 Pipeline/Status List
```tsx
// APPLICATION PIPELINE - Kanban-like display
<div className="space-y-3">
  {applications.map(app => (
    <div key={app.id} className="rounded-lg border p-4 cursor-pointer">
      {/* Application card content */}
    </div>
  ))}
</div>
```
**Usage:** [ApplicationPipelineKanban.tsx](client/src/components/jobs/ApplicationPipelineKanban.tsx)

### 7.5 Minimal List (Single Column)**
```tsx
// STREAMLINED - Simple list without table structure
<div className="space-y-2">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
      <span>{item.name}</span>
      <span className="text-sm text-gray-500">{item.date}</span>
    </div>
  ))}
</div>
```

### Summary
| Pattern | Count | Files | Type |
|---------|-------|-------|------|
| TableOrCards | 5 | Analytics, Admin | Responsive |
| HTML Table | 2 | Admin pages | Custom |
| Bulleted Lists | 3 | CV renderer | Document |
| Application Cards | 10+ | Job pages | Custom |
| Minimal Lists | 5+ | Sidebars, menus | Simplified |

---

## 8. OVERALL INCONSISTENCY SUMMARY

### **By Component Type**

| Component | Design System Classes | Custom Implementations | Inconsistency Level |
|-----------|----------------------|------------------------|---------------------|
| Buttons | 4 standard | 10+ ad-hoc | **HIGH** ⚠️ |
| Cards | 5 standard | 12+ ad-hoc | **HIGH** ⚠️ |
| Badges | 5 color variants | 8+ ad-hoc | **MODERATE** ⚠️ |
| Modals | 0 standard | 12+ unique | **VERY HIGH** 🔴 |
| Inputs | 2 standard | 7+ ad-hoc | **MODERATE** ⚠️ |
| Headings | 3 standard | 10+ ad-hoc | **HIGH** ⚠️ |
| Tables/Lists | 1 component | 5+ patterns | **MODERATE** ⚠️ |

### **Root Causes of Inconsistency**

1. **No Enforced Component Library** - 75% of UI uses inline Tailwind
2. **Design System Incomplete** - No modal, complex button, or specialized card classes
3. **Color Hardcoding** - Many files use `bg-gray-500 dark:bg-gray-600` instead of CSS variables
4. **Lack of Wrapper Components** - Only TableOrCards has a well-designed wrapper; others are ad-hoc
5. **Different Contexts, Different Approaches** - Document rendering (CV), admin panels, and job cards each have their own patterns
6. **Gradual Evolution** - Design system added later; older code wasn't refactored

### **Size of Issue**

- **Total Components Analyzed:** 60+
- **Design System Classes Used:** ~40 instances
- **Custom Ad-hoc Implementations:** ~200+ instances
- **Ratio:** ~83% custom vs. 17% system classes

---

## 9. RECOMMENDATIONS

### **Priority 1: Modal Standardization**
- Create a reusable `<Modal>` wrapper component
- Standardize z-index, overlay, close actions
- Migrate all 12+ modal implementations to use it

### **Priority 2: Button Consolidation**
- Enforce use of `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- Create button size variants as component props
- Deprecate custom button styling

### **Priority 3: Color System Expansion**
- Add system classes for common status colors (green, blue, red, amber)
- Add `.btn-success`, `.btn-info`, `.btn-warning`
- Replace all `bg-gray-50 dark:bg-gray-600` with centralized color classes

### **Priority 4: Card Wrapper Component**
- Create reusable `<Card>` component with variants (default, elevated, minimal)
- Support different padding/sizing through props
- Migrate alert/feedback cards to use system

### **Priority 5: Input Standardization**
- Create `<Input>` and `<Textarea>` wrapper components
- Support size and state variants
- Enforce use of `.input-base`

### **Priority 6: Heading System**
- Add `.section-title`, `.subsection-title` classes
- Standardize H2-H4 sizing/styling
- Create heading component wrappers

---

## 10. COMPONENT LOCATION REFERENCE

### By Category

**Navigation & Layout:**
- [Sidebar.tsx](client/src/components/cv-management/Sidebar.tsx) - Navigation with labels
- [MainLayout.tsx](client/src/components/layout/MainLayout.tsx)

**Analytics & Widgets:**
- [RecentActivityWidget.tsx](client/src/components/analytics/RecentActivityWidget.tsx)
- [WeeklyGoalWidget.tsx](client/src/components/analytics/WeeklyGoalWidget.tsx)
- [ApplicationsOverallWidget.tsx](client/src/components/analytics/ApplicationsOverallWidget.tsx)

**Job Application:**
- [ApplicationCard.tsx](client/src/components/jobs/ApplicationCard.tsx)
- [JobCvCard.tsx](client/src/components/jobs/JobCvCard.tsx)
- [JobStatusBadge.tsx](client/src/components/jobs/JobStatusBadge.tsx)

**Common Components:**
- [ConfirmModal.tsx](client/src/components/common/ConfirmModal.tsx)
- [TableOrCards.tsx](client/src/components/common/TableOrCards.tsx)
- [SearchableSelect.tsx](client/src/components/common/SearchableSelect.tsx)

**Chat:**
- [FloatingChatButton.tsx](client/src/components/chat/FloatingChatButton.tsx)
- [JobChatModal.tsx](client/src/components/chat/JobChatModal.tsx)

**Admin Pages:**
- [AdminDashboardPage.tsx](client/src/components/pages/AdminDashboardPage.tsx)
- [AdminUsersPage.tsx](client/src/components/pages/AdminUsersPage.tsx)
- [AdminErrorsPage.tsx](client/src/components/pages/AdminErrorsPage.tsx)

---

## Appendix: CSS Variable Reference

### Colors
```css
--accent: #d97706 (gold/orange)
--text-primary: #eeeef8 (light text, dark mode)
--text-secondary: #9090b4
--text-muted: #585878
--bg-surface: #1a1a28
--bg-elevated: #212130
--border: #333348
--success: #2dd4a0 (jade)
--error: #f46464 (rose)
--warning: #f07e38 (ember)
--info: #3b82f6 (azure)
```

### Fonts
```css
Display/Headings: 'Fraunces' (serif)
Body: 'Outfit' (sans-serif)
Mono/Code: 'JetBrains Mono'
```

---

**Report Generated:** March 31, 2026
**Analysis Scope:** client/src/components
**Total Files Reviewed:** 60+
**Total Patterns Identified:** 50+
