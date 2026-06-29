# myapp — integrate @astrapi69/feature-strategy

Drop-in prompt. Replace `myapp` with your app, then paste into a fresh
Claude Code session at the repo root.

---

Replace ad-hoc feature gating (per-button `if (hasApiKey)` checks,
mode-based section hiding, scattered `disabled={...}` logic) with one
central registry + strategy from `@astrapi69/feature-strategy`, so the
whole app resolves each feature to **active / disabled / hidden** from a
single reactive context.

GitHub issue FIRST ("Integrate @astrapi69/feature-strategy to replace
ad-hoc feature gating"), `Closes #NN` in the commit.

## State policy (decide this with the maintainer first)

| State | When | Tooltip / reason |
|-------|------|------------------|
| active | feature works | none |
| disabled | the user can act to enable it | e.g. "Configure an API key" |
| disabled | genuinely impossible in this deployment | e.g. "Only available in the desktop app" |
| hidden | dev-only feature flags during development | none |

Recommended product rule (from the feature-state policy in
`architecture.md`): **`hidden` is NOT used in the product UI.** Everything
the user owns is visible — either active, or disabled with a localized
reason. A disabled section keeps its header and shows a notice card; a
disabled button carries the reason as its tooltip. `hidden` is reserved
for dev flags and the registry's fail-closed handling of unknown ids.

## Critical pre-work — read the REAL API, do not copy this prompt

This prompt describes the architecture; the EXACT calls, props, types, and
constructors MUST come from the installed `.d.ts`, not from here:

```bash
npm install @astrapi69/feature-strategy @astrapi69/feature-strategy-react
cat node_modules/@astrapi69/feature-strategy/dist/index.d.ts
cat node_modules/@astrapi69/feature-strategy-react/dist/index.d.ts
```

The code snippets below are ILLUSTRATIVE. If a snippet disagrees with the
`.d.ts`, the `.d.ts` wins.

Known cornerstones of the real API (verify against the `.d.ts`):

- The provider takes a `registry` + a `context` (the strategy is set on the
  registry, not passed as a separate prop).
- `<Feature>` uses `whenDisabled` / `whenHidden` render props/slots.
- The conditional strategy takes a `Record<featureId, FeatureCondition>`,
  NOT one evaluation function over all features.
- A strategy may **abstain**: `evaluate()` returning `undefined` falls back
  to the descriptor's `defaultState`.
- Unknown feature ids resolve to `hidden` (fail closed).

## The core principle: defaultState + abstention, not a total function

Descriptors carry the normal state; the strategy holds ONLY the deviation
rules and abstains on everything else. Do NOT build a total function that
duplicates the feature list:

```ts
// WRONG: strategy as a total function, duplicating every feature id
if (featureId in ALWAYS_ACTIVE_SET) return "active";
// ...
return "active"; // fallback for unknowns
```

```ts
// RIGHT: descriptors default to active; the strategy only encodes
// the deviations and returns undefined (abstains) otherwise.
```

## Migration steps

1. Enumerate today's gated surfaces (grep for `hasApiKey`, `mode ===`,
   `disabled={`, conditional `return null` in the UI).
2. Define one `FEATURES` id map and a descriptor registry (each descriptor
   carries its `defaultState`, usually `active`).
3. Build one memoised, reactive context (e.g. `{mode, hasApiKey}`) and a
   strategy that encodes only the deviation rules from the state-policy
   table.
4. Wrap the app in the provider; replace each ad-hoc check with `<Feature
   id={FEATURES.X}>` + `whenDisabled` / `whenHidden` fallbacks.
5. Add tests for the no-key / wrong-mode surfaces so the gating cannot
   silently regress.

## Done when

- No ad-hoc per-feature gating logic remains in components.
- Flipping the context (e.g. setting an API key) updates gating reactively,
  no reload.
- Disabled features show a localized reason; nothing the user owns is
  silently hidden.
- `make test` stays green.
