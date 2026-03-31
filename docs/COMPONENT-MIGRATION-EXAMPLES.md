# Component Migration: Before & After Examples

This guide shows real code examples of how to migrate from ad-hoc styling to unified components.

---

## 1. Button Component Migration

### Before (Ad-hoc styling)

**File:** `CoverLetterEditor.tsx`

```tsx
// ❌ Multiple inconsistent button patterns
<button className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 transition">
  Save Draft
</button>

<button 
  className="border border-gray-600 text-gray-300 px-3 py-1 rounded hover:bg-gray-900 transition"
  onClick={handleEdit}
>
  Edit
</button>

<button 
  className="text-red-500 hover:text-red-600 px-2 py-1"
  onClick={handleDelete}
>
  Delete
</button>

{isLoading && <Spinner />}
<button disabled={isLoading} className="bg-amber-500 text-white px-4 py-2 rounded opacity-50">
  {isLoading ? 'Saving...' : 'Save'}
</button>
```

### After (Unified component)

```tsx
// ✅ Single consistent component
import { Button } from '@/components/common';

<Button>Save Draft</Button>

<Button variant="secondary" onClick={handleEdit}>
  Edit
</Button>

<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>

<Button isLoading={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

### Migration Steps for CoverLetterEditor.tsx

1. Add import at top:
   ```tsx
   import { Button } from '@/components/common';
   ```

2. Replace all button patterns with component (5 instances):
   - Primary button → `<Button />`
   - Secondary button → `<Button variant="secondary" />`
   - Danger button → `<Button variant="danger" />`
   - Ghost button → `<Button variant="ghost" />`

3. Test:
   - All buttons still clickable ✓
   - Styling matches previous version ✓
   - No hover/focus state regressions ✓

**Estimated Time:** 15 minutes  
**Files Affected:** 1  
**Button Instances:** 5

---

## 2. Card Component Migration

### Before (Ad-hoc styling)

**File:** `ApplicationCard.tsx`

```tsx
// ❌ Inconsistent card and badge styling
export function ApplicationCard({ job, status }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-amber-500 transition">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-white">{job.title}</h3>
          <p className="text-sm text-gray-400 mt-1">{job.company}</p>
        </div>
        {/* Inconsistent badge styling */}
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          status === 'applied' ? 'bg-blue-900 text-blue-100' :
          status === 'interview' ? 'bg-purple-900 text-purple-100' :
          status === 'rejected' ? 'bg-red-900 text-red-100' : 'bg-gray-700 text-gray-100'
        }`}>
          {status}
        </span>
      </div>
    </div>
  );
}
```

### After (Unified components)

```tsx
import { Card } from '@/components/common';
import { Badge } from '@/components/common';

export function ApplicationCard({ job, status }) {
  return (
    <Card hoverable>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-white">{job.title}</h3>
          <p className="text-sm text-gray-400 mt-1">{job.company}</p>
        </div>
        <Badge variant={statusToBadgeVariant(status)}>
          {status}
        </Badge>
      </div>
    </Card>
  );
}

// Helper function
function statusToBadgeVariant(status: string): 'jade' | 'rose' | 'ember' | 'azure' {
  const map: Record<string, 'jade' | 'rose' | 'ember' | 'azure'> = {
    applied: 'azure',
    interview: 'rose',
    rejected: 'rose',
    contacted: 'jade',
  };
  return map[status] || 'ink';
}
```

### Migration Checklist

- [ ] Import `Card` from `@/components/common`
- [ ] Import `Badge` from `@/components/common`
- [ ] Replace div wrapper with `<Card>`
- [ ] Replace conditional span with `<Badge variant={...}>`
- [ ] Extract status → badge variant mapping
- [ ] Test card borders and hover effects
- [ ] Test badge colors match design system

**Estimated Time:** 20 minutes  
**Files Affected:** ApplicationCard.tsx in 3 different modules

---

## 3. Modal Component Migration

### Before (Ad-hoc styling - 12 different implementations)

**Pattern 1:** Simple confirmation modal in `ConfirmModal.tsx`

```tsx
// ❌ Manual modal implementation #1
export function ConfirmModal({ title, message, onConfirm, onCancel, isOpen }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Pattern 2:** Complex editor modal in `CoverLetterModal.tsx`

```tsx
// ❌ Manual modal implementation #2 (different structure)
export function CoverLetterModal({ isOpen, onClose, onSave, letter }) {
  const [content, setContent] = useState(letter.content);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Edit Cover Letter</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Content - completely different structure */}
          <div className="px-6 py-6 max-h-96 overflow-y-auto">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2"
            />
          </div>

          {/* Footer - different button arrangement */}
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-800 flex justify-between">
            <button 
              onClick={onClose}
              className="px-3 py-2 rounded text-gray-300 hover:bg-gray-700"
            >
              Close
            </button>
            <button 
              onClick={() => onSave(content)}
              className="px-4 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### After (Unified Modal component)

```tsx
// ✅ Built with single Modal component

// Simple confirmation modal
import { Modal } from '@/components/common';

export function ConfirmModal({ title, message, onConfirm, onCancel, isOpen }) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-gray-300 mb-6">{message}</p>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm</Button>
      </Modal.Footer>
    </Modal>
  );
}

// Complex editor modal (same component, different content)
export function CoverLetterModal({ isOpen, onClose, onSave, letter }) {
  const [content, setContent] = useState(letter.content);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Edit Cover Letter"
      size="lg"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full bg-gray-800 text-white rounded px-3 py-2"
      />
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={() => onSave(content)}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}
```

### Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Code Duplication** | 12 implementations | 1 component |
| **Structure** | Inconsistent | Standardized |
| **Lines of Code** | 50-100 per modal | 10-15 per modal |
| **Animation** | Manual/inconsistent | Built-in, consistent |
| **Accessibility** | Manual (focus, ESC) | Automatic (Portal, ARIA) |
| **Keyboard Nav** | Not implemented | ✅ Built-in |
| **Focus Management** | Not managed | ✅ Auto trapped |

### Migration Priority Order

**High Impact (Week 3, Mon-Tue):**
1. `ConfirmModal.tsx` ✅ — Simplest, 2 uses
2. `NotesModal.tsx` ✅ — Text input only
3. `ReminderModal.tsx` ✅ — Form-based

**Medium Impact:**
4. `UserInputModal.tsx` — Dynamic form fields
5. `EmailFormatModal.tsx` — Checkbox/radio selection

**Complex (needs careful testing):**
6. `CoverLetterModal.tsx` — Rich text editor + tabs
7. `JobChatModal.tsx` — Scrollable chat history
8. Others requiring custom interaction patterns

---

## 4. Input Component Migration

### Before (Ad-hoc styling)

**File:** `ReminderModal.tsx`

```tsx
// ❌ Multiple inconsistent input patterns
<div className="mb-4">
  <label className="block text-sm font-medium text-white mb-2">Job Title</label>
  <input 
    type="text"
    className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700"
    placeholder="e.g. Senior Engineer"
  />
</div>

{/* Error state - no consistent styling */}
<input 
  type="email"
  className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-red-600"
/>
<p className="text-red-500 text-sm mt-1">Invalid email format</p>

{/* With icon */}
<div className="relative">
  <input 
    type="search"
    className="w-full px-3 py-2 pl-10 rounded bg-gray-800 text-white border border-gray-700"
  />
  <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
</div>
```

### After (Unified Input component)

```tsx
import { Input } from '@/components/common';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

<Input 
  label="Job Title"
  placeholder="e.g. Senior Engineer"
/>

<Input 
  type="email"
  error="Invalid email format"
/>

<Input 
  type="search"
  icon={<MagnifyingGlassIcon />}
/>
```

### Migration Checklist

- [ ] Import `Input` from `@/components/common`
- [ ] Replace label + input with `<Input label="..." />`
- [ ] Move error text to `error` prop
- [ ] Move icon jsx to `icon` prop
- [ ] Test error state styling
- [ ] Test placeholder text visibility
- [ ] Test focus/disabled states

---

## 5. Badge Component Migration

### Before (Ad-hoc styling)

**File:** `AnalysisDashboard.tsx`

```tsx
// ❌ Inconsistent badge styling across component
<span className="px-2 py-1 rounded-full bg-green-900 text-green-100 text-xs font-medium">
  High Match
</span>

<span className="inline-block px-3 py-1.5 rounded text-sm font-semibold text-yellow-300 border border-yellow-500">
  Warning
</span>

<span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs">
  Rejected
</span>

<div className="flex gap-1">
  {skills.map(skill => (
    <span key={skill} className="px-2 py-1 bg-gray-700 text-gray-200 rounded text-xs">
      {skill}
    </span>
  ))}
</div>
```

### After (Unified Badge component)

```tsx
import { Badge } from '@/components/common';

<Badge variant="jade" size="md">High Match</Badge>

<Badge variant="ember" size="md">Warning</Badge>

<Badge variant="rose" size="sm">Rejected</Badge>

<div className="flex gap-1">
  {skills.map(skill => (
    <Badge key={skill} variant="ink" size="sm">
      {skill}
    </Badge>
  ))}
</div>
```

**Available Variants & Colors:**
- `jade` — Green (success)
- `rose` — Pink/Red (error/alert)
- `ember` — Orange (warning)
- `azure` — Blue (info)
- `gold` — Amber (accent)
- `ink` — Dark gray (neutral)

---

## 6. Heading Component Migration

### Before (Ad-hoc styling)

**File:** `CoverLetterModal.tsx`

```tsx
// ❌ Inconsistent heading styles
<h1 className="text-3xl font-bold text-white mb-4">Cover Letter</h1>

<h2 className="text-xl font-semibold text-white mb-2">
  Preview
  <span className="text-sm text-gray-400 font-normal"> — Read-only</span>
</h2>

<div className="text-lg font-bold text-amber-500 mb-3">
  Section 1: Opening
</div>

<p className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-2">
  Instructions
</p>
```

### After (Unified Heading component)

```tsx
import { Heading } from '@/components/common';

<Heading level={1}>Cover Letter</Heading>

<Heading level={2} subtitle="Read-only">
  Preview
</Heading>

<Heading level={3}>
  Section 1: Opening
</Heading>

<Heading level={4} variant="overline">
  Instructions
</Heading>
```

**Available Levels:**
- `level={1}` → h1 (32px, Fraunces Bold)
- `level={2}` → h2 (24px, Fraunces Semibold)
- `level={3}` → h3 (20px, Outfit Bold)
- `level={4}` → h4 (16px, Outfit Medium)

---

## 7. ListCard Component Migration

### Before (Ad-hoc styling)

**File:** `RecentActivityWidget.tsx`

```tsx
// ❌ Manual list item styling
export function ActivityList({ items }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div 
          key={item.id}
          className="p-3 rounded border border-gray-800 hover:border-amber-500 hover:bg-gray-800 transition"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-white">{item.title}</p>
              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
            </div>
            <span className="text-xs text-gray-500">{item.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### After (Unified ListCard component)

```tsx
import { ListCard } from '@/components/common';

export function ActivityList({ items }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ListCard
          key={item.id}
          title={item.title}
          description={item.description}
          metadata={item.date}
        />
      ))}
    </div>
  );
}
```

---

## Migration Command Reference

### Step 1: Create Imports
At top of file, add:
```tsx
import { 
  Button, 
  Card, 
  Modal, 
  Input, 
  Badge, 
  Heading, 
  ListCard 
} from '@/components/common';
```

### Step 2: Global Find & Replace Patterns

| Pattern | Replace With |
|---------|--------------|
| `className="btn-primary` | `<Button>` |
| `className="btn-secondary` | `<Button variant="secondary">` |
| `className="btn-danger` | `<Button variant="danger">` |
| `className=".*badge.*"` | `<Badge variant="...">` |
| `className=".*card.*"` | `<Card>` |
| Manual modal divs | `<Modal>` |
| `<input className=` | `<Input` |
| `<h1>` / `<h2>` | `<Heading level={1/2}>` |

### Step 3: Verify TypeScript

```bash
npm run type-check
```

### Step 4: Test

```bash
npm run test -- ComponentName.test.tsx
npm run dev  # Manual visual inspection
```

---

## Common Migration Mistakes

### ❌ Mistake 1: Forgetting the import
```tsx
// ❌ Won't work
<Button>Click</Button>

// ✅ Fix
import { Button } from '@/components/common';
<Button>Click</Button>
```

### ❌ Mistake 2: Wrong prop names
```tsx
// ❌ Won't work
<Button type="primary">  {/* should be variant */}

// ✅ Fix
<Button variant="primary">
```

### ❌ Mistake 3: Mixing old and new
```tsx
// ❌ Inconsistent
<Button className="bg-red-500">  {/* conflicts with button styling */}

// ✅ Let component handle it
<Button variant="danger">
```

### ❌ Mistake 4: Custom className overriding design system
```tsx
// ❌ Ugly and breaks consistency
<Input className="w-96 px-10 py-4" size="md" />

// ✅ Use size prop
<Input size="lg" />

// ✅ Or if truly custom, use full override
<Input className="custom-layout" />
```

---

## FAQ

**Q: Can I still use Tailwind classes with the new components?**  
A: Yes, pass them via `className` prop. Best used for layout (spacing around component), not for styling the component itself.

**Q: What if a component needs custom styling?**  
A: Use CSS modules or CSS-in-JS for complex customization. Contact design system maintainer before creating one-off variants.

**Q: How do I update existing props after migration?**  
A: All components accept standard HTML props (disabled, onClick, etc.) plus component-specific props. Example:
```tsx
<Button 
  onClick={handleClick}      // HTML
  disabled={isLoading}       // HTML
  variant="primary"          // Component
  isLoading={isLoading}      // Component
/>
```

**Q: Will the migration break existing functionality?**  
A: No — components are built to replicate current styling exactly. Visual regression tests verify this.

---

**Ready to refactor?** Start with [Button](./COMPONENT-LIBRARY-IMPLEMENTATION.md#component-1-button), then Card, then Modal.

**Last Updated:** March 31, 2026
