# Quality checks and test strategy

## Quick check after every change

### 1. Run the tests

```bash
# Everything at once (MUST be green before every commit)
make test

# Individually when targeted:
make test-backend           # pytest backend
make test-frontend          # Vitest

# E2E (needs a running app)
make dev                    # start the app
npx playwright test         # E2E tests
```

When the project adopts plugins, wire each one into a
`test-plugin-<name>` target and aggregate via `test-plugins`
(see the comment block in the Makefile for the pattern).

### 2. Type check

```bash
# Frontend: TypeScript compiler
cd frontend && npx tsc --noEmit

# Backend: mypy
cd backend && poetry run mypy app/
```

### 3. Manually check the rules

Go through this checklist before committing:

- [ ] No `any` in TypeScript without a comment
- [ ] No fetch() calls outside of api/client.ts
- [ ] No browser dialogs (alert, confirm, prompt); use AppDialog
- [ ] No hardcoded strings in the UI; use the i18n YAML
- [ ] New UI elements work in every theme variant
- [ ] CSS uses variables, no hardcoded colors
- [ ] No em-dash in code or text
- [ ] Conventional Commit message (feat:, fix:, refactor:, ...)

---

## Test strategy

### Test pyramid

```
      /    E2E     \        Playwright
     / ------------ \       Few, critical user flows
    / Integration    \      pytest + TestClient
   / ---------------- \    API endpoints with real DB state
  /    Unit Tests      \    pytest + Vitest
 / -------------------- \  Business logic in isolation
/   Mutation Testing      \ mutmut (Python) + Stryker (TypeScript)
 --------------------------  Verifies that tests actually catch bugs
```

Current counts: track in a per-project coverage doc (e.g.
`docs/audits/current-coverage.md`) once your test surface is
large enough to make the canonical-numbers rule pay off.

### Unit tests (Backend - pytest)

**What to test:** service logic, conversions, validations, mappings.
**What NOT to test:** FastAPI routing (integration tests cover that).

**Where:** `backend/tests/` and `plugins/{name}/tests/`

**Example shape (replace with your domain):**
```python
# backend/tests/services/test_entity_service.py

def test_create_entity_persists_to_db(session):
    """create_entity writes an Entity row with the right fields."""
    entity_data = {"name": "Test", "external_id": 1}
    result = create_entity(session, entity_data)
    assert result.id is not None
    assert result.name == "Test"

def test_create_entity_rejects_duplicate_external_id(session):
    """Duplicate external_id raises ConflictError (-> HTTP 409)."""
    create_entity(session, {"name": "First", "external_id": 1})
    with pytest.raises(ConflictError):
        create_entity(session, {"name": "Second", "external_id": 1})
```

**Naming convention:** `test_{what_is_tested}.py`, functions: `test_{scenario}()`

**When to write new tests:**
- New service or new function: at least a happy path + one error case.
- Bug fix: failing test first, then fix.
- Roundtrip logic (import -> transformation -> output -> compare):
  test the roundtrip, not just one direction.

### Unit tests (Frontend - Vitest)

**Status:** set up (happy-dom).

**What to test:** API client functions, utility functions, complex hooks.
**What NOT to test:** simple components that just render (E2E tests cover that).

**Where:** next to the file: `api/client.test.ts`, `hooks/useI18n.test.ts`

**How to run:**
```bash
make test-frontend          # all frontend tests
cd frontend && npx vitest   # watch mode
```

**Example:**
```typescript
// src/api/client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { fetchEntities } from './client'

describe('API Client', () => {
  it('fetchEntities returns a list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1', name: 'Test' }])
    })
    const entities = await fetchEntities()
    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Test')
  })
})
```

### Integration tests (Backend - pytest + TestClient)

**What to test:** API endpoints with real DB state, plugin interaction.
**Difference from unit tests:** here FastAPI runs via TestClient with a real SQLite DB (in-memory).

**Where:** `backend/tests/test_api.py`, `backend/tests/test_<router>.py`

**Example shape (replace with your domain):**
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_entity_crud_roundtrip():
    """Create, read, update, delete an entity end to end."""
    resp = client.post("/api/entities", json={"name": "Test"})
    assert resp.status_code == 200
    entity_id = resp.json()["id"]

    resp = client.get(f"/api/entities/{entity_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test"

    resp = client.patch(f"/api/entities/{entity_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"

    resp = client.delete(f"/api/entities/{entity_id}")
    assert resp.status_code == 204
```

**When to write new integration tests:**
- New API endpoint: happy path + error case (404, 422).
- Plugin installation: ZIP upload -> plugin active -> endpoint reachable.
- File-format import: a real input file -> all rows + assets imported correctly.

### E2E tests (Playwright)

**What to test:** critical user flows from the end-user's perspective.
**Where:** `e2e/smoke/` (fast happy-paths) and `e2e/full/` (longer journeys).

**When to write new E2E tests:**
- New plugin with UI: at least one flow (enable plugin -> use feature).
- New dialog/modal: open, fill the form, submit, check the result.
- Regression: when a UI bug is found, write an E2E test for it.

**Example:**
```typescript
// e2e/smoke/create-entity.spec.ts
import { test, expect } from '@playwright/test'

test('user can create an entity from the dashboard', async ({ page }) => {
  await page.goto('/')
  await page.click('[data-testid="create-entity"]')
  await page.fill('[data-testid="entity-name"]', 'My Entity')
  await page.click('[data-testid="entity-submit"]')
  await expect(page.getByTestId('entity-row-my-entity')).toBeVisible()
})
```

### Coverage targets per module type

These are target coverage levels, not hard gates. They guide where to invest test effort and flag when a module is under-tested relative to its risk.

**Principle: frontend coverage is not subordinate to backend coverage.** A 95% backend with a 32% frontend is not "good enough". The frontend is the user's interface - bugs there are visible immediately. Both sides of the pyramid must reach their targets independently.

#### Backend (Python)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| Services (`app/services/`) | HIGH (>= 80%) | Core business logic, highest bug risk |
| Routers (`app/routers/`) | MEDIUM-HIGH (>= 70%) | Integration tests covering happy path + error cases |
| Models (`app/models/`) | LOW-MEDIUM | Tested indirectly via integration tests; direct tests only for custom methods |
| Schemas (`app/schemas/`) | MEDIUM | Validators and field transformations need explicit tests |
| Utilities (`app/utils/`, `app/licensing.py`, etc.) | HIGH (>= 80%) | Pure functions, easy to test, often security-relevant |

#### Plugins (Python)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| Core logic (the modules that do the plugin's work) | HIGH (>= 80%) | The plugin's reason to exist |
| `plugin.py` (hook implementations) | MEDIUM | Tested indirectly through integration; explicit tests for non-trivial hooks |
| `routes.py` | MEDIUM | At least happy-path integration test per endpoint |

#### Frontend (TypeScript/React)

| Module Type | Target | Rationale |
|-------------|--------|-----------|
| `api/client.ts` | HIGH (>= 90%) | Every API call, error path, and interceptor |
| Hooks (`hooks/`) | HIGH (>= 80%) | State logic, side effects, computed values |
| Utility functions (`utils/`) | HIGH (>= 90%) | Pure functions, trivial to test |
| Complex form components | MEDIUM (>= 60%) | Validate form logic, conditional fields, submission |
| Simple display components | LOW | E2E covers rendering; unit tests only for non-trivial logic |
| Page components | LOW | E2E covers navigation and layout |
| Contexts/Providers | MEDIUM | Test the provider logic, not the React tree |

#### E2E (Playwright)

| Flow Type | Target | Rationale |
|-----------|--------|-----------|
| Data-critical flows (backup, import, export, trash) | MUST HAVE | Silent data corruption is the worst bug class |
| Core user journeys (create, edit, navigate) | MUST HAVE | Happy path must always work |
| Plugin UI flows | SHOULD HAVE (one smoke per plugin) | Verify plugin UI mounts and basic interaction |
| Edge cases (long inputs, empty states, error recovery) | NICE TO HAVE | Fill as bugs surface |

### Mutation testing (Backend - mutmut)

**Purpose:** checks whether the tests actually catch real bugs. mutmut changes the source code (mutants) and checks whether at least one test fails. Surviving mutants reveal gaps in test quality.

**Setup:**
```bash
cd backend
poetry add --group dev mutmut
```

**pyproject.toml configuration:**
```toml
[tool.mutmut]
paths_to_mutate = "app/"
tests_dir = "tests/"
runner = "python -m pytest"
dict_synonyms = "Struct,NamedStruct"
```

**For plugins separately:**
```toml
# plugins/myapp-plugin-<name>/pyproject.toml
[tool.mutmut]
paths_to_mutate = "myapp_<name>/"
tests_dir = "tests/"
runner = "python -m pytest"
```

**How to run:**
```bash
# Full backend (slow, nightly or manual)
cd backend && poetry run mutmut run

# Just one module (faster, targeted)
cd backend && poetry run mutmut run --paths-to-mutate app/services/

# Show results
poetry run mutmut results

# Surviving mutants in detail
poetry run mutmut show <id>

# HTML report
poetry run mutmut html
```

**When to run:**
- After bigger refactorings (check whether the tests still hold).
- Before a phase is declared complete.
- Nightly in the CI pipeline (later).
- When coverage is high but confidence in test quality is low.

**How to act on the results:**
- Surviving mutants in critical code (services, conversions): add tests.
- Surviving mutants in trivial code (logging, formatting): ignore, no test bloat.
- Mutation score as a guideline: >= 60% for core modules, no hard gate.
- Include `mutmut results` in the session summary when it was run.

**Test the critical modules first:**

Pick the modules whose silent failure would corrupt the
library's promise. For a CRUD-shaped backend, that is typically:

1. Services that perform writes or transformations
2. Anything security-relevant (auth, licensing, signed payloads)
3. Plugin loader / hook dispatch
4. Format converters (if the app has any)

### Mutation testing (Frontend - Stryker Mutator)

**Purpose:** same principle as mutmut, but for TypeScript/React. Stryker Mutator is the equivalent for the JS/TS ecosystem.

**Setup:**
```bash
cd frontend
npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
```

**stryker.config.json:**
```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/core/schema/stryker-core.json",
  "testRunner": "vitest",
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "mutate": [
    "src/api/**/*.ts",
    "src/hooks/**/*.ts",
    "src/components/**/*.tsx",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
    "!src/test/**"
  ],
  "reporters": ["html", "clear-text", "progress"],
  "htmlReporter": {
    "fileName": "reports/mutation/index.html"
  },
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": null
  }
}
```

**How to run:**
```bash
# Full run (slow, nightly or manual)
cd frontend && npx stryker run

# Just one directory
cd frontend && npx stryker run --mutate "src/api/**/*.ts"

# Just one file
cd frontend && npx stryker run --mutate "src/api/client.ts"
```

**Test the critical frontend modules first:**
1. `src/api/client.ts` - all API calls, error handling
2. `src/hooks/useI18n.ts` - i18n logic
3. `src/hooks/useTheme.ts` - theme logic
4. Utility functions

---

## Automation (still to build)

### Recommended Makefile extensions

```makefile
# Frontend type check
check-types:
	cd frontend && npx tsc --noEmit

# Backend mutation testing (nightly/manual)
mutmut-backend:
	cd backend && poetry run mutmut run

mutmut-results:
	cd backend && poetry run mutmut results

mutmut-html:
	cd backend && poetry run mutmut html
	@echo "Report: backend/html/index.html"

# Frontend mutation testing (nightly/manual)
stryker:
	cd frontend && npx stryker run

stryker-api:
	cd frontend && npx stryker run --mutate "src/api/**/*.ts"

# All checks together (before push)
check-all: test check-types
	@echo "All checks passed."

# Everything together
test-all: test test-frontend
	@echo "All tests passed."
```

### CI pipeline (later, when GitHub Actions is set up)

```
1. make check-types        # TypeScript compiler
2. make test-backend       # pytest backend
3. make test-plugins       # pytest plugins
4. make test-frontend      # Vitest
5. make dev-bg             # start the app
6. npx playwright test     # E2E
7. make dev-down           # stop the app

Nightly (separate, slower):
8. make mutmut-backend     # mutation testing backend (Python)
9. make stryker            # mutation testing frontend (TypeScript)
```

---

## Coverage Targets per Module Type

- Services and business logic: 95% minimum
- API endpoints: 90% minimum
- Frontend components with logic: 85% minimum
- Frontend presentational components: 65% minimum
- Hooks and utilities: 95% minimum
- Models and schemas: 80% minimum
- Plugin routes: 90% minimum

Overall project target: 85-95% coverage.

Frontend coverage is not subordinate to backend coverage. User-facing
bugs destroy trust as effectively as backend bugs destroy data.

100% coverage is not the goal. Meaningful coverage is the goal:
tests must assert real behavior properties, not just line execution.
Regression pins for known bug classes count for more than line count.
