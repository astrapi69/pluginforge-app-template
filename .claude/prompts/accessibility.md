# myapp — accessibility (WCAG 2.1 AA) audit + fix

Drop-in prompt. Paste into a fresh Claude Code session at the repo root.

---

Audit and fix accessibility to WCAG 2.1 AA. `@axe-core/react` is already
wired in dev mode (violations log to the console); use it plus a manual
pass. GitHub issue FIRST, `Closes #NN` in the commit, `tdd.md` for any
behaviour change.

## Audit (report first, then fix in priority order)

Run an axe scan over every nav-reachable route and group findings by
severity. Then check the classes axe cannot fully catch:

1. **Landmarks + heading order.** One `<main>`, a `<nav>`, a `<header>`;
   exactly one `<h1>` per view; no skipped heading levels.
2. **Skip-to-content link** as the first focusable element, visible on focus.
3. **Keyboard.** Every interactive element reachable and operable by
   keyboard; visible `:focus-visible` indicator; no keyboard traps;
   logical tab order; `Esc` closes dialogs/menus.
4. **Names + roles.** Icon-only buttons have `aria-label`; form inputs have
   a `<label htmlFor>` / `id` pair; images have `alt` (empty `alt=""` for
   decorative); dialogs use `role="dialog"` + `aria-modal` + focus trap +
   focus restore.
5. **Contrast.** Text >= 4.5:1 (>= 3:1 for large text and UI components)
   across every theme. If you use design tokens (`docs/patterns/09`), pin
   contrast with a test across all themes rather than eyeballing.
6. **Live regions.** Async status (loading, toasts, async results) announced
   via `aria-live` / `role="status"`.
7. **Reduced motion.** A global `prefers-reduced-motion` kill-switch that
   disables non-essential animation.
8. **Forms.** Errors associated with their field (`aria-describedby`), not
   colour-only; required fields marked accessibly.

## Constraints

- Prefer semantic HTML over ARIA; only add ARIA where semantics fall short.
- No `tabindex > 0`.
- Do not regress the visual design to pass contrast — adjust the token, not
  the layout.

## Done when

- axe reports 0 serious/critical violations on every audited route (add a
  Vitest axe scan as a regression pin, like the existing Help page scan).
- A keyboard-only pass reaches and operates every control.
- `make test` stays green.
