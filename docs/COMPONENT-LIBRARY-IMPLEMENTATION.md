# Component Library Implementation Guide

Quick-start guide for implementing the unified component library outlined in [COMPONENT-UNIFICATION-PLAN.md](./COMPONENT-UNIFICATION-PLAN.md).

---

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Component 1: Button](#component-1-button) — Start here
3. [Component 2: Card](#component-2-card)
4. [Component 3: Modal](#component-3-modal)
5. [Testing Strategy](#testing-strategy)
6. [Migration Checklist](#migration-checklist)

---

## Before You Start

### Prerequisites
- Familiarity with React and TypeScript
- Understanding of the Obsidian Intelligence design system (see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md))
- Access to `client/src/components/common/` directory
- Tailwind CSS and CSS custom properties knowledge

### Design System Values to Remember
```typescript
// Colors (use these, not hardcoded values)
--accent: #d97706
--text-primary: #eeeef8
--text-secondary: #9090b4
--text-muted: #585878
--bg-surface: #1a1a28
--bg-elevated: #212130
--border: #333348

// Typography
Fraunces: headings
Outfit: body text
JetBrains Mono: code/badges

// Sizes
sm: 12px
base: 14px
md: 16px
lg: 18px
xl: 24px
```

---

## Component 1: Button

**Priority:** 🔴 CRITICAL  
**Impact:** 20+ usages across 15 files  
**Effort:** 2-3 hours (component + tests)  

### Step 1: Create Button Component

Create file: `client/src/components/common/Button.tsx`

```typescript
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * Unified Button component following Obsidian Intelligence design system.
 * Replaces ad-hoc button styling across the codebase.
 *
 * @example
 * // Primary button
 * <Button onClick={handleClick}>Save Changes</Button>
 *
 * @example
 * // Secondary with icon
 * <Button variant="secondary" size="sm" icon={<EditIcon />}>
 *   Edit
 * </Button>
 *
 * @example
 * // Danger button (destructive action)
 * <Button variant="danger">Delete</Button>
 *
 * @example
 * // Loading state
 * <Button isLoading>Processing...</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base class from @layer components in index.css
    const variantClass = `btn btn-${variant}`;

    // Size-based padding and text
    const sizeClass = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    }[size];

    // Loading state styling
    const loadingClass = isLoading ? 'opacity-60 cursor-wait' : '';

    return (
      <button
        ref={ref}
        className={`${variantClass} ${sizeClass} ${loadingClass} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && <span>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span>{icon}</span>}
          {isLoading && (
            <span
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### Step 2: Export from common/index.ts

Add to `client/src/components/common/index.ts`:

```typescript
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
```

### Step 3: Create Tests

Create file: `client/src/components/common/Button.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');

    rerender(<Button variant="secondary">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveClass('opacity-60');
  });

  it('renders icon', () => {
    render(<Button icon={<span data-testid="icon">📎</span>}>With Icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('applies size classes', () => {
    const { rerender } = render(<Button size="sm">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-2 py-1 text-xs');

    rerender(<Button size="lg">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-4 py-3 text-base');
  });
});
```

### Step 4: Find & Replace Old Buttons

Search for patterns and update:

**Before:**
```tsx
<button className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
  Save
</button>
```

**After:**
```tsx
import { Button } from '@/components/common';

<Button>Save</Button>
```

**Before (with loader):**
```tsx
<button 
  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm"
  disabled={loading}
>
  {loading && <Spinner className="w-4 h-4" />}
  Save
</button>
```

**After:**
```tsx
import { Button } from '@/components/common';

<Button isLoading={loading} icon={loading ? <Spinner /> : undefined}>
  Save
</Button>
```

**Files to Update (Priority Order):**
1. `CoverLetterEditor.tsx` (5 instances)
2. `ReviewFinalizePage.tsx` (4 instances)
3. `AtsInlinePanel.tsx` (3 instances)
4. `JobChatWindow.tsx` (2 instances)
5. `PromptCustomizer.tsx` (2 instances)
6. `CoverLetterModal.tsx` (2 instances)
7. And 9 other files

### Step 5: Validation

```bash
# Run tests
npm run test -- Button.test.tsx

# Check TypeScript
npm run type-check

# Visual check in browser
npm run dev
# Navigate to pages using buttons and verify styling is identical
```

---

## Component 2: Card

**Priority:** 🔴 CRITICAL  
**Impact:** 15+ usages across 12 files  
**Effort:** 2-3 hours  
**Depends on:** Button (for consistency)

### Implementation Path

Similar to Button component:

1. Create `client/src/components/common/Card.tsx`
2. Export from `common/index.ts`
3. Create `Card.test.tsx`
4. Replace usages in:
   - `ApplicationCard.tsx`
   - `AtsScoreCard.tsx`
   - Widget files
   - Dashboard components

### Key Points
- Preserve `.card` and `.card-elevated` classes
- Support `padding` prop: 'sm' | 'md' | 'lg'
- Support `hoverable` prop for interactive cards
- Default variant should be 'default' (uses `.card`)

---

## Component 3: Modal

**Priority:** 🔴 CRITICAL (HIGHEST IMPACT)  
**Impact:** 40+ instances across 12 files  
**Effort:** 4-5 hours  
**Complexity:** HIGH  

### Implementation Path

1. Create `client/src/components/common/Modal.tsx`
2. Create `ModalContent.tsx` and `ModalFooter.tsx` subcomponents
3. Create comprehensive tests covering:
   - Open/close animations
   - Size variants
   - Footer actions
   - Keyboard navigation (ESC to close)
   - Click outside to close
4. Migrate modals in order:
   - `ConfirmModal.tsx` → wrapper around new `Modal`
   - `JobChatModal.tsx` → likely needs custom content
   - `CoverLetterModal.tsx` → likely needs custom content
   - Others

### Key Considerations

**Animations:**
- Use Tailwind `animate-in` for smooth entrance
- Use fade + zoom for dialog effect
- Respect `prefers-reduced-motion`

**Accessibility:**
- Trap focus inside modal
- Close on ESC key
- Modal should be in React Portal or have z-index management
- ARIA labels for screen readers

**Variants by Modal Type:**

| Modal | Type | Complexity | Notes |
|-------|------|-----------|-------|
| ConfirmModal | Action confirmation | Simple | Yes/No buttons |
| JobChatModal | Long-lived chat | Complex | Scrollable content |
| CoverLetterModal | Full editor | Complex | Rich text, tabs |
| NotesModal | Text notes | Simple | Text area + save |
| ReminderModal | Reminder settings | Medium | Date/time pickers |
| UserInputModal | Missing info | Medium | Dynamic form fields |
| EmailFormatModal | Format selection | Simple | Radio buttons |

---

## Testing Strategy

### Unit Tests (Per Component)
- ✅ Default rendering
- ✅ All variant/prop combinations
- ✅ Event handlers
- ✅ Disabled states
- ✅ Loading states
- ✅ Error states (if applicable)

### Integration Tests
- ✅ Button + Modal open/close
- ✅ Input + Button submit flow
- ✅ Card + Badge combination

### Visual Regression Tests
- ✅ Light mode variants
- ✅ Dark mode variants
- ✅ Responsive sizes (mobile, tablet, desktop)
- ✅ Hover/focus states

### Performance Tests
- ✅ Component render time < 1ms
- ✅ No unnecessary re-renders
- ✅ Bundle size doesn't increase > 5%

### Accessibility Audit
- ✅ WCAG AA compliant
- ✅ Keyboard navigation works
- ✅ Screen reader announces content
- ✅ Color contrast > 4.5:1

---

## Migration Checklist

### Pre-Migration
- [ ] Create feature branch: `feat/component-unification`
- [ ] Review [COMPONENT-UNIFICATION-PLAN.md](./COMPONENT-UNIFICATION-PLAN.md)
- [ ] Install/update testing libraries if needed: `@testing-library/react`
- [ ] Create all 8 component files (or start with Button)

### Component 1: Button (Week 1)
- [ ] Create `Button.tsx` with all variants
- [ ] Write comprehensive tests
- [ ] Create Storybook/demo
- [ ] Update `CoverLetterEditor.tsx` (5 instances)
- [ ] Update `ReviewFinalizePage.tsx` (4 instances)
- [ ] Test all button interactions
- [ ] PR review + merge

### Component 2: Card (Week 2)
- [ ] Create `Card.tsx`
- [ ] Write tests
- [ ] Update `ApplicationCard.tsx`
- [ ] Update 11 other files
- [ ] Visual regression tests
- [ ] PR review + merge

### Component 3: Modal (Week 2-3)
- [ ] Create `Modal.tsx` + subcomponents
- [ ] Create comprehensive tests (focus traps, keyboard nav)
- [ ] Update `ConfirmModal.tsx` first (simplest)
- [ ] Update remaining 11 modals
- [ ] Accessibility audit
- [ ] PR review + merge

### Components 4-8 (Week 3-4)
- [ ] Input component
- [ ] Badge component
- [ ] Heading component
- [ ] ListCard component
- [ ] CollapsibleSection component

### Post-Migration
- [ ] All TypeScript checks pass
- [ ] All tests pass (>90% coverage)
- [ ] No bundle size regression
- [ ] Documentation updated in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [ ] Create [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) with examples
- [ ] Team training/demo
- [ ] Deploy to production

---

## Common Patterns

### Forwarding Refs

For components that wrap HTML elements (Button, Input, Modal trigger):

```typescript
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <button ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
```

### Extending HTML Attributes

For flexibility with native HTML props:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  // ... custom props
}
```

### Conditional Classes

Using template literals for cleaner conditionals:

```typescript
const className = `
  btn
  btn-${variant}
  ${size === 'lg' ? 'px-4 py-3' : 'px-3 py-2'}
  ${isLoading ? 'opacity-50 cursor-wait' : ''}
  ${customClass}
`;
```

---

## Troubleshooting

### Issue: "Cannot find module" after creating component

**Solution:** Add export to `components/common/index.ts`

```typescript
export { Button } from './Button';
```

### Issue: CSS class not applying in new component

**Solution:** Check that:
1. Tailwind is processing the file: `include: ['./src/**/*']`
2. CSS custom properties are defined in `index.css`
3. Component imports `index.css` via App.tsx or root file

### Issue: TypeScript errors when using component

**Solution:**
1. Ensure proper ref forwarding with `React.forwardRef`
2. Export interface: `export interface ButtonProps extends...`
3. Add `React.FC<ButtonProps>` type annotation

### Issue: Component not re-rendering on state change

**Solution:**
1. Check that state is in parent component, not component itself
2. Verify props are passed correctly
3. Check for mutable state bugs (common in animations)

---

## Links & References

- 📘 [Design System](./DESIGN_SYSTEM.md) — Color palette, typography, spacing
- 📋 [Unification Plan](./COMPONENT-UNIFICATION-PLAN.md) — Full strategy & rationale
- 🧪 [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro)
- ⚛️ [React Docs - forwardRef](https://react.dev/reference/react/forwardRef)
- 🎨 [Tailwind CSS Docs](https://tailwindcss.com/docs)
- ♿ [WCAG Accessibility Standards](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Questions?**
- Check existing component examples in `/components/common/`
- Review [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for token values
- Create an issue if you find a pattern not covered here

**Last Updated:** March 31, 2026
