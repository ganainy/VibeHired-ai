# 🚀 Component Library Quick Reference

## Available Components (as of March 31, 2026)

### ✅ Button (Ready to Use)

**Import:**
```tsx
import { Button } from '@/components/common';
```

**Variants:** `primary` | `secondary` | `ghost` | `danger`  
**Sizes:** `sm` | `md` (default) | `lg`

**Examples:**
```tsx
// Basic
<Button>Click me</Button>

// Variants
<Button variant="secondary">Edit</Button>
<Button variant="danger">Delete</Button>
<Button variant="ghost">Cancel</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// With icon
<Button icon={<SaveIcon />}>Save</Button>
<Button icon={<ArrowIcon />} iconPosition="right">Next</Button>

// Loading state
<Button isLoading={loading}>Saving...</Button>

// Disabled
<Button disabled>Unavailable</Button>

// Combined
<Button 
  variant="primary" 
  size="lg" 
  icon={<CheckIcon />}
  isLoading={isProcessing}
  onClick={handleSave}
>
  Save Changes
</Button>
```

**Defaults:** `variant="primary"` | `size="md"` | `iconPosition="left"`

---

## 🔄 Migration Pattern (Applies to All Components)

### Before (Ad-hoc)
```tsx
<button className="btn-primary px-3 py-2 text-sm hover:bg-amber-600">
  Save
</button>
```

### After (Unified)
```tsx
import { Button } from '@/components/common';

<Button>Save</Button>
```

---

## 📚 Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| `README.md` (this dir) | Component status & usage | All devs |
| `Button.test.tsx` | Test examples | QA engineers |
| `Button.showcase.tsx` | Visual demo | Designers & devs |
| [COMPONENT-MIGRATION-EXAMPLES.md](../../docs/COMPONENT-MIGRATION-EXAMPLES.md) | Before/after code | Migrating developers |
| [COMPONENT-LIBRARY-IMPLEMENTATION.md](../../docs/COMPONENT-LIBRARY-IMPLEMENTATION.md) | How to build | Component creators |
| [COMPONENT-UNIFICATION-PLAN.md](../../docs/COMPONENT-UNIFICATION-PLAN.md) | Strategy & timeline | Leads |

---

## ⏳ Components Coming Soon

| Component | ETA | Priority | Instances | Files |
|-----------|-----|----------|-----------|-------|
| Modal | Week 2-3 | 🔴 HIGH | 40+ | 12 |
| Card | Week 2 | 🔴 HIGH | 15+ | 12 |
| Input | Week 3 | 🟡 MED | 10+ | 8 |
| Badge | Week 3 | 🟡 MED | 10+ | 8 |
| Heading | Week 3-4 | 🟡 MED | 15+ | 12 |
| ListCard | Week 4 | 🟡 MED | 5+ | 5 |
| CollapsibleSection | Week 4 | 🟡 MED | 5+ | 5 |

---

## 🧪 Testing Commands

```bash
# Test Button component
npm run test -- Button.test.tsx

# Test all components in common/
npm run test -- common/

# Test with coverage
npm run test -- common/ --coverage

# Type checking
npm run type-check

# Dev server (visual verification)
npm run dev
```

---

## 🎯 Migration Checklist (Per File)

For each file needing migration:

- [ ] Identify old button/card/modal/etc. patterns
- [ ] Add import: `import { Button } from '@/components/common';`
- [ ] Replace ad-hoc styling with `<Button variant="..." />`
- [ ] Test in browser: `npm run dev`
- [ ] Run tests: `npm run test`
- [ ] TypeScript check: `npm run type-check`
- [ ] Git commit with file count in message

---

## 💡 Pro Tips

### Prop Forwarding
All components forward standard HTML attributes:
```tsx
<Button 
  onClick={handler}      // HTML
  className="extra"      // HTML
  variant="secondary"    // Component
  icon={<Icon />}        // Component
/>
```

### TypeScript Support
Import types for prop definitions:
```tsx
import { Button, type ButtonProps, type ButtonVariant } from '@/components/common';

function MyComponent(props: ButtonProps) {
  return <Button {...props} />;
}
```

### Combining Props
```tsx
// Mix variants, sizes, states
<Button variant="danger" size="lg" isLoading={isDeleting}>
  Delete Forever
</Button>
```

---

## 🆘 Troubleshooting

**Q: Component doesn't render**  
A: Check import: `import { Button } from '@/components/common'`

**Q: Styling looks wrong**  
A: Verify design system CSS is imported in `App.tsx`

**Q: Type errors**  
A: Run `npm run type-check` and check ButtonProps interface

**Q: Tests failing**  
A: Run `npm run test -- Button.test.tsx` to see detailed errors

---

## 📞 Next Steps

1. **Start using Button** in new code
2. **Read examples** in [COMPONENT-MIGRATION-EXAMPLES.md](../../docs/COMPONENT-MIGRATION-EXAMPLES.md)
3. **Migrate one file** following the pattern above
4. **Wait for Modal** (Week 2-3) for highest impact
5. **Report issues** to design system team

---

**Status:** 1/8 components done ✅  
**ETA Completion:** April 30, 2026 (4 weeks)  
**Expected Results:** 30-40% CSS reduction, 50% faster page development

Last Updated: March 31, 2026
