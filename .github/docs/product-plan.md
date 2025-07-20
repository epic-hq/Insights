# Interview Insights – Product Plan (v0.1)

_Last updated: 2025-07-20

---

## 1. Scope Recap and reference docs about repo `docs`

Original starter prompt: `docs/product-prompt-template.md` for detailed goal, user stories, flow, constraints, and success tests.
Database and infra details: `docs/database-plan.md`

---

## 2. Domain Primitives

| Primitive | Purpose | Pros | Cons / Trade-offs |
|-----------|---------|------|-------------------|
| **InterviewRecording** | Raw audio/video & metadata | Single source of truth; enables re-processing | Large storage; transcoding cost |
| **Transcript** | Auto-generated text (AssemblyAI) | Searchable & prompt-ready | Accuracy tied to ASR; no HITL |
| **Insight** | Atomic observations about pain, job to be done, etc. | Fine-grained; composable | Volume/noise risk |
| **Theme** | Cluster of Insights | Aids synthesis/dashboard | Algorithm & human validation needed |
| **Persona** | Aggregated traits across participants (auto clustering) | Drives product focus; reusable | Quality depends on cluster params |
| **Opportunity** | Solution hypothesis | Aligns discovery → delivery | Premature solutioning if weak evidence |
| **Tag** | concepts that can be grouped | Cross-filtering & search | Glossary governance means we will want to keep to a reasonable number of tags and probably often merge, reword them, etc. |

---

## 3. Architecture Overview

Note below is idealized architecture. Actual implementation is currently different since we are just uploading raw audio/video files to AssemblyAI and processing them there. Not yet storing in supabase or cloudflare.

```text
┌─────────┐     upload      ┌─────────────┐      webhook      ┌───────────────┐
│  UI     ├────────────────▶│  Edge Fn    ├──────────────────▶│  Supabase     │
│ (Remix) │                 │  (S3 presign│                   │  Storage +    │
└─────────┘                 └─────────────┘                   │  Postgres     │
     ▲ dashboard/query                                     ▲  └───────────────┘
     │                                                     │ triggers
     │     REST/RPC (Supabase)   ╔═ Background Workers ═╗  │
     └──────────────────────────▶║ 1. Transcribe (AssemblyAI)║──┐
                                ║ 2. Enrich LLM (OpenAI)   ║  │writes
                                ║ 3. Chunk-index (pgvector)║◀─┘
                                ╚═════════════════════════╝
```

**Front-end**: Remix + React + Tailwind + shadcn/ui.
**Storage**: Supabase (S3) for recordings; Postgres (+pgvector) for data.
**Workers**: Supabase Edge Functions for transcription batching (no real-time yet).

### Key Decisions

| Decision | Pros | Cons / Trade-offs |
|----------|------|------------------|
| Supabase | Auth, REST, realtime; easy local dev | Vendor lock-in limits |
| Remix | Nested routes fit dashboard drill-in | Steeper learning curve |
| Batch AssemblyAI | Cheaper; matches throughput (≤50 interviews) | Slower TAT vs RT |
| pgvector | Fast semantic search | Extra extension/inference cost |
| pgmq | utilize queue for batch processing | only works with hosted supabase |

---

## 4. Core Services & Components

| Function | Description | Reusable Module |
|----------|-------------|-----------------|
| `presignUpload()` | Return temp S3 URL | `upload.ts` |
| `transcribeRecording()` | Batch call AssemblyAI → Transcript | `transcriber.ts` |
| `generateInsights()` | Prompt LLM → Insight list | `insights.ts` |
| `aggregateDashboard()` | Compose SQL/vector KPIs | `dashboardQuery.ts` |
| `personaClustering()` | Auto-cluster Insights → Personas | `clustering.ts` |
| `tagGovernance()` | Glossary & merge suggestions | `tagService.ts` |

Front-end component list: `<UploadDropzone>`, `<InsightCard>`, `<ThemeMatrix>`, `<PersonaView>`, `<DashboardFilters>` (headless, Storybook-tested).

---

## 5. Data Model

Current data model is reflected in `supabase/schemas` directory.

New data structures to create
---

## 6. Open Questions (resolved)

1. **ASR Accuracy**: Use *AssemblyAI batch*; no human-in-the-loop.
2. **Processing Mode**: Batch for now; design workers abstractly for future RT.
3. **PII & Encryption**: Recordings may contain PII; no encryption/consent flow yet.
4. **Personas**: AI clustering auto-generates personas; no manual step required.
5. **Scale**: Average 10 interviews/project; upper bound 30-50 (design queries for ≤100 rows).

---

## 🎨 UX Track

[x] Define end-to-end user flow (user-flow.md)
[x] Create low-fi wireframes (wireframes.md)
[x] Draft UI style & component palette (ui-style.md)
[x] Implement Jett's inline edit component (inline-edit.tsx) resolve Markdown dependency issue.
[ ] inline edit in other fields like interviews etc.
[ ] How to make UX Better to get maximum WOW insights? (revise user-flow.md)

## Current Active Tasks

[ ] User login, logout, signup, reset password
[ ] auto create a user's org and membership on signup as User's Team
[ ] auto create a user_settings table on signup, include metadata JSONB field
[ ] ensure trigger for updating all database records with updated_at exists
[ ] Ensure RLS is working

---

## 📋 Backlog

[ ] Auto-Insights - Distill insights and help make executive decisions, answering key questions like "What are the top opportunities?" and "What are the top pain points?", "What changes would benefit different personas the most?" and "What are the best revenue-generating opportunities?" and "Which personas are likely to pay for what?" and "(Given key competitive pressures) what are the most profitable opportunities?"
[ ] Add Research Projects route, list, cards, CRUD. @web <https://v0.dev/chat/research-project-components-qHfJ0d4vxEP>
[ ] Structured Extraction Guidance: Enable user to specify constraints for the extraction process. eg for Stage, use a specific set of fields, and "Other" if none of the above match. We will let user define schemas for virtually anything, but start with a few examples like Journey Stage, Personas. And user can references these in AI prompts and controls for extracting insights. eg. sales, marketing, product, etc. Auto-merge tags, provide as prompts to LLM in BAML extraction process.
[ ] Persona clustering tuning: help refine personas.
[ ] Show Realtime status on transcriptions and insights (once pipeline is in place)
[ ] Real-time transcription upgrade path.
[ ] Prompt/Eval Harness – draft LLM prompt templates, add quality-eval scripts.
[ ] Encryption & PII-handling module for security & compliance.
