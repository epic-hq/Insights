# Research Answers Rollup Plan

## Goals
- Provide an end-to-end trace from decision questions down to individual interview answers and supporting evidence.
- Keep `project_answers` and `evidence` as the canonical store for interview sessions (no parallel tables).
- Keep decision/research question tables (`19_research_questions.sql`) as the source of truth and link answers/evidence back to them.
- Power the dashboard rollup so PMs can see answered vs. open research at a glance and drill into interviews directly.

## Schema Updates (Declarative SQL)
Edit `supabase/schemas/22_project_answers.sql` and `32_evidence.sql`; add helper views in a new `supabase/schemas/36_research_answer_rollup.sql` (to keep ordering consistent).

### `project_answers`
- `status` enum includes `planned`, `asked`, `answered`, `skipped`, `ad_hoc`.
- Columns (already merged): `order_index`, `question_category`, `estimated_time_minutes`, `asked_at`, `answered_at`, `skipped_at`, `origin`, `followup_of_answer_id`, `prompt_id`, `research_question_id`, `decision_question_id`, `detected_question_text`.
- Indexes: `(project_id, decision_question_id)`, `(project_id, research_question_id)`, `(prompt_id)`, `(origin)`, `(status)`, `(followup_of_answer_id)`, `(interview_id, order_index)`.
- Triggers handle timestamps/user tracking; clients should never send `created_at`.

### `evidence`
- Add `project_answer_id uuid references public.project_answers(id) on delete set null`.
- Index `idx_evidence_project_answer` on `(project_answer_id)`.
- Update RLS policies to include `project_answers` join in USING/with check.

### Helper Views (new file `36_research_answer_rollup.sql`)
1. `project_answer_metrics`
   - Columns: `project_id`, `project_answer_id`, `prompt_id`, `research_question_id`, `decision_question_id`, `interview_id`, `respondent_person_id`, `status`, `answered_at`, `evidence_count`, `interview_count`, `persona_count`.
   - Joins: `project_answers pa LEFT JOIN evidence e ON e.project_answer_id = pa.id LEFT JOIN people_personas pp ON pp.person_id = pa.respondent_person_id`.
2. `research_question_summary`
   - Aggregates metrics per research question (sum evidence, distinct interviews/personas, answered counts).
3. `decision_question_summary`
   - Aggregates metrics per decision question; includes goal text and related research question counts.

Grant `SELECT` on the views to `authenticated`.

## Data Flow & Population

### Interview Kickoff (Realtime + Upload flows)
1. Call `createPlannedAnswersForInterview` immediately after creating an interview record.
   - Derives question plan from the latest `project_sections(kind='questions')` meta.
   - Inserts `project_answers` rows with `status='planned'`, `origin='scripted'`, `order_index`, `question_category`, and `prompt_id`/research links when available.
   - Reused by all entry points: upload-from-file, upload-from-url, realtime kickoff, onboarding bootstrap, and transcript pipeline.

### During Interview Execution
- UI updates `project_answers` (`status`, `answered_at`, `skipped_at`, `answer_text`).
- Skipping a prompt clears any prior `answered_at` so answered state always wins.

### Evidence Processing (`processInterview.server.ts` & BAML pipeline)
1. Extract evidence, sanitize verbatim, and insert rows into `evidence`.
2. For each piece of evidence, match to an existing `project_answers` row by question plan metadata.
3. If the answer was not pre-seeded, create a new `project_answers` row with `origin='ad_hoc'` and `status='answered'` and link the evidence.
4. Update `evidence.project_answer_id` (legacy `project_answer_evidence` table remains only for backfill).

### Retro / Follow-up Assignment
- Provide admin tool (future) to attach ad-hoc answers to canonical prompts, which simply updates `prompt_id`/`research_question_id`/`decision_question_id` on the `project_answers` row.

## Server Utilities
- `app/lib/database/project-answers.server.ts` exposes `createPlannedAnswersForInterview` (used by all interview creation flows) and `getInterviewQuestions` for realtime UIs.
- `app/lib/database/research-answers.server.ts` provides:
  - `getResearchAnswerRollup(projectId)` returning snake_case objects: `decision_questions[]`, `research_questions_without_decision[]`, `orphan_answers[]`.
  - Detail helpers for decision/research/question answers.
- `processInterview.server.ts` maps evidence to answers and keeps timestamps/metadata in sync.

## API / Routing
- Add `app/routes/api.research-answers.tsx` (loader only) to serve rollup data as JSON for client-side hydration.
- Optionally reuse within Remix loaders when server-rendering `ResearchAnswers`.

## UI
### `ResearchAnswers` Component
- Lives at `app/features/research/components/ResearchAnswers.tsx`.
- Client-side fetches `/api.research-answers?projectId=...` and normalizes metrics using status filters (`answered`/`ad_hoc` vs `planned`/`asked`).
- Displays Decision → Research → Answer hierarchy with metrics badges and interview deep links.
- Evidence snippets are ordered chronologically (DB `created_at`).

### `ProjectStatusScreen`
- Renders the new card beside themes/personas.
- Uses `onMetrics` callback to surface answered/open totals in the dashboard summary (replaces legacy `statusData.questionAnswers`).

## Migration / Backfill Strategy
1. `20250922000100_backfill_research_answers.sql` normalizes legacy `project_answers` data (order, category, timestamps) and backfills `evidence.project_answer_id` from the old junction.
2. `20250922001500_extend_interview_prompts.sql` adds the missing prompt metadata fields so planners can store structured plans.
3. Future clean-up: drop `project_answer_evidence` after verifying dashboards no longer depend on it.

## Execution Phases
1. **Schema & Types**
   - Update SQL files, regenerate migrations, and run `supabase gen types`.
2. **Server updates**
   - Interview creation flows (`processInterview.server.ts`, realtime loaders) create planned `project_answers`.
   - Evidence pipeline writes `project_answer_id`.
   - Implement new rollup utilities.
3. **UI**
   - Build `ResearchAnswers` component + integrate into `ProjectStatusScreen`.
   - Wire drill-down navigation.
4. **Backfill & Cleanup**
   - Run SQL scripts to populate new columns and evidence links.
   - Update analytics code (e.g., `autoInsightsData.server.ts`, BAML research analysis) to read from structured tables.
5. **Measurement**
   - Add tests covering rollup queries and evidence linking.
   - Instrument telemetry to understand ad-hoc question volume.

## Open Questions / Follow-ups
- Migrate `InterviewQuestionsManager` and any legacy code still reading `project_sections.meta.questions` directly.
- Replace remaining `statusData.questionAnswers` consumers with the rollup to avoid conflicting summaries.
- Plan removal of `project_answer_evidence` once analytics/tests are migrated.
