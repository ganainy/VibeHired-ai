# Common UI Components Library

Unified component library following the Obsidian Intelligence design system. All components are built for reusability, consistency, and accessibility.

## ✅ Implemented Components

### Button
**Status:** ✅ Complete  
**File:** `Button.tsx`  
**Variants:** primary, secondary, ghost, danger  
**Sizes:** sm, md (default), lg  
**Features:** Icons, loading state, ref forwarding, full accessibility

**Quick Start:**
```tsx
import { Button } from '@/components/common';

<Button onClick={handleClick}>Save</Button>
<Button variant="secondary" size="sm">Edit</Button>
<Button variant="danger">Delete</Button>
<Button isLoading={isLoading}>Processing...</Button>
<Button icon={<SaveIcon />}>Save Draft</Button>
```

**Documentation:**
- [Migration Examples](../../docs/COMPONENT-MIGRATION-EXAMPLES.md#1-button-component-migration)
- [Button Test Suite](./Button.test.tsx)
- [Button Showcase](./Button.showcase.tsx)

---

## 🔄 In Progress / Planned

### Card
**Status:** ⏳ Planned (Week 2)  
**Purpose:** Unify 15+ card implementations into single component  
**Expected variants:** default, elevated, nested  

### Modal
**Status:** ⏳ Planned (Week 2-3, HIGH PRIORITY)  
**Purpose:** Consolidate 12 modal implementations (40+ instances)  
**Expected features:** Title, footer, size variants, animations, accessibility

### Input
**Status:** ⏳ Planned (Week 3)  
**Purpose:** Standardize form inputs (10+ ad-hoc patterns)  
**Expected features:** Label, error state, icon support, helper text

### Badge
**Status:** ⏳ Planned (Week 3)  
**Purpose:** Unify badge variants (10+ custom implementations)  
**Expected variants:** jade, rose, ember, azure, gold, ink  
**Expected sizes:** sm, md (default), lg

### Heading
**Status:** ⏳ Planned (Week 3-4)  
**Purpose:** Standardize headings (15+ inconsistent patterns)  
**Expected levels:** h1-h4 with preset sizes and typography

### ListCard
**Status:** ⏳ Planned (Week 4)  
**Purpose:** Consolidate TableOrCards + 4 alternative list patterns  
**Expected features:** Title, description, metadata, hover interaction

### CollapsibleSection
**Status:** ⏳ Planned (Week 4)  
**Purpose:** Unify 5+ accordion implementations  
**Expected features:** Expand/collapse animation, header customization

---

## 📖 How to Use

### Importing Components

```tsx
// Import single component
import { Button } from '@/components/common';

// Import multiple components
import { Button, Card, Badge } from '@/components/common';

// Import types
import { Button, type ButtonProps, type ButtonVariant } from '@/components/common';
```

### Props Pattern

All components follow consistent prop patterns:

```tsx
// TypeScript interface
interface ComponentProps extends React.HTMLAttributes<HTMLElement> {
  // Component-specific props
  variant?: 'primary' | 'secondary' | ...;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  
  // Standard HTML props supported
  className?: string;
  onClick?: () => void;
  // ... and any other HTML element attributes
}

// Usage
<Button 
  variant="primary"          // Component prop
  size="lg"                  // Component prop
  onClick={handleClick}      // HTML prop
  className="custom-class"   // HTML prop
  disabled={isDisabled}      // HTML prop
/>
```

### Ref Forwarding

All components support ref forwarding for imperative usage:

```tsx
const buttonRef = useRef<HTMLButtonElement>(null);

<Button ref={buttonRef}>Click</Button>

// Later: imperatively click the button
buttonRef.current?.click();
```

---

## 🧪 Testing

Each component includes a comprehensive test suite:

```bash
# Run Button tests
npm run test -- Button.test.tsx

# Run all component tests
npm run test -- common/

# Run with coverage
npm run test -- common/ --coverage
```

**Test Categories:**
- Rendering & defaults
- Variants and sizes
- States (disabled, loading, etc.)
- Event handling
- Accessibility (ARIA, keyboard nav)
- Custom classes
- HTML attributes
- Ref forwarding
- Combinations and edge cases

---

## 🎨 Design System Integration

All components use the Obsidian Intelligence design system:

**CSS Classes:** Components use `.btn-*`, `.card-*`, `.badge-*` classes from `index.css`  
**Colors:** Design tokens via CSS custom properties (`--accent`, `--text-primary`, etc.)  
**Typography:** Fraunces (headings), Outfit (body), JetBrains Mono (data)  
**Spacing:** 8-point grid system (4px, 8px, 16px, 24px, 32px)  

See [DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md) for complete reference.

---

## 📝 Implementation Checklist

For developers creating new components, follow this checklist:

- [ ] Create `ComponentName.tsx` with full TypeScript interface
- [ ] Export component with proper types from `index.ts`
- [ ] Create `ComponentName.test.tsx` with 20+ test cases
- [ ] Create `ComponentName.showcase.tsx` showing all variants
- [ ] Document in this README with quick start example
- [ ] Add migration examples to [COMPONENT-MIGRATION-EXAMPLES.md](../../docs/COMPONENT-MIGRATION-EXAMPLES.md)
- [ ] Run tests: `npm run test -- ComponentName.test.tsx`
- [ ] Check TypeScript: `npm run type-check`
- [ ] Visual check in browser: `npm run dev`

---

## 🚀 Migration Strategy

See [COMPONENT-UNIFICATION-PLAN.md](../../docs/COMPONENT-UNIFICATION-PLAN.md) for detailed 4-week migration timeline.

**Quick Timeline:**
- **Week 1-2:** Create Button, Card, Badge, Input components
- **Week 2-3:** Modal component + 12-file modal migration
- **Week 3-4:** Heading, ListCard, CollapsibleSection + remaining migrations

**For File-Specific Migration:**
- 27 files need updates across 7 categories
- See [COMPONENT-MIGRATION-EXAMPLES.md](../../docs/COMPONENT-MIGRATION-EXAMPLES.md) for before/after code
- See [COMPONENT-LIBRARY-IMPLEMENTATION.md](../../docs/COMPONENT-LIBRARY-IMPLEMENTATION.md) for detailed steps

---

## 📚 Additional Resources

- **[DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md)** — Design tokens, colors, typography, spacing
- **[COMPONENT-UNIFICATION-PLAN.md](../../docs/COMPONENT-UNIFICATION-PLAN.md)** — Strategy, metrics, ROI
- **[COMPONENT-LIBRARY-IMPLEMENTATION.md](../../docs/COMPONENT-LIBRARY-IMPLEMENTATION.md)** — Step-by-step build guide
- **[COMPONENT-MIGRATION-EXAMPLES.md](../../docs/COMPONENT-MIGRATION-EXAMPLES.md)** — Real code examples
- **React Docs:** https://react.dev
- **Testing Library:** https://testing-library.com
- **Tailwind CSS:** https://tailwindcss.com

---

## ✨ Component Status Matrix

| Component | Status | Variants | Sizes | Tests | Showcase | Migration | Files |
|-----------|--------|----------|-------|-------|----------|-----------|-------|
| Button | ✅ Ready | 4 | 3 | ✅ 30+ | ✅ | Pending | 15 |
| Card | ⏳ Planned | 3 | - | - | - | - | 12 |
| Modal | ⏳ HIGH PRIORITY | 2 | 3 | - | - | - | 12 |
| Input | ⏳ Planned | 2 | - | - | - | - | 8 |
| Badge | ⏳ Planned | 6 | 3 | - | - | - | 8 |
| Heading | ⏳ Planned | - | 4 | - | - | - | 12 |
| ListCard | ⏳ Planned | - | - | - | - | - | 5 |
| CollapsibleSection | ⏳ Planned | - | - | - | - | - | 5 |

**Legend:**
- ✅ = Complete
- ⏳ = Planned
- Total files needing migration: 77+ across all components
- Expected CSS reduction: 30-40%
- Expected dev velocity improvement: 50% faster new page creation

---

## 🔗 Files in This Directory

```
common/
├── index.ts                           # Component exports
├── Button.tsx                         # ✅ Button component
├── Button.test.tsx                    # ✅ Button tests (30+ cases)
├── Button.showcase.tsx                # ✅ Button demo
├── Card.tsx                           # ⏳ (Planned)
├── Card.test.tsx                      # ⏳ (Planned)
├── Modal.tsx                          # ⏳ HIGH PRIORITY
├── ModalContent.tsx                   # ⏳ Modal subcomponent
├── ModalFooter.tsx                    # ⏳ Modal subcomponent
├── Input.tsx                          # ⏳ (Planned)
├── Badge.tsx                          # ⏳ (Planned)
├── Heading.tsx                        # ⏳ (Planned)
├── ListCard.tsx                       # ⏳ (Planned)
├── CollapsibleSection.tsx             # ⏳ (Planned)
├── README.md                          # You are here
└── [test files]                       # One .test.tsx per component
```

---

**Last Updated:** March 31, 2026  
**Maintainer:** Design System Team  
**Status:** Button ✅ | 7 components pending
