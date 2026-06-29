# Pattern: Dual-storage IStorageService

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** the **seam ships**; the second backing does not. `frontend/src/storage/` provides `IStorageService` (`types.ts`, minimal: `settings` + `backup`), `ApiStorage` (`api-storage.ts`, delegates to the `api` client), and `getStorage()` (`index.ts`, selects by `VITE_STORAGE_MODE`, api-only for now). `DataSettings` already reaches its backup calls through `getStorage()` as the worked example. **Adopt it incrementally**: grow the interface and route one component off `api.*` at a time. A real `DexieStorage` (browser IndexedDB) is the per-app effort you add when you need offline/static deployment — `getStorage()` warns and falls back to api if `VITE_STORAGE_MODE=dexie` is set before it exists. (`frontend/src/db/drafts.ts` already uses Dexie for draft autosave, unrelated to this seam.)

## Why

A PluginForge app typically ships two runtime shapes:

- A **server-backed shape** where a FastAPI backend manages SQLite via SQLAlchemy and the frontend talks to it over HTTP.
- A **backend-free shape** deployed as a static build -- for example on GitHub Pages -- where there is no server and all data must live in the browser's IndexedDB. External calls (AI providers, third-party APIs) go browser-direct.

Without an abstraction every page and component hard-codes calls to `fetch` or the `api` object from `frontend/src/api/client.ts`. In the static build those calls return network errors on load, and the user sees nothing but error toasts. The Dexie path has to be bolted on file by file, creating two parallel codepaths with no shared contract.

The abstraction solves this once. Components know only `getStorage()`; the two implementations decide what actually happens underneath.

## The pattern

Define a single `IStorageService` TypeScript interface that every page and component reads through. A module-level `getStorage()` function returns the right implementation for the current build or runtime setting.

```typescript
// frontend/src/storage/types.ts

export interface ISettingsNamespace {
  get(userId: string): Promise<UserSettings>
  update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings>
}

export interface IItemsNamespace {
  list(userId: string): Promise<Item[]>
  create(data: ItemCreate): Promise<Item>
  update(id: string, patch: Partial<ItemCreate>): Promise<Item>
  delete(id: string): Promise<void>
}

export interface IStorageService {
  settings: ISettingsNamespace
  items: IItemsNamespace
  // add one namespace per domain area
}
```

```typescript
// frontend/src/storage/index.ts

import { ApiStorage } from "./api-storage"
import { DexieStorage } from "./dexie-storage"
import type { IStorageService } from "./types"

const mode = import.meta.env.VITE_STORAGE_MODE ?? "api"

let _storage: IStorageService | null = null

export function getStorage(): IStorageService {
  if (!_storage) {
    _storage = mode === "dexie" ? new DexieStorage() : new ApiStorage()
  }
  return _storage
}
```

A component reads only through `getStorage()`, never through `api` directly:

```typescript
// Before (api-only, breaks in static build):
const settings = await api.settings.get(userId)

// After (works in both modes):
const settings = await getStorage().settings.get(userId)
```

`ApiStorage` delegates each namespace method to the existing typed `api` calls in `frontend/src/api/client.ts`. `DexieStorage` keeps IndexedDB tables that mirror the backend models and returns the same wire shapes.

## What the template already provides

- **`frontend/src/db/drafts.ts`** -- a working, single-purpose Dexie store (`MyAppDB`, schema version 1, `drafts` table). It proves the Dexie dependency is wired and IndexedDB access works. Use it as the reference for how to open a database, version a schema, and write async table helpers.
- **`frontend/src/api/client.ts`** -- the fully-typed HTTP client with `ApiError`, the `request()` helper, and all domain namespaces already organized. `ApiStorage` is mostly a thin wrapper that calls these existing functions.
- **Dexie 4** is already a declared dependency; no install step required.
- The `MYAPP_*` env-var prefix convention (from `backend/config/`) has a natural frontend counterpart in `VITE_STORAGE_MODE`.

## To complete it

1. **Create `frontend/src/storage/`** with four files:
   - `types.ts` -- `IStorageService` and one `I*Namespace` interface per domain area.
   - `api-storage.ts` -- `ApiStorage implements IStorageService`. Each method calls the corresponding `api.*` function from `client.ts`.
   - `dexie-storage.ts` -- `DexieStorage implements IStorageService`. Extends the `MyAppDB` pattern from `drafts.ts` with tables for every domain entity. Returns the same shapes the backend returns.
   - `index.ts` -- the `getStorage()` accessor shown above.

2. **Route all component API calls through `getStorage()`**. Replace every direct `api.*` call in pages and components with the corresponding `getStorage().*` call. The `architecture.md` rule already says "API calls ONLY through `frontend/src/api/client.ts`"; this step moves the rule one level up to the storage abstraction.

3. **Add the `VITE_STORAGE_MODE` flag**. In `vite.config.ts` expose it as a define constant. Add a Settings toggle (Settings > General or Settings > Data) that writes to `localStorage` and requires a reload to switch. The Dexie path is the GitHub Pages shape; API is the default.

4. **Keep Dexie schema versions in sync with backend migrations**. Every Alembic migration that adds or changes a table needs a paired Dexie schema version bump with an explicit upgrade function. Do not use `this.version(N).stores(...)` without an `.upgrade()` callback when existing rows need to be rewritten.

A Dexie-mode release gate (see `docs/patterns/02-dexie-mode-release-gate.md`) enforces that every nav-reachable route renders cleanly in the static build. Add it when the storage abstraction is first wired.

## Gotchas

**The two-mode contract is a release rule, not a "nice to have".** Any feature that ships with an `ApiStorage` path but no `DexieStorage` path (or no graceful "not available in browser mode" message) is a release blocker. The GitHub Pages deployment is typically the first-impression URL for new users; an error toast on load destroys that impression immediately. Both paths must land in the same commit.

**Server-only features cannot run in Dexie mode.** Anything that needs the filesystem, a native binary, or a git subprocess cannot be emulated in IndexedDB. Disable those UI surfaces in Dexie mode with a tooltip explaining why, rather than letting the call fail at runtime.

**Never call `fetch` or `api.*` outside the storage abstraction.** Once `IStorageService` exists, a direct `api.*` call in a component is an architecture violation. The linting rule in `architecture.md` ("API calls ONLY through `frontend/src/api/client.ts`") extends to "calls ONLY through `getStorage()`". The existing `client.ts` call sites in components should be migrated when the abstraction is added; new code must never go around it.

**Avoid `dynamic import()` inside an IndexedDB upgrade transaction.** An async dynamic import suspends execution, which causes the browser to commit the transaction before the upgrade callback finishes. The result is a `DatabaseClosedError` on the next open. Keep all upgrade logic synchronous or limit it to awaits on Dexie table operations -- not on module imports.

**Dexie schema version bumps are one-way.** Once a version number is in the field there is no rollback. Increment deliberately: one bump per cohesive schema change, with a matching `.upgrade()` function that migrates existing rows rather than wiping them.
