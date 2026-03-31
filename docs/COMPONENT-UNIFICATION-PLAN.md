# Component Unification Plan

**Status:** Planning Phase  
**Date:** March 31, 2026  
**Design System:** Obsidian Intelligence  

---

## Executive Summary

Analysis of the VibeHired codebase reveals **83% ad-hoc component implementations** against only 17% actual design system usage. This creates:
- **Maintenance overhead** — Fixing one button style requires changes across 10+ files
- **Inconsistent UX** — Buttons, cards, modals look/feel different across pages
- **Onboarding friction** — New developers don't know which pattern to follow
- **Bundle bloat** — Duplicate styling logic increases compiled size

**Solution:** Create a unified component library with 8 core components that cover 90% of UI needs.

---

## Current State Analysis

### Consistency Metrics by Element

| Element | System Classes | Custom Usage | System Adoption | Priority |
|---------|---|---|---|---|
| **Buttons** | 4 | 10+ variations | 15% | 🔴 CRITICAL |
| **Cards** | 5 | 12+ variations | 12% | 🔴 CRITICAL |
| **Modals** | 0 | 12 unique impls | 0% | 🔴 CRITICAL |
| **Badges** | 5 | 8 variations | 35% | 🟡 HIGH |
| **Inputs** | 2 | 7 variations | 25% | 🟡 HIGH |
| **Headings** | 3 | 10 variations | 20% | 🟡 HIGH |
| **Tables/Lists** | 1 major | 4 alternatives | 40% | 🟢 MEDIUM |

**Result:** Only **~40 instances** of system class usage across 60+ components. Need **immediate standardization**.

---

## Component Unification Strategy

### Phase 1: Create Reusable Component Wrappers (Week 1-2)

Create 8 foundational components that wrap and enforce design system compliance:

#### 1. **Button Component** (`/common/Button.tsx`)
**Unifies:** `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` + inline variations

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseClass = `btn btn-${variant}`;
  const sizeClass = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }[size];

  return (
    <button className={`${baseClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
};
```

**Replaces:** 10+ inline button implementations  
**Files to Update:** CoverLetterModal, AtsInlinePanel, JobChatWindow, CoverLetterPage (15+ instances)

---

#### 2. **Card Component** (`/common/Card.tsx`)
**Unifies:** `.card`, `.card-elevated`, manual card styling

```typescript
type CardVariant = 'default' | 'elevated' | 'nested';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hoverable = false,
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClass = `card ${variant === 'elevated' ? 'card-elevated' : ''}`;
  const paddingClass = {
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  }[padding];

  return (
    <div className={`${variantClass} ${paddingClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
```

**Replaces:** 12+ manual card styling patterns  
**Files to Update:** ApplicationCard, AtsScoreCard, DashboardWidgets (20+ instances)

---

#### 3. **Badge Component** (`/common/Badge.tsx`)
**Unifies:** `.badge-*` classes + custom status badges

```typescript
type BadgeVariant = 'gold' | 'jade' | 'rose' | 'ember' | 'ink' | 'accent';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'ink',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`badge badge-${variant} ${sizeClass} ${className}`} {...props}>
      {children}
    </span>
  );
};
```

**Replaces:** 8+ custom badge implementations  
**Files to Update:** JobStatusBadge, ApplicationCard, RecommendationBadge (12+ instances)

---

#### 4. **Modal Component** (`/common/Modal.tsx`) ⭐ **HIGHEST IMPACT**
**Unifies:** 12 different modal implementations (ConfirmModal, JobChatModal, CoverLetterModal, etc.)

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeButton = true,
}) => {
  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className={`${sizeClass} w-full mx-4 animate-in zoom-in duration-200`}>
        {(title || closeButton) && (
          <div className="flex items-center justify-between mb-6 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
            {title && <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '1.25rem' }}>{title}</h2>}
            {closeButton && (
              <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
                ✕
              </button>
            )}
          </div>
        )}
        {children}
        {footer && (
          <div className="mt-6 pt-6 border-t flex gap-2 justify-end" style={{ borderColor: 'var(--border)' }}>
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};
```

**Replaces:** 12 unique modal implementations  
**Files to Update:** ConfirmModal, JobChatModal, CoverLetterModal, NotesModal, CoverLetterEditor, InterviewMaterialsPage, ReminderModal, UserInputModal, EmailFormatModal (40+ modal instances)

---

#### 5. **Input Component** (`/common/Input.tsx`)
**Unifies:** `.input-base` + custom input styling

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        <input
          className={`input-base ${icon ? 'pl-9' : ''} ${error ? 'border-red-500' : ''}`}
          {...props}
        />
      </div>
      {(error || helperText) && (
        <p className="text-xs mt-1" style={{ color: error ? 'var(--error)' : 'var(--text-muted)' }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};
```

**Replaces:** 7+ input styling patterns  
**Files to Update:** CoverLetterPage, ReminderModal, EditModals (15+ instances)

---

#### 6. **Heading Component** (`/common/Heading.tsx`)
**Unifies:** h1, h2, h3 + custom heading styles

```typescript
type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';
type HeadingSize = 'lg' | 'md' | 'sm';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  size?: HeadingSize;
  subtitle?: string;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 'h2',
  size = 'md',
  subtitle,
  children,
  className = '',
  ...props
}) => {
  const sizeClass = {
    lg: 'text-2xl',
    md: 'text-lg',
    sm: 'text-base',
  }[size];

  const Comp = level as any;

  return (
    <>
      <Comp className={`font-semibold ${sizeClass} ${className}`} style={{ color: 'var(--text-primary)', fontFamily: "'Fraunces', Georgia, serif" }} {...props}>
        {children}
      </Comp>
      {subtitle && (
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      )}
    </>
  );
};
```

**Replaces:** 10+ heading styling patterns  
**Files to Update:** CoverLetterModal, AtsScoreCard, Pages (25+ instances)

---

#### 7. **Table/Card List Component** (`/common/ListCard.tsx`)
**Unifies:** TableOrCards + 4 alternative list implementations

```typescript
interface ListCardProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  variant?: 'table' | 'cards';
  onItemClick?: (item: T) => void;
}

export const ListCard = <T,>({
  items,
  renderItem,
  emptyState,
  variant = 'cards',
  onItemClick,
}: ListCardProps<T>) => {
  if (items.length === 0) {
    return (
      <Card className="text-center py-12">
        {emptyState || <p style={{ color: 'var(--text-muted)' }}>No items found</p>}
      </Card>
    );
  }

  return (
    <div className={variant === 'cards' ? 'space-y-3' : ''}>
      {items.map((item, index) => (
        <div key={index} onClick={() => onItemClick?.(item)} className="cursor-pointer">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
};
```

**Replaces:** 4+ list/table implementations  
**Files to Update:** AdminErrorsPage, RecentActivityWidget, MaterialsList (10+ instances)

---

#### 8. **Collapsible Section Component** (`/common/CollapsibleSection.tsx`)
**Unifies:** Multiple accordion/collapsible implementations

```typescript
interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

export const CollapsibleSection: React.FC<CollapsibleProps> = ({
  title,
  defaultOpen = false,
  children,
  icon,
  count,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card variant="nested">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {count !== undefined && <Badge>{count}</Badge>}
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>{children}</div>}
    </Card>
  );
};
```

**Replaces:** 5+ accordion implementations  
**Files to Update:** AtsPanel, GeneralCvAtsPanel, InterviewMaterialsPage (8+ instances)

---

### Phase 2: Migration Plan (Week 3-4)

#### Priority Order (High → Low Impact)

1. **REPLACE Modals** (Week 3, Mon-Tue) — 40+ instances, 12 files
   - Update: `ConfirmModal`, `JobChatModal`, `CoverLetterModal`, `NotesModal`, `CoverLetterEditor`, etc.
   - Tests: Modal open/close, footer actions, size responsiveness

2. **REPLACE Buttons** (Week 3, Wed-Thu) — 20+ instances, 15 files
   - Update: All `className="btn-primary"` → `<Button variant="primary" />`
   - Tests: Hover states, disabled state, loading state

3. **REPLACE Cards** (Week 3, Fri + Week 4, Mon) — 15+ instances, 12 files
   - Update: All manual card styling → `<Card />`
   - Tests: Padding, hover, shadows

4. **REPLACE Inputs** (Week 4, Tue) — 10+ instances, 8 files
   - Update: Manual input styling → `<Input />`
   - Tests: Focus state, error display

5. **REPLACE Badges** (Week 4, Wed) — 10+ instances, 8 files
6. **REPLACE Headings** (Week 4, Thu) — 15+ instances, 12 files
7. **CONSOLIDATE Lists** (Week 4, Fri) — 5+ instances, 5 files

---

## Implementation Checklist

### Create Component Files
- [ ] `/common/Button.tsx` 
- [ ] `/common/Card.tsx`
- [ ] `/common/Badge.tsx`
- [ ] `/common/Modal.tsx`
- [ ] `/common/Input.tsx`
- [ ] `/common/Heading.tsx`
- [ ] `/common/ListCard.tsx`
- [ ] `/common/CollapsibleSection.tsx`

### Create Tests
- [ ] `Button.test.tsx` — variants, sizes, loading state
- [ ] `Card.test.tsx` — variants, padding
- [ ] `Modal.test.tsx` — open/close, size, footer
- [ ] `Input.test.tsx` — error state, label, helper text
- [ ] `Badge.test.tsx` — variants, sizes
- [ ] `Heading.test.tsx` — levels, sizes
- [ ] `ListCard.test.tsx` — empty state, rendering

### Refactor Components (by priority)

**Week 3:**
- [ ] `ConfirmModal.tsx` → Use `<Modal />`
- [ ] `JobChatModal.tsx` → Use `<Modal />`
- [ ] `CoverLetterModal.tsx` → Use `<Modal />`
- [ ] All modal files (12 total)
- [ ] All button usages → `<Button />`

**Week 4:**
- [ ] All card usages → `<Card />`
- [ ] All input usages → `<Input />`
- [ ] All badge usages → `<Badge />`
- [ ] All heading usages → `<Heading />`
- [ ] List displays → `<ListCard />`

### Update Documentation
- [ ] Add component examples to [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [ ] Create [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) with usage examples
- [ ] Add to [DEVELOPMENT.md](./DEVELOPMENT.md) → "Component Usage Guidelines"

### Validation
- [ ] All TypeScript compiles without errors
- [ ] All tests pass (95%+ coverage)
- [ ] Visual regression tests pass (Chromatic/Percy)
- [ ] Performance: No bundle size increase >5%
- [ ] Accessibility: No regression in WCAG AA compliance

---

## Expected Benefits

### Immediate (After Phase 1-2)
- ✅ **Consistent UI** — All buttons/cards/modals look identical
- ✅ **Reduced code** — 30-40% less styling code
- ✅ **Maintainability** — Changes to button style update across entire app instantly
- ✅ **Developer velocity** — New developers have single source of truth

### Long-term (Sustainment)
- ✅ **Design debt reduction** — No more ad-hoc styling
- ✅ **Theme switching** — Dark/light mode toggle becomes trivial
- ✅ **Feature velocity** — New pages build faster using component library
- ✅ **Bundle size** — Reduce CSS duplication

### Metrics
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Files using design system | 40/100 (40%) | 95/100 (95%) | +138% |
| CSS duplication | 200+ KB | 120 KB | -40% |
| Button implementations | 4 system + 10 ad-hoc | 1 unified | -13 |
| Modal implementations | 12 unique | 1 unified | -11 |
| New page dev time | ~4 hours | ~2 hours | -50% |

---

## File Inventory for Refactoring

### Modals (12 files, ~40 instances)
```
ConfirmModal.tsx
JobChatModal.tsx
CoverLetterModal.tsx
NotesModal.tsx
CoverLetterEditor.tsx (modal section)
InterviewMaterialsPage.tsx (inline modals)
ReminderModal.tsx
UserInputModal.tsx
EmailFormatModal.tsx
EmbedCodeModal.tsx
GenerateDraftModal.tsx
SettingsModal.tsx
```

### Buttons (15 files, ~20 instances)
```
CoverLetterEditor.tsx
CoverLetterPage.tsx
JobChatWindow.tsx
AtsInlinePanel.tsx
CoverLetterModal.tsx
ReviewFinalizePage.tsx
ConfirmModal.tsx
NotesModal.tsx
PromptCustomizer.tsx
WeeklyGoalWidget.tsx
InterviewMaterialsPage.tsx
+ 4 other pages
```

### Cards (12 files, ~15 instances)
```
ApplicationCard.tsx
AtsScoreCard.tsx
AnalysisDashboard.tsx
DashboardPage.tsx
AnalyticsPage.tsx
+ 7 other dashboard/widget files
```

---

## Notes & Considerations

### Design System Assumptions
- All components follow CSS custom properties (`var(--accent)`, etc.)
- Tailwind configured with design system colors
- No hardcoded colors in components
- Dark mode as primary experience

### Migration Strategy
- **Backward compatible** — Keep old classes for 2 releases
- **Gradual adoption** — Don't require refactor of all files at once
- **Co-exist** — Old and new patterns can coexist during transition
- **Feature flag** — Use feature flags for risky modals (JobChat, CoverLetter)

### Testing Strategy
- Unit tests for each component variant
- Integration tests for modal flows
- Visual regression tests for each variant
- Performance tests (bundle size, render time)

---

**Next Steps:**
1. ✅ Get stakeholder approval on component list
2. Create component files with TypeScript interfaces
3. Write comprehensive unit tests
4. Create Storybook/Chromatic for visual validation
5. Execute Phase 1 & 2 migration
6. Update DESIGN_SYSTEM.md with new component library

**Estimated Effort:** 3-4 weeks (1 dev, full-time)  
**Risk Level:** LOW (components are isolated, can test independently)  
**ROI:** HIGH (30-40% CSS reduction, faster feature velocity)
