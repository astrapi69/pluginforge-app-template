# Pattern: Dexie-mode release gate

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** Playwright is installed (`install-e2e` target, `e2e/playwright.config.ts` with `chromium` and `smoke` projects) and the Vite build pipeline is in place, but no `test-dexie-smoke` Makefile target and no `e2e/dexie/` directory exist yet. The gate must be added once you implement dual-storage (see `01-dual-storage.md`).

---

## Why

If your app ships a backend-free browser build - the Dexie-mode static build described in `01-dual-storage.md` - that static build is often the first thing real users encounter. A GitHub Pages deploy, a hosted demo, or a distributed single-file bundle all fall into this category. The problem is that a feature can work perfectly in API mode (backend present, `fetch` calls succeed) while silently crashing in Dexie mode (no backend, every `api.*` call returns HTTP 404 or a network error). Without a dedicated gate, this broken state ships and every user on the public deployment gets an error toast or a blank page until someone notices.

This is not a hypothetical. Adaptive-learner shipped a Learning Repository feature in API-mode-only. The GitHub Pages deployment rebuilt automatically. Every visitor landing on the Settings, Dashboard, or Learning-Repo pages for approximately 24 hours saw a raw HTTP 404 toast because the components called `api.*` directly instead of routing through the storage abstraction. The fix was straightforward; the detection was the gap.

A Dexie-mode release gate closes that gap by exercising the static build with no backend process before the release tag lands.

---

## The pattern

The gate has four parts that must work together:

1. **A frontend build with the browser-mode flag.** The Vite build must run with `VITE_STORAGE_MODE=dexie` so the resulting `dist/` is the Dexie-mode bundle, not the default API-mode bundle.

2. **A `vite preview` server with no backend.** `vite preview` serves the compiled `dist/` on a fixed port. No `uvicorn` process starts. Any component that tries to reach the backend gets a connection error - exactly what you want the gate to catch.

3. **A dedicated Playwright config for the dexie suite.** A separate `e2e/playwright.dexie.config.ts` points `testDir` at `e2e/dexie/`, sets `webServer` to the `vite preview` command only (no backend entry), and uses a fixed preview port (4173 is the Vite default). It never shares the `webServer` block with the main `e2e/playwright.config.ts`, which starts both frontend and backend.

4. **A route-sweep spec that asserts no error state.** For each nav-reachable route the spec navigates, waits for the page to settle, and asserts that no error toast (`[data-testid*="error"]` or your toast selector) appears and no uncaught JS error fires. This is the minimal bar; extend it over time with real interactive journeys.

---

## What the template already provides

- **Playwright installed:** `make install-e2e` runs `npm install && npx playwright install chromium` inside `e2e/`. Chromium is the only browser needed for the gate.
- **`e2e/` directory and `playwright.config.ts`:** The existing config defines `chromium` and `smoke` projects, both backed by a full dev stack (backend + frontend via `webServer`). This is the seed the dexie config diverges from.
- **Vite build pipeline:** `cd frontend && npm run build` produces `dist/`. The build already works; you are adding a flag to it.
- **`make test-e2e` target:** shows the existing Makefile shape for running Playwright. The new `test-dexie-smoke` target follows the same pattern.

---

## To complete it

**Step 1 - Add the storage-mode flag to Vite (depends on `01-dual-storage.md`).** In `frontend/vite.config.ts`, read `process.env.VITE_STORAGE_MODE` and pass it to the `define` block so component code can branch on it. Without this, the build ignores the flag and the gate tests the wrong bundle.

**Step 2 - Create `e2e/playwright.dexie.config.ts`.** A minimal config:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./dexie",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4173",
    actionTimeout: 10_000,
  },
  webServer: {
    // No backend. Only the static preview.
    command: "cd ../frontend && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 15_000,
  },
  projects: [
    {
      name: "dexie-smoke",
      use: { browserName: "chromium" },
    },
  ],
});
```

**Step 3 - Write a route-sweep spec at `e2e/dexie/route-sweep.spec.ts`.** For each nav-reachable route in your app, navigate and assert the page is usable:

```typescript
import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/settings", "/dashboard" /* add your routes */];

for (const route of ROUTES) {
  test(`${route} renders without error in Dexie mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    // Adjust the selector to match your toast component's error state.
    await expect(page.locator('[data-testid*="toast-error"]')).toHaveCount(0);
    expect(errors).toHaveLength(0);
  });
}
```

**Step 4 - Add `test-dexie-smoke` to the Makefile.** The target must build fresh with the flag before running the suite so a stale or wrong-mode `dist/` cannot produce a false result:

```makefile
test-dexie-smoke: ## Build with VITE_STORAGE_MODE=dexie then run the Dexie-mode route sweep (no backend)
	cd frontend && VITE_STORAGE_MODE=dexie npm run build
	cd e2e && npx playwright test --config=playwright.dexie.config.ts
```

**Step 5 - Wire it into your release-test chain.** Add `test-dexie-smoke` as a prerequisite to whatever aggregate release-test target you define (cross-ref `03-release-automation.md`). The gate is only valuable if a red run blocks the tag.

---

## Gotchas

**The build must be fresh and mode-correct.** If you run `make test-dexie-smoke` after a prior `npm run build` without the flag, the `dist/` is the API-mode bundle and the gate silently passes while testing nothing. The Makefile target above always rebuilds; do not split the build and the test-run steps across separate manual invocations.

**Authenticated routes redirect before they render.** In a fresh browser session with no stored session data, authenticated routes typically redirect to the onboarding or login page. The sweep then measures the redirect target, not the route you wanted to test. Either onboard first in a `beforeAll` block, or assert on the onboarding page rendering cleanly rather than expecting the dashboard to appear. Adaptive-learner carried this blind spot for several test cycles before the spec was updated to account for it.

**Keep this gate out of `make test`.** The target needs a Vite build and a browser, both of which are too slow for the everyday change-test loop. It belongs in the release chain only. The existing `make test` stays fast (backend pytest + frontend Vitest, no build, no browser).

**Extend the spec over time.** The route-sweep is the minimum viable gate: it catches crash-on-load failures. As your app matures, add real interactive flows to `e2e/dexie/` - complete a core user action end to end in Dexie mode, verify that data written to IndexedDB persists across a page reload, check that no route shows a horizontal scrollbar at a 375px mobile viewport. Each new spec raises the confidence bar without slowing the sweep materially.
