# Project Comparison: Template ↔ Bibliogon ↔ Adaptive-Learner

> **Generated**: 2026-09-27 | **Template**: v0.x | **Bibliogon**: v0.60.0 | **Adaptive-Learner**: v2.15.0
> **Purpose**: Show what the template provides vs. what real applications add on top

---

## High-Level Comparison

| Aspect | Template (this repo) | Bibliogon | Adaptive-Learner | Notes |
|--------|---------------------|-----------|------------------|-------|
| **Purpose** | Generic scaffold for new PluginForge apps | Book authoring (prose, picture-book, comic) | Language learning (lessons, SRS, exercises) | Template is domain-agnostic |
| **Domain Models** | `EXAMPLE-DOMAIN` (Book, Chapter, Article, Comment, Author, Asset) | 15+ entities (StoryEntity, ComicPanel, Page, etc.) | 20+ entities (Lesson, Exercise, Mission, etc.) | Replace `EXAMPLE-DOMAIN` per project |
| **Storage Modes** | API (FastAPI/SQLite) scaffold | API + Dexie (IndexedDB) — full dual-mode | API + Dexie — full dual-mode | Template has `IStorageService` pattern; Dexie is opt-in |
| **Plugin System** | PluginForge ^0.10.0 wired, zero plugins | 16 plugins (core + export, AI, Git, etc.) | 13 plugins (core + missions, content-repo, etc.) | Template has hook specs + loader ready |
| **AI Integration** | None (infrastructure only) | 6 providers, browser-direct in Dexie | 3 providers, browser-direct in Dexie | Both apps use `@astrapi69/feature-strategy` |
| **Export/Import** | Backup/restore scaffolding | Full `.bgb` + selective + 6 client formats | Full `.alb` + selective + Anki `.apkg` | Template has `backup_history` model/service |
| **Sync** | None | Git-sync (per-book), Git-backup | WiFi sync, Content-repo sync, Git-backed learning repo | Different models per app |
| **PWA/Offline** | Not configured | Full offline, SW auto-update, GH Pages | Full offline, SW auto-update, GH Pages | Template: add Dexie + SW for PWA |
| **Launcher** | PyInstaller cross-OS (Linux/macOS/Windows) | docker-app-launcher ^0.28.0 (PyPI library) | Custom hand-written launcher | Template has PyInstaller; apps may migrate |
| **CI/CD** | Full GitHub Actions suite | Same + release automation Makefile targets | Same + mutation testing import | Template has release-gate workflow |

---

## What the Template Provides (Baseline)

### Backend
- FastAPI app with layered architecture (routers → services → models)
- SQLAlchemy 2.0 + Alembic migrations
- Pydantic v2 schemas
- PluginForge integration: hookspecs, entry-point loader, lifecycle management
- 4-layer config: project YAML < user overlay < `~/.config/myapp/secrets.yaml` < env vars
- Test isolation: tmp data dir + production marker tripwire + in-memory test DB
- i18n: 8 languages (DE, EN, ES, FR, EL, PT, TR, JA) in `backend/config/i18n/*.yaml`
- Soft-delete + trash lifecycle on `EXAMPLE-DOMAIN` entities
- Backup/restore scaffolding (`backup_history` model + service)
- Licensing infrastructure (HMAC-signed, dormant)

### Frontend
- React 19 + TypeScript strict + Vite 8
- Radix UI primitives (Dialog, Tabs, Dropdown, Select, Tooltip)
- @dnd-kit, Lucide React, react-toastify
- Theming: CSS custom properties, multiple palettes × light/dark
- Typed API client (`frontend/src/api/client.ts`) with `ApiError` + toast-friendly chain
- i18n hook (`useI18n`) reading backend YAML catalogs

### Plugin System
- Zero plugins ship — loader is wired and ready
- Hook specs at `backend/app/hookspecs.py`
- Entry-point group `myapp.plugins`

### Launcher
- Cross-OS PyInstaller launcher under `launcher/`
- Per-OS build pipelines: `.github/workflows/launcher-{linux,macos,windows}.yml`
- Single-source version pin (`backend/pyproject.toml` → `make sync-versions`)

### CI/CD
- GitHub Actions: `ci.yml`, `coverage.yml`, `docs.yml`, launcher workflows, `release-gate.yml`, `mutation-import.yml`
- Pre-commit: ruff (lint+format), check-yaml/json, trailing-whitespace, end-of-file-fixer
- Release-gate enforcement (version pins, subsystem lock-step, install.sh freshness)

### Patterns (in `docs/patterns/`)
- 01-dual-storage.md — `IStorageService` + API/Dexie backends
- 02-dexie-mode-release-gate.md — offline release gate
- 03-release-automation.md — Makefile targets + Gitflow
- 04-docs-verification.md — drift gates
- 05-i18n-sync.md — YAML → frontend JSON sync
- 06-friendly-errors.md — `ApiError` + toast chain
- 07-complexity-cohesion-ratchet.md — file-size/complexity/god-folder gates
- 08-test-impact-analysis.md — changed-only test execution
- 09-design-tokens.md — CSS custom properties theming
- 10-security-scanning.md — dependency audit gates

---

## What Bibliogon Adds (v0.60.0)

### Domain-Specific Features
| Feature | Description |
|---------|-------------|
| **Story Bible** | Fiction entities (character/setting/plot_point/item/lore) + relationships + Arc View + continuity checker |
| **Picture-Book Editor** | 13 layouts (incl. collage), drag-positioned regions, overlay text tiers |
| **Comic Editor** | Panel grids (7 templates), speech bubbles (6 types), cross-page panel move |
| **Chapter Outliner** | Sortable inline-editable spreadsheet, synopsis, inspector notes |
| **Writing Goals + Streak** | Per-book word target + deadline, per-chapter targets, dashboard widget |
| **Quality Report (PDF)** | Flesch, nested sentences, genre benchmarks, chapter comparison |
| **KDP Publishing Wizard** | Format step, trim size, margins, cover validation, completeness check |
| **A+ Content Generator** | Amazon A+ modules from metadata via AI |
| **Promotion Board** | Retail formats per book, store URLs, ASIN, universal links |

### Infrastructure Upgrades
| Feature | Description |
|---------|-------------|
| **docker-app-launcher** | Library-first (^0.28.0): force-recreate, `--update`, `--doctor`, live logs, cancellable ops |
| **Release Automation** | Makefile targets (`release-prepare`/`release-finish`) + Gitflow workflow |
| **Visual Regression** | Playwright screenshot baselines (36 specs, 3 views × 12 themes) |
| **a11y Gates** | axe-core checks (5 routes), WCAG AA contrast verification |
| **SEO/Export Meta** | Open Graph, Twitter, JSON-LD, og-image per export format |
| **Scrivener Import** | `.scrivx` parsing with `defusedxml` |
| **Client-side Templates** | "Aus Vorlage" in Dexie mode |
| **Maximal Offline** | Full desktop parity in PWA via `IStorageService` seam |

### Plugins (16 core)
plugin-export, plugin-help, plugin-getstarted, plugin-ms-tools, plugin-audiobook, plugin-translation, plugin-grammar, plugin-kinderbuch, plugin-kdp, plugin-comics, plugin-git-sync, plugin-medium-import, plugin-learnset, plugin-promotion, plugin-story-bible, plugin-aplus

---

## What Adaptive-Learner Adds (v2.15.0)

### Learning-Specific Features
| Feature | Description |
|---------|-------------|
| **SRS (Spaced Repetition)** | Element-level errors, 3-consecutive-correct mastery, 1d/3d/7d scheduler, review queue |
| **Gamification** | Exponential level curve, 24 badges/5 categories, streak freeze/weekend mode, GitHub-style heatmap |
| **Daily Missions** | 3 deterministic adaptive goals/day, evaluated against existing data (`missions` plugin) |
| **Anki Export** | Client-side `.apkg` builder (sql.js + JSZip), AI-extracted cards, accept/reject/edit UI |
| **Adaptive Lesson Generation** | Rule-based, client-side: reads error history, classifies weaknesses, synthesizes personalised lesson |
| **Exercise Types (7+)** | Matching, Picture-Choice, Cloze, Dictation, Free-Text, Word-Tiles, Hotspot, Parsons, Ordering |
| **NotebookLM Integration** | StudyQuestion generation, one-shot study guide, client-side ZIP export |

### Content Ecosystem
| Feature | Description |
|---------|-------------|
| **Content Repository Ecosystem** | Multiple repos (list/add/remove/reorder), Trust levels, curated discovery, star ratings, private/coach repos |
| **Learning Repository (Git-backed)** | Per-project Markdown artefacts (README, STATS, CHEATSHEET, ROADMAP), semantic commits, cycle tags |
| **Community Sharing via PR** | Share wizard → GitHub PR to official content repo, CI validation, duplicate detection |
| **Asset Fetching for Content** | Binary images via manifest-declared `assets/`, deterministic placeholder SVGs |

### UX/Quality Infrastructure
| Feature | Description |
|---------|-------------|
| **KeyVault (Encrypted AI Keys)** | `@astrapi69/ai-key-vault` + React components, passphrase-encrypted `.alk`, format-agnostic import |
| **Contextual Help** | 22 glossary concepts, dotted-underline HelpTooltip, slide-over HelpDrawer, search |
| **Error-Toast → GH Issue** | 5xx toasts → "Report Issue" button → pre-filled GH issue URL, DEBUG mode stacktrace |
| **Praise/Celebration** | 8-lang catalogs, AnswerCelebration, milestone overlays, CSS confetti, intensity settings |
| **Identity Persistence** | `~/.config/identity.yaml` writes on changes, Landing flow recovers from disk/IndexedDB |
| **Danger Zone (3-step typed confirm)** | `POST /api/reset` truncates all tables, scrubs `ai.*` from secrets.yaml, preserves Fernet key |
| **Secrets.yaml UI Source Badges** | Shows where key comes from (env/secrets.yaml/DB) |
| **Visual Regression** | 16 smoke specs, screenshot baselines (Playwright) |
| **WCAG 2.1 AA Audit** | Full audit + atomic fixes, regression tests |
| **Native i18n (PT/TR/JA)** | Full native translations replacing EN-passthrough |

### Plugins (13 core)
Similar core set + missions, content-repo, learning-repo, praises, pronunciation, etc.

---

## What You Get When Starting From This Template

### Immediately Usable (No Customization)
- [x] FastAPI + React + TypeScript skeleton
- [x] SQLAlchemy 2.0 + Alembic + Pydantic v2
- [x] PluginForge loader + hook specs
- [x] 8-language i18n (backend YAML + frontend sync via `make sync-i18n`)
- [x] Layered config + secrets chain (4 layers)
- [x] Test isolation (tmp dir + production marker + in-memory DB)
- [x] Soft-delete + trash on example entities
- [x] Backup/restore scaffolding
- [x] Typed API client + `ApiError` + toast chain
- [x] Radix UI + @dnd-kit + theming (CSS custom properties)
- [x] Cross-OS PyInstaller launcher
- [x] Full CI/CD (GitHub Actions, pre-commit, release-gate)
- [x] 10 documented patterns in `docs/patterns/`
- [x] TDD workflow + complexity/cohesion ratchets
- [x] Test Impact Analysis (`make test-changed`)

### Requires Domain Customization
- [ ] Replace `EXAMPLE-DOMAIN` entities (Book, Chapter, Article, Comment, Author, Asset) with your domain
- [ ] Define your content model (chapters? pages? lessons? exercises?)
- [ ] Add domain-specific plugins (or build as plugins)
- [ ] Configure PWA/offline (Dexie + SW) if needed
- [ ] Add visual regression baselines if needed
- [ ] Add a11y gates if needed
- [ ] Add domain-specific export/import formats
- [ ] Define your plugin entry-point group (`myapp.plugins` → `yourdomain.plugins`)

### Optional Upgrades (Port from Bibliogon/AL)
- [ ] Dexie/IndexedDB dual-mode (see `docs/patterns/01-dual-storage.md`)
- [ ] docker-app-launcher migration (Bibliogon's library-first approach)
- [ ] Release automation Makefile + Gitflow (see `docs/patterns/03-release-automation.md`)
- [ ] Visual regression + multi-browser E2E
- [ ] KeyVault for AI keys (AL's `@astrapi69/ai-key-vault`)
- [ ] Contextual help tooltips (AL's HelpTooltip/HelpDrawer)
- [ ] Error-toast → GH issue reporting
- [ ] SRS/gamification/missions (AL's learning features)
- [ ] Content repository ecosystem (AL's content-repo pattern)

---

## Migration Path: Template → Your App

```
1. Clone template → `my-app`
2. Read CUSTOMIZE.md (global rename, EXAMPLE-DOMAIN replacement, first plugin)
3. Run `make install` → `make test` → `make dev` (verify green baseline)
4. Replace domain models (Step 3 in CUSTOMIZE.md)
5. Add domain-specific plugins (backend/app/hookspecs.py + plugins/)
6. Optional: Add Dexie/PWA (pattern 01-dual-storage.md)
7. Optional: Add release automation (pattern 03-release-automation.md)
8. Optional: Add visual regression / a11y gates
9. Optional: Port KeyVault / contextual help / SRS from AL
10. Optional: Migrate launcher to docker-app-launcher (Bibliogon's approach)
```

---

## Shared Packages Across All Three

| Package | Template | Bibliogon | Adaptive-Learner | Purpose |
|---------|----------|-----------|------------------|---------|
| `pluginforge` | ✓ | ✓ | ✓ | Plugin framework (PyPI) |
| `@astrapi69/feature-strategy` | (pattern) | ✓ | ✓ | Feature gating (`useFeature`) |
| `@astrapi69/ai-key-vault` | — | (planned #908) | ✓ | Encrypted AI key export/import |
| `manuscripta` | — | ✓ (^0.9.0) | — | Book export pipeline |
| `docker-app-launcher` | — | ✓ (^0.28.0) | — | Desktop launcher library |
| `IStorageService` | (pattern) | ✓ | ✓ | Dual-mode storage seam |

---

## Recommendations

### For New Projects Starting From This Template

1. **Start minimal** — Use the template as-is, only replace `EXAMPLE-DOMAIN`
2. **Add patterns incrementally** — Pull from `docs/patterns/` as needed
3. **Build domain as plugins** — Keep core lean, ship domain logic in plugins
4. **Adopt release automation early** — Pattern 03 saves significant time
5. **Consider Dexie/PWA only if offline is a requirement** — Adds complexity

### For Bibliogon/AL Maintainers

1. **Template is the contract** — If a pattern works in both apps, it belongs in the template
2. **Backport patterns** — When AL or Bibliogon invents a reusable pattern, add to `docs/patterns/`
3. **Keep CLAUDE.md rules generic** — Prune domain-specific entries
4. **Shared packages** — Extract truly shared code to `@astrapi69/*` npm/PyPI packages

---

## Conclusion

**The template provides**: A production-ready, tested, CI-gated skeleton with all cross-cutting concerns solved (config, i18n, plugins, launcher, test isolation, patterns). It has **zero domain assumptions**.

**Bibliogon adds**: Deep domain features for book authoring (Story Bible, visual editors, publishing workflows, KDP/A+), plus infrastructure upgrades (docker-app-launcher, release automation, visual regression).

**Adaptive-Learner adds**: Learning-specific features (SRS, gamification, missions, exercises, Anki export), content ecosystem (repos, sharing, PR-based), and UX quality infrastructure (KeyVault, contextual help, error reporting, praise system, WCAG audit).

**Best cross-pollination**:
- Template → Both: Patterns, CI/CD, test isolation, launcher spec
- Bibliogon → Template: docker-app-launcher pattern, release automation Makefile, visual regression setup
- AL → Template: KeyVault pattern, contextual help pattern, error-reporting pattern, SRS/gamification as optional plugins
- Bibliogon → AL: docker-app-launcher, release automation, KDP concepts as "publish lesson set"
- AL → Bibliogon: KeyVault (in progress), Anki export, SRS, gamification, content repo, contextual help, error reporting

All three share the same architectural DNA (PluginForge, layered config, `IStorageService` pattern, feature strategy, Tailwind/Radix/TipTap stack), making component porting straightforward.