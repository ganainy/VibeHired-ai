# VibeHired Documentation

Welcome to the VibeHired documentation hub! This folder contains all the essential guides for working with the VibeHired job search platform.

## 📋 Quick Navigation

### Design & Architecture
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — Complete design system specification including color tokens, typography, spacing, responsive patterns, component specs, and implementation guidelines. **Start here for visual and UI development.**

### Features & Pages
- **[FEATURES.md](./FEATURES.md)** — Comprehensive per-page feature reference documenting every screen in the application, routes, authentication requirements, AI features used, and API endpoints.

### Getting Started
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Step-by-step guide to set up VibeHired locally for development, including environment configuration and prerequisites.

### Deployment
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Complete deployment guide for Netlify (frontend) and Heroku (backend) with automatic deployment setup, environment variable configuration, and troubleshooting.

### Phase Specifications
- **[UI-SPEC.md](./UI-SPEC.md)** — Phase 1 design contract for mobile responsive improvements to the Interview Materials page, including component specifications, CSS implementation, and testing checklist.

### Refactoring & Improvements
- **[COMPONENT-UNIFICATION-PLAN.md](./COMPONENT-UNIFICATION-PLAN.md)** — Comprehensive plan to unify duplicate UI components across the codebase. Identifies 83% ad-hoc implementations vs. design system usage, proposes 8 core reusable components, and provides a 4-week migration strategy.
- **[COMPONENT-LIBRARY-IMPLEMENTATION.md](./COMPONENT-LIBRARY-IMPLEMENTATION.md)** — Quick-start guide for implementing the unified component library with step-by-step instructions for Button, Card, and Modal components, complete with code examples, test templates, and migration checklist.
- **[COMPONENT-MIGRATION-EXAMPLES.md](./COMPONENT-MIGRATION-EXAMPLES.md)** — Real before/after code examples showing how to migrate from ad-hoc styling to unified components. Seven component types with concrete examples from actual codebase files and common migration mistakes to avoid.

**Implementing the component unification?**  
→ Follow [COMPONENT-LIBRARY-IMPLEMENTATION.md](./COMPONENT-LIBRARY-IMPLEMENTATION.md) for detailed step-by-step instructions, then reference [COMPONENT-MIGRATION-EXAMPLES.md](./COMPONENT-MIGRATION-EXAMPLES.md) for specific before/after patterns

**Setting up locally for the first time?**
→ Start with [DEVELOPMENT.md](./DEVELOPMENT.md)

**Building a new feature or page?**  
→ Reference [FEATURES.md](./FEATURES.md) for feature parity and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for design tokens

**Deploying to production?**  
→ Follow [DEPLOYMENT.md](./DEPLOYMENT.md)

**Need design guidance?**  
→ Check [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for color system, typography, spacing, and component specifications

## 📁 Other Resources

- **[PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)** — File and folder architecture of the codebase
- **[Figma Design System](https://figma.com)** — [Link provided in main README]
- **[Specs Folder](../specs/)** — Phase-specific specifications and planning documents

## 🎨 Design System at a Glance

**Obsidian Intelligence** — Dark-first editorial design language

### Color Palette
- **Page**: #0e0e17
- **Cards**: #15151f  
- **Accent**: #e8b844 (gold)
- **Semantic**: Jade (success), Rose (error), Ember (warning), Azure (info)

### Typography
- **Display**: Fraunces (serif)
- **Body**: Outfit (sans)
- **Data**: JetBrains Mono (monospace)
- **Sizes**: 12px, 14px, 16px (default), 24px

### Spacing Grid
8-point grid: 4px, 8px, 16px, 24px, 32px, 48px

### Responsive Breakpoints
- Mobile: <640px
- Tablet: ≥640px
- Desktop: ≥768px
- Wide: ≥1024px

---

**Last Updated:** March 31, 2026
