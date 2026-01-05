# Research Links — Rollout Plan

## Phase 0: Requirements & Alignment
- Validate naming (“Research Links” vs “Sign-up Lists”) with stakeholders.
- Confirm defaults for response mode and calendar CTA placement.
- Lock down data schema changes (if any) and migration approach.

## Phase 1: Data Model + Admin UI
- Extend existing sign-up list tables (or alias to research link naming) to support:
  - `default_response_mode`
  - `calendar_url`
  - question types/options
- Update account UI:
  - creation/editing UX
  - slug validation
  - question list editor
- Add response table enhancements and CSV export wiring.

## Phase 2: Public Survey Experience
- Update public page to support:
  - form mode (default)
  - chat mode (optional)
  - calendar CTA placement
- On completion, generate an Evidence record for each response (method: `survey`).
- Ensure incremental save + completion logic remains reliable.
- Add redirect-on-complete behavior.

## Phase 3: Metrics + QA
- Track: submissions, completion rate, chat vs form usage, scheduling click-through.
- QA checklist:
  - slug uniqueness validation
  - response persistence on refresh/resume
  - CSV export correctness
  - RLS enforcement

## Phase 4: Launch
- Release behind feature flag for existing accounts.
- Announce in-product with tooltip on research link list page.
- Gather feedback and iterate on UI/UX.

## Risks & Mitigations
- **Confusion about naming**: Provide UI copy that explains “Research Links (formerly sign-up lists)”.
- **Low completion rates**: reduce question count hints, add progress indicators.
- **Data loss**: keep upsert on every answer and log errors on save.
