# UpSight App - Information Architecture and Core Entities

## Marketing 1‑liner

Craft a simple promise anyone in the company can repeat.

**Mad‑Libs pitch**

* *For* **\[team / role]** *who need to* **\[understand customers / decide what to build]**, **DSTL** *turns* **recordings & reports** *into* **evidence → themes → insights** *so they can* **\[prioritize confidently / ship the right thing]**—*without* **research jargon or bottlenecks**.

**Micro‑taglines**

* *Turn conversations into confidence.*
* *From raw talks to ready decisions.*
* *Evidence in. Insights out. Action next.*

---

## Core entities (crisp definitions)

* **Project**: Container for all work.
* **Target Audience (Ideal Customer)**: Project‑level definition of **Organization** and **Role(s)** we’re designing for.
* **Goal (project goal)**: What the team wants to learn/achieve now (e.g., price sensitivity, improve retention). Includes assumptions and unknowns.
* **Interview**: A session that yields a transcript (speaker turns, chapters). Links to People and generates Evidence.
* **Person / Participant**: Individual in the study with attributes (role, company, segment). Rolls into Personas.
* **Experiment**: Any method that generates information (interview, usability test, survey, log study, market scan). Holds protocol + metadata.
* **Evidence** (atomic): Discrete, citable unit from any source (quote, metric, observation, market stat, artifact). May support/refute/neutral.
* **Theme** (cluster): Named pattern formed by grouping related evidence (tags + semantics). Reusable across people, personas, time.
* **Insight** (meaning): Decision‑useful explanation connecting 1–3 themes with **context → cause → effect**. *Confidence (later) lives here.*
* **Opportunity** (“How might we…”): Testable idea for change from an insight (action + audience + expected benefit + measurement).
* **Persona / Segment**: Audience slice tags applied to evidence/themes/insights for stratified analysis.
* **Question**: Suggested interview prompts derived from **Goal + Target Audience**; tracked as Proposed/Approved and linked to Studies.

> Canvas mapping: **Experiments → Evidence → Insights → Opportunities**; *Project setup adds Target Audience, Goal, and a starting Question set.*

---

## Relationships (at a glance)

```
Project 1..1 → TargetAudience (org, roles[])
Project 1..* → Goal (active goal per project)
Goal → generates → Question*
Study 1..* → Interview* → Evidence*
Evidence *..* → Theme (theme_evidence)
Theme *..* → Insight (insight_theme)
Insight 1..* → Opportunity
Evidence/Theme/Insight *..* → Persona/Segment tags
Evidence ↔ Anchors (timecodes/pages/URLs)
```

---

## Lifecycle (who does what)

| Step                        | Trigger                                                       | What happens                                                                             | Outputs                              |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| **−1. Project setup**       | **User** creates project                                      | Define **Target Audience** (Org + Role) and enter **Goal** (assumptions + unknowns).     | Project config saved                 |
| **0. Question suggestions** | **Auto** on save of setup                                     | AI drafts an interview **Question set** from Goal + Audience; user *Approve/Edit/Merge*. | Approved questions list              |
| **1. Ingest**               | **User** adds recording/doc                                   | Upload media → language detect → transcription (AssemblyAI).                             | Transcript, chapters, speakers       |
| **2. Auto‑tag**             | **Auto** post‑ingest                                          | NER, emotions, journey stage, entities, keywords.                                        | Tags on transcript segments          |
| **3. Extract Evidence**     | **Auto → Human confirm**                                      | AI proposes evidence units (quotes/metrics); user approves/edits.                        | Evidence items with anchors + tags   |
| **4. Group into Themes**    | **Auto** on new evidence + **Human** merge/split              | Cluster similar evidence; LLM assigns/creates themes under rules.                        | Themes updated; theme↔evidence links |
| **5. Create Insight**       | **Auto suggest** when thresholds met; **User** approves/edits | AI drafts insight (≤3 themes, scoped to personas).                                       | Insight draft/published              |
| **6. Spot Opportunities**   | **Auto suggest** from insight; **User** curates               | Generate HMW options; backlog status/owner.                                              | Opportunity cards                    |
| **7. Recompute**            | **Auto** after evidence/theme/insight change                  | Update counts, coverage, (Phase 2) confidence; notify affected items.                    | Fresh stats + change log             |

> New evidence auto‑kicks: clustering, theme stats, suggestions, and dependency recompute.

\---|---|---|---|
\| 0. **Ingest** | **User** clicks *Add recording/doc* | Upload media → language detect → transcription (AssemblyAI) | Transcript, chapters, speakers |
\| 1. **Auto‑tag** | **Auto** post‑ingest | NER, emotions, journey stage, entities, keywords | Tags on transcript segments |
\| 2. **Extract Evidence** | **Auto → Human confirm** | AI proposes evidence units (quotes/metrics); user approves/edits | Evidence items with anchors + tags |
\| 3. **Group into Themes** | **Auto on new evidence** + **Human merge/split** | Similar evidence clustered; LLM assigns/creates themes under rules | Themes updated; theme↔evidence links |
\| 4. **Create Insight** | **User** | Author concise statement connecting ≤3 themes; set persona scope; add assumptions/risks | Insight draft |
\| 5. **Spot Opportunities** | **User** | Write “How might we…”, attach to insight; backlog status/owner | Opportunity card |
\| 6. **Recompute** | **Auto** after evidence/theme/insight change | Update counts, coverage, (later) confidence; notify affected items | Fresh stats + change log |

> New evidence auto‑kicks: clustering, theme stats, and dependency recompute.

---

## Evidence model (minimal but complete)

* `id`
* `source_type`: `primary | secondary`
* `method`: `interview | usability | survey | telemetry | market_report | support_ticket | benchmark | other`
* `modality`: `qual | quant`
* `support`: `supports | refutes | neutral`
* `personas[]`, `segments[]`, `journey_stage?`, `role?`, `company_size?`
* `tags[]` (problem, goal, behavior, emotion, context, constraint, artifact)
* `weight_quality (0..1)`, `weight_relevance (0..1)`, `independence_key` (cohort/source hash)
* `metric_value?`, `n?`, `ci_low?`, `ci_high?` (for quant)
* `verbatim?` (for qual), `media_anchor?` (timecode/page), `citation?` (URL, doc id)
* `created_at`

**Tag set (condensed, LLM‑friendly):**

* **Problem (Pain)**, **Goal (Outcome)**, **Behavior (Action)**, **Emotion (Affect)**, **Context/Constraint**, **Artifact/UI**.

---

## Theme: definition & rules (LLM‑ready)

**Definition:** A named, stable **problem/goal/behavior** pattern observed across ≥2 evidence items that share semantics and intent.

**Required fields**: `name`, `statement`, `scope (persona/segment/context)`, `inclusion_criteria`, `exclusion_criteria`, `synonyms[]`, `anti_examples[]`.

**Naming template:**

* *Problem*: “Confusion locating the shopping cart on mobile.”
* *Goal*: “Desire for predictable monthly spend.”
* *Behavior*: “Deferring signup until after exploration.”

**Acceptance criteria:**

* Purity ≥ 0.7 (share common tokens/embeddings + tag overlap)
* Coverage across ≥2 participants **or** ≥2 sources (e.g., logs + interviews)
* Not a UI‑specific phrasing if the underlying issue is conceptual

**LLM rubric (classification prompt skeleton):**

* Input: evidence text + tags + persona + journey stage
* Output: `{theme_id|new}, rationale (1–2 lines), confidence (0–1)`
* Must respect: inclusion/exclusion, synonyms, anti‑examples
* If `new`, propose `name`, `statement`, `synonyms`, and `scope`

---

## Insights: synthesis & policy

**Definition:** A concise, actionable explanation that connects 1–3 themes for a declared audience/context, stating **context → cause → effect**.

**Template:**

> *For \[persona/segment] in \[context], because \[cause/mechanism], they \[effect/behavior/outcome], which impacts \[metric/business risk].*

**Fields:** `id, statement, theme_ids[], personas[], assumptions[], risks[], scope, owner, created_at`.

**Rules:**

* May reference multiple themes (recommended ≤3).
* Must cite representative evidence via the linked themes.
* Confidence is assigned **only at the insight level** (see below). Themes hold descriptive stats for drill‑down, not public badges.

---

## Confidence (assigned to Insights)

**Phase 1 (MVP):** show **counts & coverage**, no math beyond totals.

* Display on Insight: `Evidence: 18 (5 interviews, 2 methods, 3 personas)` and badges *Triangulated / Cross‑persona / Wedge*.

**Phase 2:** enable two‑lane scoring (Quant × Qual) with simple independence.

### Independence (simple version: easy to ship)

Goal: avoid over‑counting near‑duplicates without heavy ML.

* **Cohort key**: `source_cohort` (same interview series, same recruiter, same company, same campaign).
* **Diminishing returns per cohort**: `effective = Σ_cohort sqrt(count_cohort)`
  Example: 1+1+1 from same cohort → `sqrt(3)=1.73` (not 3). Another independent cohort of 4 adds `sqrt(4)=2`.
* **Quality / relevance weights** still apply as simple multipliers (0–1).

### Quant lane (Phase 2)

* Compute `N_eff` using the sqrt rule above (optionally multiply by average weight).
* Map `N_eff` to a probability‑style score with a skeptical prior (Beta(1,2)); supports add +1, refutes add +1 to the other side.
* Report: mean, CI, `N_raw`, `N_eff`, personas/methods coverage.

### Qual lane (Phase 2)

* Start High; downgrade for bias, inconsistency, indirectness, imprecision; upgrade for triangulation, strong effect, replication.

### Labels (Phase 2 defaults)

* **Preliminary** < 3 `N_eff` or sparse/biased.
* **Emerging** ≥3 and some diversity.
* **Supported** ≥6 with ≥2 cohorts/methods.
* **Robust** ≥10 with ≥3 cohorts and ≥2 methods.

---

## Visualization patterns

1. **Persona × Theme heatmap**: color=coverage/strength; size=`N_eff`; wedge badge when strong for a specific persona (clear PMF signal). Tooltip explains: *Wedge = concentrated, reliable signal within one persona; not necessarily generalizable.*
2. **Theme clusters graph**: semantic clusters; edges for co‑occurrence; hover reveals top evidence.
3. **Insight ladder**: insights sorted by confidence (Phase 2) or counts (Phase 1).
4. **Evidence timeline**: chapters & key moments; jump via anchors.
5. **Coverage gauges**: % interviews per persona contributing to each theme.

---

## UX copy (plain language)

* **Evidence** (not “fact” except when quantified), **Theme**, **Insight**, **Opportunity**.
* Badges: *Preliminary, Emerging, Supported, Robust*.
* Buttons: *Add evidence*, *Group into theme*, *Create insight*, *Spot an opportunity*.

---

## Minimal schema (Supabase)

**evidence**(`id`, `experiment_id?`, `source_type`, `method`, `modality`, `support`, `personas[]`, `segments[]`, `journey_stage?`, `tags[]`, `weight_quality`, `weight_relevance`, `independence_key`, `metric_value?`, `n?`, `ci_low?`, `ci_high?`, `verbatim?`, `media_anchor?`, `citation?`, `created_at`)

**themes**(`id`, `name`, `statement`, `scope`, `inclusion_criteria`, `exclusion_criteria`, `synonyms[]`, `anti_examples[]`, `created_at`)

**theme\_evidence**(`theme_id`, `evidence_id`, `rationale?`)

**insights**(`id`, `statement`, `theme_ids[]` or join table, `personas[]`, `assumptions[]`, `risks[]`, `scope`, `owner`, `created_at`, `quant_mean`, `quant_ci_low`, `quant_ci_high`, `n_eff`, `qual_rating`, `confidence_label`)

**opportunities**(`id`, `insight_id`, `how_might_we`, `audience`, `expected_benefit`, `measure`, `status`)

---

## API surface (TS)

```ts
addEvidence(e: EvidenceInput): Evidence
linkEvidenceToTheme(themeId: Id, evidenceId: Id, rationale?: string)
mergeThemes(primaryId: Id, mergeId: Id)
createInsight(input: InsightInput): Insight
scoreInsight(insightId: Id): Insight // updates quant+qual+label
matrixPersonaTheme(): PersonaThemeCell[]
```

---

## Governance, anchors & audit

**Anchors (what they are):** precise pointers back to the source—timecodes in A/V (`00:12:43–00:13:05`), page+paragraph in PDFs (`p.14 ¶3`), message IDs, or row IDs in logs. Every Evidence item must have at least one anchor and (if external) a citation.

**Audit**

* RLS per project/company; redact PII by default; opt‑in exposure rules.
* Explain‑why panels show cohort math and which evidence moved a score.
* Change log on Insights when linked evidence/themes change.

---

## Decisions locked

1. Theme count per insight **capped at 3**.
2. Method bonuses **approved**: survey +0.05, telemetry +0.10, triangulation +0.15 (Phase 2).
3. Independence **sqrt per‑cohort** rule for MVP+ (no vectors required).
4. Confidence label **defaults accepted**; tune later.
5. Insight badge only; theme stats on hover/drill.
6. Show **Wedge** prominently when a persona‑specific signal is strong; copy explains meaning.
7. Terminology locked: **Evidence / Theme / Insight / Opportunity**.

---

## MVP (recommended)

1. Ingest → transcript → auto‑tags + **anchors** (chapters from AssemblyAI).
2. Evidence capture UI (approve AI‑proposed snippets; add tags, personas, journey stage).
3. Auto cluster → **Themes** (rule‑based + semantic assist) with manual merge/split; create `theme_evidence` join.
4. Create **Insights** manually from ≤3 themes; show counts & coverage (no probabilistic score yet).
5. **Persona × Theme heatmap** and **Cluster graph** (counts‑based); drill to evidence.
6. **Opportunities backlog** with status and owners; simple generator (BAML) to draft from themes.
7. Chat over findings (retrieval limited to evidence anchors) + copy‑out.

## Phase rollout

* **Phase 0 (1–2 weeks):** ingest, transcripts, anchors, evidence UI, manual themes, basic heatmap.
* **Phase 1 (2–4 weeks):** auto‑clustering assist, insight creation pane, opportunities backlog, cluster graph.
* **Phase 2:** confidence scoring (sqrt cohort rule + labels), audit panels, notifications on changes.
* **Phase 3:** advanced independence (similarity), random‑effects refinements, per‑persona forecasting.

## Storyboards (core flows)

1. **Researcher → Evidence**: Upload → transcript appears with chapters → AI suggests 20 evidence units → user approves/edits → items anchor to timecodes.
2. **Analyst → Themes**: Open Theme Studio → “Auto‑group new evidence” → review groups, merge/split → name & scope → heatmap updates.
3. **PM → Insight & Opportunity**: Pick 1–3 themes → author insight → badge shows counts/coverage → click “Spot opportunity” → HMW drafted → add owner & metric.

## Implementation notes

* BAML utilities: `extract_evidence`, `propose_themes`, `draft_insight`, `draft_opportunities`.
* Supabase: add `theme_evidence` join; follow existing RLS patterns; store anchors as structured JSON (`type`, `target`, `start`, `end`).

---

## AI‑generated Insights & Opportunities (human‑in‑the‑loop)

**Workflow**

1. **Auto‑suggest** when a theme hits a threshold (e.g., `N_eff ≥ 3` or cross‑persona spread):

   * `draft_insight(themes[], personas[])` → returns *Proposed* insight (includes rationale + linked evidence via themes).
   * `draft_opportunities(insight)` → 3–5 “How might we…” variants.
2. **Review queue**: user **Accept / Edit / Merge / Reject**.
3. **Provenance**: every suggestion stores `generated_by`, model/version, timestamp, and the theme snapshot used.
4. **States**: `proposed → approved → published`. Merges keep a `superseded_by` pointer.

**Merge semantics**

* Combine `theme_ids` (dedupe), keep strongest statement, unify personas; union opportunities; keep change log.

---

## Cohort key (independence made simple)

**Why**: avoid over‑counting near‑duplicate sources.

**Default fields** (Balanced):

* `study_id` (research project)
* `recruiter_id` (or `panel_provider_id`)
* `company_domain` (B2B) **or** `acquisition_channel` (B2C)

**Optional add‑ons** (Stricter):

* `campaign_id` or `ad_group`
* `time_bucket` (ISO week, e.g., 2025‑W34)

**Build the key**: concatenate available fields with `:`; missing fields are skipped.

* **Simple/MVP**: `study_id`
* **Balanced (recommended)**: `study_id:recruiter_id:company_domain|acquisition_channel`
* **Strict**: add `:campaign_id:time_bucket`

**Example**

* All from same study and recruiter at ACME → same key `S17:R002:acme.com` → 5 items count as `sqrt(5)=2.24` effective.
* Another cohort from Ads campaign B → key `S17:R999:ads:B` → adds `sqrt(3)=1.73`.
* Total `N_eff ≈ 3.97` instead of 8.

**TS helper**

```ts
export function cohortKey(e: Evidence) {
  const parts = [e.study_id, e.recruiter_id, e.company_domain ?? e.acquisition_channel, e.campaign_id, e.time_bucket];
  return parts.filter(Boolean).join(":");
}
```

---

## Anchors (schema & implications)

**What**: precise pointers back to the source so anyone can jump to proof.

**Shape**

```ts
// Store as JSONB array: evidence.anchors
{
  type: 'av'|'doc'|'web'|'message'|'log',
  target: string,        // media_id, doc_id, URL, or stream id
  start: string|number,  // av: ms; doc: "p14#para3"; web: CSS/XPath; log: ISO timestamp
  end?: string|number
}
```

* **Implications**: a unified way to deep‑link across media; enables UI jump‑to; easy to extend; no extra join table for MVP.
* **Later**: if anchors get heavy, move to `evidence_anchor` table; for now, keep as JSONB and index `target` with GIN.

**SQL index**

```sql
CREATE INDEX ON evidence USING GIN ((anchors) jsonb_path_ops);
```

---

## Tags (how they work, BAML‑friendly)

**Canonical kinds**: `problem`, `goal`, `behavior`, `emotion`, `context`, `artifact`.

**Pipeline**

1. BAML `tag_evidence` proposes `{kind, value, confidence}`.
2. Canonicalize `value` via `tags` table (synonyms & slugs). If no close match → `candidate_tags` for review.
3. Apply if `confidence ≥ 0.7` and max **3 tags per kind** (keeps noise down).
4. Themes are built from tag overlaps + semantic similarity; user can add/remove tags.

**Schema sketch**

* `tags(id, kind, value, slug, synonyms[])`
* `evidence_tag(evidence_id, tag_id, confidence)`

**LLM rubric tip**: one short quote per **problem/goal**; *don’t* assign both if mutually exclusive.

---

## UI wireframe guidance (opinionated)

**A. Project Setup Wizard**

* Step 1: Target Audience (Org + Role chips)
* Step 2: Goal (title, detail, assumptions, unknowns)
* Step 3: AI‑Suggested Questions → *Approve/Edit/Merge* → Save

**B. Personas**

* Tabs: *People | Interviews | Evidence*
* Persona chips with counts & **Wedge** badges
* Generate Personas (AI) → Accept/Merge/Edit

**C. Patterns** *(Themes & Matrix)*

* Left: ranked **Themes** with badges (Wedge, Cross‑persona, Triangulated)
* Right: **Persona × Theme Matrix** (click cell → drawer with evidence + Draft Insight)

**D. Insights & Opportunities**

* Draft Insights (AI) from ≤3 themes → Accept/Edit/Merge
* Counts & coverage (Phase 1) → later confidence badge
* Generate **HMW Opportunities** → Kanban: Proposed → Validating → Ready → In‑progress

---

## Navigation (4‑step journey)

**Desktop sidebar (4 items):**

1. **Research** — status, recommendations, questions, experiments, transcripts, add interviews/surveys. *Define goals & get evidence.*
2. **Personas** — people, interviews, evidence. *Analyze who we’re hearing from & what makes them tick.*
3. **Patterns** — themes, themes × personas matrix. *See signals, strength, and resonance; springboard to insights.*
4. **Insights & Opportunities** — publish insights; HMW backlog & next steps.

**Mobile bottom nav:** the same 4; sub‑areas become top tabs (e.g., Personas: People | Interviews | Evidence; Patterns: Themes | Matrix).

**Stepper:** show a subtle progress rail at top: **Research → Personas → Patterns → Insights** with a big **Next** CTA on each page.

---

## Updated next steps

1. **Anchors** JSONB in `evidence`; AssemblyAI chapters in ingest.
2. **Auto‑group service** (BAML): build `propose_themes` + create `theme_evidence` joins.
3. **AI drafts**: `draft_insight`, `draft_opportunities`; review queue with Accept/Edit/Merge.
4. **Heatmap + cluster graph** components.
5. Defer confidence math to Phase 2; for now show counts, cohorts, and coverage.

---

# Build Spec Addendum (for Windsurf IDE)

## Supabase schema (starter DDL)

> Assumes you have `projects`. Add `project_id` to each table and RLS by project.

````sql
-- PROJECT CONFIG
create table if not exists project_config (
  project_id uuid primary key,
  target_org text,
  target_roles text[] default '{}',
  goal_title text,
  goal_detail text,
  goal_assumptions text[] default '{}',
  goal_unknowns text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  study_id uuid, -- optional; attach to a specific study
  text text not null,
  intent text, -- discovery/validation/price/retention/etc
  status text check (status in ('proposed','approved','archived')) default 'proposed',
  source text, -- 'ai' | 'human'
  created_at timestamptz default now()
);

-- PEOPLE & INTERVIEWS
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  display_name text,
  role text,
  company text,
  persona text,
  segment text,
  created_at timestamptz default now()
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  study_id uuid,
  person_id uuid references people(id) on delete set null,
  language text,
  media_id text,
  chapters jsonb default '[]',
  transcript_ready boolean default false,
  created_at timestamptz default now()
);

-- EVIDENCE
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  experiment_id uuid,
  interview_id uuid references interviews(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  source_type text check (source_type in ('primary','secondary')) not null,
  method text check (method in ('interview','usability','survey','telemetry','market_report','support_ticket','benchmark','other')) not null,
  modality text check (modality in ('qual','quant')) not null,
  support text check (support in ('supports','refutes','neutral')) default 'supports',
  personas text[] default '{}',
  segments text[] default '{}',
  journey_stage text,
  weight_quality numeric default 0.8,
  weight_relevance numeric default 0.8,
  independence_key text,
  metric_value numeric,
  n numeric,
  ci_low numeric,
  ci_high numeric,
  verbatim text,
  anchors jsonb default '[]',
  citation text,
  created_at timestamptz default now()
);
create index if not exists evidence_anchors_gin on evidence using gin ((anchors) jsonb_path_ops);

-- TAGS
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  kind text check (kind in ('problem','goal','behavior','emotion','context','artifact')) not null,
  value text not null,
  slug text unique,
  synonyms text[] default '{}'
);
create table if not exists evidence_tag (
  evidence_id uuid references evidence(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  confidence numeric,
  primary key (evidence_id, tag_id)
);

-- THEMES
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  name text not null,
  statement text not null,
  scope text,
  inclusion_criteria text,
  exclusion_criteria text,
  synonyms text[] default '{}',
  anti_examples text[] default '{}',
  created_at timestamptz default now()
);
create table if not exists theme_evidence (
  theme_id uuid references themes(id) on delete cascade,
  evidence_id uuid references evidence(id) on delete cascade,
  rationale text,
  primary key (theme_id, evidence_id)
);

-- INSIGHTS
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  statement text not null,
  personas text[] default '{}',
  assumptions text[] default '{}',
  risks text[] default '{}',
  scope text,
  owner uuid,
  created_at timestamptz default now(),
  quant_mean numeric,
  quant_ci_low numeric,
  quant_ci_high numeric,
  n_eff numeric,
  qual_rating text,
  confidence_label text check (confidence_label in ('Preliminary','Emerging','Supported','Robust'))
);
create table if not exists insight_theme (
  insight_id uuid references insights(id) on delete cascade,
  theme_id uuid references themes(id) on delete cascade,
  primary key (insight_id, theme_id)
);

-- OPPORTUNITIES
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  insight_id uuid references insights(id) on delete cascade,
  how_might_we text not null,
  audience text,
  expected_benefit text,
  measure text,
  status text check (status in ('proposed','validating','ready','in_progress','done')) default 'proposed',
  created_at timestamptz default now()
);
```sql
-- PEOPLE & INTERVIEWS
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  display_name text,
  role text,
  company text,
  persona text,
  segment text,
  created_at timestamptz default now()
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  study_id uuid,
  person_id uuid references people(id) on delete set null,
  language text,
  media_id text,           -- storage key
  chapters jsonb default '[]',
  transcript_ready boolean default false,
  created_at timestamptz default now()
);

-- EVIDENCE
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  experiment_id uuid,
  interview_id uuid references interviews(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  source_type text check (source_type in ('primary','secondary')) not null,
  method text check (method in ('interview','usability','survey','telemetry','market_report','support_ticket','benchmark','other')) not null,
  modality text check (modality in ('qual','quant')) not null,
  support text check (support in ('supports','refutes','neutral')) default 'supports',
  personas text[] default '{}',
  segments text[] default '{}',
  journey_stage text,
  weight_quality numeric default 0.8,
  weight_relevance numeric default 0.8,
  independence_key text, -- cohort key
  metric_value numeric,
  n numeric,
  ci_low numeric,
  ci_high numeric,
  verbatim text,
  anchors jsonb default '[]', -- [{type,target,start,end}]
  citation text,
  created_at timestamptz default now()
);
create index if not exists evidence_anchors_gin on evidence using gin ((anchors) jsonb_path_ops);

-- TAGS
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  kind text check (kind in ('problem','goal','behavior','emotion','context','artifact')) not null,
  value text not null,
  slug text unique,
  synonyms text[] default '{}'
);
create table if not exists evidence_tag (
  evidence_id uuid references evidence(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  confidence numeric,
  primary key (evidence_id, tag_id)
);

-- THEMES
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  name text not null,
  statement text not null,
  scope text,
  inclusion_criteria text,
  exclusion_criteria text,
  synonyms text[] default '{}',
  anti_examples text[] default '{}',
  created_at timestamptz default now()
);
create table if not exists theme_evidence (
  theme_id uuid references themes(id) on delete cascade,
  evidence_id uuid references evidence(id) on delete cascade,
  rationale text,
  primary key (theme_id, evidence_id)
);

-- INSIGHTS
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  statement text not null,
  personas text[] default '{}',
  assumptions text[] default '{}',
  risks text[] default '{}',
  scope text,
  owner uuid,
  created_at timestamptz default now(),
  -- Phase 2 scoring
  quant_mean numeric,
  quant_ci_low numeric,
  quant_ci_high numeric,
  n_eff numeric,
  qual_rating text,
  confidence_label text check (confidence_label in ('Preliminary','Emerging','Supported','Robust'))
);
create table if not exists insight_theme (
  insight_id uuid references insights(id) on delete cascade,
  theme_id uuid references themes(id) on delete cascade,
  primary key (insight_id, theme_id)
);

-- OPPORTUNITIES
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  insight_id uuid references insights(id) on delete cascade,
  how_might_we text not null,
  audience text,
  expected_benefit text,
  measure text,
  status text check (status in ('proposed','validating','ready','in_progress','done')) default 'proposed',
  created_at timestamptz default now()
);
````

> **RLS**: add `project_id` policies mirroring your existing pattern (omitted for brevity).

---

## TypeScript types (shared)

````ts
export type ProjectConfig = {
  project_id: string;
  target_org?: string;
  target_roles: string[];
  goal_title?: string;
  goal_detail?: string;
  goal_assumptions?: string[];
  goal_unknowns?: string[];
};

export type Question = {
  id: string; project_id: string; study_id?: string;
  text: string; intent?: string; status: 'proposed'|'approved'|'archived'; source: 'ai'|'human';
};

export type Anchor = { type: 'av'|'doc'|'web'|'message'|'log'; target: string; start: number|string; end?: number|string };

export type Evidence = { /* unchanged fields from prior section */ };
export type Theme = { /* unchanged */ };
export type Insight = { /* unchanged plus counts in Phase 1 */ };
export type Opportunity = { /* unchanged */ };
```ts
export type Anchor = {
  type: 'av'|'doc'|'web'|'message'|'log';
  target: string; // media_id | doc_id | URL | stream id
  start: number|string; // ms or location string
  end?: number|string;
};

export type Evidence = {
  id: string; project_id: string;
  source_type: 'primary'|'secondary';
  method: 'interview'|'usability'|'survey'|'telemetry'|'market_report'|'support_ticket'|'benchmark'|'other';
  modality: 'qual'|'quant';
  support: 'supports'|'refutes'|'neutral';
  personas: string[]; segments: string[]; journey_stage?: string;
  weight_quality: number; weight_relevance: number; independence_key?: string;
  metric_value?: number; n?: number; ci_low?: number; ci_high?: number;
  verbatim?: string; anchors: Anchor[]; citation?: string;
};

export type Theme = {
  id: string; name: string; statement: string; scope?: string;
  inclusion_criteria?: string; exclusion_criteria?: string;
  synonyms?: string[]; anti_examples?: string[];
};

export type Insight = {
  id: string; statement: string; personas: string[];
  assumptions?: string[]; risks?: string[]; scope?: string;
  theme_ids: string[]; // ≤3
  // Phase 1 stats
  evidence_count?: number; interview_count?: number; method_count?: number; persona_count?: number;
  // Phase 2
  quant_mean?: number; quant_ci_low?: number; quant_ci_high?: number; n_eff?: number;
  qual_rating?: 'High'|'Moderate'|'Low'|'Very Low';
  confidence_label?: 'Preliminary'|'Emerging'|'Supported'|'Robust';
};

export type Opportunity = {
  id: string; insight_id: string; how_might_we: string; audience?: string;
  expected_benefit?: string; measure?: string; status: 'proposed'|'validating'|'ready'|'in_progress'|'done';
};
````

---

## Service API (contracts)

```ts
// Project setup
export function saveProjectConfig(cfg: ProjectConfig): Promise<ProjectConfig>
export function generateQuestions(cfg: ProjectConfig): Promise<Question[]>  // AI suggest
export function approveQuestions(ids: string[]): Promise<void>

// Evidence
export function addEvidence(input: Partial<Evidence>): Promise<Evidence>
export function linkEvidenceToTheme(themeId: string, evidenceId: string, rationale?: string): Promise<void>

// Cohorts / independence
export function cohortKey(e: Evidence): string
export function nEffByCohort(evidence: Evidence[]): number // sqrt per‑cohort rule

// Themes
export function autoGroupEvidence(projectId: string): Promise<{created: Theme[]; updated: Theme[]}>
export function mergeThemes(primaryId: string, mergeId: string): Promise<void>

// Insights & Opportunities (AI‑assisted)
export function draftInsight(themeIds: string[], personas: string[]): Promise<Insight>
export function draftOpportunities(insight: Insight): Promise<Opportunity[]>
export function reviewProposed<T extends Insight|Opportunity>(item: T, action: 'accept'|'edit'|'merge'|'reject'): Promise<T>

// Matrices & graphs
export function personaThemeMatrix(projectId: string): Promise<Array<{persona: string, theme_id: string, n_eff: number, coverage: number}>>
```

---

## BAML stubs (names & IO)

```yaml
# generate_questions.baml
input: { target_org: string, target_roles: string[], goal_title: string, goal_detail?: string, assumptions?: string[], unknowns?: string[] }
output: [ { text: string, intent: enum(discovery|validation|price|retention|adoption|usability|other) } ]

# extract_evidence.baml (unchanged)
input: { transcript: string, chapters: Chapter[], language: string }
output: [ { verbatim: string, support: enum, kind_tags: {problem?: string[], goal?: string[], behavior?: string[], emotion?: string[], context?: string[], artifact?: string[]}, anchors: Anchor[] } ]

# tag_evidence.baml (unchanged)
# propose_themes.baml (unchanged)
# draft_insight.baml (unchanged)
# draft_opportunities.baml (unchanged)
```

yaml

# extract\_evidence.baml

input: { transcript: string, chapters: Chapter\[], language: string }
output: \[ { verbatim: string, support: enum, kind\_tags: {problem?: string\[], goal?: string\[], behavior?: string\[], emotion?: string\[], context?: string\[], artifact?: string\[]}, anchors: Anchor\[] } ]

# tag\_evidence.baml

input: { evidence\_text: string }
output: \[ { kind: enum(problem|goal|behavior|emotion|context|artifact), value: string, confidence: float } ]

# propose\_themes.baml

input: { evidence\_items: Evidence\[], existing\_themes: Theme\[] }
output: \[ { theme\_id?: string, name?: string, statement?: string, rationale: string, confidence: float } ]

# draft\_insight.baml

input: { themes: Theme\[], personas: string\[] }
output: { statement: string, theme\_ids: string\[], personas: string\[], assumptions: string\[], risks: string\[] }

# draft\_opportunities.baml

input: { insight: Insight }
output: \[ { how\_might\_we: string, audience?: string, expected\_benefit?: string, measure?: string } ]

```

---

## Remix file map (suggested)
```

app/
routes/
projects.new\.tsx               # Setup wizard (Target Audience + Goal)
p.\$id.research.\_index.tsx     # Research dashboard
p.\$id.research.ingest.tsx     # Add recordings / transcripts
p.\$id.research.surveys.tsx    # (optional later)

```
p.$id.personas._index.tsx     # People | Interviews | Evidence (tabs)

p.$id.patterns.themes.tsx     # Theme list
p.$id.patterns.matrix.tsx     # Persona × Theme Matrix

p.$id.insights._index.tsx     # Insights (tab) | Opportunities (tab)
```

components/
ProjectSetupWizard.tsx
QuestionCard.tsx
EvidenceCard.tsx
ThemeCard.tsx
InsightComposer.tsx
OpportunityCard.tsx
PersonaThemeHeatmap.tsx
ClusterGraph.tsx
lib/
supabase.server.ts
cohort.ts
themes.ts
ai/
generate\_questions.ts
extract\_evidence.ts
tag\_evidence.ts
propose\_themes.ts
draft\_insight.ts
draft\_opportunities.ts

```

app/
  routes/
    projects.new.tsx           # Setup wizard (Target Audience + Goal)
    questions._index.tsx       # Approve/Edit AI‑suggested questions
    evidence._index.tsx        # Evidence Inbox
    themes._index.tsx          # Theme Studio
    insights._index.tsx        # Insight Workshop
    opportunities._index.tsx   # Backlog
    matrix.persona-theme.tsx   # Heatmap
  components/
    ProjectSetupWizard.tsx
    QuestionCard.tsx
    EvidenceCard.tsx
    ThemeCard.tsx
    InsightComposer.tsx
    OpportunityCard.tsx
    PersonaThemeHeatmap.tsx
    ClusterGraph.tsx
  lib/
    supabase.server.ts
    cohort.ts
    themes.ts
    ai/
      generate_questions.ts
      extract_evidence.ts
      tag_evidence.ts
      propose_themes.ts
      draft_insight.ts
      draft_opportunities.ts
```

app/
routes/
evidence.\_index.tsx        # Evidence Inbox
themes.\_index.tsx          # Theme Studio
insights.\_index.tsx        # Insight Workshop
opportunities.\_index.tsx   # Backlog
matrix.persona-theme.tsx   # Heatmap
components/
EvidenceCard.tsx
ThemeCard.tsx
InsightComposer.tsx
OpportunityCard.tsx
PersonaThemeHeatmap.tsx
ClusterGraph.tsx
lib/
supabase.server.ts
cohort.ts                  # cohortKey, nEffByCohort
themes.ts                  # autoGroupEvidence
ai/
extract\_evidence.ts
tag\_evidence.ts
propose\_themes.ts
draft\_insight.ts
draft\_opportunities.ts

```

---

## UI microcopy
- **Wedge badge tooltip:** “Strong, reliable signal *within* this persona. Great for a focused PMF wedge; not guaranteed to generalize.”
- **Anchor tooltip:** “Jump to the exact moment or page this evidence came from.”
- **Counts/coverage line (Phase 1):** “Evidence 18 • 5 interviews • 2 methods • 3 personas • 2 cohorts.”

---

## MVP checklist
- [ ] AssemblyAI ingest → chapters → transcript stored; anchors created for segments
- [ ] AI evidence suggestions → Inbox approve/edit → saved with anchors & tags
- [ ] Auto‑group → Themes; manual merge/split; `theme_evidence` join maintained
- [ ] Insight composer with AI drafts (≤3 themes) → review queue
- [ ] Opportunities generator + Kanban statuses
- [ ] Persona×Theme heatmap + cluster graph
- [ ] Cohort key + `nEffByCohort` counts shown (defer probabilistic scoring)

```
