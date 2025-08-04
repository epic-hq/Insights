# Project Task Board

## 🔜 Doing Now (Sprint 2 - Accounts & Projects controls and routing)

- [ ] Ensure DB definition statements not handled by declarative schemas are handled in separate process and file.
- [ ] Thread account_id and project_id in server side loader/actions from CurrentProjectContext to check project_id (eq('account_id', …).eq('project_id', …))
- [ ] Update all links to protectedLayout and downstream components to use CurrentProjectPath from CurrentProjectContext
- [ ] Create compound indexes (account_id, project_id, created_at) on all project-scoped tables.
- [ ] Update RLS to require account_id AND project_id.
- [ ] CRUD functions for people, projects, personas, tags, opportunities

## 🔜 Up Next (Sprint 3 – Chat Agents with Data)

- [ ] CopilotKit with Mastra implementation

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

- [ ] fix login-redirect, and sign-in flow
- [ ] Intro Testing framework and coverage [howto test](testing-howto.md)
- [ ] Add Research Projects route, list, cards, CRUD. @web <https://v0.dev/chat/research-project-components-qHfJ0d4vxEP>
- [ ] **Auto-Insights** - Distill insights and help make executive decisions, answering key questions like "What are the top opportunities?" and "What are the top pain points?", "What changes would benefit different personas the most?" and "What are the best revenue-generating opportunities?" and "Which personas are likely to pay for what?" and "(Given key competitive pressures) what are the most profitable opportunities?"
- [ ] Extraction Guidance: User specified constraints for auto-insights. eg. sales, marketing, product, etc. Auto-merge tags, provide as prompts to LLM in BAML extraction process.
- [ ] Persona clustering tuning: help refine personas.
- [ ] Show Realtime status on transcriptions and insights (once pipeline is in place)
- [ ] Real-time transcription upgrade path.
- [ ] **Prompt/Eval Harness** – draft LLM prompt templates, add quality-eval scripts.
- Encryption & PII-handling module.

- [ ] Insights schema tweaks:

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
