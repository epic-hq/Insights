# Interview Insights – Product Plan (v0.1)

_Last updated: 2025-07-06 23:00-06:00_

---

## 1. Scope Recap
See `docs/product-prompt-template.md` for detailed goal, user stories, flow, constraints, and success tests.

---

## 2. Domain Primitives
| Primitive | Purpose | Pros | Cons / Trade-offs |
|-----------|---------|------|-------------------|
| **InterviewRecording** | Raw audio/video & metadata | Single source of truth; enables re-processing | Large storage; transcoding cost |
| **Transcript** | Auto-generated text (AssemblyAI) | Searchable & prompt-ready | Accuracy tied to ASR; no HITL |
| **Insight** | Atomic observation (impact, novelty, tags, quotes) | Fine-grained; composable | Volume/noise risk |
| **Theme** | Cluster of Insights | Aids synthesis/dashboard | Algorithm & human validation needed |
| **Persona** | Aggregated traits across participants (auto clustering) | Drives product focus; reusable | Quality depends on cluster params |
| **Opportunity** | Solution hypothesis | Aligns discovery → delivery | Premature solutioning if weak evidence |
| **Tag** | Lower_snake_case label | Cross-filtering & search | Glossary governance |

---

## 3. Architecture Overview
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

## 5. Data Model (DDL extract)
```sql
CREATE TABLE interviews (
  id uuid PRIMARY KEY,
  file_url text,
  conducted_at timestamptz,
  duration int,
  metadata jsonb
);

CREATE TABLE transcripts (
  id uuid PRIMARY KEY,
  interview_id uuid REFERENCES interviews(id),
  text text,
  words jsonb
);

CREATE TABLE insights (
  id uuid PRIMARY KEY,
  interview_id uuid REFERENCES interviews(id),
  theme_tag text,
  impact int,
  novelty int,
  jtbd text,
  quotes jsonb,
  tags text[],
  confidence text,
  embedding vector(1536)
);

-- plus tables: themes, personas, opportunities
CREATE EXTENSION IF NOT EXISTS pgvector;
```

---

## 6. Open Questions (resolved)
1. **ASR Accuracy**: Use *AssemblyAI batch*; no human-in-the-loop.  
2. **Processing Mode**: Batch for now; design workers abstractly for future RT.  
3. **PII & Encryption**: Recordings may contain PII; no encryption/consent flow yet.  
4. **Personas**: AI clustering auto-generates personas; no manual step required.  
5. **Scale**: Average 10 interviews/project; upper bound 30-50 (design queries for ≤100 rows).

---

## 7. Roadmap / Next Steps
1. **Vertical Slice**: Upload → Transcript → single Insight card.  
2. Set up Supabase project + CI (Vitest, Playwright).  
3. Storybook PoC for components.  
4. Draft prompt templates & evaluation harness for LLM quality.  
5. Review privacy stance before beta.

---

## 8. Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM cost spikes | Med | Med | Prompt cost guards, caching |
| AssemblyAI API limits | Low | High | Rate-limit, queue jobs |
| Vendor lock-in | Med | Med | Abstract data access layer |
| Data privacy requirements change | Low | High | Add encryption module later |
