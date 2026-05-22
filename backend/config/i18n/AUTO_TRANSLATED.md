# Auto-translated i18n keys

Track machine-translated keys here so a native speaker can
review and confirm them later. Once a translation is verified,
remove its row from the matching language column.

The parity test in [backend/tests/test_i18n_parity.py](../../tests/test_i18n_parity.py)
does not inspect this file; it is maintenance metadata only.

## Format

Add one section per batch of auto-translated keys. Group by
date and short topic. Use the table shape below.

```markdown
## YYYY-MM-DD - <short topic>

<one-paragraph description of what was translated and why>

| Key | Languages |
|-----|-----------|
| `ui.<scope>.<key>` | XX, YY, ZZ |
| ... | ... |

Notes:
- Technical terms left in English / Latin script: <list>
- Placeholders preserved: `{var1}`, `{var2}`
- Other locale-specific quirks
```

## Conventions

- Technical terms (commit, push, pull, merge, force push, PAT,
  SSH, repository, branch, etc.) stay in English where the
  language community usually keeps them that way. Adjust if
  the idiomatic usage in your locale prefers a native term.
- Placeholders (`{var}`) must match the English value's set.
  The parity test enforces this.
- Length should stay within ~1.3x the English value where the
  surrounding UI has limited space (dashboard buttons, dialog
  body copy).
- No em-dashes in translated strings; use hyphens or commas.

_No current entries._
