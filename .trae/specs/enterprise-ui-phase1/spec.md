# BoardingEdu Enterprise UI/UX Upgrade — Phase 1: Design System

## Overview
- **Summary**: Establish a consistent, reusable enterprise design system for the BoardingEdu platform (Next.js 14 + TypeScript + Tailwind v4). Phase 1 aligns design tokens to the requested palette, creates a small set of reusable UI primitives, and applies them to shared chrome (navigation, buttons, forms) so the whole site inherits a professional, consistent look — without rebuilding pages or breaking existing functionality.
- **Purpose**: Remove style duplication, standardize typography/spacing/colors, and provide a component foundation that Phases 2–5 (parent experience, parent dashboard, school admin, additional features) will build on.
- **Target Users**: Parents, School Admins, Staff Admins, Super Admins (the design system must serve all four roles and the public site).

## Goals
- Align design tokens to the requested palette: Primary Blue `#0b5f8a`, Accent Gold `#e8a317`, white/light-grey backgrounds, dark navy text, neutral grey secondary text — while preserving the existing BoardingEdu brand orange (`#e8650f`) for the logo/brand identity only.
- Create reusable UI primitives (Button, Card, Badge, Field, Modal, Skeleton, EmptyState, ConfirmDialog, Toast) built on existing dependencies (`lucide-react`, React 18, Tailwind v4) — no new runtime dependencies.
- Apply primitives to shared chrome (NavBar, global buttons, form controls) so the entire site immediately looks consistent.
- Preserve all existing URLs, SEO, authentication, RBAC, and working functionality.

## Non-Goals
- Full page-by-page redesign of school listing, school detail, parent dashboard, or school admin dashboard (those are Phases 2–4).
- Backend API or database schema changes in this phase.
- Introducing a component library dependency (shadcn, Radix, MUI, etc.).
- Changing the existing brand logo mark color.
- Removing or rewriting any existing working feature.

## Background & Context
- Existing tokens in `frontend/app/globals.css` (`:root`): `--brand: #e8650f`, `--accent: #17456b`, `--gold: #e2ad34`, radii `8/11/16px`, shadows, Inter font, size scale. These are already well-structured but the primary action color is orange, not the requested blue.
- Styling is overwhelmingly raw CSS classes in `globals.css` (~22k+ lines) rather than Tailwind utilities; components inline their own markup. There is no shared Button/Card/Badge primitive — each component re-declares button/card styles.
- Stack: Next.js 14.2, React 18, TypeScript 5, Tailwind v4, `lucide-react` (only icon library).
- SEO is critical: canonical URLs, metadata, JSON-LD, sitemap, robots, hierarchical location URLs, trailing slashes must remain intact.
- Auth: JWT + Email OTP; four roles (PARENT, SCHOOL_ADMIN, STAFF_ADMIN, SUPER_ADMIN); RBAC via `permissions.py`.
- Backend: Django 5.2 + DRF on Render; frontend on Vercel.

## Functional Requirements
- **FR-1**: A token layer in `:root` exposes semantic colors (`--primary`, `--primary-strong`, `--primary-soft`, `--gold`, `--gold-strong`, `--gold-soft`, plus existing `--brand`, `--accent`, `--ink`, `--muted`, `--line`, `--surface`, `--card`) matching the requested palette.
- **FR-2**: Reusable `Button` primitive supports variants (primary, secondary, ghost, danger), sizes (sm, md, lg), loading state, disabled state, and renders as `<button>` or `<a>`/`Link` when an `href` is provided.
- **FR-3**: Reusable `Card`, `Badge`, `Field` (label + input/select/textarea + error), `Modal`, `Skeleton`, `EmptyState`, `ConfirmDialog`, and `Toast` components exist and are typed.
- **FR-4**: `NavBar` and global form controls use the new primitives/tokens; primary actions use `--primary` blue.
- **FR-5**: All primitives are keyboard-accessible (focus-visible outlines, Escape-to-close modals, focus trap for modal, Enter/click for buttons).
- **FR-6**: Existing public pages, dashboards, and auth flows remain functional and styled (no broken layouts after the token change).

## Non-Functional Requirements
- **NFR-1**: No new npm dependencies added in this phase.
- **NFR-2**: `next build` and `tsc --noEmit` pass with zero errors.
- **NFR-3**: Color contrast for text on primary/gold backgrounds meets WCAG AA (≥ 4.5:1 for body text).
- **NFR-4**: Responsive: primitives render correctly at desktop, tablet, and mobile widths (existing breakpoints preserved).
- **NFR-5**: No mock data, no hardcoded school/user data introduced.

## Constraints
- **Technical**: Next.js 14 App Router, React 18, TypeScript 5, Tailwind v4, `lucide-react` only. CSS custom properties already drive the theme.
- **Business**: Preserve existing BoardingEdu brand identity (orange logo); do not change the logo. Do not break SEO.
- **Dependencies**: No backend changes this phase. Existing Django APIs unchanged.

## Assumptions
- The user's "Primary Blue #0b5f8a / Accent Gold #e8a317" applies to UI chrome (buttons, links, highlights), while the existing `--brand: #e8650f` orange remains the logo/brand identity color. This avoids a jarring mixed palette and respects both the brand identity and the requested design colors.
- Phases 2–5 will progressively migrate individual pages to the new primitives; Phase 1 only guarantees the shared chrome and primitives.

## Acceptance Criteria

### AC-1: Token palette aligned
- **Type**: `rule`
- **Given**: The `:root` block in `frontend/app/globals.css`
- **When**: The design tokens are inspected
- **Then**: `--primary` equals `#0b5f8a`, `--gold` equals `#e8a317`, `--brand` remains `#e8650f`, and semantic soft/strong variants exist for primary and gold.
- **Pass Condition**: Tokens present with exact values.
- **Evidence**: Read `globals.css` `:root` block.

### AC-2: Reusable primitives exist and are typed
- **Type**: `rule`
- **Given**: The `frontend/components/ui/` directory
- **When**: The primitives are listed
- **Then**: `Button`, `Card`, `Badge`, `Field`, `Modal`, `Skeleton`, `EmptyState`, `ConfirmDialog`, and `Toast` exist as `.tsx` files with TypeScript props.
- **Pass Condition**: All nine files exist and export typed components.
- **Evidence**: `Glob frontend/components/ui/*.tsx`.

### AC-3: NavBar uses new Button/Link styling with primary blue
- **Type**: `rule`
- **Given**: `frontend/components/NavBar.tsx`
- **When**: The header actions are rendered
- **Then**: The primary CTA uses the `Button` primitive (or primary token styling) with `--primary` background, and focus-visible outlines are present.
- **Pass Condition**: NavBar primary action references `--primary` and `Button` primitive.
- **Evidence**: Read `NavBar.tsx`.

### AC-4: Modal and ConfirmDialog are accessible
- **Type**: `rule`
- **Given**: `Modal` and `ConfirmDialog` components
- **When**: Opened via keyboard or click
- **Then**: Escape closes them, focus is trapped within the modal while open, focus returns to the trigger on close, and clicking the backdrop closes.
- **Pass Condition**: All four behaviors implemented.
- **Evidence**: Source inspection of `Modal.tsx`.

### AC-5: Build and typecheck pass
- **Type**: `rule`
- **Given**: The modified frontend
- **When**: `npx tsc --noEmit` and `npm run build` are run
- **Then**: Both exit with code 0.
- **Pass Condition**: Exit code 0 for both.
- **Evidence**: Command output.

### AC-6: Existing functionality preserved
- **Type**: `rule`
- **Given**: Public pages and auth flows
- **When**: The home, listing, school detail, login, and parent/school admin dashboard routes are rendered
- **Then**: No console errors, no broken imports, and existing class names still resolve (no removed utility classes that pages depend on).
- **Pass Condition**: Build succeeds and key routes render without import errors.
- **Evidence**: Build output + dev-server render check.

### AC-7: Visual consistency across chrome
- **Type**: `rubric`
- **Dimension**: Consistency of buttons, cards, badges, and form controls across NavBar, auth pages, and modals.
- **Scale**: 1-5
- **Anchors**: 1 = wildly inconsistent (each area looks different); 3 = mostly consistent with minor drift; 5 = uniform, shared primitives used everywhere in shared chrome.
- **Pass Threshold**: >= 4
- **Evidence**: Visual inspection of NavBar, login page, and a modal.

## Open Questions
- [ ] Should the school-admin sidebar (recently set to dark `#1f2d3d`) be aligned to the new `--accent-strong` navy, or keep its current dark slate? (Likely keep; revisit in Phase 4.)
- [ ] Does the user want the brand orange removed entirely from UI chrome (only logo), or kept as an occasional highlight? (Assumption: logo only; revisit if feedback differs.)
