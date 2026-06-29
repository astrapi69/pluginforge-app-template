# Drop-in CC prompts

Reusable, **template-neutral** prompts for recurring work that every
PluginForge app eventually needs. Each file is a copy-paste-ready prompt
for a fresh Claude Code session at the repo root — they describe the WHAT
and the project conventions to honour, not one app's domain.

These complement the other two reusable-asset layers:

- `.claude/rules/` — how to work in this codebase (always/on-demand rules).
- `docs/patterns/` — larger cross-cutting designs you opt into per app.
- **`.claude/prompts/` (this dir)** — task recipes: drop one in, fill the
  app-specific blanks, run.

Replace the `myapp` placeholder with your app name. Where a prompt ships a
code block, treat it as a starting scaffold, not gospel — read the real
`.d.ts` / API of any library it names before wiring it up.

| Prompt | Use it to |
|--------|-----------|
| [audit.md](audit.md) | Run a systematic codebase audit against the project's documented standards (tests, code quality, infra, docs). Triage only — produces a report, not a patch. |
| [seo.md](seo.md) | Add SEO: per-route `<title>` + meta + Open Graph + Twitter cards + canonical + `sitemap.xml` + `robots.txt` + JSON-LD. Ships a dependency-free `<Seo>` scaffold. |
| [accessibility.md](accessibility.md) | Run a WCAG 2.1 AA audit + fix the common failures (landmarks, focus, labels, contrast, reduced-motion). axe-core is already wired in dev. |
| [feature-strategy.md](feature-strategy.md) | Replace ad-hoc feature gating (per-button `if (hasKey)` checks, mode-based hiding) with `@astrapi69/feature-strategy`'s active/disabled/hidden model. |
| [exp-design-doc.md](exp-design-doc.md) | Write an architecture-decision / exploration doc (the "EXP" convention) before building a non-trivial feature. |

## How to use

1. Open the prompt file, skim it, and replace any `myapp` / `<...>`
   placeholders with your specifics.
2. Paste it into a fresh Claude Code session at the repo root.
3. Follow your `ai-workflow.md` discipline: GitHub issue first, then the
   work, then `Closes #NN` in the commit.

## Adding your own

Keep new prompts template-neutral if they belong here. App-specific
prompts (with your domain, your URLs, your content) belong in
`docs/prompts/` instead — this directory is for the reusable recipes.
