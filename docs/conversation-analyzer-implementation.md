# Conversation Analyzer Implementation Notes

The conversation analyzer delivers a lightweight “mini CRM” ingest for one-off recordings. The flow spans three layers:

1. **Storage & schema**
   - `supabase/schemas/43_conversation_analyses.sql` defines the `conversation_analyses` table with a `conversation_analysis_status` enum and RLS.
   - `supabase/types.ts` and `app/lib/conversation-analyses/schema.ts` provide typed accessors plus Zod validation for JSON payloads.
   - `app/lib/conversation-analyses/db.server.ts` exposes helpers to insert/list/update rows so Remix routes and Trigger tasks share the same contract.

2. **Processing pipeline**
   - `app/utils/storeConversationAudio.server.ts` stores uploads under `conversation-analyses/{id}` in R2.
   - `baml_src/conversation_analysis.baml` defines the `AnalyzeStandaloneConversation` function. `pnpm run baml-generate` regenerates the client bindings.
   - `app/utils/conversationAnalysis.server.ts` wraps the BAML call, normalising confidence scores and optional fields. It also exports the shared context schema for validation.
   - `src/trigger/conversation/analyzeRecording.ts` (id `conversation.analyze-recording`) orchestrates transcription (`transcribeAudioFromUrl`), runs the analyzer, and persists the result. Failures update the Supabase row to `failed` with an error message for the UI.

3. **Remix surface**
   - `app/routes/api.conversation-analyses.tsx` handles multipart uploads, stores audio, inserts the pending row, and triggers the task with optional meeting context.
   - `app/routes/api.conversation-analyses.$analysisId.tsx` returns the latest status for polling.
   - `app/routes/_protected.conversation-analyzer.tsx` renders the upload form, polls for status changes, and visualises the structured output (questions, goals, takeaways, recommendations).

### Sales workspace CTA

`app/routes/api.sales.create-workspace.tsx` creates a `projects` record with `workflow_type = 'sales'` so the redesigned home page can route AEs directly into `/sales-lenses` without touching the onboarding flow.

### Home route redesign

`app/features/home/pages/index.tsx` now:
- highlights three starting points (Discovery, Sales workspace, Conversation Analyzer),
- filters existing projects into discovery vs. sales groups, and
- pipes the sales CTA through the new API.

### Trigger registration

`app/routes.ts` adds:
- `/conversation-analyzer` for the UI,
- `/api/conversation-analyses` + detail route for polling,
- `/api/sales/create-workspace` for the sales CTA.

`supabase/migrations/20251110121500_conversation_analyzer.sql` keeps production in sync with the declarative schema updates.
