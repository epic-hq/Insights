# Research Links — Technical Architecture

## Summary
Research Links extend the current sign-up list infrastructure into a generalized intake system. This architecture keeps the existing public slug flow and response storage, while adding configurable metadata, richer question types, optional scheduling links, and Evidence integration for downstream analysis.

## System Components
### Frontend
- **Account UI**
  - Research link list page with create/edit actions.
  - Research link editor:
    - title/description/hero
    - slug validation
    - live toggle
    - question editor (manual + paste)
    - response mode defaults (form/chat)
    - calendar link and redirect URL
  - Responses table view with export.

- **Public Research Link Page**
  - Landing hero + email capture.
  - Progressive question flow (one per step).
  - Optional chat mode selector.
  - Optional calendar CTA.

### Backend (Routes/APIs)
- **Research Link CRUD APIs**
  - Create/update links and questions.
  - Slug uniqueness validation.
- **Public Start/Save APIs**
  - Create or resume a response session (by email + link ID).
  - Save incremental answers with upsert.
- **CSV Export API**
  - Return flattened response rows for download.
 - **Evidence Integration**
  - Create/update a single evidence record per completed response (method: `survey`).
  - Store a normalized Q/A summary for facet extraction and people enrichment.

### Data Model (Supabase)
Existing tables can be reused with minor field additions, or renamed/aliased:

- **research_links** (existing `sign_up_lists`)
  - `id`, `account_id`, `slug`, `title`, `description`, `hero_html`
  - `is_live`, `redirect_url`, `calendar_url`
  - `default_response_mode` (form/chat)
  - `created_at`, `updated_at`

- **research_link_questions** (existing question store)
  - `id`, `research_link_id`, `prompt`, `required`
  - `response_type`, `options` (JSON)
  - `position`

- **research_link_responses** (existing sign-up response table)
  - `id`, `research_link_id`, `email`
  - `responses` (JSONB)
  - `response_mode` (form/chat)
  - `status` (in_progress/completed)
  - `created_at`, `updated_at`
  - `evidence_id` (FK to evidence)

## Request Flow
1. **Research link creation**
   - Account user defines title/description/questions.
   - Slug checked for uniqueness under account.
2. **Public entry**
   - Respondent opens `/research/:slug`.
   - Start endpoint initializes response row (status `in_progress`).
3. **Incremental saves**
   - Each answer triggers save endpoint to upsert JSONB `responses`.
4. **Completion**
   - Final step marks response completed.
   - Optional redirect after thank-you.
   - Evidence record created/updated with Q/A summary.

## Security / RLS
- Research links and responses are account-scoped with RLS.
- Public endpoints only accept slug-based writes and are limited to response creation for that link.
- Avoid leaking link ownership or account identifiers in public responses.

## Future Extensions
- AI interview bot for scheduled conversations.
- Branching logic / conditional questions.
- Multi-language research link variants.
