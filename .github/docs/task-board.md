# Project Task Board

> **Source of Truth** – last updated: 2025-07-06 23:05-06:00

## ✅ Done

- Draft & save comprehensive product plan (`docs/product-plan.md`).
- Resolve initial open questions (ASR model, batching, privacy scope, persona clustering, interview scale).
- Fix README link to product plan.
- [x] **Process Data** – upload recording, batch transcribe via AssemblyAI, store transcript in db
- [x] **Supabase Project & CI** – initialise local Supabase, add Vitest + Playwright pipelines.
- [x] **Component PoC** – build Storybook for `<InsightCard>` and `<ThemeMatrix>`.

## 🎨 UX Track

- [x] Define end-to-end user flow (`user-flow.md`)
- [x] Create low-fi wireframes (`wireframes.md`)
- [x] Draft UI style & component palette (`ui-style.md`)
- [x] Implement Jett's inline edit component (`inline-edit.tsx`) resolve Markdown dependency issue.
- [ ] inline edit in other fields like interviews etc.
- [ ] How to make UX Better to get maximum WOW insights? (revise `user-flow.md`)

## 🔜 Up Next (Sprint 1 – Get Valuable Insights)

- [ ] **Enable User-Org** - needed for basic record ownership
- [ ] **Insight Card** – inline editable insight fields.
- [x] **Embeddings Pipeline** – generate embeddings for insights and themes.
- [ ] **Insight Clustering Visualization** - Cluster insights by category and JTBD to visualise themes.

## 🌓 Backlog / Later

- [ ] **Auto-Insights** - Distill insights and help make executive decisions, answering key questions like "What are the top opportunities?" and "What are the top pain points?", "What changes would benefit different personas the most?" and "What are the best revenue-generating opportunities?" and "Which personas are likely to pay for what?" and "(Given key competitive pressures) what are the most profitable opportunities?"
- User login, org membership, multi-tenant Auth and RLS
- Add Research Projects route, list, cards, CRUD. @web <https://v0.dev/chat/research-project-components-qHfJ0d4vxEP>
- Extraction Guidance: User specified constraints for auto-insights. eg. sales, marketing, product, etc. Auto-merge tags, provide as prompts to LLM in BAML extraction process.
- Persona clustering tuning: help refine personas.
- Show Realtime status on transcriptions and insights (once pipeline is in place)
- Real-time transcription upgrade path.
- [ ] **Prompt/Eval Harness** – draft LLM prompt templates, add quality-eval scripts.
- Encryption & PII-handling module.

---

Feel free to check items off or reprioritise; we’ll keep this board synced with development progress.
