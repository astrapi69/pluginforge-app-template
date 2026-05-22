# E2E fixtures

Binary/text fixtures consumed by the Playwright smoke specs.
Keep this directory small; reviewers need to understand each
byte on disk.

The template ships no fixtures. As your domain stabilises and
you write smoke specs that need pre-built test inputs (backup
archives, import sources, sample files), add them here.

## Convention

For every binary fixture, also commit a generator script next
to it so the fixture is reproducible without a backend running.
Pattern:

```
e2e/fixtures/
  <fixture-name>.<ext>      # the binary fixture
  regen_<fixture-name>.py   # reproduces it deterministically
```

Document each fixture in this README with:

- What the fixture represents (one sentence).
- Which smoke spec consumes it.
- How to regenerate it.

## Example entry shape

```markdown
## minimal-entity.<ext>

Minimum valid input the import wizard accepts: one entity,
no children, no assets. Used by `smoke/import-wizard.spec.ts`.

Regenerate with:

` ` `bash
python3 e2e/fixtures/regen_minimal_entity.py
` ` `
```
