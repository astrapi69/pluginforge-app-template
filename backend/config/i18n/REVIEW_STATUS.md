# Backend i18n review status

This document tracks the per-language review state of the
backend i18n catalogs (`backend/config/i18n/{lang}.yaml`). The
machine-readable equivalent lives in each YAML file's top-level
`_meta:` block when present; this file is the human-readable
companion.

The template ships catalogs as placeholders. Re-fill this table
as your project picks a translator path per language (native
speaker / machine-translated then reviewed / machine-only).

## Catalogs

| Code | Language | Status | Translator | Date | Notes |
|------|----------|--------|------------|------|-------|
| en | English | **source / reference** | maintainer | - | The reference catalog. Every other catalog mirrors its key set. No `_meta` block. |
| de | Deutsch | _set on project init_ | _name_ | _date_ | Use real umlauts (ä ö ü ß) per the project rule. |
| es | Español | _set on project init_ | _name_ | _date_ | |
| fr | Français | _set on project init_ | _name_ | _date_ | |
| el | Ελληνικά | _set on project init_ | _name_ | _date_ | |
| pt | Português | _set on project init_ | _name_ | _date_ | |
| tr | Türkçe | _set on project init_ | _name_ | _date_ | |
| ja | 日本語 | _set on project init_ | _name_ | _date_ | |

## How the marker works

Each pending-review catalog can carry a `_meta:` block at the
top of the YAML:

```yaml
_meta:
  review_status: "partial: pending native speaker for new namespaces"
  translator: "<name or tool>"
  translation_date: "YYYY-MM-DD"
  reference_lang: en
  pending_namespaces:
    - <namespace-1>
    - <namespace-2>

ui:
  dashboard:
    title: "..."
  ...
```

The backend's `i18n` loader and the frontend's `useI18n` hook
treat `_meta` as silent metadata - no `t("_meta....")` lookup
ever resolves to a UI string.

The parity tests in `backend/tests/test_i18n_parity.py` enforce
three contracts:

1. Every catalog has the same content keys as `en.yaml` (no
   missing, no extra).
2. The `_meta` block, when present, conforms to the documented
   shape (`review_status`, `translator`, `translation_date`,
   `reference_lang`, `pending_namespaces`).
3. `en.yaml` and the maintainer-validated reference catalog
   (typically the maintainer's primary spoken language) must
   NOT carry the marker.

A future native-speaker pass that fixes a namespace but forgets
to remove the `pending_namespaces` entry will not break tests,
but a maintainer doing the review can pop the entry when
satisfied; once `pending_namespaces` is empty, remove the whole
`_meta` block.

## How to submit corrections

If you read one of the pending-review catalogs and find errors:

1. Fork the repo.
2. Edit the relevant `backend/config/i18n/{lang}.yaml` directly.
3. If the catalog carries a `_meta` block, update or remove the
   relevant `pending_namespaces` entries.
4. When the whole catalog is verified, remove the `_meta` block
   entirely.
5. Open a PR. Tag it `i18n-{lang}` so the maintainer can route
   it.

The parity test will catch:

- any key removal (catalog must keep parity with `en.yaml`),
- any new key without an EN counterpart,
- any placeholder-set drift (`{port}`, `{title}`, `{count}`, ...),
- any `_meta` shape regression.
