# Condensed Supabase Schema

This document is intended to serve as a reference for the database schema of the Insights application. It is not intended to be a complete reference for the database schema, but rather a high-level overview of the schema, providig relevant information for LLMs to generate field and type-accurate code.

## Core Enums

- `accounts.account_role`: `"owner" | "member"`
- `accounts.invitation_type`: `"one_time" | "24_hour"`
- `accounts.subscription_status`: `"trialing" | "active" | "canceled" | "incomplete" | "incomplete_expired" | "past_due" | "unpaid"`
- `public.interview_status`: `"draft" | "scheduled" | "uploaded" | "transcribed" | "processing" | "ready" | "tagged" | "archived"`

## Accounts & Billing (schema: `accounts`)

- **accounts**:
  `id`, `name?`, `slug?`, `personal_account`(bool), `primary_owner_user_id`, `created_at?`, `created_by?`, `updated_at?`, `updated_by?`, `public_metadata?`(Json), `private_metadata?`(Json)
- **account_user**:
  `account_id` → accounts.id, `user_id`, `account_role`(enum)
- **billing_customers**:
  `id`, `account_id` → accounts.id, `email?`, `provider?`, `active?`(bool)
- **billing_subscriptions**:
  `id`, `account_id` → accounts.id, `billing_customer_id` → billing_customers.id,
  `status?`(enum), `plan_name?`, `price_id?`, `provider?`, `quantity?`(number),
  `created`, `current_period_start`, `current_period_end`,
  `trial_start?`, `trial_end?`, `cancel_at?`, `cancel_at_period_end?`(bool), `canceled_at?`, `ended_at?`, `metadata?`(Json)
- **invitations**:
  `id`, `account_id` → accounts.id, `account_name?`, `account_role`(enum), `invitation_type`(enum), `invited_by_user_id`, `token`, `created_at?`, `updated_at?`

## Projects (schema: `public`)

- **projects**:
  `id`, `account_id`, `name`, `slug?`, `description?`, `status?`, `created_at`, `updated_at`
- **project_section_kinds**:
  `id`, `Goal?` (label text)
- **project_sections**:
  `id`, `project_id` → projects.id, `kind` → project_section_kinds.id,
  `content_md`, `content_tsv?`, `meta?`(Json), `position?`(number),
  `created_at`, `created_by`, `updated_at`, `updated_by`
- **VIEW project_sections_latest** (read-only):
  `id?`, `project_id?`, `kind?`, `content_md?`, `content_tsv?`, `meta?`(Json), `position?`, `created_at?`, `updated_at?`

## People & Interviews

- **people**:
  `id`, `account_id?`, `project_id?` → projects.id,
  `name?`, `name_hash?`, `image_url?`, `description?`,
  `age?`(number), `gender?`, `income?`(number), `education?`, `occupation?`,
  `languages?`(string[]), `location?`, `preferences?`, `contact_info?`(Json),
  `segment?`, `created_at`, `updated_at`
- **project_people** (stats/rollup per project):
  `id`, `project_id` → projects.id, `person_id` → people.id,
  `role?`, `interview_count?`(number), `first_seen_at?`, `last_seen_at?`,
  `created_at?`, `created_by?`, `updated_at?`, `updated_by?`
- **interviews**:
  `id`, `account_id`, `project_id` → projects.id,
  `status`(enum), `title?`, `interview_date?`, `duration_min?`(number),
  `media_url?`, `transcript?`, `transcript_formatted?`(Json),
  `participant_pseudonym?`, `interviewer_id?`,
  `segment?`, `high_impact_themes?`(string[]),
  `observations_and_notes?`, `open_questions_and_next_steps?`,
  `created_at`, `updated_at`
- **interview_people** (join):
  `interview_id` → interviews.id, `person_id` → people.id, `project_id?` → projects.id,
  `role?`, `created_at`, `created_by?`, `updated_at`, `updated_by?`
- **interview_tags** (join):
  `id`, `account_id`, `interview_id` → interviews.id, `tag_id` → tags.id, `project_id?` → projects.id,
  `created_at?`, `created_by?`

## Insights, Tags, Reactions

- **insights**:
  `id`, `account_id`, `project_id?` → projects.id, `interview_id?` → interviews.id,
  `name`, `category`,
  `details?`, `evidence?`, `contradictions?`, `emotional_response?`,
  `jtbd?`, `motivation?`, `desired_outcome?`, `pain?`, `journey_stage?`,
  `impact?`(number), `novelty?`(number),
  `opportunity_ideas?`(string[]), `related_tags?`(string[]),
  `confidence?`, `embedding?`(string),
  `created_at`, `created_by`, `updated_at`, `updated_by?`
- **comments**:
  `id`, `insight_id` → insights.id, `account_id`, `user_id`, `content`, `created_at`, `updated_at`
- **tags**:
  `id`, `account_id`, `project_id?` → projects.id,
  `tag`, `term?`, `definition?`, `set_name?`,
  `embedding?`(string), `created_at`, `updated_at`
- **insight_tags** (join):
  `id`, `account_id`, `insight_id` → insights.id, `tag_id` → tags.id, `project_id?` → projects.id,
  `created_at?`, `created_by?`
- **votes** (generic up/down on entities):
  `id`, `account_id`, `project_id` → projects.id,
  `entity_type`, `entity_id`, `user_id`, `vote_value`(number),
  `created_at?`, `updated_at?`
- **entity_flags** (per‑user flags like hide/star):
  `id`, `account_id`, `project_id` → projects.id,
  `entity_type`, `entity_id`, `flag_type`, `flag_value?`(bool),
  `user_id`, `metadata?`(Json), `created_at?`, `updated_at?`

## Opportunities (roadmap items)

- **opportunities**:
  `id`, `account_id`, `project_id` → projects.id,
  `title`, `kanban_status?`, `owner_id?`, `related_insight_ids?`(string[]),
  `created_at`, `updated_at`
- **opportunity_insights** (join + weight):
  `id`, `opportunity_id` → opportunities.id, `insight_id` → insights.id, `project_id?` → projects.id,
  `weight?`(number), `created_at?`, `created_by?`

## Personas

- **personas**:
  `id`, `account_id`, `project_id?` → projects.id,
  `name`, `description?`, `image_url?`, `color_hex?`,
  `age?`, `gender?`, `income?`, `education?`, `occupation?`, `role?`, `segment?`, `location?`, `languages?`,
  `key_tasks?`(string[]), `primary_goal?`, `secondary_goals?`(string[]), `motivations?`(string[]),
  `frustrations?`(string[]), `values?`(string[]), `preferences?`,
  `frequency_of_use?`, `frequency_of_purchase?`, `tech_comfort_level?`, `tools_used?`(string[]),
  `quotes?`(string[]), `sources?`(string[]), `learning_style?`, `percentage?`(number),
  `created_at`, `updated_at`
- **people_personas** (assignments):
  `person_id` → people.id, `persona_id` → personas.id, `project_id?` → projects.id,
  `interview_id?` → interviews.id, `confidence_score?`(number), `source?`,
  `assigned_at?`, `created_at?`, `created_by?`
- **persona_insights** (relevance of insight to persona):
  `id`, `persona_id` → personas.id, `insight_id` → insights.id, `project_id?` → projects.id,
  `relevance_score?`(number), `created_at?`, `created_by?`
- **VIEW persona_distribution** (rollup):
  `persona_id?`, `persona_name?`, `account_id?`, `color_hex?`,
  `combined_percentage?`, `interview_percentage?`, `legacy_percentage?`,
  `interview_count?`, `legacy_interview_count?`, `total_interview_count?`,
  `total_interviews?`, `total_interviews_with_participants?`, `total_legacy_interviews?`,
  `created_at?`, `updated_at?`

## User Settings

- **account_settings**:
    `id`, `account_id?`, `app_activity`(Json), `created_at`, `created_by?`, `metadata`(Json),
    `onboarding_completed`(bool), `role?`, `title?`, `updated_at`, `updated_by?`
## User Settings (schema: `public`)

- **user_settings**:
    - `id`: uuid (PK, default: gen_random_uuid())
    - `user_id`: uuid (not null, unique, references `auth.users(id)`)
    - `first_name`: text
    - `last_name`: text
    - `company_name`: text
    - `title`: text
    - `role`: text
    - `industry`: text
    - `email`: text
    - `mobile_phone`: text
    - `image_url`: text
    - `signup_data`: jsonb (signup data from chat)
    - `trial_goals`: jsonb (success metrics)
    - `referral_source`: text (marketing attribution)
    - `metadata`: jsonb (misc)
    - `onboarding_completed`: boolean (not null, default: false)
    - `onboarding_steps`: jsonb (not null, default: '{}')
    - `theme`: text (default: 'system')
    - `language`: text (default: 'en')
    - `notification_preferences`: jsonb (not null, default: '{}')
    - `ui_preferences`: jsonb (not null, default: '{}')
    - `last_used_account_id`: uuid
    - `last_used_project_id`: uuid
    - `created_at`: timestamptz (not null, default: now())
    - `updated_at`: timestamptz (not null, default: now())

    - `id`: string (PK)
    - `account_id`: string | null
    - `app_activity`: Json
    - `created_at`: string
    - `created_by`: string | null
    - `metadata`: Json
    - `onboarding_completed`: boolean
    - `role`: string | null
    - `title`: string | null
    - `updated_at`: string
    - `updated_by`: string | null

## Annotations (AI & user)

- **annotations**:
  `id`, `account_id`, `project_id`,
  `entity_type`, `entity_id`, `annotation_type`,
  `content?`, `metadata?`(Json),
  `created_by_user_id?`, `created_by_ai?`(bool), `ai_model?`,
  `status?`, `visibility?`,
  `parent_annotation_id?` → annotations.id, `thread_root_id?` → annotations.id,
  `created_at?`, `updated_at?`

## App DB Function Calls & API Routes Reference

### Exported DB Utility Functions

The following functions are exported from feature DB modules and are available for use throughout the app:

- [`app/features/interviews/db.ts`](app/features/interviews/db.ts:1)
  - `getInterviews`
  - `getInterviewById`
  - `getInterviewParticipants`
  - `getInterviewInsights`
  - `getRelatedInterviews`
  - `createInterview`
  - `updateInterview`
  - `deleteInterview`

- [`app/features/personas/db.ts`](app/features/personas/db.ts)
  - `getPersonas`

- [`app/features/people/db.ts`](app/features/people/db.ts:1)
  - `getPeople`
  - `getPersonById`
  - `createPerson`
  - `updatePerson`
  - `deletePerson`

- [`app/features/projects/db.ts`](app/features/projects/db.ts:1)
  - `getProjects`
  - `getProjectById`
  - `createProject`
  - `updateProject`
  - `deleteProject`

- [`app/features/insights/db.ts`](app/features/insights/db.ts:1)
  - `getInsights`
  - `getInsightById`
  - `createInsight`
  - `updateInsight`
  - `deleteInsight`

- [`app/features/opportunities/db.ts`](app/features/opportunities/db.ts:1)
  - `getOpportunities`
  - `getOpportunityById`
  - `createOpportunity`
  - `updateOpportunity`
  - `deleteOpportunity`

- [`app/features/annotations/db.ts`](app/features/annotations/db.ts:1)
  - `getVoteCountsForEntities`
  - `getAnnotationsForEntity`
  - `createAnnotation`
  - `updateAnnotation`
  - `deleteAnnotation`
  - `getVoteCountsForEntity`
  - `upsertVote`
  - `removeVote`
  - `getUserFlagsForEntity`
  - `setEntityFlag`

### Database Function Calls (via Supabase)

All DB access is performed using the Supabase client, instantiated in [`app/lib/supabase/client.ts`](app/lib/supabase/client.ts:1) and [`app/lib/supabase/server.ts`](app/lib/supabase/server.ts:1). Junction table helpers are in [`app/lib/database/junction-helpers.ts`](app/lib/database/junction-helpers.ts:1).

**Tables & Operations Used:**

- `accounts`: select
- `account_user`: (see helpers)
- `annotations`: insert, delete, select, RPC: `get_user_flags`
- `comments`: (not directly, but see insights)
- `entity_flags`: delete
- `insight_tags`: select
- `insights`: insert, delete, select, count
- `interview_people`: (see helpers)
- `interviews`: insert, update, delete, select, count
- `opportunities`: insert, select
- `people`: insert, delete, select, upsert (via `people_personas`)
- `people_personas`: upsert, delete
- `personas`: insert, delete, select
- `projects`: insert, update, delete, select
- `project_sections`: insert, update, delete
- `tags`: (see helpers)
- **RPCs:** `get_account`, `get_account_by_slug`, `get_user_accounts`

**Common Patterns:**

- `.from("<table>").select(...)`
- `.from("<table>").insert(...)`
- `.from("<table>").update(...)`
- `.from("<table>").delete(...)`
- `.from("<table>").upsert(...)`
- `.rpc("<function>", { ... })`

See feature-specific DB logic in:

- [`app/features/interviews/db.ts`](app/features/interviews/db.ts:1)
- [`app/features/people/db.ts`](app/features/people/db.ts:1)
- [`app/features/projects/db.ts`](app/features/projects/db.ts:1)
- [`app/features/insights/db.ts`](app/features/insights/db.ts:1)
- [`app/features/opportunities/db.ts`](app/features/opportunities/db.ts:1)
- [`app/features/annotations/db.ts`](app/features/annotations/db.ts:1)

### API Routes

API endpoints are defined in [`app/routes.ts`](app/routes.ts:1) and sub-feature route files. Main `/api/` endpoints:

- `POST /api/upload-file` → [`app/routes/api.upload-file.tsx`](app/routes/api.upload-file.tsx:1)
- `POST /api/upload-from-url` → [`app/routes/api.upload-from-url.tsx`](app/routes/api.upload-from-url.tsx:1)
- `POST /api/update-field` → [`app/routes/api.update-field.tsx`](app/routes/api.update-field.tsx:1)
- `POST /api/generate-persona-insights` → [`app/routes/api.generate-persona-insights.tsx`](app/routes/api.generate-persona-insights.tsx:1)
- `POST /api/interview-status` → [`app/routes/api.interview-status.tsx`](app/routes/api.interview-status.tsx:1)
- `POST /api/interview-transcript` → [`app/routes/api.interview-transcript.tsx`](app/routes/api.interview-transcript.tsx:1)
- `POST /api/generate-personas` → [`app/routes/api.generate-personas.tsx`](app/routes/api.generate-personas.tsx:1)
- `POST /api/copilotkit` → [`app/features/aichat/api/copilotkit.tsx`](app/features/aichat/api/copilotkit.tsx:1)

**Other Notable Routes:**

- `/resource/locales` → [`app/routes/resource.locales.ts`](app/routes/resource.locales.ts:1)
- `/healthcheck` → [`app/routes/healthcheck.ts`](app/routes/healthcheck.ts:1)

**Note:** Additional routes are defined in feature-specific route files (see imports at the top of [`app/routes.ts`](app/routes.ts:1)).

### Additional Notes

- Junction table helpers and patterns are in [`app/lib/database/junction-helpers.ts`](app/lib/database/junction-helpers.ts:1).
- All DB types are defined in [`app/supabase/types.ts`](app/supabase/types.ts:1).
- For multi-tenancy and account/project scoping, see RPCs and filtering patterns in feature DB files.

---

### Relationship Cheatsheet

- Project → **people**, **interviews**, **insights**, **tags**, **opportunities**, **personas**, **project_sections**
- Interview ↔ People: **interview_people**
- Insight ↔ Tags: **insight_tags**
- Opportunity ↔ Insights: **opportunity_insights**
- Persona ↔ People: **people_personas**
- Persona ↔ Insights: **persona_insights**
- Generic reactions on any entity: **votes**, **entity_flags**
- Threads/notes on any entity: **annotations** (self‑referential for threads)

### Minimal Display Fields per Entity

- **projects**: `id`, `name`, `status?`, `updated_at`
- **people**: `id`, `name?`, `segment?`, `image_url?`, `updated_at`
- **interviews**: `id`, `title?`, `status`, `interview_date?`, `duration_min?`
- **insights**: `id`, `name`, `category`, `impact?`, `novelty?`, `updated_at`
- **opportunities**: `id`, `title`, `kanban_status?`, `updated_at`
- **personas**: `id`, `name`, `color_hex?`, `percentage?`, `updated_at`
- **tags**: `id`, `tag`, `set_name?`, `updated_at`
