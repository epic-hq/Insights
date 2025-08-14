# Project Task Board

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

## 🔜 Up Next (Sprint 3 – Chat Agents with Data)

- [x] prototype desktop version of Simple UI for project dashboard (summary insights, suggestions, chat) [v0](https://preview-mobile-insights-app-design-kzmlp51a1bx0c0w9lgfb.vusercontent.net/) at [inapp](/aichat)
- [x] Signup chat to get user needs saved to user_settings.saved_data
- [x] Dockerfile changes for mastra version support.
- [ ] Research & Architect Chat Agent Workflows - enable front end chat to answer questions from agents and my data; eg explain the personas.
Refactor tool defs in mastra (copilotkit api actions is bulky. shoudl be tools [chat](https://chatgpt.com/c/689cba6c-9e1c-8325-8d12-8df125c7f73a)

## Sprint 4 - Persona Management

- [ ] Enhanced persona schema and generation per this chat:

- [definitions of personas, user stories etc](https://chatgpt.com/c/689ba8c0-00bc-8326-b331-efc3131aa30f)

- [new persona fields](https://chatgpt.com/c/689c3bc0-dd78-8331-aa94-8ad74916b318)

- [ ] Build personas from the existing interviews and insights and assign all the people to one, or Other. Flags = auto_assign_personas = true, auto_generate_new_personas = true (if false, eg later when solidified, it puts people in Other if they don't fit an existing persona)
- [ ] Analyze Personas feature: make recommendations.
- [ ] Chat about Personas

## Sprint 5 - Insights Optimization

- [ ] Enhance Insights schema and generation.
- [ ] e.g. add emotional_intensity (1-10)
- [ ] Guide use of existing tags dynamically

## UX Sprint - Mobile

- [x] convert mobile design from [v0](https://v0.app/chat/fork-of-mobile-insights-app-design-aV5ayoVifB4) to [remix w help of gpt5]()
- [x] Mobile concept stubbed out at metro
- [ ] Storyboard the rest of it and Get more buy-in

## Sprint 3.5 - Annotations Component

- [ ] Create proper component for annotations. Stubbed out.
- [ ] Add annotations to insights and pick cards, v2, quick, or mobile
- [ ] Revise DB calls and build Annotations View in DB [spec](annotations-schema-proposal.md##Enhancement:AnnotationViews)

## Sprint 4: Workflow Pipelines

- [X] Research and architect a pipeline queue for transcription: `docs/feature-spec-transcription-pipeline.md`
- [ ] Implement queues
- [ ] Convert existing 'Add Interview' process to use the queues and show Onboarding sequence cards
- [ ] Implement Generation queue (already spec'd)
- [ ] Handle longer files, use as upgrade trigger. AAI timeout handling

## 🎨 User Experience

- [ ] Deeper planning on ideal workflow. We need to get user's goals for project, and to invite people. What to show them in plain english. Upload / Record > Goal (needed for anlaysis) > alert > TLDR > What's next
- [ ] Mobile-friendly page. this will happen at events, in the field. Add 'record now' to work on phone.

- [ ] Misc:
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

## 🌓 Backlog / Later

- [ ] Migrate auth and Organizations to BetterAuth, get Stripe integration working.

Defer:

- [ ] Deep Linking & Next RedirectTo after login
- [ ] how to handle routes:
  - /$accountId
  - /home my accounts(pro), projects, user profile settings etc?
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
