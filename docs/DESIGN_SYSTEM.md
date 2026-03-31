# VibeHired Design System
## Obsidian Intelligence — Unified Design Language

**Version:** 1.0  
**Last Updated:** March 31, 2026  
**Status:** Active & Complete  
**Figma File:** [VibeHired - Obsidian Intelligence Design System](https://www.figma.com/design/AuGzY3MIec89UbJpF98mVF)

---

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Responsive Design](#responsive-design)
6. [Base Components](#base-components)
7. [Component Implementations](#component-implementations)
8. [UI Patterns](#ui-patterns)
9. [Implementation Guide](#implementation-guide)
10. [Accessibility & Best Practices](#accessibility--best-practices)

---

## Design Philosophy

**Obsidian Intelligence** is a dark-first, editorial design language built for precision and clarity in a job search platform.

### Core Principles

🌙 **Dark-First Design**
- Dark mode is the primary experience (black backgrounds reduce eye strain during extended use)
- Light mode is a minimal, warm-paper variant
- Design hierarchy through layered dark ink tones, not bright colors

✍️ **Typographic Hierarchy**
- Serif display headings (Fraunces) command attention for key information
- Clean body text (Outfit) ensures consistent readability
- Monospace (JetBrains Mono) for data clarity and instant scannability

💫 **Purposeful Accent Color**
- Single gold accent (#e8b844) reserved exclusively for CTAs and key interactions
- Used sparingly to guide user focus and action
- No secondary accent colors to avoid visual noise

🎨 **Restrained Surfaces**
- Layered dark ink tones create depth without bright colors
- Color reserved for semantic status (success, error, warning, info)
- Subtle depth through background layer hierarchy

📊 **Data Clarity**
- Numbers and labels use monospace for instant scannability
- Badges and metadata use precisely scaled typography
- Touch targets minimum 44px (optimal: 48px) for accessibility

---

## Color System

### CSS Custom Properties (Authoritative Source)

All colors must be applied using CSS variables from `client/src/index.css`:

```css
/** Background Layers (dark, lightest → deepest) **/
--bg-base: #0e0e17;           /* Page background (deepest) */
--bg-surface: #15151f;        /* Card backgrounds */
--bg-elevated: #1c1c2a;       /* Input fields, overlays */
--bg-raised: #222233;         /* Interactive hover targets (lightest) */

/** Borders **/
--border-bright: #363655;     /* Focused, highlighted */
--border: #2a2a3d;            /* Default, neutral */
--border-subtle: #1e1e2c;     /* Very faint, disabled */

/** Text **/
--text-primary: #eeeef8;      /* Headings, critical content */
--text-secondary: #9090b0;    /* Body text, descriptions */
--text-muted: #505070;        /* Placeholders, disabled, overlines */

/** Accent (Gold) — Primary CTA **/
--accent: #e8b844;            /* Primary action buttons, links, icons */
--accent-hover: #f5cc58;      /* Hover state */
--accent-dim: #c89a2a;        /* Borders on accent-tinted panels */
--accent-bg: rgba(232,184,68,0.08);  /* Very subtle background tint */

/** Semantic Colors **/
--jade: #2dd4a0;              /* Success, positive actions, checkmarks */
--jade-bg: rgba(45,212,160,0.08);

--rose: #f46464;              /* Destructive actions ONLY (delete, remove, stop) */
--rose-bg: rgba(244,100,100,0.08);

--ember: #f07e38;             /* Warnings, intermediate states, pending */
--ember-bg: rgba(240,126,56,0.08);

--azure: #3b82f6;             /* Informational, links, secondary info */
--azure-bg: rgba(59,130,246,0.08);
```

### Color Usage Rules

| Element | Color | Rule |
|---------|-------|------|
| **Primary Button** | `--accent` | All primary CTAs use gold |
| **Hover State** | `--accent-hover` | Brighten on interaction |
| **Disabled State** | `--border-subtle` + `--text-muted` | Remove interactive appearance |
| **Error/Delete** | `--rose` | Destructive actions ONLY |
| **Success** | `--jade` | Positive confirmations |
| **Warning** | `--ember` | Cautions, pending states |
| **Info** | `--azure` | Links, secondary information |
| **Card Background** | `--bg-surface` | Always use CSS variable |
| **Text on Gold** | `text-ink-950` or `#0e0e17` | Dark text ensures WCAG AAA contrast |

### Tailwind Configuration

Custom color scales defined in `client/tailwind.config.js`:

```javascript
colors: {
  ink: { 50: '#f5f4f0', 950: '#0e0e17' },
  gold: { 400: '#f5cc58', 500: '#e8b844', 600: '#c89a2a' },
  jade: { 400: '#2dd4a0', 500: '#16a34a' },
  rose: { 400: '#f46464', 500: '#dc2626' },
  ember: { 400: '#f07e38', 500: '#ea580c' },
  azure: { 400: '#3b82f6', 500: '#2563eb' }
}
```

**When to use CSS variables vs Tailwind:**
- ✅ Use `style={{background:'var(--accent)'}}` for gold backgrounds
- ✅ Use CSS variables for anything respecting light/dark mode
- ⚠️ Use Tailwind classes only for stateless utility backgrounds

---

## Typography

### Font Stack (3 families)

| Role | Family | Usage |
|------|--------|-------|
| **Display** | `Fraunces` (serif) | Page titles, section headings, hero text |
| **Body** | `Outfit` (sans-serif) | Body text, labels, buttons, inputs (DEFAULT) |
| **Monospace** | `JetBrains Mono` | Stats, numbers, badges, code, timestamps |

Usage in JSX:
```tsx
// Display heading — automatically uses Fraunces via h1/h2/h3 tags
<h1 className="text-2xl font-semibold">Page Title</h1>

// Body text (default — no explicit class needed)
<p>Description or body copy</p>

// Monospace data
<span className="font-mono text-sm">3,421</span>
```

### Font Sizes (4-Scale System - EXACTLY 4 sizes)

| Size | Rem | Usage | Examples |
|------|-----|-------|----------|
| **12px** | 0.75rem | Metadata, badges, small text | Job ID, timestamp, tag |
| **14px** | 0.875rem | Body text, descriptions | Card description, placeholder |
| **16px** | 1rem | **DEFAULT** — Card titles, input text | Button text, form labels |
| **24px** | 1.5rem | Page headings, major titles | Page title, modal title |

### Font Weights (2-Option System - EXACTLY 2 weights)

| Weight | Value | Usage |
|--------|-------|-------|
| **Regular** | 400 | Body text, descriptions, normal content |
| **Semibold** | 600 | Headings, important text, buttons, CTAs, labels |

### Line Heights

| Context | Value | Example |
|---------|-------|---------|
| **Body Text** | 1.5 | Paragraph content (24px for 16px text) |
| **Headings** | 1.2 | Page titles, section headers |
| **Tight** | 1.1 | Badges, metadata, small text |

---

## Spacing & Layout

### 8-Point Grid System

All spacing uses multiples of 8px (mobile-first design):

| Spacing | Rem | Usage |
|---------|-----|-------|
| **4px** | 0.25rem | Minimal gaps, fine adjustments, icon spacing |
| **8px** | 0.5rem | Icon padding, tight gaps between elements |
| **16px** | 1rem | **DEFAULT** — Card padding, standard gaps, section spacing |
| **24px** | 1.5rem | Section spacing, larger padding, component spacing |
| **32px** | 2rem | Major section breaks, page-level spacing |
| **48px** | 3rem | Page-level spacing, maximum section separation |

### Touch Targets & Accessibility

- **Minimum:** 44px × 44px (WCAG accessible)
- **Optimal:** 48px × 48px (use `p-3` = 12px padding for 48px total)
- All interactive elements must meet minimum touch target size

### Tailwind Spacing Convention

```jsx
// Standard gaps
<div className="gap-4">    {/* 16px gap */}
<div className="p-4">      {/* 16px padding all sides */}
<div className="mb-6">     {/* 24px margin-bottom */}

// Touch target (48px)
<button className="p-3">   {/* 12px padding = 48px total with border */}

// Section spacing
<div className="space-y-8">  {/* 32px between children */}
```

### Container Widths

- **Mobile-first approach:** Full width on mobile with side padding
- **No fixed max-widths:** Designs respond fluidly to viewport width
- **Breakpoint adjustments:** Use Tailwind prefixes for responsive behavior

---

## Responsive Design

### Breakpoints (Mobile-First)

| Breakpoint | Width | Prefix | Usage |
|------------|-------|--------|-------|
| **Mobile** | < 640px | (none) | Default, mobile-first |
| **Tablet** | ≥ 640px | `sm:` | iPad, medium devices |
| **Desktop** | ≥ 768px | `md:` | Standard desktop |
| **Wide** | ≥ 1024px | `lg:` | Large monitors |

### Mobile-First Strategy

1. **Design for mobile first** (< 640px) - assume smallest screen
2. **Add tablet enhancements** with `sm:` prefix
3. **Add desktop optimizations** with `md:` and `lg:` prefixes
4. **Never hide content** — reorganize layout instead

### Common Responsive Patterns

```jsx
// Stacked on mobile, row on tablet
<div className="flex flex-col sm:flex-row gap-4">

// Full width on mobile, constrained on desktop
<div className="w-full md:max-w-2xl">

// Font size scaling
<h1 className="text-xl sm:text-2xl md:text-3xl">

// Padding scaling
<div className="p-4 sm:p-6 md:p-8">

// Grid columns scale
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">

// Menu transformation
<nav className="flex flex-col sm:flex-row">
```

---

## Base Components

### Button Component

#### Primary Button
- **Background:** `--accent` (#e8b844)
- **Text Color:** `text-ink-950` or `#0e0e17` (dark on gold)
- **Padding:** `px-4 py-3` (16px horizontal, 12px vertical)
- **Font:** Semibold (600), Outfit
- **Hover:** `--accent-hover` (#f5cc58)
- **Active:** Darken by 10%
- **Disabled:** `--border-subtle` background, `--text-muted` text
- **Tailwind Class:** `.btn-primary`

#### Secondary Button
- **Background:** `--bg-elevated`
- **Border:** 2px `--border`
- **Text Color:** `--text-primary`
- **Hover:** `--border-bright`, lighter background
- **Padding:** `px-4 py-3`
- **Tailwind Class:** `.btn-secondary`

#### Outline Button
- **Background:** Transparent
- **Border:** 2px `--accent`
- **Text Color:** `--accent`
- **Hover:** `--accent-bg` tint background
- **Padding:** `px-4 py-3`
- **Tailwind Class:** `.btn-outline`

#### Destructive Button (Delete/Remove)
- **Background:** `--rose`
- **Text Color:** White
- **Hover:** Darken rose by 10%
- **Padding:** `px-4 py-3`
- **Tailwind Class:** `.btn-danger`

### Input Component

- **Background:** `--bg-elevated`
- **Border:** 2px solid `--border`
- **Border-Radius:** 6px
- **Padding:** `px-3 py-2`
- **Font:** 14px Outfit Regular
- **Placeholder:** `--text-muted`
- **Focus:** Border `--border-bright`, shadow `0 0 0 3px rgba(232,184,68,0.1)`
- **Error State:** Border `--rose`, error icon
- **Disabled:** Background `--bg-surface`, text `--text-muted`
- **Tailwind Class:** `.input-base`

### Card Component

- **Background:** `--bg-surface`
- **Border:** 1px `--border`
- **Border-Radius:** 8px
- **Padding:** `16px` (default)
- **Shadow:** None (design relies on background layers)
- **Hover:** Border becomes `--border-bright`
- **Interactive Card:** Slight background lift on hover
- **Tailwind Class:** `.card`

### Badge Component

- **Font Size:** 12px
- **Font Weight:** Semibold (600)
- **Font Family:** JetBrains Mono
- **Padding:** `px-2 py-1` (8px horizontal, 4px vertical)
- **Border-Radius:** 4px
- **Success Badge:** `--jade` text on `--jade-bg` background
- **Error Badge:** `--rose` text on `--rose-bg` background
- **Warning Badge:** `--ember` text on `--ember-bg` background
- **Info Badge:** `--azure` text on `--azure-bg` background
- **Tailwind Classes:** `.badge`, `.badge-jade`, `.badge-rose`, `.badge-ember`, `.badge-azure`

### Modal Component

- **Background Overlay:** `rgba(0, 0, 0, 0.5)` (semi-transparent)
- **Modal Panel:** `--bg-surface` background
- **Border-Radius:** 12px
- **Min-Width:** 360px (mobile), 480px (desktop)
- **Padding:** `24px`
- **Title:** 16px Outfit Semibold
- **Content:** 14px Outfit Regular
- **Actions:** Primary button (gold) + secondary button (outline)

### Navigation Bar

- **Background:** `--bg-elevated`
- **Height:** 64px (desktop), responsive on mobile
- **Logo:** Left-aligned, 32px height
- **Nav Items:** 16px Outfit Semibold, `--text-secondary` default
- **Active Tab:** `--accent` text, bottom border `--accent`
- **Responsive:** Hamburger menu on mobile (< 640px)

---

## Component Implementations

### Tailwind Component Classes

These are `@layer components` classes defined in `client/src/index.css` — use them directly:

```tsx
// Cards
<div className="card p-6">…</div>
<div className="card-elevated p-6">…</div>

// Buttons
<button className="btn-primary">Save Changes</button>
<button className="btn-secondary">Cancel</button>
<button className="btn-ghost">View All</button>
<button className="btn-danger">Delete</button>

// Inputs
<input className="input-base" placeholder="Enter value…" />
<textarea className="input-base" rows={4} />
<select className="input-base">
<option>Option A</option>
</select>

// Badges
<span className="badge badge-jade">Success</span>
<span className="badge badge-rose">Failed</span>
<span className="badge badge-ember">Pending</span>
<span className="badge badge-azure">Info</span>

// Stats
<div className="stat-card">
<span className="stat-card-value">142</span>
<span className="stat-card-label">Applications</span>
</div>

// Labels
<label className="label-overline mb-2 block">Field Name</label>

// Alerts
<div className="alert-success">Operation completed.</div>
<div className="alert-error">Something went wrong.</div>
<div className="alert-warning">Review before continuing.</div>
<div className="alert-info">Feature note here.</div>

// Utility classes
<div className="bg-surface">…</div>
<div className="bg-elevated">…</div>
<div className="shimmer rounded-xl h-8 w-32" />
<div className="overflow-y-auto custom-scrollbar">…</div>
```

### Gold Backgrounds

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

---

## UI Patterns

### Form Layout

```jsx
<form className="space-y-6">
  {/* Form group */}
  <div className="space-y-2">
    <label className="block text-sm font-semibold">Label</label>
    <input className="input-base" />
    <p className="text-xs" style={{color:'var(--text-muted)'}}>Helper text</p>
  </div>
  
  {/* Form error state */}
  <div className="space-y-2">
    <label className="text-sm font-semibold" style={{color:'var(--rose)'}}>Label</label>
    <input className="input-base" style={{borderColor:'var(--rose)'}} />
    <p className="text-xs" style={{color:'var(--rose)'}}>Error message</p>
  </div>
  
  {/* Action buttons */}
  <div className="flex gap-3 justify-end pt-6">
    <button className="btn-secondary">Cancel</button>
    <button className="btn-primary">Submit</button>
  </div>
</form>
```

### Data Table

```jsx
<div className="overflow-x-auto">
  <table className="w-full text-left text-sm">
    <thead>
      <tr className="border-b-2" style={{borderColor:'var(--border)'}}>
        <th className="px-4 py-3 font-semibold">Column</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b hover:bg-raised" style={{borderColor:'var(--border)'}}>
        <td className="px-4 py-3">Content</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Empty State

```jsx
<div className="flex flex-col items-center justify-center py-12" style={{background:'var(--bg-surface)'}}>
  <div className="text-4xl mb-4">📭</div>
  <h3 className="text-base font-semibold mb-2" style={{color:'var(--text-primary)'}}>No items found</h3>
  <p className="text-sm mb-6" style={{color:'var(--text-secondary)'}}>Try adjusting your filters</p>
  <button className="btn-primary">Create New Item</button>
</div>
```

### Error State

```jsx
<div className="p-4 rounded-md border-2" style={{background:'var(--rose-bg)', borderColor:'var(--rose)'}}>
  <div className="flex gap-3">
    <span className="text-xl">⚠️</span>
    <div>
      <h4 className="text-sm font-semibold" style={{color:'var(--rose)'}}>Something went wrong</h4>
      <p className="text-xs mt-1" style={{color:'var(--rose)'}}>Please try again or contact support</p>
    </div>
  </div>
</div>
```

### Success Message

```jsx
<div className="p-4 rounded-md border-2" style={{background:'var(--jade-bg)', borderColor:'var(--jade)'}}>
  <div className="flex gap-3">
    <span className="text-xl">✓</span>
    <div>
      <h4 className="text-sm font-semibold" style={{color:'var(--jade)'}}>Success</h4>
      <p className="text-xs mt-1" style={{color:'var(--jade)'}}>Your changes have been saved</p>
    </div>
  </div>
</div>
```

### Loading State

```jsx
<div className="flex items-center justify-center py-8">
  <div className="animate-spin rounded-full h-8 w-8 border-4 border-border border-t-accent"></div>
  <span className="ml-3 text-sm" style={{color:'var(--text-secondary)'}}>Loading...</span>
</div>
```

---

## Implementation Guide

### Setup Instructions

1. **CSS Variables** in `client/src/index.css`:
   ```css
   :root {
     --bg-base: #0e0e17;
     --bg-surface: #15151f;
     /* ... all variables as documented above */
   }
   ```

2. **Tailwind Config** in `client/tailwind.config.js`:
   ```javascript
   theme: {
     extend: {
       colors: {
         ink: { 50: '#f5f4f0', 950: '#0e0e17' },
         gold: { 400: '#f5cc58', 500: '#e8b844', 600: '#c89a2a' },
         jade: { 400: '#2dd4a0', 500: '#16a34a' },
         rose: { 400: '#f46464', 500: '#dc2626' },
         ember: { 400: '#f07e38', 500: '#ea580c' },
         azure: { 400: '#3b82f6', 500: '#2563eb' }
       },
       fontFamily: {
         display: ['Fraunces', 'serif'],
         mono: ['JetBrains Mono', 'monospace'],
       }
     }
   }
   ```

3. **Use CSS Variables** in components:
   ```jsx
   // ✅ Correct
   <div style={{ background: 'var(--accent)' }}>
   
   // ❌ Avoid
   <div className="bg-gold-500">
   ```

### Component Creation Checklist

- [ ] Define all props (required & optional)
- [ ] Use one of 4 font sizes: 12px, 14px, 16px, or 24px
- [ ] Use semibold (600) for headings/buttons, regular (400) otherwise
- [ ] Use spacing in 8px multiples
- [ ] Test hover states with gold accent
- [ ] Test disabled state with muted colors
- [ ] Verify touch targets ≥ 44px
- [ ] Test responsive behavior at all breakpoints
- [ ] Test in light & dark modes

---

## Accessibility & Best Practices

### Contrast Ratios

- **WCAG AA:** Minimum 4.5:1 for text
- **WCAG AAA:** Minimum 7:1 for text
- Gold text (`--text-primary` on `--accent`) meets WCAG AAA standards
- All semantic colors tested for accessibility

### Keyboard Navigation

- All interactive elements must be focusable with Tab key
- Focus indicators use `--border-bright` with 3px ring
- No keyboard traps

### Screen Reader Support

- All clickable icons must have `aria-label` or `title` attributes
- Use semantic HTML (`<button>`, `<input>`, `<select>`)
- Links must have descriptive text

### Focus Indicators

```css
input:focus, button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(232, 184, 68, 0.2);
  border-color: var(--border-bright);
}
```

### Motion & Animation

- Prefer CSS transitions over animations
- Respect `prefers-reduced-motion: reduce` accessibility setting
- Avoid flashing or rapidly changing content

### DO's and DON'Ts

| ❌ DON'T | ✅ DO |
|----------|-------|
| Use `bg-purple-*`, `text-purple-*` | Use `style={{background:'var(--accent)'}}` |
| Use `bg-indigo-*`, `text-indigo-*` | Use gold/semantic colors only |
| Use `text-white` on gold background | Use `text-ink-950` or `#0e0e17` |
| Use `rounded-md`, `rounded-lg` | Use `rounded-xl` or `rounded-2xl` |
| Use `font-sans` for headings | Let `h1–h3` inherit Fraunces automatically |
| Hardcode hex colors | Use CSS custom properties |
| Hide content on mobile | Reorganize layout with responsive classes |
| Create new colors/shades | Use defined palette always |

---

## Page Structure Template

```tsx
const MyPage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{background:'var(--bg-base)'}}>
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Page Title</h1>
            <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Supporting description</p>
          </div>
          <button className="btn-primary">Primary Action</button>
        </div>

        {/* Content */}
        <div className="card p-6">
          {/* Card content */}
        </div>

      </div>
    </div>
  );
};
```

---

## Full Example Component

```tsx
import React, { useState } from 'react';

const ExampleCard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b flex items-center justify-between" style={{borderColor:'var(--border)'}}>
        <h2 className="text-base font-semibold" style={{color:'var(--text-primary)'}}>Items</h2>
        <span className="badge badge-jade">12 active</span>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="card-elevated p-4">
              <p className="text-sm" style={{color:'var(--text-primary)'}}>Item Name</p>
              <p className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Created today</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 border-t flex gap-3" style={{borderColor:'var(--border)'}}>
        <button className="btn-primary flex-1">Save</button>
        <button className="btn-secondary flex-1">Cancel</button>
      </div>
    </div>
  );
};

export default ExampleCard;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Mar 31, 2026 | Initial unified design system - consolidated DESIGN_SYSTEM.md + STYLE_GUIDELINES.md |

---

**Maintained By:** Design System Team  
**Last Reviewed:** March 31, 2026  
**Questions?** Open an issue or contact the design team
