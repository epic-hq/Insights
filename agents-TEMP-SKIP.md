# Agents Handbook (Engineering Rules of Engagement)

This is the authoritative, efficient playbook for building and operating features in this codebase. It encodes the architecture decisions and patterns already implemented across `docs/`, `app/`, `supabase/`, and `baml_src/`.


## Purpose
- Provide a fast, opinionated guide to add/edit features with minimal cognitive load.
- Encode database, routing, auth, and AI patterns in one place.
- Prevent regressions by listing common pitfalls and checklists.

## Using Development Server

- I Use `npm run dev` to start the development server, and is generally always running, so you shouldn't have to restart it unless there are package changes. It will start the development server with hot reloading on :4280, and mastra server on :4111.
- Ensure there is only one dev server and mastra server running at a time. If you get port conflicts, kill the process and try again.
- variables are in .env but for production .env.production and we use dotenvx to load the variables. in production we use .env.keys to decrypt .env.production


## Golden Rules
- Clarify Objective → Sketch Options → Pick the Front‑Runner. Attach Confidence: NN%.
- Prefer patterns already implemented in `app/features/*`, `app/routes.ts`, and `supabase/schemas/*`.
- Server-first mindset. Loader/action logic runs on the server, returns serializable objects (no `json()` from RR7).
- Keep account/project context explicit in the URL. RLS does the heavy lifting in DB.
- Normalize data. Use junction tables, not arrays. Avoid denormalized mirrors.
- Fail fast, log verbosely. Add precise error messages and early returns.
- DRY. Reuse helpers (`junction-helpers`, `junction-server`, `/api/update-field`).


## Project Structure (what goes where)
- `app/features/{entity}/` — Feature folder with `routes.ts`, `pages/*`, `components/*`, minimal co-located utils.
- `app/routes.ts` — Consolidated programmatic route config.
- `app/routes/*` — Cross-cutting API endpoints (e.g., `/api/update-field`).
- `app/contexts/*` — React contexts (Auth, Notifications, Current Account/Project).
- `app/lib/supabase/*` — SSR server/client Supabase clients.
- `app/utils/*` — Cross-feature server utilities (e.g., `autoInsightsData.server.ts`).
- `baml_src/*` — BAML functions and tests (LLM I/O contracts).
- `supabase/schemas/*` — Declarative SQL schemas & functions. We do this first, then generate migrations from here. Special imperative migrations required for GRANT Statements and any scripts that seed data.
- `supabase/migrations/*` — Generated SQL migrations applied to environments.
- `supabase/functions/*` — Edge functions.
- `mastra/*` - Mastra agentic framework config and integration with `copilotKit`.
- `docs/*` — Deep dives and how-tos. Keep aligned with implemented code.


## React Router 7 + Remix Patterns
- Loaders/actions return plain objects. Do NOT use `json()` (deprecated).
  - Before: `return json({ data })`
  - After: `return { data }`
- Use `useLoaderData<typeof loader>()` or `useRouteLoaderData("routeId")` from `react-router-dom` in components.
- Feature-based routing: define in `app/features/{entity}/routes.ts` using `prefix()`, `index()`, `route()`; register in `app/routes.ts`.
- Protected routes via `_ProtectedLayout.tsx` with `unstable_middleware`:
  - Access with `const ctx = context.get(userContext)` in loaders/actions.
  - Get `account_id`, `claims`, and SSR `supabase` client from context.
- Avoid redundant auth calls in loaders/actions. Use middleware context.


## Authentication & Context
- Server-side Supabase client: `app/lib/supabase/server.ts`.
  - `createSupabaseServerClient()`, `getAuthenticatedUser()`, `getSession()`.
- Client-side Supabase: `app/lib/supabase/client.ts` (SSR-compatible).
- React auth: `AuthContext` provides `user`, `session`, `signOut()`; initialized from server loader state.
- Account context: Prefer explicit URL scoping (e.g., `/accounts/:accountId/...`).


## Data Access & RLS
__RLS-first queries__
- Do not add explicit `account_id` filters in queries. RLS already enforces tenant scoping based on the authenticated context from `userContext`.
- Keep `project_id` filters where the feature is project-scoped (e.g., `/accounts/:accountId/projects/:projectId/...`).
- Prefer server utilities that receive `projectId` explicitly when needed. `accountId` should come from context, not query filters.
- Use the universal single-field update API: `app/routes/api.update-field.tsx`.
  - Submit form with: `entity`, `entityId`, `projectId?`, `fieldName`, `fieldValue`.


## Database Design: Junction-First
- Junction tables implemented (see `supabase/schemas/` and migrations):
  - `insight_tags`, `interview_tags`, `opportunity_insights`, `project_people`, `persona_insights`, and `people_personas`.
- Use helpers to manage relationships:
  - `app/lib/database/junction-helpers.ts` (InsightTagsHelper, InterviewTagsHelper, OpportunityInsightsHelper, ProjectPeopleHelper, PersonaInsightsHelper).
  - `app/lib/database/junction-server.ts` (ServerJunctionManager, factory with auth context).
  - React hooks in `useJunctionTables.ts` for client UIs.
- Migration pattern:
  1) Update declarative schema in `supabase/schemas/*.sql`.
  2) Generate migration and apply locally & remotely. `supabase db diff -f <filename>` will generate migrations. `subabase migrations up` will apply migrations. or `supabase db reset` to reset the database. `supabase db push` will apply migrations to the remote database.
  3) Regenerate Supabase types; fix TypeScript surfaces. `supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts`.
  4) Add integration tests for critical flows.


## Evidence & Insights (LLM contracts)
- Evidence schema (`supabase/schemas/32_evidence.sql`) uses:
  - `modality`: `qual` | `quant`
  - `support`: `supports` | `refutes` | `neutral`
  - `weight_quality`, `weight_relevance`, `independence_key`
- BAML I/O:
  - `ExtractEvidenceFromTranscript` emits `EvidenceUnit` with `verbatim`, `support`, `kind_tags`, optional `personas/segments/journey_stage`, `anchors[]`, `confidence`.
  - Auto-Insights in `baml_src/auto_insights.baml`; data aggregation in `app/utils/autoInsightsData.server.ts`.
- Token-budget conscious: aggregate upstream to ~8k tokens when needed.

## Facet Catalog
- Declarative schema for facets lives in `supabase/schemas/12_core_tables.sql` and migrates via `20251002093000_people_facets.sql`.
- Use `getFacetCatalog` / `persistFacetObservations` (`app/lib/database/facets.server.ts`) when ingesting interviews.
- Facet management UI: `/a/:accountId/:projectId/facets` (see `app/features/facets`). Analysts can review candidates, auto-approve, and toggle project aliases.
- Global seeds + sample facets reside in `_NORUN_seed.sql`; keep them in sync with migrations.


## Edge Functions & Env
- Use `process.env.SUPABASE_FUNCTIONS_URL` for cloud functions (e.g., `cluster_insights`).
- For cloud functions, authenticate with service role where required by design.
- Parse embeddings safely (JSON strings → arrays) with try/catch.


## UI/Frontend Rules
- Tailwind + shadcn/ui. Keep CSS sorting to linter. Favor composition over overrides.
- No `json` imports in components (deprecated pattern). Fetch via loaders; use `useLoaderData`.
- Notifications via `NotificationContext`.
- Auth UI: `components/auth/AuthUI.tsx`, `AuthGuard`, `UserProfile`.
- Enhanced cards (e.g., personas) use real types from generated DB types; avoid magic strings.
- Local component state can be camelCase; DB-bound data stays snake_case.


## Testing Strategy
- Unit tests for pure logic. Integration tests for DB and schema regression detection.
- Integration harness:
  - Dedicated config `vitest.integration.config.ts` and setup files.
  - Tests cover: interview upload → people/personas linking, junction integrity, RLS, complex joins.
- Do not mock data services (Supabase). Only mock third-party APIs.


## Common Pitfalls to Avoid
- React Router 7: Do NOT use `json()`; return plain objects.
- Redundant auth calls inside protected routes; use middleware context instead.
- Missing `projectId` when calling DB functions that require it.
- Hardcoded `accountId`/`projectId` in API routes — always derive from context/URL.
- Arrays for relationships (e.g., `related_tags`) — use junction tables.


## Adding a New Feature (Checklist)
1) Objective & API
- Define goal, data boundaries, and required entities.
- Choose server contracts (loader/action payloads, BAML I/O if applicable).

2) Routing
- Create `app/features/{entity}/routes.ts` using `prefix()`, `index()`, `route()`.
- Implement `pages/index.tsx` and optional `$id.tsx`/`new.tsx`/`edit.tsx`.
- Register feature routes in `app/routes.ts` under protected layout.

3) Data & DB
- Extend schema in `supabase/schemas/*.sql` (normalize via junctions where needed).
- Generate/apply migrations; regenerate types. Add indexes and RLS.
- Supabase db diff does not handle GRANT statements so you must add these to a new migration file, called imperative-feature that matches the timestamp_feature format.
- Implement cross-functional server utilities in `app/lib/database/*` and reuse junction helpers.

4) Loaders/Actions
- Use middleware contexts: `userContext`, current project/account contexts.
- Return plain objects. Add tight error messages. Early validation.

5) UI
- Consume with `useLoaderData`. Keep DB fields and their component equivalents in snake_case to minimize mapping errors, component state can be camelCase.
- Use `useRouteLoaderData("routeId")` to access loader data from nested routes.
- Add optimistic updates where useful; fall back to `/api/update-field` for single-field edits.

6) Tests & Docs
- Add integration tests for critical DB flows and relationships.
- Update relevant docs in `docs/` and this file if a new pattern emerges.

7) Review
- PR checklist below.


## Editing an Existing Feature (Checklist)
- Confirm route structure aligns with feature-based routing (no legacy `_NavLayout*`).
- Ensure loaders/actions don’t use `json()` and avoid redundant auth calls.
- Verify account/project scoping is explicit and correct.
- If touching relationships, migrate to/from junction tables with backfill/migration tests.
- Update BAML I/O and tests if LLM contracts change. Keep token budget in mind.


## PR Checklist (Merge Gate)
- Loaders/actions return plain objects; no `json()`.
- Uses middleware context (no extra `supabase.auth.getUser()` calls).
- Queries rely on RLS for tenant scoping (no explicit `account_id` filters). Include `project_id` filters where applicable.
- Junction tables used for many-to-many; indexes and RLS present.
- No hardcoded IDs. Env and URLs correctly configured.
- Error handling/logging in critical paths; no silent failures.
- Types regenerated and TypeScript clean.
- Integration tests for risky changes pass locally.
- Docs updated (`docs/*` and/or this `agents.md`).


## Quick References (by file)
- Routing: `app/routes.ts`, `app/features/*/routes.ts`
- Auth: `app/contexts/AuthContext.tsx`, `app/lib/supabase/server.ts`
- Update API: `app/routes/api.update-field.tsx`
- Junction helpers: `app/lib/database/junction-helpers.ts`, `junction-server.ts`, `useJunctionTables.ts`
- Evidence schema: `supabase/schemas/32_evidence.sql`
- Auto-Insights: `baml_src/auto_insights.baml`, `app/utils/autoInsightsData.server.ts`
- Edge functions: `supabase/functions/*`, env `SUPABASE_FUNCTIONS_URL`
- Integration tests: `vitest.integration.config.ts`, `tests/*`


## Last Notes
- If confidence < 90% on a design choice, list 1–2 viable alternatives and the fastest spike to evaluate them.
- Prefer small, explicit changes that compose with existing patterns.
- Persist new architecture decisions in `docs/` and update this file.
