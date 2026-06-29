# Pattern: Design-token architecture

> Backported from adaptive-learner. Template-neutral; adapt the names to your app. The token set + themes below are an illustrative stub, NOT any one app's palette.

**Status in this template:** not yet wired. The template ships a small set
of CSS variables; this doc describes the full architecture (one canonical
token set per theme, no hardcoded colours, test-enforced) so you can adopt
it when your app grows real theming.

---

## Why

If colours, spacing, radii, and shadows are written as literals across
components, re-theming means hunting every literal, dark mode is a
second copy of every rule, and "is this WCAG AA?" is unanswerable. A
design-token system makes one rule true: **a contributor re-themes the app
by editing one theme file and touching no component.** Enforced by tests,
not by convention, so it cannot rot.

---

## The pattern

Three token layers:

1. **Per-theme tokens** — the canonical token set (backgrounds, text,
   borders, interactive, accent, status pairs, feedback, shadows...),
   defined once per theme in `styles/themes/theme-<id>.css`. Switching
   `[data-theme]` flips all of them. **Every theme MUST define the EXACT
   same set** (pinned by a parity test).
2. **Theme-agnostic tokens** — values identical in every theme by
   construction (brand palette, always-on-red danger foreground, layout
   spacing/radii). Live in `global.css :root`, NOT in the theme files, so
   parity stays intact.
3. **Legacy aliases** — old names resolve THROUGH the canonical tokens;
   prefer the semantic names.

Rules consumers follow:

- **No raw colour literals** (`#hex` / `rgb()` / `hsl()`) in a component
  or a consumer CSS declaration. A literal is allowed ONLY as the value of
  a `--token:` definition. Components reference tokens:
  `color: var(--fg-primary)`.
- **No fixed-palette utility classes** (`bg-blue-500`, `text-red-600`).
  Use token-backed utilities or an arbitrary value over a token
  (`bg-[var(--bg-elevated)]`).
- **No inline styles with colour values.**
- **Shadows, radii, spacing are tokens too**, not magic numbers.

Justified exceptions are marked, not silent: an on-the-same-line
`/* token-exempt: <reason> */` in CSS, or an allowlist entry (with reason)
in the enforcement test for `.tsx`. The allowlist only shrinks.

---

## What the template already provides

- A CSS-variable-based styling layer the token set slots into.
- ESLint + a test runner (Vitest) to host the enforcement guards.

---

## To complete it

1. Define the canonical token set once per theme in
   `styles/themes/theme-<id>.css`; put theme-agnostic tokens in
   `global.css :root`.
2. Add three Vitest guards (`no-hardcoded-colors.test.ts`):
   - `.tsx` colour literals -> allowlist ratchet.
   - non-theme CSS consumer literals -> only `--token:` definitions and
     `token-exempt:` lines pass (theme files excluded — they ARE the
     palette).
   - fixed-palette utility classes -> must be zero.
3. Add `themes.test.ts` (every theme defines the same token set) and
   `contrast.test.ts` (WCAG AA across all themes).
4. Optionally add a standalone CLI gate (`scripts/verify_theme.py`,
   stdlib-only: token-completeness + undefined `var()`-reference +
   WCAG-contrast matrix with a `.theme-baseline.json` ratchet) and a
   `make verify-theme` target that runs it then the Vitest guards — useful
   where the node toolchain is unavailable.

A minimal illustrative theme stub (replace with your real palette):

```css
/* styles/themes/theme-light.css */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-surface: #f6f7f9;
  --fg-primary: #1a1a1a;
  --fg-secondary: #555a61;
  --accent: #2563eb;
  --accent-fg: #ffffff;
  --border: #d8dce1;
  /* ...the rest of the canonical set, identical keys in every theme... */
}
```

---

## Gotchas

**Parity is the load-bearing invariant.** A token referenced by a
component but undefined in one theme renders a stale/wrong colour only in
that theme — invisible until someone switches to it. The `themes.test.ts`
parity guard is what makes the "edit one file to re-theme" promise true.

**Charts can't read CSS vars in SVG attributes.** Charting libraries that
set colours as SVG attributes need the resolved string, not `var(--x)`.
Read tokens through a small `chartTheme` helper and recolour on theme
change; this is a legitimate allowlist entry (data, not chrome).

**WCAG AA is computed, not eyeballed.** Pin contrast with a test across
every theme so a "nice-looking" token pair that fails 4.5:1 cannot ship.
