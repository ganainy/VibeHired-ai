# UI Style Guidelines — Obsidian Intelligence Design System

This is the **authoritative reference** for building new screens in VibeHired. Follow every section to ensure visual consistency.

---

## 1. Design Philosophy

**Obsidian Intelligence** — dark-first, editorial, precise.

- **Dark-first**: Dark mode is the primary experience. Light mode is a minimal, warm-paper variant.
- **Typographic hierarchy**: Serif display headings (Fraunces) over clean body text (Outfit).
- **Warm gold accent** (`#e8b844`) instead of any blue/purple. One accent color, used sparingly.
- **Restraint**: Surfaces are layered dark ink tones, not colorful. Color is reserved for status and CTAs.
- **Data clarity**: Numbers and labels use JetBrains Mono for instant scannability.

---

## 2. Fonts

| Role | Family | Usage |
|------|--------|-------|
| **Display** | `Fraunces` (serif) | `<h1>`, `<h2>`, `<h3>`, `.page-title`, hero text |
| **Body** | `Outfit` (sans) | All body text, labels, buttons, inputs |
| **Data / Mono** | `JetBrains Mono` | Stats, numbers, badges, code, timestamps |

Tailwind classes:
```tsx
// Display heading
<h1 className="font-display text-3xl font-semibold tracking-tight">

// Body (default — no class needed, set on html/body)

// Mono data
<span className="font-mono text-sm">
```

> `h1`, `h2`, `h3` automatically use Fraunces via the global CSS rule. No extra class needed.

---

## 3. Color System

### CSS Custom Properties (always prefer these over raw Tailwind colors)

```
Background layers (dark, lightest → deepest):
  --bg-raised:    #222233   ← interactive hover targets
  --bg-elevated:  #1c1c2a   ← card interiors, inputs
  --bg-surface:   #15151f   ← card backgrounds
  --bg-base:      #0e0e17   ← page background

Borders:
  --border-bright:  #363655  ← highlighted / focused
  --border:         #2a2a3d  ← default
  --border-subtle:  #1e1e2c  ← very faint

Text:
  --text-primary:    #eeeef8  ← headings, important content
  --text-secondary:  #9090b0  ← body, descriptions
  --text-muted:      #505070  ← placeholders, disabled, overlines

Accent (gold):
  --accent:           #e8b844   ← primary CTA, links, icons
  --accent-hover:     #f5cc58   ← hover state of accent
  --accent-dim:       #c89a2a   ← borders on accent-tinted panels
  --accent-bg:        rgba(232,184,68,0.08)   ← very subtle gold tint

Semantic colors:
  --jade:    #2dd4a0  / --jade-bg:  rgba(45,212,160,0.08)   ← success / positive
  --rose:    #f46464  / --rose-bg:  rgba(244,100,100,0.08)  ← error / destructive
  --ember:   #f07e38  / --ember-bg: rgba(240,126,56,0.08)   ← warning / pending
```

### Tailwind Color Scales (custom, defined in tailwind.config.js)

| Scale | Purpose |
|-------|---------|
| `ink-*` | Dark UI surfaces (50 = lightest, 950 = darkest) |
| `gold-*` | Accent / CTA (400–600 most used) |
| `jade-*` | Success / positive |
| `rose-*` | Error / destructive |
| `ember-*` | Warning / pending |

**Key rule:** `text-ink-950` (not `text-white`) for dark text **on** gold backgrounds.

### When to use inline style vs Tailwind class

- Use `style={{background:'var(--accent)'}}` for gold backgrounds (raw Tailwind `bg-gold-500` may not apply correctly on all elements).
- Use `className="bg-gold-500"` only for stateless utility backgrounds where Tailwind purging is safe.
- Always use CSS variables for anything that needs to respect light/dark mode automatically.

---

## 4. Page Structure Template

```tsx
const MyPage: React.FC = () => {
  return (
    // Page wrapper — full height scrollable
    <div className="h-full overflow-y-auto" style={{background:'var(--bg-base)'}}>
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="page-title">Page Title</h1>
            <p className="page-subtitle">Supporting description text.</p>
          </div>
          <button className="btn-primary">Primary Action</button>
        </div>

        {/* Content */}
        <div className="card p-6">
          {/* card content */}
        </div>

      </div>
    </div>
  );
};
```

---

## 5. Component Classes (defined in `index.css`)

These are `@layer components` classes — use them directly, no Tailwind prefixes needed.

### Cards

```tsx
// Standard card
<div className="card p-6">…</div>

// Elevated card (slightly lighter, stronger shadow)
<div className="card-elevated p-6">…</div>

// Card with header separator
<div className="card overflow-hidden">
  <div className="p-5 border-b" style={{borderColor:'var(--border)'}}>
    <h3 className="text-base font-semibold" style={{color:'var(--text-primary)'}}>Title</h3>
  </div>
  <div className="p-5">…</div>
</div>
```

### Buttons

```tsx
// Primary — gold, dark text
<button className="btn-primary">Save Changes</button>

// Secondary — subtle surface
<button className="btn-secondary">Cancel</button>

// Ghost — transparent, muted text
<button className="btn-ghost">View All</button>

// Danger — rose tint
<button className="btn-danger">Delete</button>
```

> All button classes include base sizing (`px-4 py-2.5`), font, border-radius, and transitions. No need to add those manually.

### Inputs

```tsx
// Text input
<input className="input-base" placeholder="Enter value…" />

// Textarea
<textarea className="input-base" rows={4} />

// Select
<select className="input-base">
  <option>Option A</option>
</select>

// Label
<label className="label-overline mb-2 block">Field Name</label>
```

### Badges

```tsx
<span className="badge badge-gold">Active</span>   // gold — info/neutral
<span className="badge badge-jade">Success</span>  // green — positive
<span className="badge badge-rose">Failed</span>   // red — error
<span className="badge badge-ember">Pending</span> // orange — warning
<span className="badge badge-ink">Draft</span>     // neutral ink
```

> Badge text renders in JetBrains Mono automatically.

### Stat Cards

```tsx
<div className="stat-card">
  <span className="stat-card-value">142</span>
  <span className="stat-card-label">Applications</span>
</div>
```

### Section Labels (overline style)

```tsx
<p className="label-overline">Section Name</p>
```

### Alerts

```tsx
<div className="alert-success">Operation completed.</div>
<div className="alert-error">Something went wrong.</div>
<div className="alert-warning">Review before continuing.</div>
<div className="alert-info">Feature note here.</div>
```

### Utility Classes

```tsx
// Text colors via CSS var
<span className="text-accent">Gold text</span>
<span className="text-jade">Green text</span>
<span className="text-rose">Red text</span>
<span className="text-ember">Orange text</span>
<span className="text-primary-color">Primary text</span>
<span className="text-secondary-color">Secondary text</span>
<span className="text-muted-color">Muted text</span>

// Backgrounds
<div className="bg-surface">…</div>
<div className="bg-elevated">…</div>
<div className="bg-base">…</div>

// Shimmer loading state
<div className="shimmer rounded-xl h-8 w-32" />

// Staggered list entrance animation
<ul className="animate-stagger space-y-3">
  <li>…</li>  {/* each child fades in with delay */}
</ul>

// Custom scrollbar (thin, themed)
<div className="overflow-y-auto custom-scrollbar">…</div>
```

---

## 6. Typography Reference

```tsx
// Page title (uses Fraunces automatically via h1 tag)
<h1 className="page-title">Dashboard</h1>

// Section heading
<h2 className="text-xl font-semibold" style={{color:'var(--text-primary)'}}>Section</h2>

// Card title
<h3 className="text-base font-semibold" style={{color:'var(--text-primary)'}}>Card Title</h3>

// Body text
<p style={{color:'var(--text-secondary)'}}>Description or body copy.</p>

// Muted helper text
<p className="text-sm" style={{color:'var(--text-muted)'}}>Helper or placeholder info.</p>

// Mono data
<span className="font-mono text-sm" style={{color:'var(--text-primary)'}}>3,421</span>
```

---

## 7. Specific Patterns

### Gold backgrounds (accent)

```tsx
// Button-like element with gold background
<div
  className="rounded-xl px-4 py-2"
  style={{background:'var(--accent)', color:'#0e0e17'}}
>
  Action
</div>

// Subtle gold-tinted panel
<div
  className="rounded-xl p-4"
  style={{background:'var(--accent-bg)', border:'1px solid var(--accent-dim)'}}
>
  …
</div>
```

### Focus rings

```tsx
<input className="input-base focus:ring-gold-500/50" />
// OR rely on input-base which already handles focus styling
```

### Conditionally accent-colored text

```tsx
<span style={isActive ? {color:'var(--accent)'} : {color:'var(--text-muted)'}}>
  Label
</span>
```

### Status colors for job tracking

```tsx
// Use the pre-built status badge classes
<span className="status-applied">Applied</span>
<span className="status-interview">Interview</span>
<span className="status-offer">Offer</span>
<span className="status-rejected">Rejected</span>
<span className="status-not-applied">Saved</span>
```

### Loading / skeleton state

```tsx
<div className="space-y-3 animate-stagger">
  <div className="shimmer h-5 w-3/4 rounded-lg" />
  <div className="shimmer h-5 w-1/2 rounded-lg" />
  <div className="shimmer h-5 w-2/3 rounded-lg" />
</div>
```

---

## 8. Layout Patterns

```tsx
// Responsive 2-col → 4-col grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

// Responsive flex row
<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

// Space between header and content
<div className="space-y-8">

// Section spacing within a card
<div className="space-y-5">
```

---

## 9. Spacing Scale

| Context | Class |
|---------|-------|
| Page outer padding | `p-6 lg:p-8` |
| Between page sections | `space-y-8` |
| Card inner padding | `p-5` or `p-6` |
| Within sections | `space-y-5` |
| Form fields | `space-y-4` |
| Tight inline gaps | `gap-2` or `gap-3` |
| Standard gaps | `gap-4` or `gap-5` |

---

## 10. DON'T Use

| ❌ Avoid | ✅ Use Instead |
|----------|----------------|
| `bg-purple-*`, `text-purple-*` | `text-accent` / `style={{color:'var(--accent)'}}` |
| `bg-indigo-*`, `text-indigo-*` | Same as above |
| `bg-violet-*`, `text-violet-*` | Same as above |
| `bg-gray-*`, `text-gray-*` | `text-zinc-*` → prefer CSS vars |
| `bg-slate-*`, `text-slate-*` | CSS vars (`var(--bg-elevated)`, etc.) |
| `text-white` on gold background | `text-ink-950` or `style={{color:'#0e0e17'}}` |
| `rounded-md`, `rounded-lg` | `rounded-xl` or `rounded-2xl` |
| `font-sans` for headings | Let `h1–h3` inherit Fraunces automatically |
| Hardcoded `#hex` colors | CSS custom properties |
| `bg-zinc-*` for page bg | `style={{background:'var(--bg-base)'}}` |
| `border-zinc-*` for card borders | `style={{borderColor:'var(--border)'}}` or `.card` class |

---

## 11. Full Page Example

```tsx
import React, { useState } from 'react';

const ExamplePage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{background:'var(--bg-base)'}}>
      <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="page-title">My Feature</h1>
            <p className="page-subtitle">Manage your items below.</p>
          </div>
          <button className="btn-primary">
            <span className="material-symbols-outlined text-base">add</span>
            New Item
          </button>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="stat-card">
            <span className="stat-card-value">42</span>
            <span className="stat-card-label">Total</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value text-jade">18</span>
            <span className="stat-card-label">Active</span>
          </div>
        </div>

        {/* Main card */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between" style={{borderColor:'var(--border)'}}>
            <h2 className="text-base font-semibold" style={{color:'var(--text-primary)'}}>Items</h2>
            <span className="badge badge-gold">42 total</span>
          </div>
          <div className="p-5 space-y-3">
            {loading ? (
              <div className="space-y-3 animate-stagger">
                <div className="shimmer h-10 rounded-xl" />
                <div className="shimmer h-10 rounded-xl" />
              </div>
            ) : (
              <div className="animate-stagger space-y-2">
                <div className="card-elevated p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium" style={{color:'var(--text-primary)'}}>Item Name</p>
                    <p className="text-sm" style={{color:'var(--text-muted)'}}>Created today</p>
                  </div>
                  <span className="status-applied">Applied</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form section */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold" style={{color:'var(--text-primary)'}}>
            Add Item
          </h2>
          <div>
            <label className="label-overline mb-2 block">Name</label>
            <input className="input-base" placeholder="Enter name…" />
          </div>
          <div>
            <label className="label-overline mb-2 block">Category</label>
            <select className="input-base">
              <option>Option A</option>
              <option>Option B</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-primary">Save</button>
            <button className="btn-secondary">Cancel</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExamplePage;
```

---

**Last Updated:** February 2026  
**Design system source:** `client/src/index.css`, `client/tailwind.config.js`


This document defines the unified design system for all pages in the Job App Assistant application. **Follow these guidelines when creating or modifying any screen.**

## Design Philosophy

Our modern minimalist aesthetic features:
- **Typography**: Plus Jakarta Sans for display, DM Sans for body text
- **Color Palette**: Zinc-based neutral palette with high contrast
- **Shape**: Rounded corners (xl = 0.75rem, 2xl = 1rem)
- **Depth**: Subtle shadows with layered depth
- **Motion**: Smooth transitions with staggered animations

## Quick Reference - Page Template

```tsx
// Standard page structure
const ExamplePage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Page Title
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Description text
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6">
          {/* Card content */}
        </div>
      </div>
    </div>
  );
};
```

---

## 1. Colors

### Page Backgrounds
| Context | Light | Dark |
|---------|-------|------|
| Main Page | `bg-zinc-50` | `dark:bg-zinc-950` |
| Card/Panel | `bg-white` | `dark:bg-zinc-900` |

### Borders
| Context | Light | Dark |
|---------|-------|------|
| Card Border | `border-zinc-100` | `dark:border-zinc-800` |
| Divider | `border-zinc-200` | `dark:border-zinc-700` |
| Input Border | `border-zinc-200` | `dark:border-zinc-700` |

### Primary Action Color
Use **Zinc (neutral)** for a refined minimalist look:
- Button: `bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900`
- Focus: `focus:ring-zinc-900 dark:focus:ring-white`

### Text Colors
| Type | Light | Dark |
|------|-------|------|
| Heading | `text-zinc-900` | `dark:text-white` |
| Body | `text-zinc-700` | `dark:text-zinc-300` |
| Muted | `text-zinc-500` | `dark:text-zinc-400` |

---

## 2. Typography

| Element | Classes |
|---------|---------|
| Page Title | `text-3xl font-bold text-zinc-900 dark:text-white tracking-tight` |
| Section Title | `text-xl font-semibold text-zinc-900 dark:text-white` |
| Card Title | `text-lg font-semibold text-zinc-900 dark:text-white` |
| Body | `text-zinc-700 dark:text-zinc-300` |
| Helper/Small | `text-sm text-zinc-500 dark:text-zinc-400` |
| Label | `text-sm font-medium text-zinc-700 dark:text-zinc-300` |

---

## 3. Cards

### Standard Card
```tsx
<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6">
  {/* Content */}
</div>
```

### Card with Header
```tsx
<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Title</h3>
  </div>
  <div className="p-6">
    {/* Body */}
  </div>
</div>
```

---

## 4. Buttons

### Primary
```tsx
<button className="px-6 py-3 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg">
```

### Secondary
```tsx
<button className="px-6 py-3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all duration-200">
```

### Ghost
```tsx
<button className="px-4 py-2 text-zinc-600 dark:text-zinc-400 font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200">
```

---

## 5. Form Elements

### Input
```tsx
<input
  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-all"
/>
```

### Select
```tsx
<select className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-all">
```

### Label
```tsx
<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
```

---

## 6. Spacing

| Context | Class |
|---------|-------|
| Page sections | `space-y-8` |
| Card content | `space-y-6` |
| Header to content | `mb-8` |
| Form fields | `space-y-5` |
| Grid gaps | `gap-5` or `gap-6` |

---

## 7. Status Colors

| Status | Badge Classes |
|--------|---------------|
| Success | `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300` |
| Error | `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300` |
| Warning | `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300` |
| Info | `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300` |

---

## 8. DON'T Use

| ❌ Avoid | ✅ Use Instead |
|----------|----------------|
| `bg-black` | `bg-zinc-900` |
| `bg-gray-*` | `bg-zinc-*` |
| `dark:bg-zinc-*` | `dark:bg-zinc-*` |
| Indigo primary | Zinc primary |
| `rounded-md` | `rounded-xl` |
| `rounded-lg` | `rounded-xl` |
| `text-gray-*` | `text-zinc-*` |
| `text-slate-*` | `text-zinc-*` |

---

## 9. Responsive Patterns

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

// Responsive flex
<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

// Responsive padding
<div className="p-5 sm:p-6">
```

---

## 10. Animation Classes

Use these utility classes for smooth animations:

- `animate-stagger` - Staggered fade-in for lists
- `transition-all duration-200` - Smooth transitions
- Custom shadows for depth

---

**Last Updated:** February 2026
