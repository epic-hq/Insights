# Project Task Board

## 🔜 Doing Now (Sprint 2 - Accounts & Projects controls and routing)

- [x] **imperative migrations** Ensure DB definition statements not handled by declarative schemas are handled in separate process and file.
- [ ] Define Routing
- [ ] Add Projects route, list, cards, CRUD. @web <https://v0.dev/chat/research-project-components-qHfJ0d4vxEP>

- [ ] Get user's current account and project id from DB. Add to CurrentProjectContext. It should be the Team's default project
-

- [ ] fix login-redirect, and sign-in flow. <rickmoy@gmail.com> is broken but <rick@deeplight.digital> works hmmm. need to reset db.
- [ ] remove the db creation of response table
- [ ] Thread account_id and project_id in server side loader/actions from CurrentProjectContext to check project_id (eq('account_id', …).eq('project_id', …))
- [ ] Update all links to protectedLayout and downstream components to use CurrentProjectPath from CurrentProjectContext
- [ ] Create compound indexes (account_id, project_id, created_at) on all project-scoped tables.
- [ ] Update RLS to require account_id AND project_id.
- [ ] CRUD functions for people, projects, personas, tags, opportunities

## 🔜 Up Next (Sprint 3 – Chat Agents with Data)

- [ ] Chat Agent Workflows

## 🎨 UX Track

- [x] Define end-to-end user flow (`user-flow.md`)
- [x] Create low-fi wireframes (`wireframes.md`)
- [x] Draft UI style & component palette (`ui-style.md`)
- [x] Implement Jett's inline edit component (`inline-edit.tsx`) resolve Markdown dependency issue.
- [x] **Insight Card** – inline editable insight fields.
- [x] **Insight Clustering Visualization** - Cluster insights by category and pain points to visualise themes. [clustering-howto.md](clustering-howto.md)
- [ ] How to make UX Better to get maximum WOW insights? (revise `user-flow.md`)
- [ ] Organize insights. Group similar insights into themes. count frequences. See by personas. expand on pain points and causes.
Prioritize.
- [ ] add 'inline edit' in other records like interviews etc.

## 🌓 Backlog / Later

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

### Sprint 1 - get started with foundation

- [x] **Enable User-Org** - needed for basic record ownership
- [x] **Embeddings Pipeline** – generate embeddings for insights and themes.
- [x] **Fix remaining routes** - interview list and detail pages done. See `_NavLayout.insights/index.tsx` and `_NavLayout.interviews/$interviewId/route.tsx`.
- [x] Propagate project_id everywhere
- [x] Add project_id column for interview, people, personas, insights, tags, junction tables
