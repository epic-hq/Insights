# Project Task Board

## Onboarding Storyboard ✅ Minor tasks to complete and verify

- [x] **Webhook-driven transcription pipeline** - Complete event-driven processing deployed to production
- [x] **Fixed webhook processing loop** - Added idempotency check to prevent duplicate processing
- [x] **Fixed frontend status progression** - Status now progresses properly: 20% → 50% → 85% → 100%
- [x] **Admin client authentication** - Webhooks use admin credentials for system operations
- [x] **Nullable audit fields** - Made `created_by`/`updated_by` nullable for admin operations
- [x] Simplify the Processing component to show actual steps over % completion. Let user know they can leave/return.
- [ ] Transcription record doesn't have diarization
- [x] Tie in the Add Interview Button to use the pipeline. What is the new add interview buttonfor the new onboarding process. assume it will be same flow, jsut not the first interview.
- [ ] People not being generated. can be under Personas.
- [x] Merge agent-persona branch and simpleui so we have the benefit of the mastra dockerfile fixes
- [x] Get Fly.io to a clean state where releases complete
- [x] Fix OOM errors with increased memory allocation (1GB → 2GB)
- [x] Fix Mastra instrumentation.mjs missing file error

## Metro UI

- [x] New Project Status page acceptance
'/Users/richardmoy/Downloads/page.tsx' contains some suggestions on how to add insights cards into the metro-index display. but we should think holisticlaly about it.
- [ ] Figure out how to easily plug metro in as a layout option for mobile screen size.Claude has plan.
- [ ] Verify all entities created from new onboarding step with right accountId if needed.
- [ ] Verify db fns updated to just match projectId. accountId should not be used. (people, projects, interviews)
- [ ] Redesign Entity components for Metro style.


### 🛠️ Critical Conventions to Remember

**Webhook Authentication Pattern:**

- Webhooks ALWAYS use `createSupabaseAdminClient()` (no user context)
- Pass `userId` from interview record for audit fields: `created_by: metadata.userId`
- Admin client bypasses RLS - use for all system operations

**ID Usage Conventions:**

- `interview.account_id` = `user.sub` (personal ownership, auth.uid())
- `metadata.userId` = `interview.account_id` for audit fields
- `metadata.accountId` = `interview.account_id` for data scoping

**Status Progression Pipeline:**

```
uploaded (20%) → transcribed (50%) → processing (85%) → ready (100%)
```

**Database Schema Notes:**

- Audit fields (`created_by`, `updated_by`) are nullable to support admin operations
- Upload jobs have idempotency via status check: `if (uploadJob.status === 'done') return`
- Always update interview status before each major processing step

## 🔜 Up Next (Sprint 3 – Chat Agents with Data)

- [x] prototype desktop version of Simple UI for project dashboard (summary insights, suggestions, chat) [v0](https://preview-mobile-insights-app-design-kzmlp51a1bx0c0w9lgfb.vusercontent.net/) at [inapp](/aichat)
- [x] Signup chat to get user needs saved to user_settings.saved_data
- [ ] HELP: Realtime update progress of plan in chat, and tell user when done and redirect them.
- [x] Dockerfile changes for mastra version support.
- [ ] Research & Architect Chat Agent Workflows - enable front end chat to answer questions from agents and my data; eg explain the personas.
Refactor tool defs in mastra (copilotkit api actions is bulky. shoudl be tools [chat](https://chatgpt.com/c/689cba6c-9e1c-8325-8d12-8df125c7f73a)

### 🚨 CRITICAL: CopilotKit + Mastra Agent Integration Issues

**Problem:** mainAgent integration with CopilotKit has runtime context issues preventing proper data access.

**Current Status:**

- ✅ CopilotKit receives headers correctly: `accountId: 'cc766803-d98d-4aa7-9821-6c5c7d2b03e1'`
- ✅ Fixed URL-driven accountId (was using auth fallback, now prioritizes `params.accountId`)
- ✅ Agent instructions updated to prevent using project names as UUIDs
- ❌ Runtime context empty: `RuntimeContext { registry: Map(0) {} }`
- ❌ upsightTool fails: "accountId is required - must be provided either in context or runtime headers"

**Root Cause Analysis:**

1. **Header Flow Issue**: Headers reach CopilotKit API but don't propagate to Mastra agents
2. **Agent Parameter Confusion**: AI uses project description instead of UUID projectId
3. **Runtime Context**: MastraAgent.getLocalAgents() doesn't accept headers parameter
4. **CopilotRuntime**: Doesn't accept runtimeContext parameter in constructor

**What's Been Tried:**

- ✅ Fixed `_ProtectedLayout` to use `params.accountId` (URL-driven) vs `auth.accountId` (user setting)
- ✅ Added explicit UUID format instructions to agent prompts
- ❌ Attempted manual RuntimeContext injection (API doesn't support it)
- ❌ Attempted headers parameter in MastraAgent.getLocalAgents() (not supported)

**Next Steps to Try:**

1. **Investigate MastraAgent header forwarding**: Check if headers need to be passed differently to Mastra server
2. **Direct tool parameter injection**: Modify upsightTool to accept explicit accountId/projectId parameters from CopilotKit
3. **Alternative context passing**: Use CopilotKit's action handlers to pass context directly to tools
4. **Mastra server middleware**: Ensure Mastra server middleware properly receives and processes headers
5. **Check Mastra documentation**: Review latest docs for proper header/context forwarding patterns

**Error Logs:**

```log
Runtime context: RuntimeContext { registry: Map(0) {} }
Using accountId: undefined projectId: Undergraduate... userId: undefined
ERROR: accountId is required - must be provided either in context or runtime headers
```

**Success Case (manual parameters):**

```log
Using accountId: 1048cfdf-9b63-4650-a42d-7a75f10b3ca3 projectId: 849728b0-374d-468a-b529-fef02cee88ad
```

## Sprint 4 - Persona Management

- [ ] Enhanced persona schema per this chat:
- [definitions of personas, user stories etc](https://chatgpt.com/c/689ba8c0-00bc-8326-b331-efc3131aa30f)
- [new persona fields](https://chatgpt.com/c/689c3bc0-dd78-8331-aa94-8ad74916b318)

- [ ] Improve persona generation. 4o has 128k input limit. gpt-5-nano is 400k and .05c in.
- [x] Build personas from the existing interviews and insights and assign all the people to one, or Other. Flags = auto_assign_personas = true, auto_generate_new_personas = true (if false, eg later when solidified, it puts people in Other if they don't fit an existing persona)
TEST IT MORE
- [ ] Analyze Personas feature: make recommendations.
- [ ] Chat about Personas

## New Interviews

- [ ] ProjectStatus page shold tell user what changed if its added in, as an annotation.

## Sprint 5 - Insights Optimization

- [ ] Enhance Insights schema and generation.
- [ ] e.g. add emotional_intensity (1-10)
- [ ] Guide use of existing tags dynamically

## UX Sprint - Mobile Metro Design System

- [x] **Fix signup flow** - Changed redirect from `/signup_chat` to `/onboarding`
- [x] **Make metro-index default dashboard** - Mobile-first tile design now default
- [ ] **Extract MetroLayout component** - Create reusable metro layout system
- [ ] **Migrate home page to metro tiles** - Apply metro design to `/home`
- [ ] **Metro feature page templates** - Apply metro design to insights, people, personas
- [ ] **Create MetroActionBar component** - Bottom navigation for mobile
- [ ] **Metro responsive breakpoints** - Ensure desktop compatibility
- [ ] convert mobile design from [v0](https://v0.app/chat/fork-of-mobile-insights-app-design-aV5ayoVifB4) to [remix w help of gpt5]()

**Metro Design Achievements:**

- 🎯 Mobile-optimized with perfect touch targets
- ⚡ Fast tile-based navigation
- 🎨 Black + colorful aesthetic (Windows Metro inspired)
- 📱 Bottom action bars, slide-up panels
- 🔗 Real-time data integration

## Sprint 3.5 - Annotations Component

- [x] Create proper component for annotations. Stubbed out.
- [x] Add annotations to insights and pick cards, v2, quick, or mobile
- [ ] Users feature and api needed for team members to see each other, and Annothation comments to display who made them. /api/user-profile stubbed out.
- [ ] Revise DB calls and build Annotations View in DB [spec](annotations-schema-proposal.md##Enhancement:AnnotationViews)

## Sprint 4: Workflow Pipelines ✅ COMPLETED

- [x] Research and architect a pipeline queue for transcription: `docs/feature-spec-transcription-pipeline.md`
- [x] **Implement webhook-driven transcription pipeline** - Complete queue system with upload_jobs and analysis_jobs
- [x] **Convert onboarding to use pipeline** - 4-step onboarding flow with real-time progress tracking
- [x] **Fix RLS and authentication issues** - Personal interview ownership with team project access
- [x] **Real-time UI updates** - Supabase Realtime websocket integration working (401 → 101)
- [x] **AssemblyAI integration** - File upload, transcription, webhook processing
- [x] **CRITICAL: Deploy webhook to production** - Required for AssemblyAI callbacks
- [ ] Implement Generation queue (already spec'd)
- [ ] Handle longer files, use as upgrade trigger. AAI timeout handling

## 🎨 User Experience

- [ ] Deeper planning on ideal workflow. We need to get user's goals for project, and to invite people. What to show them in plain english. Upload / Record > Goal (needed for anlaysis) > alert > TLDR > What's next
- [ ] Mobile-friendly page. this will happen at events, in the field. Add 'record now' to work on phone.

## Refactor & Ops

- [ ] **Move API routes under their respective feature directories**

  **Current Structure:** All API routes in `/app/routes/api.*` (21 routes)

  **Target Structure:** Move to `/app/features/{feature}/api/{route}.tsx`

  **Route Mapping:**
  ```
  INTERVIEWS FEATURE:
  - api.interview-status.tsx → features/interviews/api/status.tsx
  - api.interview-transcript.tsx → features/interviews/api/transcript.tsx
  - api.process-interview-internal.tsx → features/interviews/api/process-internal.tsx
  - api.upload-file.tsx → features/interviews/api/upload-file.tsx
  - api.upload-from-url.tsx → features/interviews/api/upload-from-url.tsx

  INSIGHTS FEATURE:
  - api.auto-insights.tsx → features/insights/api/auto-insights.tsx
  - api.update-field.tsx → features/insights/api/update-field.tsx (generalized)

  PERSONAS FEATURE:
  - api.generate-personas.tsx → features/personas/api/generate.tsx
  - api.backfill-people.tsx → features/personas/api/backfill-people.tsx

  ONBOARDING FEATURE:
  - api.onboarding-start.tsx → features/onboarding/api/start.tsx
  - api.generate-questions.tsx → features/onboarding/api/generate-questions.tsx

  PROJECTS FEATURE:
  - api.analyze-project-status.tsx → features/projects/api/analyze-status.tsx
  - api.project-status.tsx → features/projects/api/status.tsx
  - api.trigger-analysis.tsx → features/projects/api/trigger-analysis.tsx

  AI CHAT FEATURE:
  - api.copilot.tsx → features/aichat/api/copilot.tsx (already exists)
  - api.daily-brief.tsx → features/aichat/api/daily-brief.tsx

  SHARED/SYSTEM:
  - api.assemblyai-webhook.tsx → shared/api/assemblyai-webhook.tsx (external webhook)
  - api.migrate-arrays.tsx → shared/api/migrate-arrays.tsx (one-time migration)
  ```

  **Dependencies to Update:**
  - Update 15+ import references across components
  - Update fetcher.submit() calls in components
  - Update route definitions in utils/route-definitions.ts
  - Update test files (4 test files reference API routes)
  - Update CopilotKit runtimeUrl references

  **Critical Files Using API Routes:**
  - features/interviews/pages/detail.tsx (3 references to /api/update-field)
  - features/upload/components/AddInterview.tsx (/api/upload-file)
  - features/onboarding/components/OnboardingFlow.tsx (/api/onboarding-start)
  - features/onboarding/components/QuestionsScreen.tsx (/api/generate-questions)
  - features/onboarding/components/ProjectStatusScreen.tsx (/api/analyze-project-status)
  - routes/_ProtectedLayout.tsx (/api/copilotkit)
  - components/EditableTextarea.tsx (/api/update-field)

  **Migration Steps:**
  1. Create new API route files in feature directories
  2. Update import paths in all consuming components
  3. Update route definitions and type exports
  4. Update test files and mocks
  5. Remove old API route files from /app/routes/
  6. Verify all functionality works end-to-end

  **Shared Utilities to Consider:**
  - Authentication patterns (getAuthenticatedUser, userContext)
  - BAML client imports and usage
  - Supabase client setup
  - Error handling patterns
  - Response formatting

- [ ] A better breadcrumbs, indicate current project.
- [ ] Show suggestions for next steps.
- [ ] Reduce clutter
  - [ ] dont makeadd 'inline edit' in other records like interviews etc.
  - [ ] breadcrumbs parent not clickable
  - []
- [ ] Organize insights. Group similar insights into themes. count frequences. See by personas. expand on pain points and causes.
- [ ] How to make UX Better to get maximum WOW insights? (revise `user-flow.md`)
Prioritize.
- [ ] Upgrade Projects page detail, list, cards, CRUD. @web <https://v0.dev/chat/research-project-components-qHfJ0d4vxEP>

## 🚨 Critical Next Steps

- [x] **DEPLOY TO PRODUCTION** - Pipeline webhook endpoint must be live for AssemblyAI callbacks
- [x] **Test end-to-end flow** - Verify upload → transcription → webhook → analysis → completion
- [ ] **Error handling & retry logic** - Handle failed transcriptions and network issues

## 🔄 Architecture Cleanup

- [ ] **Team collaboration access** - Allow team members to view interviews in shared projects
- [ ] **Account/User ID consistency** - Resolve remaining confusion between personal and team accounts
- [ ] **Remove account_settings table and migrate to user_settings** - Current architecture has duplicate user preferences between `account_settings.current_account_id/current_project_id` and `user_settings.last_used_account_id/last_used_project_id`. Consolidate all user preferences in user_settings for clarity and remove confusing duplication.

## 🌓 Backlog / Later

- [ ] Migrate auth and Organizations to BetterAuth, get Stripe integration working.
- [ ] Deep Linking & Next RedirectTo after login
- [ ] how to handle routes:
  - /$accountId
  - /home my accounts(pro), projects, user profile settings etc?
- [ ] cleanup current-project-context.tsx:40 error No accountId available from organizaitons context.
- [ ] Implement `parseIdFromParams` fn in app/lib/utils easy to use in loaders/actions.
- [ ] Test & verify CRUD functions for people, projects, personas, tags, opportunities
- [ ] Update RLS to require account_id AND project_id.
- [ ] Create compound indexes (account_id, project_id, created_at) on all project-scoped tables.
- [ ] Cannot delete users due to fk constraints.
- [ ] Intro Testing framework and coverage [howto test](testing-howto.md)
- [ ] **Auto-Insights** - Distill insights and help make executive decisions, answering key questions like "What are the top opportunities?" and "What are the top pain points?", "What changes would benefit different personas the most?" and "What are the best revenue-generating opportunities?" and "Which personas are likely to pay for what?" and "(Given key competitive pressures) what are the most profitable opportunities?"
- [ ] Extraction Guidance: User specified constraints for auto-insights. eg. sales, marketing, product, etc. Auto-merge tags, provide as prompts to LLM in BAML extraction process.
- [ ] Persona clustering tuning: help refine personas.
- [ ] Show Realtime status on transcriptions and insights (once pipeline is in place)
- [ ] Real-time transcription upgrade path.
- [ ] **Prompt/Eval Harness** – draft LLM prompt templates, add quality-eval scripts.
- Encryption & PII-handling module.

## Task Details

A place to refine details of what's needed, how to do it, to explore how it fits properly into rest of app.

### Define Routing

**Problem:** Routing in app is not well organized.

**Goal:** Define routing in app so that it is easy to navigate and understand and support protected route segments, and how loaders, actions, middleware and context work together for efficient data fetching and state management.

**Approach:**
See [app-flow](_stack-database-plan.md#app-flow)

**How we want routing to behave:**

Accounts & Home:
/ → marketing landing page
/auth/callback

- on success → /login_success redirects to /home (features/home/pages/index.tsx)
- on failure → show error message in login page
/home (features/home/pages/index.tsx) shows what accounts and projects the user has access to, a list of accounts, projects, suggested actions, onboarding

Accounts: (Future when we let them create & switch.)
/a/:accountId/ → /features/accounts/pages/accountDetail
/a/:accountId/edit → /features/accounts/pages/edit (not implemented) members, invites, description.
/a/new → /features/accounts/pages/new (not implemented)

Projects:
/a/:accountId/projects → /features/projects/index shows list of projects in account
/a/:accountId/projects/new → /features/projects/new page

Specific Project resources:
/a/:accountId/:projectId/ → /features/projects/pages/projectDetail
/a/:accountId/:projectId/edit → /features/projects/pages/edit
/a/:accountId/:projectId/dashboard → /features/projects/pages/projectDetail/dashboard
/a/:accountId/:projectId/interviews → /features/projects/pages/projectDetail/interviews

/a/:accountId/:projectId/insights → /features/insights/insights/index
/a/:accountId/:projectId/insights/:insightId → /features/insights/insightDetail
/a/:accountId/:projectId/insights/:insightId/edit → /features/insights/insightDetail/edit
...

**Route Links**
Implement `useRoutes` hook for link building.

### Chat Agent Workflows

**Problem:** The problem is that we want to avoid looking like a pure chatbot and also avoid looking like a fixed rigid application. So a blend between there or a hybrid so that it's easier for the user to see the information they want and ask questions with full context.

**Goal:** The goal of chat agent workflows is to allow the user to ask the system different questions and provide context to the back-end agents who can follow a workflow and have tools and access to the database to answer the user's question and update the responses so that they automatically appear in the database. The front-end user interface will be using CopilotKit and Mostra AI agents.

**Approach:** CopilotKit with Mastra implementation.
[copilotkit + mastra](https://docs.copilotkit.ai/mastra)

### Insights schema tweaks

Opinionated tweak suggestions (optional):
Type alignment: Make confidence smallint (1–3) or an enum if you want strictness; same for emotional_response.
**Rename motivation → motivation for clarity with your BAML schema.
**Add CHECK (journey_stage in (...)) if your stages are fixed.

- [ ] Enable user to re-generate insights with custom user instructions (optional) and add into a new queue called: `generate_insights_queue`. Default redoes the given interviewid from 'transcript' column. This would call BAML with the given instructions and generate new insights. we should expose this as an action API and callable from the UI or a db trigger (would want as edge function?)

- [ ] “Smart” tagging (medium effort)
Problem: users may create semantically-duplicate tags (safety, transport_safety, night_travel).

Plan:

Fetch existing tags for the account (SELECT tag FROM tags WHERE account_id = …).
Call BAML with:
system: You are TagNormalizer.  Given `candidate_tags` and `existing_tags`, return
        a mapping: {candidate_tag: canonical_tag}.
        If there is no suitable existing tag, return NEW.
This is a lightweight, single-shot mapping – no schema change.
Apply mapping
If canonical_tag === 'NEW' → insert new tag
else → reuse existing canonical_tag.
Benefits

Reuses semantically-close tags automatically
Keeps tag table clean without manual admin

## ✅ Done

- Draft & save comprehensive product plan (`docs/product-plan.md`).
- Resolve initial open questions (ASR model, batching, privacy scope, persona clustering, interview scale).
- Fix README link to product plan.
- [x] User login, org membership, multi-tenant Auth and RLS
- [x] **Process Data** – upload recording, batch transcribe via AssemblyAI, store transcript in db
- [x] **Supabase Project & CI** – initialise local Supabase, add Vitest + Playwright pipelines.
- [x] **Component PoC** – build Storybook for `<InsightCard>` and `<ThemeMatrix>`.

UX

- [x] Define end-to-end user flow (`user-flow.md`)
- [x] Create low-fi wireframes (`wireframes.md`)
- [x] Draft UI style & component palette (`ui-style.md`)
- [x] Implement Jett's inline edit component (`inline-edit.tsx`) resolve Markdown dependency issue.
- [x] **Insight Card** – inline editable insight fields.
- [x] **Insight Clustering Visualization** - Cluster insights by category and pain points to visualise themes. [clustering-howto.md](clustering-howto.md)

### Sprint 1 - get started with foundation

- [x] **Enable User-Org** - needed for basic record ownership
- [x] **Embeddings Pipeline** – generate embeddings for insights and themes.
- [x] **Fix remaining routes** - interview list and detail pages done. See `_NavLayout.insights/index.tsx` and `_NavLayout.interviews/$interviewId/route.tsx`.
- [x] Propagate project_id everywhere
- [x] Add project_id column for interview, people, personas, insights, tags, junction tables

## 🔜 Doing Now (Sprint 2 - Accounts & Projects controls and routing)

- [x] **imperative migrations** Ensure DB definition statements not handled by declarative schemas are handled in separate process and file.
- [x] Reset db.
- [x] remove the db creation of response table
- [x] fix login-redirect, and sign-in flow.
- [x] Define Routing
- [x] Get user's current account and project id from DB. Add to CurrentProjectContext. It should be the Team's default project
- [x] Implement useProjectRoutes in link building on every protected route segment. server and client.
project detail getproject by id fails
insights blank due to missing project_id for previous interviews. Test going forward.
- [x] Thread account_id and project_id in server side loader/actions from CurrentProjectContext to check project_id (eq('account_id', …).eq('project_id', …))
- [x] insightDetail - not found bc linking to project_id. needs error guard
- [x] personaDetail & edit
- [x] people
- [x] peopleDetail
- [x] persona not added to proj or not queried right after add interview
- [x] Deployed to fly.io as `upsight.fly.dev`
- [x] Update all links to protectedLayout in app/routes
- [x] interview upload should redir to interview detail page.

## Sprint 2.5 - Project Management

- [x] Project display, editing, sections
- [x] Test & confirm
- [x] Memory leak fix. Rewrote db queries to be more focused, eliminating mebeddings, big transcripts etc.
- [x] Stubbed out hooks for votes and annotations
