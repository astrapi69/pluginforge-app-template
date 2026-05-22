# Launcher i18n review status

This document tracks the per-language review state of the
launcher's i18n catalogs. The machine-readable equivalent lives
in each catalog's `_meta` block (when present); this file is
the human-readable companion.

The template ships catalogs as placeholders. Re-fill this table
as your project picks a translator path per language.

## Catalogs

| Code | Language | Status | Translator | Date | Notes |
|------|----------|--------|------------|------|-------|
| en | English | source / reference | maintainer | - | The reference catalog. Every other catalog mirrors its key set. |
| de | Deutsch | _set on project init_ | _name_ | _date_ | Use real umlauts (ä ö ü ß) per the project rule. |
| el | Ελληνικά | _set on project init_ | _name_ | _date_ | |
| fr | Français | _set on project init_ | _name_ | _date_ | |
| es | Español | _set on project init_ | _name_ | _date_ | |
| pt | Português | _set on project init_ | _name_ | _date_ | |
| tr | Türkçe | _set on project init_ | _name_ | _date_ | |
| ja | 日本語 | _set on project init_ | _name_ | _date_ | |

## How the marker works

Each pending-review catalog can carry a `_meta` block at the
top of the JSON:

```json
{
  "_meta": {
    "review_status": "pending native speaker",
    "translator": "<name or tool>",
    "translation_date": "YYYY-MM-DD",
    "reference_lang": "en"
  },
  "...other keys": "..."
}
```

The runtime `i18n.t()` function looks up string keys directly,
so `_meta` is silently ignored - the dict is data, not a
translation entry. The parity tests in
`launcher/tests/test_i18n_parity.py` enforce two contracts:

1. Every catalog has the same content keys as `en.json` (no
   missing, no extra).
2. Pending-review catalogs carry the `_meta.review_status ==
   "pending native speaker"` block; verified catalogs do NOT.

This means a future native-speaker pass that fixes a
translation but leaves the marker is caught by CI as "marker
still present after review", and a native pass that updates the
catalog without removing the marker still ships safely.

## How to submit corrections

1. Fork the repo.
2. Edit the relevant `launcher/myapp_launcher/locales/{lang}.json`
   directly.
3. Remove the `_meta` block when the entire catalog has been
   reviewed (keep it if your pass was partial; add a Notes
   column entry to this file noting the partial state).
4. Open a PR. Tag it `i18n-{lang}` so the maintainer can route it.
5. The launcher i18n parity test will catch:
   - any key removal (catalog must keep parity with `en.json`)
   - any new key without an EN counterpart
   - any placeholder-set drift (`{port}` / `{version}` / `{path}` etc.)

For partial corrections (a few strings, not the whole catalog),
open a PR with just the strings you are confident about and
leave the `_meta` block in place. The next reviewer can build
on top.

## Audit log

| Date | Action | Catalog | Notes |
|------|--------|---------|-------|
| _date_ | _action_ | _lang_ | _notes_ |
