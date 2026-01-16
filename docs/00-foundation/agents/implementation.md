# Agents Implementation Guide

**Audience:** Builders implementing features, agents, and automation workflows.

This is the authoritative, efficient playbook for building and operating features in this codebase. It encodes the architecture decisions and patterns already implemented across `docs/`, `app/`, `supabase/`, and `baml_src/`.

## Purpose
- Provide a fast, opinionated guide to add/edit features with minimal cognitive load
- Encode database, routing, auth, and AI patterns in one place
- Prevent regressions by listing common pitfalls and checklists

## Using Development Server
- Use `npm run dev` to start the development server (generally always running)
- Starts dev server with hot reloading on :4280, and mastra server on :4111
- Ensure only one dev server and mastra server running at a time
- Variables in `.env` for dev, `.env.production` for production (use dotenvx to load)
- In production use `.env.keys` to decrypt `.env.production`

## Golden Rules
- **Clarify Objective → Sketch Options → Pick the Front‑Runner.** Attach Confidence: NN%
- Prefer patterns already implemented in `app/features/*`, `app/routes.ts`, and `supabase/schemas/*`
- **Server-first mindset.** Loader/action logic runs on the server, returns serializable objects (no `json()` from RR7)
- **Keep account/project context explicit in the URL.** RLS does the heavy lifting in DB
- **Normalize data.** Use junction tables, not arrays. Avoid denormalized mirrors
- **Fail fast, log verbosely.** Add precise error messages and early returns
- **DRY.** Reuse helpers (`junction-helpers`, `junction-server`, `/api/update-field`)

## Project Structure (what goes where)
- `app/features/{entity}/` — Feature folder with `routes.ts`, `pages/*`, `components/*`, minimal co-located utils
- `app/routes.ts` — Consolidated programmatic route config
- `app/routes/*` — Cross-cutting API endpoints (e.g., `/api/update-field`)
- `app/contexts/*` — React contexts (Auth, Notifications, Current Account/Project)
- `app/lib/supabase/*` — SSR server/client Supabase clients
- `app/utils/*` — Cross-feature server utilities (e.g., `autoInsightsData.server.ts`)
- `baml_src/*` — BAML functions and tests (LLM I/O contracts)
- `supabase/schemas/*` — Declarative SQL schemas & functions (edit first, then generate migrations)
- `supabase/migrations/*` — Generated SQL migrations applied to environments
- `supabase/functions/*` — Edge functions
- `mastra/*` — Mastra agentic framework config and integration with `copilotKit`
- `docs/*` — Deep dives and how-tos (keep aligned with implemented code)

## React Router 7 + Remix Patterns
- **Loaders/actions return plain objects.** Do NOT use `json()` (deprecated)
  - Before: `return json({ data })`
  - After: `return { data }`
- Use `useLoaderData<typeof loader>()` or `useRouteLoaderData("routeId")` from `react-router-dom`
- **Feature-based routing:** Define in `app/features/{entity}/routes.ts` using `prefix()`, `index()`, `route()`; register in `app/routes.ts`
- **Protected routes** via `_ProtectedLayout.tsx` with `unstable_middleware`:
  - Access with `const ctx = context.get(userContext)` in loaders/actions
  - Get `account_id`, `claims`, and SSR `supabase` client from context
- **Avoid redundant auth calls** in loaders/actions. Use middleware context

## Authentication & Context
- **Server-side Supabase client:** `app/lib/supabase/client.server.ts`
  - `createSupabaseServerClient()`, `getAuthenticatedUser()`, `getSession()`
- **Client-side Supabase:** `app/lib/supabase/client.ts` (SSR-compatible)
- **React auth:** `AuthContext` provides `user`, `session`, `signOut()`; initialized from server loader state
- **Account context:** Prefer explicit URL scoping (e.g., `/accounts/:accountId/...`)

## Data Access & RLS

### Canonical Data Paths
1. **Themes first:** All reads/writes go through `public.themes` or the compatibility views (`insights_current`, `insights_with_priority`). Use `getInsights`, `getInsightById`, or Mastra helpers (`fetchProjectStatusContext`, `fetchThemesTool`) rather than referencing `public.insights` directly
2. **Votes & priority:**
   - Vote counts come from `votes` (or the mapped `vote_count` your loaders surface)
   - `priority` lives in `insights_with_priority` (derived from scored votes) and should *only* influence AI/LLM suggestions, not UI sorting/filtering
3. **Evidence & personas:** Link evidence → people via `evidence_people` → `people_personas`, then map into persona coverage matrices for dashboards

### RLS-First Queries
- **Do not add explicit `account_id` filters in queries.** RLS already enforces tenant scoping based on authenticated context from `userContext`
- **Keep `project_id` filters** where the feature is project-scoped (e.g., `/accounts/:accountId/projects/:projectId/...`)
- Prefer server utilities that receive `projectId` explicitly when needed. `accountId` should come from context, not query filters
- Use the universal single-field update API: `app/routes/api.update-field.tsx`
  - Submit form with: `entity`, `entityId`, `projectId?`, `fieldName`, `fieldValue`

### Context & Tooling Conventions
- Always seed `account_id`/`project_id` for Supabase calls. Layout middleware populates `currentProjectContext`, so loaders/actions can call `context.get(currentProjectContext)` and safely run `supabase` queries
- Prefer helper functions (e.g., `getInsights`, `getProjectStatusData`) so telemetry/integration counts stay centralized
- When adding new SQL logic, update `supabase-howto.md` with any non-standard manual migrations or `imperative.sql` steps before calling `supabase db diff`

## Database Design: Junction-First
- **Junction tables implemented** (see `supabase/schemas/` and migrations):
  - `insight_tags`, `interview_tags`, `opportunity_insights`, `project_people`, `persona_insights`, `people_personas`
- **Use helpers to manage relationships:**
  - `app/lib/database/junction-helpers.ts` (InsightTagsHelper, InterviewTagsHelper, OpportunityInsightsHelper, ProjectPeopleHelper, PersonaInsightsHelper)
  - `app/lib/database/junction-server.ts` (ServerJunctionManager, factory with auth context)
  - React hooks in `useJunctionTables.ts` for client UIs
- **Migration pattern:**
  1. Update declarative schema in `supabase/schemas/*.sql`
  2. Generate migration: `supabase db diff -f <filename>`
  3. Apply locally: `supabase migrations up` or `supabase db reset`
  4. Apply remotely: `supabase db push`
  5. Regenerate types: `supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts`
  6. Add integration tests for critical flows
  7. **Note:** `supabase db diff` does not handle GRANT statements - add these to a new migration file with `imperative-feature` naming matching the timestamp format

## Evidence & Insights (LLM contracts)
- **Evidence schema** (`supabase/schemas/32_evidence.sql`) uses:
  - `modality`: `qual` | `quant`
  - `support`: `supports` | `refutes` | `neutral`
  - `weight_quality`, `weight_relevance`, `independence_key`
- **BAML I/O:**
  - `ExtractEvidenceFromTranscript` emits `EvidenceUnit` with `verbatim`, `support`, `kind_tags`, optional `personas/segments/journey_stage`, `anchors[]`, `confidence`
  - Auto-Insights in `baml_src/auto_insights.baml`; data aggregation in `app/utils/autoInsightsData.server.ts`
- Token-budget conscious: aggregate upstream to ~8k tokens when needed

## Facet Catalog
- Declarative schema for facets lives in `supabase/schemas/12_core_tables.sql` and migrates via `20251002093000_people_facets.sql`
- Use `getFacetCatalog` / `persistFacetObservations` (`app/lib/database/facets.server.ts`) when ingesting interviews
- Facet management UI: `/a/:accountId/:projectId/facets` (see `app/features/facets`)
- Analysts can review candidates, auto-approve, and toggle project aliases
- Global seeds + sample facets reside in `_NORUN_seed.sql`; keep them in sync with migrations

## Edge Functions & Env
- Use `process.env.SUPABASE_FUNCTIONS_URL` for cloud functions (e.g., `cluster_insights`)
- For cloud functions, authenticate with service role where required by design
- Parse embeddings safely (JSON strings → arrays) with try/catch

## UI/Frontend Rules
- **Tailwind + shadcn/ui.** Keep CSS sorting to linter. Favor composition over overrides
- **No `json` imports** in components (deprecated pattern). Fetch via loaders; use `useLoaderData`
- **Notifications** via `NotificationContext`
- **Auth UI:** `components/auth/AuthUI.tsx`, `AuthGuard`, `UserProfile`
- Enhanced cards (e.g., personas) use real types from generated DB types; avoid magic strings
- **Local component state** can be camelCase; **DB-bound data** stays snake_case

## Testing Strategy
- **Unit tests** for pure logic. **Integration tests** for DB and schema regression detection
- **Integration harness:**
  - Dedicated config `vitest.integration.config.ts` and setup files
  - Tests cover: interview upload → people/personas linking, junction integrity, RLS, complex joins
- **Do not mock data services** (Supabase). Only mock third-party APIs

## Common Pitfalls to Avoid
- React Router 7: Do NOT use `json()`; return plain objects
- Redundant auth calls inside protected routes; use middleware context instead
- Missing `projectId` when calling DB functions that require it
- Hardcoded `accountId`/`projectId` in API routes — always derive from context/URL
- Arrays for relationships (e.g., `related_tags`) — use junction tables

## Adding a New Feature (Checklist)

### 1. Objective & API
- Define goal, data boundaries, and required entities
- Choose server contracts (loader/action payloads, BAML I/O if applicable)

### 2. Routing
- Create `app/features/{entity}/routes.ts` using `prefix()`, `index()`, `route()`
- Implement `pages/index.tsx` and optional `$id.tsx`/`new.tsx`/`edit.tsx`
- Register feature routes in `app/routes.ts` under protected layout

### 3. Data & DB
- Extend schema in `supabase/schemas/*.sql` (normalize via junctions where needed)
- Generate/apply migrations; regenerate types. Add indexes and RLS
- Implement cross-functional server utilities in `app/lib/database/*` and reuse junction helpers

### 4. Loaders/Actions
- Use middleware contexts: `userContext`, current project/account contexts
- Return plain objects. Add tight error messages. Early validation

### 5. UI
- Consume with `useLoaderData`. Keep DB fields and their component equivalents in snake_case to minimize mapping errors
- Component state can be camelCase
- Use `useRouteLoaderData("routeId")` to access loader data from nested routes
- Add optimistic updates where useful; fall back to `/api/update-field` for single-field edits

### 6. Tests & Docs
- Add integration tests for critical DB flows and relationships
- Update relevant docs in `docs/` and this file if a new pattern emerges

### 7. Review
- PR checklist below

## Editing an Existing Feature (Checklist)
- Confirm route structure aligns with feature-based routing (no legacy `_NavLayout*`)
- Ensure loaders/actions don't use `json()` and avoid redundant auth calls
- Verify account/project scoping is explicit and correct
- If touching relationships, migrate to/from junction tables with backfill/migration tests
- Update BAML I/O and tests if LLM contracts change. Keep token budget in mind

## Deployment & Rollout
1. After schema or view changes, consult `docs/deploy-howto.md` before running `supabase db push` (explains how to sequence migrations, `imperative.sql`, and type regeneration)
2. Use `pnpm typecheck` and the `mastra` workflows to validate any automations that consume `projectStatusContext` or push annotations
3. Update `_task-board.md` with the rollout status; automation updates should call out whether the UI and docs have been synced

## PR Checklist (Merge Gate)
- Loaders/actions return plain objects; no `json()`
- Uses middleware context (no extra `supabase.auth.getUser()` calls)
- Queries rely on RLS for tenant scoping (no explicit `account_id` filters). Include `project_id` filters where applicable
- Junction tables used for many-to-many; indexes and RLS present
- No hardcoded IDs. Env and URLs correctly configured
- Error handling/logging in critical paths; no silent failures
- Types regenerated and TypeScript clean
- Integration tests for risky changes pass locally
- Docs updated (`docs/*` and/or this file)

## Quick References (by file)
- **Routing:** `app/routes.ts`, `app/features/*/routes.ts`
- **Auth:** `app/contexts/AuthContext.tsx`, `app/lib/supabase/client.server.ts`
- **Update API:** `app/routes/api.update-field.tsx`
- **Junction helpers:** `app/lib/database/junction-helpers.ts`, `junction-server.ts`, `useJunctionTables.ts`
- **Evidence schema:** `supabase/schemas/32_evidence.sql`
- **Auto-Insights:** `baml_src/auto_insights.baml`, `app/utils/autoInsightsData.server.ts`
- **Edge functions:** `supabase/functions/*`, env `SUPABASE_FUNCTIONS_URL`
- **Integration tests:** `vitest.integration.config.ts`, `tests/*`

## Helpful References
- `docs/supabase-howto.md` – best practices for migrations, manual SQL, and type generation
- `docs/_information_architecture.md` – keep the evidence → themes → insights mental model when designing new agents
- `docs/deploy-howto.md` – release checklist for schema/view changes so agents know when to re-run tests/rollouts
- `docs/00-foundation/agents/mastra-project-agents.md` – how projectStatusAgent and projectSetupAgent work in practice
- `docs/architecture/agentic-system-strategy.md` – orchestration strategy and system-level decisions
- `docs/architecture/agentic-system-planning-guide.md` – production planning checklist and best practices
- `docs/00-foundation/agents/evaluation-checklist.md` – pre-ship evaluation checklist
- `docs/30-howtos/mastra-tools/tool-contracts.md` – tool contract standard

## Last Notes
- If confidence < 90% on a design choice, list 1–2 viable alternatives and the fastest spike to evaluate them
- Prefer small, explicit changes that compose with existing patterns
- Persist new architecture decisions in `docs/` and update this file

Add further conventions at the end of this document whenever a new pattern solidifies.
