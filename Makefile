.PHONY: dev dev-bg dev-bg-logs dev-down dev-backend dev-frontend stop restart fix-watchers \
       install install-backend install-frontend install-plugins install-e2e \
       test test-backend test-plugins test-e2e test-e2e-ui \
       test-plugin-export test-plugin-grammar test-plugin-kdp test-plugin-kinderbuch test-plugin-ms-tools test-plugin-translation test-plugin-audiobook test-plugin-help test-plugin-getstarted test-plugin-git-sync \
       test-coverage test-coverage-backend test-coverage-frontend test-coverage-plugins \
       test-coverage-plugin-audiobook test-coverage-plugin-export test-coverage-plugin-grammar test-coverage-plugin-kdp test-coverage-plugin-kinderbuch test-coverage-plugin-ms-tools test-coverage-plugin-translation test-coverage-plugin-help test-coverage-plugin-getstarted \
       mutmut-backend mutmut-export mutmut-ms-tools mutmut-results \
       check-types check-types-backend check-types-frontend \
       archive-task archive-task-dry install-hooks \
       sync-versions sync-versions-dry sync-versions-check \
       generate-trial-key \
       lock-all-plugins verify-plugin-locks \
       test-fast test-changed \
       audit-backend audit-frontend bandit-backend security-backend check-security \
       release-prepare release-finish release-publish \
       check-file-sizes check-complexity check-complexity-gate check-complexity-gate-update \
       lint lint-fix \
       clean prod prod-down prod-logs help

# --- Development ---

dev: ## Start backend + frontend (backend first, then frontend)
	@if [ -r /proc/sys/fs/inotify/max_user_watches ]; then \
		watches=$$(cat /proc/sys/fs/inotify/max_user_watches); \
		if [ "$$watches" -lt 100000 ]; then \
			echo "WARNING: fs.inotify.max_user_watches=$$watches is low (< 100000)."; \
			echo "         vite dev will likely fail with ENOSPC."; \
			echo "         Run 'make fix-watchers' for the persistent fix."; \
		fi; \
	fi
	@echo "Starting MyApp..."
	@cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run uvicorn app.main:app --reload --port 8000 &
	@echo "Waiting for backend..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		curl -s http://localhost:8000/api/health > /dev/null 2>&1 && break; \
		sleep 1; \
	done
	@echo "Backend ready. Starting frontend..."
	@cd frontend && npm run dev

DEV_LOG_DIR ?= /tmp/myapp-logs

dev-bg: ## Start in background, logs to $(DEV_LOG_DIR) (stop with: make dev-down)
	@mkdir -p $(DEV_LOG_DIR)
	@echo "Starting MyApp (background)..."
	@echo "  Backend  log: $(DEV_LOG_DIR)/backend.log"
	@echo "  Frontend log: $(DEV_LOG_DIR)/frontend.log"
	@# `setsid` puts each child in its own session so it survives the
	@# Makefile recipe shell exiting. `< /dev/null` closes stdin so the
	@# child does not block waiting on a tty. `> ... 2>&1` captures both
	@# streams to a log file we can tail later. The bare `&` backgrounds
	@# the compound, and `echo $$!` then writes the child PID for
	@# `dev-down` to kill.
	@# `A && B &` is one AND-OR list backgrounded in a subshell; the
	@# subshell inherits the cd, the main shell does not. So PID
	@# files are written from the main recipe shell at repo root, and
	@# the path is `.pid-backend` (NOT `../.pid-backend`).
	@cd backend && \
		setsid poetry run uvicorn app.main:app --reload --port 8000 \
			< /dev/null > $(DEV_LOG_DIR)/backend.log 2>&1 & \
		echo $$! > .pid-backend
	@cd frontend && \
		setsid npm run dev \
			< /dev/null > $(DEV_LOG_DIR)/frontend.log 2>&1 & \
		echo $$! > .pid-frontend
	@sleep 2
	@if kill -0 $$(cat .pid-backend) 2>/dev/null; then \
		echo "  Backend  PID: $$(cat .pid-backend) (alive)"; \
	else \
		echo "  ERROR: backend died on startup. tail $(DEV_LOG_DIR)/backend.log"; \
		rm -f .pid-backend; \
		exit 1; \
	fi
	@if kill -0 $$(cat .pid-frontend) 2>/dev/null; then \
		echo "  Frontend PID: $$(cat .pid-frontend) (alive)"; \
	else \
		echo "  ERROR: frontend died on startup. tail $(DEV_LOG_DIR)/frontend.log"; \
		rm -f .pid-frontend; \
		exit 1; \
	fi
	@echo "Stop with: make dev-down  |  Tail logs with: make dev-bg-logs"

dev-bg-logs: ## Tail backend + frontend logs from a `make dev-bg` run
	@if [ ! -f $(DEV_LOG_DIR)/backend.log ] && [ ! -f $(DEV_LOG_DIR)/frontend.log ]; then \
		echo "No logs in $(DEV_LOG_DIR). Run 'make dev-bg' first."; \
		exit 1; \
	fi
	@echo "Tailing $(DEV_LOG_DIR)/backend.log + $(DEV_LOG_DIR)/frontend.log (Ctrl+C to stop)..."
	@tail -F $(DEV_LOG_DIR)/backend.log $(DEV_LOG_DIR)/frontend.log

dev-down: ## Stop background dev servers
	@if [ -f .pid-backend ]; then kill $$(cat .pid-backend) 2>/dev/null; rm -f .pid-backend; echo "Backend stopped"; fi
	@if [ -f .pid-frontend ]; then kill $$(cat .pid-frontend) 2>/dev/null; rm -f .pid-frontend; echo "Frontend stopped"; fi
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "Done"

stop: dev-down ## Alias for dev-down (stop dev servers)

restart: dev-down dev ## Stop and restart dev servers (use after a hung session)

fix-watchers: ## Persist Linux inotify limits for vite dev (sudo required, runs once)
	@echo "MyApp: persist inotify limits for vite dev mode."
	@echo "Sudo prompt is for the sysctl write to /etc/sysctl.d/."
	@echo ""
	@echo "fs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/99-myapp-watchers.conf > /dev/null
	@echo "fs.inotify.max_user_instances=512" | sudo tee -a /etc/sysctl.d/99-myapp-watchers.conf > /dev/null
	@sudo sysctl --system > /dev/null
	@echo "Wrote /etc/sysctl.d/99-myapp-watchers.conf and applied:"
	@echo "  fs.inotify.max_user_watches    = $$(cat /proc/sys/fs/inotify/max_user_watches)"
	@echo "  fs.inotify.max_user_instances  = $$(cat /proc/sys/fs/inotify/max_user_instances)"
	@echo "Persistent across reboots."

dev-backend:
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# --- Install ---

install: install-plugins install-backend install-frontend install-e2e ## Install all dependencies

install-backend:
	cd backend && poetry install

install-frontend:
	cd frontend && npm install

install-e2e:
	cd e2e && npm install && npx playwright install chromium

install-plugins:
	@for dir in plugins/myapp-plugin-*; do \
		if [ -f "$$dir/pyproject.toml" ]; then \
			echo "Installing $$dir..."; \
			cd "$$dir" && poetry install && cd ../..; \
		fi; \
	done

# --- Test ---

test: test-backend test-frontend ## Run ALL tests, no coverage (everyday use; coverage runs in CI - see test-coverage)
	@echo ""
	@echo "=== All tests complete ==="

test-frontend: ## Run frontend unit tests (Vitest)
	@echo ""
	@echo "=== Frontend Tests ==="
	cd frontend && npx vitest run

test-backend: ## Run backend tests
	@echo ""
	@echo "=== Backend Tests ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run pytest tests/ -v

# Plugin test targets: skeleton ships zero plugins. When you add a
# plugin under plugins/myapp-plugin-<name>/, follow the
# pattern below and wire it into `test-plugins`.
#
# test-plugins: test-plugin-<name>  ## Run all plugin tests
#
# test-plugin-<name>:
#	cd plugins/myapp-plugin-<name> && \
#		poetry env use python3.12 -q 2>/dev/null; \
#		poetry run pytest tests/ -v

# --- Fast gates + Test Impact Analysis (docs/patterns/08-test-impact-analysis.md) ---

test-fast: ## Fast PR-mirror gate: backend ruff+mypy+pytest, frontend tsc+vitest (no coverage, no plugins)
	@echo ""
	@echo "=== test-fast: backend ruff check app/ ==="
	cd backend && poetry run ruff check app/
	@echo ""
	@echo "=== test-fast: backend mypy app/ ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run mypy app/
	@echo ""
	@echo "=== test-fast: backend pytest tests/ ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run pytest tests/ -q
	@echo ""
	@echo "=== test-fast: frontend tsc --noEmit ==="
	cd frontend && npx tsc --noEmit
	@echo ""
	@echo "=== test-fast: frontend vitest run ==="
	cd frontend && npx vitest run
	@echo ""
	@echo "test-fast mirrors the PR gate. Full suite incl. plugins: 'make test'."

test-changed: ## Test Impact Analysis: only tests affected vs $(TIA_BASE) (vitest --changed + pytest --testmon)
	@echo ""
	@echo "=== test-changed: frontend Vitest --changed $(TIA_BASE) ==="
	cd frontend && npx vitest run --changed $(TIA_BASE) --passWithNoTests
	@echo ""
	@echo "=== test-changed: backend pytest --testmon (vs .testmondata) ==="
	cd backend && poetry run pip install -q pytest-testmon
	cd backend && { poetry env use python3.12 -q 2>/dev/null; poetry run pytest tests/ --testmon -q; code=$$?; [ $$code -eq 5 ] && exit 0; exit $$code; }
	@echo ""
	@echo "test-changed runs only impacted tests. Full run: 'make test' (nightly/CI run the full suite)."

# Base ref for Test Impact Analysis. Under gitflow set TIA_BASE=origin/develop.
TIA_BASE ?= origin/main

# --- Coverage (heavy, opt-in; CI runs this on every push - see .github/workflows/coverage.yml) ---

test-coverage: test-coverage-backend test-coverage-frontend ## Run ALL tests with coverage (slow; prefer CI)
	@echo ""
	@echo "=== All coverage runs complete ==="

test-coverage-backend: ## Backend coverage report (htmlcov/)
	@echo ""
	@echo "=== Backend Coverage ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run pytest tests/ --cov=app --cov-report=html --cov-report=term

test-coverage-frontend: ## Frontend coverage report (coverage/)
	@echo ""
	@echo "=== Frontend Coverage ==="
	cd frontend && npm run test:coverage

# Plugin coverage: same pattern as test-plugin-<name>. Wire each
# plugin's `--cov=<package>` into test-coverage-plugin-<name> and
# add it to test-coverage-plugins.

# --- Mutation Testing ---

mutmut-backend: ## Run mutation testing on backend
	@echo ""
	@echo "=== Mutation Testing: Backend ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run mutmut run

mutmut-results: ## Show mutation testing results
	@echo "=== Backend ===" && cd backend && poetry run mutmut results 2>/dev/null || true

# --- ROADMAP archival ---

archive-task: ## Move completed [x] tasks out of ROADMAP/backlog into docs/roadmap-archive/YYYY-MM.md (interactive)
	@python3 scripts/archive_completed_task.py

archive-task-dry: ## Same as archive-task but writes nothing (preview)
	@python3 scripts/archive_completed_task.py --dry-run

# --- Git Hooks ---

install-hooks: ## Install scripts/git-hooks/* into .git/hooks (per-checkout, not committed under .git)
	@mkdir -p .git/hooks
	@for hook in scripts/git-hooks/*; do \
		name=$$(basename $$hook); \
		ln -sf ../../$$hook .git/hooks/$$name; \
		echo "linked .git/hooks/$$name -> $$hook"; \
	done
	@echo "Hooks installed. They run on every git push; tag pushes trigger pre-commit on all backend files."

# --- Type Checking ---

check-types: check-types-backend check-types-frontend ## Run all type checks

check-types-backend: ## Run mypy on backend
	@echo ""
	@echo "=== mypy Backend ==="
	cd backend && poetry env use python3.12 -q 2>/dev/null; poetry run mypy app/

check-types-frontend: ## Run tsc --noEmit on frontend
	@echo ""
	@echo "=== TypeScript Frontend ==="
	cd frontend && npx tsc --noEmit

lint: ## Run ESLint on the frontend (errors block; warnings are informational)
	@echo ""
	@echo "=== ESLint Frontend ==="
	cd frontend && npm run lint

lint-fix: ## ESLint --fix on the frontend
	cd frontend && npm run lint:fix

# --- Cohesion + complexity gates (docs/patterns/07-complexity-cohesion-ratchet.md) ---

check-file-sizes: ## Cohesion watcher: warn >500, error >1000 lines (shrink-only .filesize-baseline)
	@bash scripts/check-file-sizes.sh

check-complexity: ## Complexity watcher (warn-only): radon (Python) + eslint complexity (TS)
	@bash scripts/check-complexity.sh

check-complexity-gate: ## Complexity ratchet gate: fail on new/regressed offenders vs .complexity-baseline
	@bash scripts/check-complexity.sh --gate

check-complexity-gate-update: ## Regenerate .complexity-baseline from current offenders (ratchet may only shrink)
	@bash scripts/check-complexity.sh --update-baseline

# --- E2E Tests ---

test-e2e: ## Run Playwright e2e tests (starts servers automatically)
	cd e2e && npx playwright test

test-e2e-ui: ## Run e2e tests with Playwright UI
	cd e2e && npx playwright test --ui

# --- Version sync ---

sync-versions: ## Propagate backend/pyproject.toml version to all subsystems
	@python3 scripts/sync_versions.py

sync-versions-dry: ## Show what sync-versions would change without writing
	@python3 scripts/sync_versions.py --dry-run

sync-versions-check: ## Exit non-zero if any subsystem version drifts from canonical
	@python3 scripts/sync_versions.py --check

# --- Release (gitflow; docs/patterns/03-release-automation.md) ---
# These assume a gitflow layout: `develop` is the active branch, `main`
# holds releases only. Create a `develop` branch before first use. The
# full pre-tag gate lives in .claude/rules/release-workflow.md.

release-prepare: ## Gitflow: cut release/$(VERSION) from develop. Usage: make release-prepare VERSION=X.Y.Z
ifndef VERSION
	$(error VERSION is required, e.g. make release-prepare VERSION=1.2.3)
endif
	@echo "=== Checkout develop + create release/$(VERSION) ==="
	git checkout develop
	git pull origin develop
	git checkout -b release/$(VERSION)
	@echo ""
	@echo "On release/$(VERSION). Now: bump backend/pyproject.toml, make sync-versions,"
	@echo "draft changelog/releases/v$(VERSION).md, run the release gate, commit."
	@echo "Then: make release-finish VERSION=$(VERSION)"

release-finish: ## Gitflow: merge release/$(VERSION) to main (tag) + back to develop. Usage: make release-finish VERSION=X.Y.Z
ifndef VERSION
	$(error VERSION is required, e.g. make release-finish VERSION=1.2.3)
endif
	@echo "=== Pre-tag verification (verify_version_pins.sh) ==="
	@bash scripts/verify_version_pins.sh $(VERSION)
	@echo "=== Merge release/$(VERSION) into main (no-ff) + tag ==="
	git checkout main
	git pull origin main
	git merge --no-ff release/$(VERSION) -m "Release v$(VERSION)"
	git tag -a v$(VERSION) -m "Release v$(VERSION)"
	git push origin main --tags
	@echo "=== Merge release/$(VERSION) back into develop (no-ff) ==="
	git checkout develop
	git pull origin develop
	git merge --no-ff release/$(VERSION) -m "Merge release/$(VERSION) back into develop"
	git push origin develop
	@echo "=== Delete release/$(VERSION) ==="
	git branch -d release/$(VERSION)
	git push origin --delete release/$(VERSION)
	@echo ""
	@echo "Tagged + merged. Next: make release-publish VERSION=$(VERSION)"

release-publish: ## Create GitHub Release from changelog/releases/vX.Y.Z.md. Usage: make release-publish VERSION=X.Y.Z
ifndef VERSION
	$(error VERSION is required, e.g. make release-publish VERSION=1.2.3)
endif
	@if [ ! -f "changelog/releases/v$(VERSION).md" ]; then \
		echo "ERROR: changelog/releases/v$(VERSION).md missing."; \
		echo "Draft the per-release notes file first (release-workflow.md Step 3)."; \
		exit 1; \
	fi
	@echo "=== Creating GitHub Release v$(VERSION) ==="
	gh release create v$(VERSION) \
		--title "myapp v$(VERSION)" \
		--notes-file changelog/releases/v$(VERSION).md

# --- Security scanning (docs/patterns/10-security-scanning.md) ---
# Warn-only sweep mirrors the nightly scan; check-security is the narrow
# blocking gate. Ignore-lists start EMPTY - populate with YOUR reviewed
# and accepted findings, never another app's accepted-CVE list.

audit-backend: ## pip-audit the backend venv (incl. plugin path-deps); warn-only
	@echo "=== pip-audit (backend venv, incl. plugin path-deps) ==="
	@cd backend && poetry run pip-audit --skip-editable --progress-spinner=off || true

audit-frontend: ## npm audit the frontend lockfile; warn-only
	@echo "=== npm audit (frontend) ==="
	@cd frontend && npm audit --package-lock-only || true

bandit-backend: ## bandit SAST over app + plugins + scripts (MEDIUM+ severity & confidence); warn-only
	@echo "=== bandit (app + plugins + scripts; MEDIUM+ severity & confidence) ==="
	@cd backend && poetry run python -m pip install -q bandit >/dev/null 2>&1 || \
		echo "WARN: could not install bandit (offline?); skipping the bandit run."
	@cd backend && poetry run bandit -r app ../plugins ../scripts -ll -ii \
		-x '*/tests/*,*/test_*.py' || true

security-backend: audit-backend bandit-backend ## Backend security sweep (warn-only, mirrors the nightly scan)

check-security: ## Blocking dependency gate: pip-audit + npm audit fail on HIGH/CRITICAL (pre-PR check)
	@echo "=== check-security: pip-audit (backend, fails on any known vuln) ==="
	@cd backend && poetry run pip-audit --skip-editable --progress-spinner=off
	@echo "=== check-security: npm audit --audit-level=high (frontend) ==="
	@cd frontend && npm audit --package-lock-only --audit-level=high
	@echo "check-security passed: no high/critical dependency vulnerabilities."

# --- License ---
# Licensing infrastructure lives in backend/app/licensing.py. The
# skeleton ships zero paid plugins, so the per-plugin / trial-key
# generation Makefile targets that lived here in the upstream
# project (generate-trial-key, generate-license-key, generate-
# license-key-all) were removed. Re-add them when you wire a
# paid-plugin tier.

# --- Production (Docker) ---

prod: ## Start production via Docker Compose
	docker compose -f docker-compose.prod.yml up --build -d

prod-down: ## Stop production
	docker compose -f docker-compose.prod.yml down

prod-logs: ## Show production logs
	docker compose -f docker-compose.prod.yml logs -f

# --- Plugin lockfile discipline (PLUGIN-LOCKFILE-DRIFT-01) ---
# `make test` installs plugins from the backend's combined poetry.lock
# (path-deps); CI installs each plugin from its OWN poetry.lock. The two
# paths drift independently when a shared external pin (e.g. fastapi)
# bumps in every plugin's pyproject. Catches the divergence before push.

lock-all-plugins: ## Re-lock every plugin's poetry.lock (after a shared-dep pin bump)
	@for d in plugins/myapp-plugin-*/; do \
		echo ""; echo "=== $$(basename $$d) ==="; \
		cd "$$d" && poetry lock && cd - >/dev/null; \
	done
	@echo ""
	@echo "Re-locked $$(ls -d plugins/myapp-plugin-*/ | wc -l) plugin(s)."

verify-plugin-locks: ## Detect drift between each plugin's pyproject.toml and its poetry.lock
	@drift=0; \
	for d in plugins/myapp-plugin-*/; do \
		name=$$(basename $$d); \
		out=$$(cd "$$d" && poetry install --dry-run --no-interaction --no-ansi 2>&1 | head -3); \
		if echo "$$out" | grep -q "changed significantly"; then \
			echo "DRIFT: $$name (run \`make lock-all-plugins\` or \`cd $$d && poetry lock\`)"; \
			drift=1; \
		fi; \
	done; \
	if [ $$drift -eq 1 ]; then \
		echo ""; \
		echo "ERROR: at least one plugin pyproject.toml drifts from its poetry.lock."; \
		echo "Same shape as the v0.30.0 release CI red-on-main: the backend's"; \
		echo "combined lock can be in sync while per-plugin locks lag. Run"; \
		echo "\`make lock-all-plugins\` to bring all plugin locks in sync."; \
		exit 1; \
	fi; \
	echo "OK: all plugin pyproject.toml/poetry.lock pairs in sync."

# --- Clean ---

clean: ## Remove build artifacts and caches
	rm -rf backend/__pycache__ backend/.pytest_cache backend/*.db
	rm -rf frontend/node_modules frontend/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# --- Help ---

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'
