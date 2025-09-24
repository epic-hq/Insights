# Interview Insights – User Flow

## Business Level

Looking at your current **flow** (Goal → Key Decisions → What to Learn → Questions for Users → Evidence), here are the **user’s key business problems** along the way and ideas to **reduce friction + delight**:

---

## 1. Defining the Goal

**Problem:** Users may struggle to phrase a clear goal.
**Delight Ideas:**

* **Templates & examples** (e.g., “Boost newsletter engagement,” “Reduce checkout drop-offs”).
* **Smart suggestions**: AI reformulates their rough text into a crisp goal.
* **Mini goal library**: pick from common goals in SaaS, e-commerce, CPG, etc.

---

## 2. Turning Goals into Key Decisions

**Problem:** People often don’t know what decisions they *should* be making.
**Delight Ideas:**

* **Auto-generated decision questions** with tooltips (“This is the big choice you’ll face”).
* **Scenario preview**: show how different decisions could play out.
* **Confidence meter**: indicate if a decision has weak or strong existing evidence.

---

## 3. Breaking into “What to Learn”

**Problem:** Users may not see the link between decisions and research questions.
**Delight Ideas:**

* **Visual map** (graph view): Goal → Decisions → Learn → Ask.
* **Coverage tracker**: highlight “We don’t have any way to learn about X yet.”
* **Suggestions from prior data**: pull relevant insights/reports automatically.

---

## 4. Getting the Questions for Users (Interview Prompts)

**Problem:** Teams don’t know how to phrase unbiased, effective prompts.
**Delight Ideas:**

* **Prompt builder with bias checks**: red flag if leading/yes-no question.
* **Auto-translate to plain voice**: adapt formal RQs into natural prompts.
* **Preview mode**: simulate how a participant might answer.

---

## 5. Gathering the Users / Data

**Problem:** They need participants, not just questions.
**Delight Ideas:**

* **Recruitment helpers**:

  * Pull from CRM/email lists.
  * Auto-generate outreach messages (“Want to join a 20-min test?”).
  * Incentive tracker (gift cards, discounts).
* **Async input**: allow users to answer via quick polls or embedded survey links.
* **Leverage “Research Docs”**: upload GA4 logs, surveys, A/B results as additional evidence sources.

---

## 6. Synthesizing Evidence

**Problem:** Overwhelm from raw notes/logs.
**Delight Ideas:**

* **Smart clustering**: auto-group answers by theme/persona.
* **Evidence-to-decision roll-up**: “This finding supports Decision A.”
* **Delightful chips**: color-coded supports/refutes tags, quick filters.

---

## 7. Closing the Loop

**Problem:** Users may feel “So what?” after seeing insights.
**Delight Ideas:**

* **Answer cards**: Each decision has a status (Answered / Partial / Unknown).
* **Next steps nudges**: Suggest experiments or additional encounters.
* **Shareable storyboards**: export findings to slides for execs.

---

💡 **For getting the *users*** (your question):
Add a **“Recruit Participants” button** next to Encounters. When clicked:

* Options:

  * Upload contact list.
  * Generate recruitment email.
  * Post quick survey link.
* Show **progress bar**: “5 of 10 target interviews scheduled.”
* Integrate with People section → auto-tag stakeholders / participants.

---

## Examples

## 1. Updated UI Flow (plain terms)

* **Step 1 → “What do you want to achieve?”** (Goal)
* **Step 2 → “What big choices do you need to make?”** (Key Decisions / DQs)
* **Step 3 → “What do you need to learn?”** (Things to Find Out / RQs)
* **Step 4 → “What will you ask people?”** (Questions for Users / IPs)

Tooltips can still show the formal names (Decision Question, Research Question, Interview Prompt).

---

## 2. Four Example Use Cases

### A) Generating Content (Marketing Team)

* **Goal:** Boost engagement with weekly newsletter.
* **Key Decisions:**

  * Which topics resonate most with subscribers?
  * Should we use more video vs. text content?
* **What to Learn:**

  * What topics subscribers actually click on.
  * How people prefer to consume marketing content.
* **Questions for Users:**

  * “What was the last newsletter you opened and why?”
  * “Do you prefer short videos, articles, or quick tips?”

---

### B) Finding PMF for SaaS App (Startup Team)

* **Goal:** Validate product–market fit for task automation app.
* **Key Decisions:**

  * Does our app solve a real, painful problem?
  * Who are the early adopter segments?
* **What to Learn:**

  * What tasks people currently automate or struggle with.
  * Which roles or industries feel the pain strongest.
* **Questions for Users:**

  * “Tell me about the last time you wished a task could be automated.”
  * “What tools do you use now to handle repetitive work?”

---

### C) Testing a New Business Idea (Founder)

* **Goal:** Explore viability of subscription meal-kit for athletes.
* **Key Decisions:**

  * Is the market willing to pay for specialized nutrition?
  * Which features (speed, customization, price) matter most?
* **What to Learn:**

  * Athletes’ current eating habits and struggles.
  * How much they spend on supplements and prepared meals.
* **Questions for Users:**

  * “Walk me through your typical week of meals.”
  * “If you had a subscription that handled nutrition, what would be must-have vs. nice-to-have?”

---

### D) Increasing Community Usage & Referrals (Community Manager)

* **Goal:** Grow active participation in an online founder community.
* **Key Decisions:**

  * What makes members post and refer others?
  * Which incentives or formats drive stickiness?
* **What to Learn:**

  * Why members engage or drop off.
  * Which referral benefits feel motivating.
* **Questions for Users:**

  * “When was the last time you invited someone to join a community? What made you do it?”
  * “What makes you post or comment vs. just read silently?”


---

## Primary Journey (PM uploads new research. Detailed. July)

```mermaid
graph TD
  A[Login / Dashboard] --> B[Create Study]
  B --> C[Upload Interview Recording]
  C --> D[Processing Queue]\nTranscribe → Generate Insights
  D --> E[Interview Detail – Insight Cards]
  E --> F[Dashboard Aggregation]
  F --> G[Persona View]
  F --> H[Theme Matrix]
  H --> I[Opportunity Backlog]
```

### Step Descriptions
|#| Screen | Goal | Key Actions |
|-|-|-|-|
|1| Login / Dashboard | Access workspace | Auth (Supabase) → see list of studies |
|2| Create Study | New research project | Name study, set context meta |
|3| Upload Recording | Add raw data | Drag-n-drop file(s), show progress |
|4| Processing Queue | Background tasks | Real-time status chips (Queued/Done) |
|5| Interview Detail | Investigate a single session | Review Insight Cards, edit tags |
|6| Dashboard | Aggregate insights | Filter by persona/theme/opportunity, sticky KPI bar, 12-column grid layout, interactive filtering |
|7| Persona View | Understand segments | Auto-generated profiles + top quotes |
|8| Theme Matrix | Impact vs Novelty heat-map | Click cell → list supporting insights |
|9| Opportunity Backlog | Bridge to delivery | Prioritised table, export to CSV |

### Alternate Flows
* **Add More Interviews** – from Dashboard, hit “Upload More”.
* **Edit Insight** – from Card actions, opens modal with JSON fields.
* **Share Link** – read-only permalink with Dashboard filters encoded.
* **Filter Insights** – click on tags/categories in Insight cards to filter by related content.
* **Drag-and-Drop Opportunities** – reorder and move opportunity cards between kanban columns.
* **Navigate to List Views** – click on KPI cards or section headers to view detailed list pages.

---

## Navigation
Problem: We have too many things, and no clear flow.
HMW: guide user better to Wow and reduce clutter

- [ ] Desktop version: Top bar or sidenav?

First interaction. How long does it take to get to Wow? After a User uploads an interview, the priority is to understand the target market, people & personas. Then dig into the top themes for the target personas, how much evidence is there, and who resonates with it. Then formulate insights we can validate or act upon

So a lean menu in both mobile and desktop could look like this, with (items) appearing on page or as subnav.

1. Research (status, recommendations, questions, experiments, transcripts, add interviews, surveys) - define goals & get the evidence
2. Personas (people, interviews, evidence, themes, personas x themes) - analyze people & what makes them tick
3. Patterns (themes, themes x personas) - what are the signals we are getting, the top themes, how much evidence is there, and who resonates with it. Then formulate insights we can validate or act upon
4. Insights & Opportunities (future) - what are the insights we can validate or act upon & next steps

Global: Workspace switcher ▸ Projects ▸ Settings/Team


---

## UX Decisions (resolved)
* Single workspace for now.
* Read-only share links are auth-gated.

## Interview Data Flow (2025 Update)

| Step | Route/Function/Component | Purpose | Data Storage | Key Relationships |
|------|-------------------------|---------|--------------|-------------------|
| 1 | [`app/components/questions/InterviewQuestionsManager.tsx`](app/components/questions/InterviewQuestionsManager.tsx) | Plan, generate, edit, and organize interview questions | `interview_prompts`, `project_answers` | Questions linked to project, can be associated with interviews via `prompt_id`/`question_id` |
| 2 | [`app/features/interviews/pages/new.tsx`](app/features/interviews/pages/new.tsx) | Create a new interview, assign participants, set meta | `interviews` | Interview linked to project, account, and optionally people (participants) |
| 3 | [`app/routes/api.upload-file.tsx`](app/routes/api.upload-file.tsx:13) | Upload interview recording (audio/video) | File storage (media), `interviews.media_url` | Uploaded file URL saved to interview record |
| 4 | [`app/routes/api.interview-transcript.tsx`](app/routes/api.interview-transcript.tsx:5) | Transcribe uploaded media, attach transcript to interview | `interviews.transcript`, `interviews.transcript_formatted` | Transcript linked to interview, used for downstream analysis |
| 5 | [`app/routes/api.trigger-analysis.tsx`](app/routes/api.trigger-analysis.tsx:5) | Trigger LLM/AI analysis on transcript | `evidence`, `project_answers`, `project_answer_evidence` | Extracted evidence/answers linked to interview, project, and optionally to questions |
| 6 | [`app/features/interviews/pages/detail.tsx`](app/features/interviews/pages/detail.tsx) | View interview details, evidence, empathy map, insights | Reads from `interviews`, `evidence`, `project_answers` | UI aggregates all related data for a single interview |
| 7 | [`app/features/interviews/pages/index.tsx`](app/features/interviews/pages/index.tsx) | List all interviews for a project | Reads from `interviews` | Aggregates interviews by project/account |

```mermaid
flowchart TD
    A[InterviewQuestionsManager<br/>(Plan Questions)] --> B[NewInterviewPage<br/>(Create Interview)]
    B --> C[UploadFileAPI<br/>(Upload Recording)]
    C --> D[InterviewTranscriptAPI<br/>(Transcribe)]
    D --> E[TriggerAnalysisAPI<br/>(Extract Evidence/Answers)]
    E --> F[InterviewDetailPage<br/>(View Insights, Empathy Map)]
    F --> G[InterviewsIndexPage<br/>(Project Interview List)]

    subgraph Data
      I[interviews]
      J[interview_prompts]
      K[project_answers]
      L[evidence]
      M[project_answer_evidence]
    end

    B -- saves --> I
    A -- saves --> J
    E -- saves --> L
    E -- saves --> K
    E -- saves --> M
    F -- reads --> I
    F -- reads --> L
    F -- reads --> K
    G -- reads --> I
```

### Recommendations for Interview Data Flow Improvements (2025 Review)

**Strengths:**
- Data is highly normalized, with clear separation between interviews, answers, and evidence.
- All entities are project/account scoped with RLS, supporting multi-tenancy and security.
- The flow from question planning to evidence extraction is explicit and traceable.
- Empathy map facets and rich metadata on evidence support advanced analysis.

**Potential Improvements:**
1. **Transcript Chunking:**
   - If interviews become very long, consider normalizing transcript storage (e.g., `transcript_chunks` table) for more granular evidence mapping and efficient querying.
   - This is already hinted at in `project_answer_evidence.transcript_chunk_id` but not yet implemented.

2. **Explicit People/Participant Linking:**
   - While interviews can reference participants, consider a junction table for `interview_people` to support multi-participant interviews and richer role tracking (speaker, observer, etc.).
   - This would align with the `evidence_people` pattern.

3. **Evidence Provenance:**
   - Consider tracking the exact LLM/model version or pipeline used for evidence extraction in the `evidence` table for auditability and reproducibility.

4. **Error Handling & Status:**
   - The `interviews.status` enum is robust, but consider adding more granular error codes or logs for failed uploads/transcriptions/analyses to aid debugging.

5. **UI/UX:**
   - Consider adding a visual "data lineage" or "evidence trace" feature in the UI, so users can click from an insight/evidence unit back to the original transcript/audio segment and question.

6. **API Consistency:**
   - Ensure all API endpoints return consistent error structures and status codes, especially for file upload and analysis triggers.

7. **Documentation:**
   - Keep this flow diagram and table up to date in both user and developer docs, and add a section on "How evidence is linked to interviews and questions" for advanced users.

---
