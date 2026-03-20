# API Consolidation Plan

> **Status**: Draft
> **Created**: 2026-03-07
> **Scope**: Migrate ~152 ad-hoc route files from `app/routes/api.*` into feature-scoped modules under `app/features/*/api/`, then generate an OpenAPI spec from the unified surface.

---

## 1. Current State Assessment

### What exists today

| Pattern | File count | Example |
|---------|-----------|---------|
| Ad-hoc routes in `app/routes/api.*` | ~152 files | `app/routes/api.generate-themes.tsx` |
| Ad-hoc routes in `app/routes/api/` subdirectory | 9 files | `app/routes/api/generate-themes.tsx` |
| Feature-scoped API routes in `app/features/*/api/` | ~35 files across 10 features | `app/features/people/api/deduplicate.tsx` |

Only ~18% of API endpoints follow the feature-scoped pattern. The remaining 82% are registered inline in `app/routes.ts`, making it a 342-line file that mixes page routes, API routes, auth routes, webhooks, and test routes.

### Target pattern (already proven)

Each feature owns its routes in `app/features/<domain>/routes.ts`:

```typescript
// app/features/people/routes.ts
import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  ...prefix("people", [
    index("./features/people/pages/index.tsx"),
    route("api/deduplicate", "./features/people/api/deduplicate.tsx"),
    route("api/update-inline", "./features/people/api/update-inline.tsx"),
    // ...
  ]),
] satisfies RouteConfig;
```

API route files live at `app/features/<domain>/api/<action>.tsx` and export `action` or `loader` functions. No code changes are needed inside the route handler -- only the file location and the route registration move.

### What makes migration safe

1. **URL paths stay identical.** The route registration string (e.g., `"api/interviews/realtime-start"`) does not change -- only the file path in the second argument changes.
2. **No import-path coupling.** Ad-hoc route files are never imported by other files (they are leaf handlers). Moving them cannot break downstream imports.
3. **Incremental.** Each domain can be migrated in a single PR. The old route registration line is deleted from `app/routes.ts` and added to the feature's `routes.ts`.

---

## 2. Domain Module Grouping

The ~152 ad-hoc routes map to 18 domain modules. Where a feature directory already exists, routes move into it. Where no feature directory exists, a new one is created.

### Domain Map

| # | Domain Module | Feature Dir | Ad-hoc routes to absorb | Already feature-scoped | New feature dir needed? |
|---|--------------|-------------|------------------------|----------------------|------------------------|
| 1 | **interviews** | `app/features/interviews/` | 12 (realtime-start, realtime-upload, realtime-finalize, delete, status, transcript, restart, fix-stuck, reprocess, record-now, link-participant, refresh-questions) | 0 | No |
| 2 | **evidence** | `app/features/evidence/` | 4 (semantic-search, reprocess-evidence, similar-evidence-for-insight, realtime-evidence) | 1 (get-evidence) | No |
| 3 | **themes** | `app/features/insights/` | 7 (generate-themes, reanalyze-themes, enrich-themes, consolidate-themes, diagnose-themes, similar-themes, delete-empty-themes) | 3 (update-field, vote, archive) | No |
| 4 | **people** | `app/features/people/` | 6 (import-csv x2, search, merge, enrich, backfill x2, update-person-facet-summary) | 3 (deduplicate, update-inline, infer-segments) | No |
| 5 | **chat** | `app/features/project-chat/` | 8 (project-setup, project-setup/history, project-status, project-status/history, project-status/threads, project-status/history-by-thread, interview chat, copilot) | 0 | No |
| 6 | **questions** | `app/features/questions/` | 7 (generate, evaluate, coach, improve, followup, save-debug, CRUD) | 0 | No |
| 7 | **lenses** | `app/features/lenses/` | 7 (apply-lens, lens-templates, generate-sales-lens, update-lens, update-lens-analysis-field, update-lens-entity, backfill-conversation-overview-lens) | 0 | No |
| 8 | **personas** | `app/features/personas/` | 4 (generate-persona-insights, create-persona-from-icp, persona-advisor, generate-personas) | 1 (generate-personas) | No |
| 9 | **content** | `app/features/upload/` | 7 (upload-file, upload-from-url, upload-image, presigned-url, signed-url, media-url, deck-upload) | 0 | No (exists but unused) |
| 10 | **research-links** | `app/features/research-links/` | 3 (start, save, chat) | 12 | No |
| 11 | **calendar** | `app/features/calendar/` | 5 (connect, callback, save-connection, disconnect, sync) | 0 | **Yes** |
| 12 | **gmail** | `app/features/gmail/` | 3 (save-connection, disconnect, send-survey) | 0 | **Yes** |
| 13 | **desktop** | `app/features/desktop/` | 9 (health, context, recall-token, recording-status, realtime-evidence, interviews, interviews/finalize, interviews/upload-media, people/resolve) | 0 | **Yes** |
| 14 | **billing** | `app/features/billing/` | 3 (checkout, portal, polar-webhook) | 0 | No (page exists) |
| 15 | **analysis** | `app/features/analysis/` | 8 (trigger-analysis, cancel-analysis, cancel-analysis-run, analysis-retry, trigger-run-token, regenerate-ai-summary, regenerate-conversation-analysis, update-analysis-settings) | 0 | **Yes** |
| 16 | **projects** | `app/features/projects/` | 7 (create, save-goals, load-goals, project-status, analyze-project-status, analyze-research-evidence, generate-research-structure) | 0 | No |
| 17 | **opportunities** | `app/features/opportunities/` | 3 (update-opportunity, opportunity-advisor, update-next-step) | 0 | No |
| 18 | **onboarding** | `app/features/onboarding/` | 3 (onboarding-start, skip-setup, signup-next-turn) | 0 | No (exists) |

**Remaining small groups** (absorbed into existing or new features):

| Routes | Absorb into |
|--------|------------|
| `api/share/enable`, `api/share/disable`, share-invite | `app/features/sharing/` (new) |
| `api/teams/create`, test-user-groups | `app/features/teams/` |
| `api/authkit/token` | `app/features/auth/` (new) |
| `api/user-settings/onboarding`, `api/user-profile`, `api/update-ui-preference` | `app/features/users/` (exists) |
| `api/icp-criteria`, `api/score-icp-matches`, `api/generate-icp-recommendations` | `app/features/personas/` (ICP is persona-adjacent) |
| `api/notes/create`, `api/index-note` | `app/features/notes/` (new) |
| `api/recall-webhook`, `api/assemblyai-webhook`, `api/assemblyai-token`, `api/livekit-token` | `app/features/integrations/` (new) |
| `api/webhooks/polar`, `api/webhooks/brevo` | `app/features/integrations/` |
| `api/contextual-suggestions`, `api/generate-suggestions`, `api/daily-brief`, `api/auto-insights` | `app/features/analysis/` |
| `api/update-field`, `api/update-slot`, `api/update-stakeholder` | `app/features/insights/` (generic entity updates) |
| Test/dev routes | `app/features/admin/` |

---

## 3. Migration Mechanics

### Per-domain migration checklist

For each domain, a migration PR follows these exact steps:

1. **Create `app/features/<domain>/api/` directory** (if it does not exist).
2. **Move each ad-hoc file**:
   ```bash
   git mv app/routes/api.<domain>.<action>.tsx app/features/<domain>/api/<action>.tsx
   ```
3. **Update the feature's `routes.ts`** to register the API routes that were previously inline in `app/routes.ts`.
4. **Remove the corresponding lines from `app/routes.ts`**.
5. **Update internal imports** (if any file imports types or helpers from the moved file -- rare for route handlers, but verify with grep).
6. **Run the full test suite** (`pnpm test`).
7. **Smoke test** the affected API endpoints locally.

### Naming conventions for API files

| Current ad-hoc name | Target feature file |
|---------------------|-------------------|
| `api.interviews.realtime-start.tsx` | `app/features/interviews/api/realtime-start.tsx` |
| `api.evidence.semantic-search.tsx` | `app/features/evidence/api/semantic-search.tsx` |
| `api.chat.project-setup.tsx` | `app/features/project-chat/api/project-setup.tsx` |
| `api.generate-themes.tsx` | `app/features/insights/api/generate-themes.tsx` |
| `api.upload-file.tsx` | `app/features/upload/api/upload-file.tsx` |

### Route registration pattern

Before (in `app/routes.ts`):
```typescript
route("api/interviews/realtime-start", "./routes/api.interviews.realtime-start.tsx"),
```

After (in `app/features/interviews/routes.ts`):
```typescript
route("api/realtime-start", "./features/interviews/api/realtime-start.tsx"),
```

**Important**: The URL path seen by the browser does not change because feature routes are spread into the same parent layout in `app/routes.ts`. The prefix `"interviews"` is already applied by the feature's `prefix()` call, so the API sub-path only needs the part after the domain prefix. For routes that are registered outside the project prefix scope (e.g., desktop, webhooks), the full path must be preserved -- these are registered at the top level of `app/routes.ts` and need a different spread location.

### Scope-aware registration

Routes fall into four registration scopes in `app/routes.ts`:

| Scope | Parent in routes.ts | Example URL |
|-------|-------------------|-------------|
| **Project-scoped** | Inside `:projectId` layout | `/a/:accountId/:projectId/api/evidence/semantic-search` |
| **Account-scoped** | Inside `a/:accountId` layout | `/a/:accountId/api/interviews/record-now` |
| **Protected (user-scoped)** | Inside `_ProtectedLayout` | `/api/calendar/connect` |
| **Public** | Top level | `/api/desktop/health`, `/api/assemblyai-webhook` |

When moving routes to feature modules, the spread location must match the original scope. Feature `routes.ts` files that are currently spread inside `:projectId` (like `...peopleRoutes`) automatically get project scope. New feature modules for public/webhook routes must be spread at the top level.

---

## 4. Phased Implementation Plan

### Phase 0: Foundation (1 day)

**Objective**: Establish the migration pattern with documentation and tooling.

- [ ] Create a migration script (`scripts/migrate-api-route.sh`) that automates `git mv`, updates route registration, and validates no broken imports.
- [ ] Add a `MIGRATION_LOG.md` file tracking which domains have been migrated.
- [ ] Create the 6 new feature directories needed: `calendar`, `gmail`, `desktop`, `analysis`, `integrations`, `sharing`, `notes`, `auth`.
- [ ] For each new directory, create `routes.ts` and `api/` subdirectory with the proper structure.

**Rollback**: Delete the new directories and script. No production impact.

---

### Phase 1: High-confidence, self-contained domains (3-4 days)

Migrate domains that are cleanly isolated, have no cross-domain dependencies, and are already partially feature-scoped. These are low-risk migrations that establish the pattern.

**Batch 1A -- Already partially migrated (1 day)**:

| Domain | Files to move | Risk |
|--------|--------------|------|
| **people** | 6 files (import-csv, search, merge, enrich, backfill, update-person-facet-summary) | Low |
| **evidence** | 4 files (semantic-search, reprocess, similar-evidence, realtime-evidence) | Low |
| **personas** | 4 files (persona-insights, create-from-icp, advisor, icp-criteria, score-icp-matches, icp-recommendations) | Low |
| **research-links** | 3 files (start, save, chat) | Low |

**Batch 1B -- New feature dirs, simple routes (2 days)**:

| Domain | Files to move | Risk |
|--------|--------------|------|
| **calendar** | 5 files | Low -- pure integration, no cross-deps |
| **gmail** | 3 files | Low |
| **desktop** | 9 files | Low -- standalone Electron API |
| **billing** | 3 files | Low -- webhook + 2 actions |
| **sharing** | 3 files (enable, disable, invite) | Low |
| **notes** | 2 files | Low |

**Success criteria**: All migrated endpoints return identical responses. Test suite passes. `app/routes.ts` shrinks by ~42 lines.

---

### Phase 2: Core feature domains (3-4 days)

Migrate the high-traffic, high-churn domains that most benefit from colocation with their UI code.

| Domain | Files to move | Risk | Notes |
|--------|--------------|------|-------|
| **interviews** | 12 files | Medium -- many realtime paths | Verify WebSocket/realtime flows still work |
| **chat** | 8 files | Medium -- streaming responses | Test SSE/streaming in all chat endpoints |
| **questions** | 7 files | Low | Pure CRUD + AI generation |
| **lenses** | 7 files | Low | Already has page routes in feature |
| **opportunities** | 3 files | Low | |

**Success criteria**: `app/routes.ts` shrinks by another ~37 lines. All chat streaming and realtime interview flows verified.

---

### Phase 3: Analysis and AI domains (2-3 days)

Migrate the AI/analysis endpoints into the new `analysis` feature module and colocate theme operations with insights.

| Domain | Files to move | Risk | Notes |
|--------|--------------|------|-------|
| **themes** (into insights) | 7 files | Low | Themes are a sub-concept of insights |
| **analysis** | 8 files | Medium -- Trigger.dev integration | Verify background job triggers still fire |
| **projects** | 7 files | Low | |
| **onboarding** | 3 files | Low | |

**Success criteria**: `app/routes.ts` shrinks by another ~25 lines.

---

### Phase 4: Integrations and cleanup (2 days)

| Domain | Files to move | Risk | Notes |
|--------|--------------|------|-------|
| **integrations** | 5 files (assemblyai, livekit, recall, polar, brevo webhooks) | Medium -- webhook URLs are configured externally | Must coordinate with external service configs |
| **content/upload** | 7 files | Low | |
| **users** | 3 files | Low | |
| **teams** | 2 files | Low | |
| **auth** | 1 file (authkit token) | Low | |
| **admin/test** | ~6 files (test routes, backfills, migrations) | Low | |

**Webhook warning**: If any webhook URLs are hardcoded in external services (AssemblyAI, Polar, Recall), those URLs must not change. Since we only move file locations and not URL paths, this is safe, but double-check by searching for URL references in external dashboards.

**Success criteria**: `app/routes.ts` contains only layout structure, auth routes, public resource routes, and feature module spreads. No more inline `route("api/...", "./routes/api.*")` lines.

---

### Phase 5: OpenAPI spec generation (3-4 days)

**Objective**: Generate a machine-readable OpenAPI 3.1 spec from the consolidated API surface.

#### Approach: Schema-first with Zod

1. **Add `zod-openapi` package** for annotating existing Zod schemas with OpenAPI metadata.
2. **Create `app/api-schema/` directory** with per-domain schema files:
   ```
   app/api-schema/
     interviews.schema.ts    # Request/response Zod schemas with .openapi() metadata
     evidence.schema.ts
     people.schema.ts
     ...
     registry.ts             # Central OpenApiRegistry
     generate.ts             # Script to emit openapi.json
   ```
3. **For each API route**, extract or create Zod schemas for:
   - Request body (POST/PUT/PATCH)
   - Query parameters (GET)
   - Path parameters
   - Response body (success + error shapes)
4. **Generate `openapi.json`** via a build script (`pnpm run generate:openapi`).
5. **Serve the spec** at `/api/openapi.json` as a static route.

#### Why not auto-generate from route files?

React Router route files have no standard way to declare input/output types. The handlers use raw `request.json()` and `request.formData()` with ad-hoc validation. Extracting schemas automatically would be unreliable. Instead, we declare schemas alongside routes and use them both for runtime validation (via Conform/Zod) and spec generation.

#### Incremental adoption

- Start with the 10 highest-traffic endpoints.
- Add schema annotations as part of each domain migration (phases 1-4).
- The spec grows organically; it does not need to be complete on day one.

---

### Phase 6: OpenClaw skill file generation (2 days)

**Objective**: Auto-generate a skill definition file from the OpenAPI spec for ecosystem integration.

1. **Write a transformer script** (`scripts/generate-openclaw-skill.ts`) that reads `openapi.json` and emits a skill file.
2. **Map OpenAPI operations to skill actions**:
   - `operationId` becomes the skill action name
   - Request schema becomes skill input
   - Response schema becomes skill output
   - Auth requirements become skill prerequisites
3. **Publish the skill file** alongside the OpenAPI spec.

This phase depends on Phase 5 having at least 50% coverage.

---

## 5. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Webhook URL changes break external integrations** | External services (AssemblyAI, Polar, Recall) stop delivering events | URLs do NOT change in this migration (only file paths change). Verify by diffing the route registration strings before and after. Add integration tests that confirm webhook endpoints respond correctly. |
| **Realtime/streaming endpoints break during chat migration** | Chat and interview features stop working | Migrate chat endpoints with extra manual QA. Test SSE streaming, WebSocket connections, and Trigger.dev task triggers before merging. |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Route scope mismatch after move** | 401/403 errors if a route is spread at the wrong nesting level | Create a test that asserts each API route's URL matches its expected pattern. Document scope requirements in each feature's `routes.ts`. |
| **Large PR size causes review fatigue** | Reviewers miss issues in big diffs | Batch migrations by domain (max 12 files per PR). Each PR is mechanical (git mv + route re-registration) and can be reviewed quickly. |
| **OpenAPI schema drift** | Spec becomes inaccurate as handlers evolve | Add a CI check that validates runtime Zod schemas match the OpenAPI spec. Use the same Zod schemas for both validation and spec generation. |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Stale imports in moved files** | Build errors | `pnpm build` catches these immediately. All moved files use `~/` path aliases which are project-root-relative and do not change. |
| **Test file colocation** | Test files left behind in `app/routes/` | Move test files alongside their route files. Update any test path references. |

---

## 6. Post-Migration State

### `app/routes.ts` after full migration

```typescript
import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";

// Feature module imports
import analysisRoutes from "./features/analysis/routes";
import annotationsRoutes from "./features/annotations/routes";
import askRoutes from "./features/ask/routes";
import assetsRoutes from "./features/assets/routes";
import authRoutes from "./features/auth/routes";
import billingRoutes from "./features/billing/routes";
import calendarRoutes from "./features/calendar/routes";
import chatRoutes from "./features/project-chat/routes";
import contentRoutes from "./features/upload/routes";
import dashboardRoutes from "./features/dashboard/routes";
import desktopRoutes from "./features/desktop/routes";
import docsRoutes from "./features/docs/routes";
import evidenceRoutes from "./features/evidence/routes";
import facetsRoutes from "./features/facets/routes";
import gmailRoutes from "./features/gmail/routes";
import homeRoutes from "./features/home/routes";
import insightsRoutes from "./features/insights/routes";
import integrationsRoutes from "./features/integrations/routes";
import interviewsRoutes from "./features/interviews/routes";
import journeyMapRoutes from "./features/journey-map/routes";
import lensesRoutes from "./features/lenses/routes";
import marketingRoutes from "./features/marketing/routes";
import mobileRoutes from "./features/mobile/insights/routes";
import notesRoutes from "./features/notes/routes";
import onboardingRoutes from "./features/onboarding/routes";
import opportunitiesRoutes from "./features/opportunities/routes";
import organizationsRoutes from "./features/organizations/routes";
import peopleRoutes from "./features/people/routes";
import personasRoutes from "./features/personas/routes";
import prioritiesRoutes from "./features/priorities/routes";
import projectsRoutes from "./features/projects/routes";
import questionsRoutes from "./features/questions/routes";
import realtimeTranscriptionRoutes from "./features/realtime-transcription/routes";
import responsesRoutes from "./features/responses/routes";
import segmentsRoutes from "./features/segments/routes";
import sharingRoutes from "./features/sharing/routes";
import signupChatRoutes from "./features/signup-chat/routes";
import sourcesRoutes from "./features/sources/routes";
import teamsRoutes, { teamsAccountRoutes } from "./features/teams/routes";
import ttsRoutes from "./features/tts/routes";
import usersRoutes from "./features/users/routes";
import voiceRoutes from "./features/voice/routes";

const routes = [
  ...marketingRoutes,
  ...signupChatRoutes,

  // Public APIs (no auth)
  ...desktopRoutes,
  ...integrationsRoutes,  // webhooks

  layout("./routes/_ProtectedLayout.tsx", [
    ...homeRoutes,
    ...calendarRoutes,
    ...gmailRoutes,
    ...authRoutes,
    ...usersRoutes,
    ...sharingRoutes,
    ...teamsRoutes,
    ...docsRoutes,

    route("a/:accountId", "./routes/_protected/accounts.tsx", [
      ...teamsAccountRoutes,
      ...projectsRoutes,
      ...billingRoutes,

      route(":projectId", "./routes/_protected/projects.tsx", [
        ...dashboardRoutes,
        ...interviewsRoutes,
        ...insightsRoutes,
        ...evidenceRoutes,
        ...opportunitiesRoutes,
        ...organizationsRoutes,
        ...peopleRoutes,
        ...personasRoutes,
        ...segmentsRoutes,
        ...questionsRoutes,
        ...chatRoutes,
        ...facetsRoutes,
        ...lensesRoutes,
        ...prioritiesRoutes,
        ...journeyMapRoutes,
        ...assetsRoutes,
        ...sourcesRoutes,
        ...responsesRoutes,
        ...annotationsRoutes,
        ...analysisRoutes,
        ...notesRoutes,
        ...onboardingRoutes,
        ...contentRoutes,
        ...prefix("ask", askRoutes),
        ...mobileRoutes,
      ]),
    ]),
  ]),

  // Auth routes
  route("login", "./routes/login.tsx"),
  route("sign-up", "./routes/sign-up.tsx"),
  // ... (auth routes stay as-is)

  // Public resource routes
  ...ttsRoutes,
  ...voiceRoutes,
  ...realtimeTranscriptionRoutes,
  route("s/:token", "./routes/s.$token.tsx"),
  route("healthcheck", "./routes/healthcheck.ts"),
  // ...
] satisfies RouteConfig;
```

The file drops from ~342 lines to ~80 lines of pure structural layout -- no inline API route registrations.

### Directory structure after migration

```
app/features/
  analysis/
    api/
      trigger-analysis.tsx
      cancel-analysis.tsx
      analysis-retry.tsx
      ...
    routes.ts
  billing/
    api/
      checkout.tsx
      portal.tsx
    routes.ts
    pages/
      index.tsx  (already exists)
  calendar/
    api/
      connect.tsx
      callback.tsx
      save-connection.tsx
      disconnect.tsx
      sync.tsx
    routes.ts
  desktop/
    api/
      health.ts
      context.ts
      interviews.ts
      interviews-finalize.ts
      interviews-upload-media.ts
      people-resolve.ts
      recall-token.ts
      recording-status.ts
      realtime-evidence.ts
    routes.ts
  evidence/
    api/
      get-evidence.tsx       (already here)
      semantic-search.tsx
      reprocess.tsx
      similar-evidence.tsx
      realtime-evidence.tsx
    routes.ts
  gmail/
    api/
      save-connection.tsx
      disconnect.tsx
      send-survey.tsx
    routes.ts
  insights/
    api/
      update-field.tsx       (already here)
      vote.tsx               (already here)
      archive.tsx            (already here)
      generate-themes.tsx
      reanalyze-themes.tsx
      enrich-themes.tsx
      consolidate-themes.tsx
      diagnose-themes.tsx
      similar-themes.tsx
      delete-empty-themes.tsx
      auto-insights.tsx
    routes.ts
  integrations/
    api/
      assemblyai-token.tsx
      assemblyai-webhook.tsx
      livekit-token.tsx
      recall-webhook.ts
      polar-webhook.tsx
    routes.ts
  interviews/
    api/
      realtime-start.tsx
      realtime-upload.tsx
      realtime-finalize.tsx
      delete.tsx
      status.tsx
      transcript.tsx
      restart.tsx
      fix-stuck.tsx
      reprocess.tsx
      record-now.tsx
      link-participant.tsx
      refresh-questions.tsx
    routes.ts
    pages/
      ...  (already exists)
  lenses/
    api/
      apply.tsx
      templates.tsx
      generate-sales.tsx
      update.tsx
      update-field.tsx
      update-entity.tsx
      backfill-overview.tsx
    routes.ts
    pages/
      ...  (already exists)
  people/
    api/
      deduplicate.tsx        (already here)
      update-inline.tsx      (already here)
      infer-segments.tsx     (already here)
      import-csv.tsx
      search.tsx
      merge.tsx
      enrich.tsx
      update-facet-summary.tsx
      backfill.tsx
    routes.ts
  project-chat/
    api/
      project-setup.tsx
      project-setup-history.tsx
      project-status.tsx
      project-status-history.tsx
      project-status-threads.tsx
      project-status-history-by-thread.tsx
      interview-chat.tsx
      copilot.tsx
    routes.ts
  ... (similar for remaining domains)
```

---

## 7. OpenAPI Generation Strategy

### Architecture

```
app/api-schema/
  domains/
    interviews.schema.ts     # Zod schemas with .openapi() annotations
    evidence.schema.ts
    people.schema.ts
    ...
  registry.ts                # Collects all schemas into OpenApiRegistry
  generator.ts               # Reads registry, emits openapi.json
```

### Per-endpoint schema example

```typescript
// app/api-schema/domains/evidence.schema.ts
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const SemanticSearchParams = z.object({
  query: z.string().openapi({ description: "Natural language search query" }),
  projectId: z.string().uuid().openapi({ description: "Project to search within" }),
  matchThreshold: z.coerce.number().default(0.3).openapi({ description: "Minimum similarity score" }),
  matchCount: z.coerce.number().default(20).openapi({ description: "Maximum results to return" }),
}).openapi("SemanticSearchParams");

export const SemanticSearchResponse = z.object({
  evidence: z.array(z.object({
    id: z.string().uuid(),
    gist: z.string().nullable(),
    verbatim: z.string().nullable(),
    similarity: z.number(),
    // ...
  })),
  totalCount: z.number(),
  query: z.string(),
  threshold: z.number(),
}).openapi("SemanticSearchResponse");
```

### Build step

```json
// package.json
{
  "scripts": {
    "generate:openapi": "tsx app/api-schema/generator.ts > public/openapi.json"
  }
}
```

### Adoption strategy

- Phase 5 creates the infrastructure and covers 10-15 core endpoints.
- Subsequent work adds schemas as endpoints are touched for feature work.
- CI validates that every route in a migrated feature has a corresponding schema entry (warning, not blocking, initially).

---

## 8. Effort Summary

| Phase | Scope | Estimated effort | Cumulative routes migrated |
|-------|-------|-----------------|---------------------------|
| 0 - Foundation | Tooling, new dirs | 1 day | 0 |
| 1 - Self-contained domains | 42 routes, 10 domains | 3-4 days | 42 (~28%) |
| 2 - Core feature domains | 37 routes, 5 domains | 3-4 days | 79 (~52%) |
| 3 - Analysis & AI | 25 routes, 4 domains | 2-3 days | 104 (~68%) |
| 4 - Integrations & cleanup | 25 routes, 6 domains + stragglers | 2 days | ~152 (100%) |
| 5 - OpenAPI spec | Schema infra + 15 endpoints | 3-4 days | -- |
| 6 - OpenClaw skill | Transformer script | 2 days | -- |
| **Total** | | **~16-19 days** | |

---

## 9. Questions / Decisions Needed

1. **Theme routes**: Should theme API endpoints live under `app/features/insights/api/` (since themes are displayed on the Insights page) or should there be a dedicated `app/features/themes/` module? Current recommendation: keep in `insights` since the UI is there.

2. **ICP endpoints**: Should ICP-related endpoints (`score-icp-matches`, `icp-criteria`, `generate-icp-recommendations`, `create-persona-from-icp`) live under `personas` or get their own `app/features/icp/` module? Current recommendation: `personas`, since ICP is tightly coupled to persona generation.

3. **Upload/content endpoints**: The `app/features/upload/` directory exists but has no routes registered. Should all media/upload endpoints move there, or should they be split between the features that use them (e.g., interview upload stays in interviews)?

4. **Webhook URL stability**: Are any webhook URLs (`/api/assemblyai-webhook`, `/api/webhooks/polar`, `/api/recall-webhook`) configured in external service dashboards? If so, who has access to update them if needed?

5. **OpenAPI tooling choice**: `zod-openapi` vs `@asteasolutions/zod-to-openapi` -- both work with Zod. The latter has more GitHub stars and active maintenance. Need to evaluate compatibility with the project's Zod version.

6. **Test file migration**: Some routes have colocated test files (e.g., `api.chat.project-status.test.ts`, `api.upload-file.test.ts`). Should test files move with their route files into `app/features/*/api/`, or stay in a centralized test directory?
