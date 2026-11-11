# BoardingEdu Enterprise UI/UX Upgrade — Phase 1: Design System (Implementation Plan)

## Task 1: Align design tokens to the requested palette
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Update the `:root` block in `frontend/app/globals.css` to add semantic tokens: `--primary: #0b5f8a`, `--primary-strong: #084a6d`, `--primary-soft: #e8f1f7`; set `--gold: #e8a317`, `--gold-strong: #c5840a`, `--gold-soft: #fff6e0`. Keep `--brand: #e8650f` (logo/identity) and existing `--accent`, `--ink`, `--muted`, `--line`, `--surface`, `--card`, radii, shadows, and typography scale.
  - Ensure text on `--primary` and `--gold` uses white/near-white for WCAG AA contrast.
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-1.1: `--primary`, `--primary-strong`, `--primary-soft`, `--gold`, `--gold-strong`, `--gold-soft` are present in `:root` with the exact values above; `--brand` remains `#e8650f`. Evidence: `globals.css` `:root` block.
- **Notes**: Do not rename or remove existing tokens; many components reference them.
- **Completion Evidence**:
  - TR-1.1 (rule): `globals.css` `:root` now contains `--primary: #0b5f8a`, `--primary-strong: #084a6d`, `--primary-soft: #e8f1f7`, `--gold: #e8a317`, `--gold-strong: #c5840a`, `--gold-soft: #fff6e0`; `--brand` unchanged at `#e8650f`. Verified via Read of lines 32–47.

## Task 2: Create UI primitive components
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create `frontend/components/ui/` with these typed React components (no new deps; use `lucide-react` icons where needed):
    - `Button.tsx` — variants: `primary` (--primary), `secondary`, `ghost`, `danger`; sizes `sm`/`md`/`lg`; `loading` (spinner + disabled); `disabled`; renders `<button>` by default, `<Link>`/`<a>` when `href` provided.
    - `Card.tsx` — container with header/body/footer slots, uses `--card`, `--line`, `--radius-lg`, `--shadow-sm`.
    - `Badge.tsx` — variants: `default`, `primary`, `gold`, `success`, `warn`, `danger`; pill shape.
    - `Field.tsx` — label + control (input/select/textarea) + error text; accessible `htmlFor`/`id` pairing.
    - `Modal.tsx` — portal to `document.body`, backdrop click to close, Escape to close, focus trap, focus return to trigger, `role="dialog"`, `aria-modal`.
    - `Skeleton.tsx` — shimmer placeholder with width/height props.
    - `EmptyState.tsx` — icon + title + description + optional action.
    - `ConfirmDialog.tsx` — built on `Modal`; confirm/cancel actions; controlled `open` state.
    - `Toast.tsx` — lightweight toast with auto-dismiss; exported `useToast` hook with a provider.
  - All components use the design tokens (CSS variables), not hardcoded colors.
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `rule` TR-2.1: All nine files exist in `frontend/components/ui/` and export typed components. Evidence: `Glob`.
  - `rule` TR-2.2: `Modal` implements Escape close, backdrop close, focus trap, and focus return. Evidence: source inspection of `Modal.tsx`.
  - `rule` TR-2.3: `Button` accepts `variant`, `size`, `loading`, `disabled`, `href` and renders the correct element. Evidence: source inspection.
- **Notes**: Use `next/link` `Link` for client-side hrefs in `Button`; external hrefs use `<a>`.
- **Completion Evidence**:
  - TR-2.1 (rule): `Glob frontend/components/ui/*.tsx` returns 9 files: Button, Card, Badge, Field, Modal, Skeleton, EmptyState, ConfirmDialog, Toast (plus index.ts barrel). All export typed React components.
  - TR-2.2 (rule): `Modal.tsx` implements Escape-key close (`keydown` listener), backdrop click close (`onMouseDown` target check), focus trap (Tab/Shift+Tab cycles focusable elements), and focus return (`previouslyFocused.current?.focus()` on cleanup). Verified via source.
  - TR-2.3 (rule): `Button.tsx` accepts `variant`, `size`, `loading`, `disabled`, `href`, `external`; renders `<Link>` for internal hrefs, `<a>` for external, `<button>` otherwise. Verified via source.

## Task 3: Apply primitives to shared chrome (NavBar + global forms)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Refactor `frontend/components/NavBar.tsx` to use `Button` for the primary Register CTA and ghost/secondary buttons where appropriate; keep the existing layout and mobile menu behavior intact.
  - Update global button/form CSS in `globals.css` to use `--primary` for primary actions and `--gold` for highlights (e.g., star ratings), while leaving existing page-specific overrides intact.
  - Ensure `focus-visible` outlines use `--primary` for a consistent focus ring.
- **Acceptance Criteria Addressed**: AC-3, AC-7
- **Test Requirements**:
  - `rule` TR-3.1: NavBar primary CTA uses `Button` primitive (or `--primary`-backed styling) and renders with `--primary` background. Evidence: `NavBar.tsx`.
  - `rubric` TR-3.2: Visual consistency of buttons/badges/forms across NavBar, `/login`, and a modal; scale 1-5; anchors 1=inconsistent, 3=mostly, 5=uniform; threshold >= 4; evidence: visual inspection.
- **Notes**: Do not change nav links, routes, or mobile menu logic.
- **Completion Evidence**:
  - TR-3.1 (rule): `NavBar.tsx` imports `Button` from `@/components/ui/Button`; desktop Register CTA uses `<Button href="/signup" variant="primary">`; Log in uses `<Button href="/login" variant="ghost">`. Mobile auth buttons use `Button` (secondary + primary). `--primary` background rendered as blue `#0b5f8a` in browser screenshot.
  - TR-3.2 (rubric): Score 4/5. Buttons across NavBar, login page, and the auto-opened discovery modal are visually consistent (rounded corners, shared focus rings, primary blue for CTAs). Minor drift remains in the legacy green "Send reset code" button (auth component not yet migrated) — to be unified in Phase 3 (auth/dashboard). Evidence: browser screenshots of home, /login, and school detail pages.

## Task 4: Verify build, typecheck, and key routes
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Run `npx tsc --noEmit` and `npm run build` in `frontend/`.
  - Confirm the home page, `/india/` (listing), a school detail route, `/login`, and `/dashboard/school/` render without import/runtime errors via the dev server.
- **Acceptance Criteria Addressed**: AC-5, AC-6
- **Test Requirements**:
  - `rule` TR-4.1: `tsc --noEmit` exits 0. Evidence: command output.
  - `rule` TR-4.2: `npm run build` exits 0. Evidence: command output.
  - `rule` TR-4.3: Home, listing, school detail, login, and school dashboard routes render without console import errors. Evidence: dev-server / browser check.
- **Notes**: If build fails due to pre-existing issues unrelated to Phase 1, record them as remaining issues rather than blocking.
