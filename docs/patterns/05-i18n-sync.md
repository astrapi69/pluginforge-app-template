# Pattern: i18n sync pipeline (YAML source -> frontend JSON)

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** 8 backend YAML catalogs present under `backend/config/i18n/` (de, el, en, es, fr, ja, pt, tr) with full parity and structure tests in `backend/tests/test_i18n_parity.py` and `backend/tests/test_i18n_structure.py`; no `make sync-i18n` target, no `scripts/sync_i18n.py`, and no `frontend/src/data/i18n/*.json` generated files yet. The frontend currently fetches catalogs at runtime via `api.i18n.get(lang)`.

## Why

Backend and frontend both need translated strings. Maintaining two copies by hand causes drift. Fetching catalogs from the API at runtime solves drift but breaks the static/offline build: when `VITE_STORAGE_MODE=dexie` (see `01-dual-storage.md`), there is no backend to fetch from. A first-time visitor on the GitHub Pages deployment gets no translated strings.

The solution is one source of truth with a build-time copy. The backend YAML files are the only place a string is ever written. A script regenerates the frontend JSON from them before every dev start and every build. The frontend imports the JSON statically, so it works offline, in tests, and behind any storage mode.

## The pattern

```
backend/config/i18n/*.yaml
        |
        | make sync-i18n   (scripts/sync_i18n.py)
        v
frontend/src/data/i18n/*.json   <-- build-time mirror, never hand-edited
        |
        | static import at startup
        v
useI18n  ->  t("ui.some.key", "fallback")
```

The `t(key, fallback)` function walks the bundled JSON by the dotted path. If any segment is missing it returns the fallback string (or the raw key), so a missing translation never crashes the UI.

A parity test (`test_i18n_parity.py`) runs in `make test` and asserts key-set equality across all 8 locales against EN as the reference. You cannot add a string to EN and forget DE: the next `make test` fails with an actionable message naming the missing key and the file to fix.

A structure test (`test_i18n_structure.py`) independently guards the YAML nesting. PyYAML 1.1 silently coerces bare `on:` and `off:` keys to Python booleans. A misplaced indent moves an entire subsection into its sibling. Both bugs are invisible at runtime until a user switches language; the structure test catches them at commit time.

## What the template already provides

- `backend/config/i18n/{de,el,en,es,fr,ja,pt,tr}.yaml` - the 8 locale catalogs, each with a `ui.*` namespace hierarchy. EN is the reference; DE is fully maintained in lockstep; the other six carry a `_meta.review_status` marker noting they are pending a native-speaker pass.
- `backend/tests/test_i18n_parity.py` - five parameterised checks: no missing keys, no extra keys, no empty values, structural parity, and `{placeholder}` parity. Plus a non-failing advisory that flags values byte-identical to EN and likely untranslated.
- `backend/tests/test_i18n_structure.py` - guards top-level `ui.*` section roots, rejects boolean YAML keys, and pins that subsections cannot accidentally nest inside their siblings.
- `frontend/src/hooks/useI18n.ts` - `I18nProvider` and `useI18n()` with a dotted-path `t(key, fallback)` resolver and a module-level cache. Currently fetches from `api.i18n.get(lang)`; step 4 below replaces that with a static import.

## To complete it

1. **Write `scripts/sync_i18n.py`.** Load each YAML from `backend/config/i18n/`, strip the `_meta` block (`raw.pop("_meta", None)`, same as the parity test), and write `frontend/src/data/i18n/{lang}.json` using `json.dumps(..., ensure_ascii=False, sort_keys=True, indent=2)` for deterministic, diff-clean output.

2. **Add `make sync-i18n` to the Makefile.**
   ```makefile
   sync-i18n: ## Regenerate frontend/src/data/i18n/*.json from backend YAML catalogs
       @python3 scripts/sync_i18n.py
   ```

3. **Wire as a predev/prebuild npm hook in `frontend/package.json`.**
   ```json
   "predev": "python3 ../scripts/sync_i18n.py",
   "prebuild": "python3 ../scripts/sync_i18n.py"
   ```
   The script is idempotent; it is a no-op when the YAML has not changed.

4. **Switch `useI18n` to import the bundled JSON.** Replace the `api.i18n.get(lang)` call with a static import map keyed by locale code. The `t(key, fallback)` resolver and dotted-path walk are unchanged. Remove the module-level fetch cache; the JSON is in the bundle.

5. **Keep the parity test as the gate.** No change to `test_i18n_parity.py`. `make test` already enforces key-set equality across all locales.

## Gotchas

**Never hand-edit the generated JSON.** Treat `frontend/src/data/i18n/*.json` like generated docs: the source is the YAML, the JSON is an artifact. Any manual edit will be overwritten by the next `make sync-i18n`.

**Deterministic output prevents noisy diffs.** Use `json.dumps(..., ensure_ascii=False, sort_keys=True, indent=2)`. Without `sort_keys=True`, key insertion order varies across Python versions and produces spurious diffs on every run.

**Dotted-path keys stored as flat strings silently fall through.** If a YAML author writes `"ui.settings.save": "Speichern"` as a flat top-level key instead of the nested `ui > settings > save` structure, `t("ui.settings.save")` finds nothing and returns the fallback. The parity test catches this (flat key is extra, nested path is missing), but only if you also add a resolution test that calls `t()` on every expected key path and asserts it does not return the raw key.

**Locale-content rule: production text uses native character sets.** German values use real umlauts, never ASCII substitutes. French uses accented characters. Code identifiers, YAML keys, filenames, and JSON keys stay ASCII. The `test_advisory_untranslated_en` check surfaces ASCII transliterations in non-English catalogs as advisories; they do not fail the test but do indicate a missed translation.

**Strip `_meta` before writing the JSON.** The review-status marker (`_meta.review_status: "pending native speaker"`) is catalog metadata for maintainers; it must not reach the frontend bundle. Mirror the `raw.pop("_meta", None)` already used in `test_i18n_parity.py`.
