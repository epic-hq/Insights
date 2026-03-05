# Survey Sections + Branching Architecture (Bead-Ready Spec)

## Outcome / JTBD
Survey owners need a predictable respondent journey:

`Shared intro -> role-specific middle -> shared close`

This reduces irrelevant questions, improves completion, and increases trust in the data.

## Scope
- Add first-class visible sections for surveys.
- Keep existing question-level branching fully backward compatible.
- Allow branch targets by section (not only question id).
- Prepare future AI semantic branching for write-ins (not implemented in this phase).

## Public Interface Changes

### Question shape
- `sectionId?: string`

### Survey shape
- `sections?: Array<{ id: string; title: string; description?: string; order: number; startQuestionId: string }>`

### Branch rule shape
- Existing: `targetQuestionId?: string`
- New: `targetSectionId?: string`

Rules:
- If `targetSectionId` exists, runtime resolves to that section's `startQuestionId`.
- If both are present, `targetSectionId` takes precedence.
- Legacy surveys with only `targetQuestionId` continue unchanged.

## Runtime Behavior
- Build an in-memory section map at load.
- On branch evaluation:
  - `end_survey` ends immediately.
  - `skip_to` resolves destination in this order:
    1. `targetSectionId -> section.startQuestionId`
    2. `targetQuestionId`
  - Invalid destination logs warning and falls through to `defaultNext`/linear.
- Support fan-in by placing route rules on the last question of each path section.
- Build a path summary (`min/max questions`, `min/max time`, per-path labels) from the first decision point.
  - Used by editor coaching banner for path-aware estimates.
  - Exposed to survey tooling (`fetch-surveys includeQuestions=true`) so surveyAgent can reason about flow.

## Editor UX
- Show section headers in question list (collapsible).
- Show route rows as:
  - `After Intro -> Path A / Path B`
- Group route rows by destination section by default.
- Keep hover highlight/arrow to destination start question.
- Path preview chip on each destination:
  - `N questions • ~M min`

## Migration + Compatibility
- No DB migration required initially (questions JSON supports additive fields).
- For existing surveys:
  - Auto-create implicit section model in UI if missing:
    - one default section containing all questions.
- Provide one-click “Create sections from current flow” helper:
  - Intro (pre-routing)
  - Path A/B by existing branch targets
  - Shared close (optional)

## Future: AI Semantic Branching for Write-ins
- Add branch operator family:
  - `semantic_match`
- Config shape:
  - `{ classifierKey: string; labels: string[]; threshold: number }`
- Flow:
  1. Classify write-in text on response save.
  2. Cache `{label, confidence}` in response metadata.
  3. Evaluate branch against cached label.
- Safety:
  - If confidence < threshold, route to safe fallback section.
  - Never hard-route on low confidence.
  - Show confidence + fallback reason in debug UI.

## Acceptance Criteria
1. Survey can model intro/path/close without duplicating shared close questions.
2. Branch targets can be section ids.
3. Existing surveys without sections run unchanged.
4. Editor displays sections, grouped routes, and path preview chips.
5. Invalid section targets fail safely and log diagnostics.
