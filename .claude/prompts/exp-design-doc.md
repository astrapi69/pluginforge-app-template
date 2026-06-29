# myapp — write an exploration / architecture-decision doc (EXP)

Drop-in prompt. Use it BEFORE building a non-trivial feature, to think on
paper first. Paste into a fresh Claude Code session at the repo root.

---

Write an exploration doc ("EXP") for `<feature>` under
`docs/explorations/EXP-NNN-<slug>.md`. Do NOT write feature code in this
pass — the deliverable is the decision document. Consult `CLAUDE.md`, the
relevant `.claude/rules/`, and `docs/patterns/` first; cite them where a
choice is constrained by an existing convention.

## Why this convention

A short design doc before a big feature catches the spec-vs-reality drift
that code reviews miss: it forces the data audit, the alternatives, and the
boundary decisions to be explicit and reviewable before anything ships. It
is also the artifact a future session reads to understand WHY the feature
is shaped the way it is.

## Structure

```markdown
# EXP-NNN: <Title>

- Status: Draft | Accepted | Superseded by EXP-MMM
- Date: YYYY-MM-DD
- Related: <issues / other EXPs / pattern docs>

## 1. Problem
What user-facing problem or capability gap does this address? One paragraph.

## 2. Goals / Non-goals
- Goals: bullet list of what success means.
- Non-goals: what this explicitly does NOT do (prevents scope creep).

## 3. Real-world data audit
Run the heuristic / inspect real inputs BEFORE designing. Report counts and
sample cases. (Many designs that look right on paper miss the cases that
matter once pointed at real data — see lessons-learned.md.)

## 4. Options considered
For each: sketch, pros, cons, and which layer it touches
(core vs plugin; backend vs frontend; both storage modes if applicable).

## 5. Decision
The chosen option and WHY. Call out the boundary calls explicitly
(what is general vs app-specific, what ships now vs later).

## 6. Data model / API impact
New models, migrations, endpoints, schema-version bumps. "None" is a valid,
valuable answer — state it.

## 7. Test plan
Reproduction + happy-path + edge + boundary (tdd.md). Which gates apply
(Dexie-mode gate, backup round-trip, visual/device check)?

## 8. Rollout / risks
Migration, feature-gating (feature-strategy), backwards compatibility,
known risks and their mitigations.

## 9. Open questions
Parked questions with the conservative assumption taken (ai-workflow.md
self-clarification rule).
```

## Rules

- Verify numeric claims by running the authoritative command this session
  (ai-workflow.md "Numeric claims verification").
- Prefer an existing library/framework/language primitive over new code
  (reusability.md hierarchy); record what you rejected and why.
- If the audit shows the premise is wrong (the feature already exists, or
  the reported problem does not reproduce), STOP and report that instead of
  writing a doc for a non-problem.

## Done when

The doc is committed under `docs/explorations/`, every section is filled
(or explicitly marked N/A with a reason), and the Decision section makes
the general-vs-app-specific boundary explicit.
