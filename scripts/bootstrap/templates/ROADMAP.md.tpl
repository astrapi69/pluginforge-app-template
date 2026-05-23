# ${pascal_name} roadmap

## Done

### Phase 1 - bootstrap

- [x] Repository bootstrapped from
      [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)
- [x] Global rename: template placeholder -> ${name}, env vars `${upper_name}_*`
- [x] ${pascal_name} domain (${entity_names}) replaces the
      template's example domain
- [x] CRUD services + routers per entity
- [x] Frontend shell: types, db cache, hooks, api client, stub pages
- [x] i18n catalog placeholders in ${supported_languages_count} languages

## Next (P2 - high-value features)

- [ ] **Replace the stub pages with real UX.** Pages live under
      `frontend/src/pages/`; the api client, types, hooks and Dexie
      cache are already wired.
- [ ] **First domain plugin.** Plugin scaffold under `plugins/`;
      entry-point group `${name}.plugins`. See `plugins/README.md`.
- [ ] **i18n translation.** ${default_language} + EN are populated;
      the other catalogs ship as placeholders.

## Later (P3 - quality + reach)

- [ ] Coverage audit (`make test-coverage`).
- [ ] Smoke E2E tests (`e2e/smoke/`).
- [ ] Desktop launcher release pipeline verification.

## Out of scope

> TODO: list the explicitly deferred items so future contributors
> don't accidentally re-litigate them.
