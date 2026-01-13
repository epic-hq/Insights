# Unified Conversation Architecture

> **Status:** Phase 1 complete (schema), Phase 2 in progress
> **Updated:** 2026-01-13
> **Created:** 2024-12-26

## Overview

This document describes the unified architecture for handling all conversation data—whether from recorded interviews, uploaded transcripts, public "Ask" links, or AI chat conversations. The core insight is that **all of these are conversations** and should flow through a single analysis pipeline via the `interviews` table.

### Terminology

| Term | Definition |
| ---- | ---------- |
| **Ask** | A shareable link (`/ask/:slug`) that collects responses from external participants using your project's prompts |
| **Prompts** | Questions defined in `interview_prompts` table, used for interviews and Ask links |
| **Conversation** | Any response collected—interview, upload, or Ask submission—stored in `interviews` table |

## Problem Statement

### Before: Fragmented Systems

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PREVIOUS: 3 Separate Systems                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  interviews ──────────────> evidence ──────> lenses ──> insights    │
│     (audio/video)              ✓              ✓           ✓         │
│                                                                      │
│  research_links ──> research_link_responses                          │
│     (questions JSONB)    (answers JSONB)     ✗           ✗          │
│                          NO ANALYSIS PIPELINE!                       │
│                                                                      │
│  interview_prompts                                                   │
│     (internal planning)  NOT CONNECTED TO EITHER                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Issues:**

- External responses never got analyzed by lenses
- Questions stored in two places (JSONB + table)
- External respondents weren't tracked as People
- No evidence extraction from external responses
- Duplicate code for similar functionality

### After: Unified Pipeline

```mermaid
flowchart TB
    subgraph Account["Account Level"]
        AC[Company Context]
    end

    subgraph Project["Project Level"]
        PC[Project Context]
        IP[Interview Prompts]
        PUB[Public Config]
    end

    subgraph Collection["Data Collection"]
        REC[Record Live]
        UPL[Upload Audio/Video]
        ASK[Ask Link]
        CHAT[Public AI Chat]
    end

    subgraph Pipeline["Unified Pipeline"]
        INT[interviews table]
        EV[Evidence Extraction]
        LENS[Lens Analysis]
        TH[Theme Clustering]
        INS[Insights Generation]
    end

    AC --> PC
    PC --> IP
    PC --> PUB

    IP --> REC
    IP --> UPL
    IP --> ASK
    IP --> CHAT

    REC --> INT
    UPL --> INT
    ASK --> INT
    CHAT --> INT

    INT --> EV
    EV --> LENS
    LENS --> TH
    TH --> INS
```

## Architecture Decision: Consolidate into Interviews Table

### Rationale

The `interviews` table already has most capabilities needed for Ask responses:

| Need | interviews table | Notes |
| ---- | ---------------- | ----- |
| Track completion | `status = 'draft'` vs `'uploaded'` | Enum already supports this |
| Response mode | `source_type` field | Add: `survey_form`, `survey_chat`, `survey_voice` |
| Video attachment | `media_url` | Already exists |
| Person link | `person_id` FK | Already exists |
| Link config | Add `research_link_id` FK | New nullable column |
| Unique per link | Constraint on (research_link_id, person_id) | New constraint |
| In-progress saves | `draft_responses` JSONB | Already added in survey_support.sql |

### Decision: Keep research_link_responses (Revised)

> **Note:** This section was revised on 2026-01-13. The original plan to migrate surveys into the `interviews` table was reconsidered. Survey responses are fundamentally different from interviews (no audio/video transcript, structured Q&A format) and forcing them into the interviews model adds complexity without benefit.

**Current Architecture:**

| Data | Storage Location |
|------|------------------|
| Survey answers | `research_link_responses.responses` JSONB |
| Text evidence (for themes) | `evidence` table with `research_link_response_id` FK |
| Interview transcripts | `interviews.transcript_formatted` |
| Interview evidence | `evidence` table with `interview_id` FK |

**Why NOT create interview records for surveys:**

1. Surveys don't have transcripts or media - `transcript_formatted` would be misused
2. Existing interview lenses (Empathy Map, Research Lens) expect speaker turns, not Q&A
3. Creating interview records would bloat the interviews table with non-interview data
4. Survey statistics (likert averages, select percentages) are computed directly from JSONB

**What we DO:**

- Keep `research_link_responses` table as-is
- Create `evidence` records for text questions only (for theme clustering)
- Create new Survey Statistics Lens for aggregate analysis
- Link evidence to responses via new FK `evidence.research_link_response_id`

See "Ask Link Evidence & Lens Architecture" section below for full details.

## Data Model

```mermaid
erDiagram
    accounts ||--o{ projects : has
    accounts {
        uuid id PK
        text name
        text website_url
        text company_description
        text customer_problem
        text[] offerings
        text[] target_industries
        text[] target_roles
        text[] competitors
        text industry
    }

    projects ||--o{ interview_prompts : has
    projects ||--o{ interviews : has
    projects ||--o{ research_links : has
    projects {
        uuid id PK
        uuid account_id FK
        text name
        text research_goal
        text[] assumptions
        text[] unknowns
        text custom_instructions
        text public_slug UK
        boolean is_public
        text public_hero_title
        text public_hero_subtitle
        boolean public_allow_chat
        text public_redirect_url
    }

    research_links ||--o{ interviews : collects
    research_links {
        uuid id PK
        uuid project_id FK
        text name
        text slug UK
        jsonb questions
        boolean allow_chat
        boolean allow_voice
        boolean allow_video
        text walkthrough_video_url
        boolean is_live
    }

    interview_prompts {
        uuid id PK
        uuid project_id FK
        text text
        text category
        boolean is_selected
        int selected_order
        text status
    }

    interviews ||--o{ evidence : generates
    interviews {
        uuid id PK
        uuid project_id FK
        uuid person_id FK
        uuid research_link_id FK
        text source_type
        interview_status status
        jsonb draft_responses
        jsonb transcript_formatted
        jsonb conversation_analysis
    }

    people ||--o{ interviews : participates
    people ||--o{ evidence_people : linked
    people {
        uuid id PK
        text firstname
        text lastname
        text title
        text company
        text industry
        uuid default_organization_id FK
    }

    organizations ||--o{ people : employs
    organizations {
        uuid id PK
        text name
        text industry
        text size_range
        int employee_count
    }

    evidence ||--o{ theme_evidence : grouped
    evidence ||--o{ evidence_people : linked
    evidence {
        uuid id PK
        uuid interview_id FK
        text verbatim
        text method
        text gist
    }

    themes ||--o{ theme_evidence : contains
    themes {
        uuid id PK
        text name
        text statement
        text inclusion_criteria
    }
```

## Schema Changes

### interviews (New Columns)

```sql
-- Link to Ask link configuration (null for non-Ask interviews)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS
  research_link_id uuid REFERENCES research_links(id) ON DELETE SET NULL;

-- Ensure one response per person per Ask link
CREATE UNIQUE INDEX IF NOT EXISTS uniq_interviews_research_link_person
  ON interviews(research_link_id, person_id)
  WHERE research_link_id IS NOT NULL;

-- Index for finding Ask responses
CREATE INDEX IF NOT EXISTS idx_interviews_research_link_id
  ON interviews(research_link_id)
  WHERE research_link_id IS NOT NULL;
```

### source_type Values (Extended)

The `interviews.source_type` column now supports:

| Value | Description |
| ----- | ----------- |
| `realtime_recording` | Live recorded interview |
| `audio_upload` | Uploaded audio file |
| `video_upload` | Uploaded video file |
| `document_upload` | Uploaded document |
| `transcript_paste` | Pasted transcript text |
| `survey_form` | Ask link form submission |
| `survey_chat` | Ask link AI chat conversation |
| `survey_voice` | Ask link voice conversation |

## Demographic Questions

### Design Principles

1. **Optional by default** - Respondents aren't burdened; creators opt-in to require
2. **Upfront, not mixed** - Demographic questions come first, before research questions
3. **Field-mapped** - Answers auto-populate person/organization fields
4. **Included by default** - Template starts with demographics; creators can remove

### Question Schema Extension

```typescript
interface ResearchLinkQuestion {
  id: string;
  prompt: string;
  type: "short_text" | "long_text" | "single_choice" | "multiple_choice";
  required?: boolean; // Default: false (optional)
  is_demographic?: boolean; // Default: false
  field_mapping?: {
    entity: "person" | "organization";
    field: string; // e.g., "title", "company", "industry", "size_range"
  };
}
```

### Default Demographic Template

When creating a new Ask link, include these questions by default (all optional, user can remove or mark required):

```typescript
const DEFAULT_DEMOGRAPHIC_QUESTIONS: ResearchLinkQuestion[] = [
  {
    id: "demo_name",
    prompt: "What's your name?",
    type: "short_text",
    is_demographic: true,
    field_mapping: { entity: "person", field: "name" },
  },
  {
    id: "demo_title",
    prompt: "What's your job title?",
    type: "short_text",
    is_demographic: true,
    field_mapping: { entity: "person", field: "title" },
  },
  {
    id: "demo_company",
    prompt: "What company do you work for?",
    type: "short_text",
    is_demographic: true,
    field_mapping: { entity: "organization", field: "name" },
  },
  {
    id: "demo_company_size",
    prompt: "How many employees at your company?",
    type: "single_choice",
    options: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    is_demographic: true,
    field_mapping: { entity: "organization", field: "size_range" },
  },
  {
    id: "demo_industry",
    prompt: "What industry are you in?",
    type: "short_text",
    is_demographic: true,
    field_mapping: { entity: "person", field: "industry" },
  },
];
```

### Organization Matching Logic

When processing company name from demographic questions:

1. **Email domain match first** - Extract domain from respondent email, match to existing orgs
2. **Name match second** - Fuzzy match on organization name
3. **Create if no match** - Create new organization record

Existing utilities: `app/features/people/deduplicate.ts` has normalization functions. `app/mastra/tools/manage-person-organizations.ts` has org linking logic.

## Person Detail Page Enhancement

### Design Goals

- Support both **research** and **sales** perspectives
- Surface key takeaways prominently
- Hide complexity behind tabs
- Enable actions: create opportunities, add notes, link to orgs

### Tab Structure

```text
Person: Sarah Chen
[Overview] [Details] [Evidence] [Activity]

────────────────────────────────────────────────────────────────────
OVERVIEW TAB (default - high signal)
────────────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│ Quick Stats                                                      │
│ PM at Acme Corp • 3 conversations • Last: Jan 6, 2025           │
│ [+ Add Note] [+ Create Opportunity]                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Key Takeaways (AI-generated summary)                            │
│ • Struggling with onboarding - almost gave up                   │
│ • Interested in Slack integration                               │
│ • Would recommend (NPS: 7)                                      │
│ • Decision maker for tools under $500/mo                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Organization: Acme Corp                                          │
│ 51-200 employees • SaaS • Series B                              │
│ [View Organization]                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Recent Evidence (3 most recent)                                 │
│ [📹 Interview] "The onboarding was confusing..."    Jan 5       │
│ [📋 Survey] "Took me 3 days to figure out..."       Jan 6       │
│ [📋 Survey] "Would love Slack integration"          Jan 6       │
│ [View all evidence →]                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Open Opportunities                                               │
│ Acme Corp - Expansion • $5,000 ARR • Stage: Discovery           │
│ [View Opportunity]                                               │
└─────────────────────────────────────────────────────────────────┘

────────────────────────────────────────────────────────────────────
DETAILS TAB (demographics, contact info)
────────────────────────────────────────────────────────────────────
All current fields: name, title, company, email, phone, LinkedIn,
location, industry, segment, etc.

────────────────────────────────────────────────────────────────────
EVIDENCE TAB
────────────────────────────────────────────────────────────────────
All evidence linked to this person via evidence_people junction
Filterable by source: Interview, Survey, Note
Shows source badge and link to original conversation

────────────────────────────────────────────────────────────────────
ACTIVITY TAB
────────────────────────────────────────────────────────────────────
Timeline of all interactions:
- Interviews conducted
- Ask link responses submitted
- Notes added
- Opportunities created/updated
```

## Theme/Insights View Enhancement

### Source Badges

All evidence displays show source type badge:

- 📹 Interview
- 📋 Survey (Ask link)
- 📝 Note
- 🎙️ Voice Memo

### Theme Detail with Traceability

```text
┌─────────────────────────────────────────────────────────────────┐
│ Theme: "Users struggle with initial setup"                       │
│ 8 evidence pieces • 5 people                                    │
├─────────────────────────────────────────────────────────────────┤
│ Sources: 3 Interviews • 4 Surveys • 1 Note                      │
├─────────────────────────────────────────────────────────────────┤
│ Supporting Evidence                                              │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📹 Interview                                    Sarah Chen   │ │
│ │ "The onboarding was really confusing..."                    │ │
│ │ [View Interview]                               Jan 5, 2025  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 Survey                                      Mike Johnson │ │
│ │ "Took me 3 days to figure out basic features"               │ │
│ │ [View Response]                                Jan 6, 2025  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Analysis Pipeline Flow

### Ask Response Completion Trigger

When an Ask response is completed:

```text
1. Update interview.status = 'uploaded'
   ↓
2. Existing trigger: Extract evidence from transcript_formatted
   ↓
3. Create evidence_people junction (NEW - currently missing)
   ↓
4. Trigger embedding generation for semantic search
   ↓
5. Apply conversation lenses (automatic - interview exists)
   ↓
6. Theme clustering suggests themes from evidence
   ↓
7. Evidence appears in unified views with source badges
```

### Currently Missing (To Implement)

1. **evidence_people junction** - Create on Ask response completion
2. **Source badges in UI** - Add to evidence displays
3. **Person page tabs** - Reorganize layout
4. **Demographic field mapping** - Process on save

## Migration Plan

### Phase 1: Schema Consolidation ✅

- [x] Add `research_link_id` column to interviews
- [x] Add unique constraint (research_link_id, person_id)
- [x] Add index for efficient Ask response lookups
- [x] Update source_type enum to include `survey_form`, `survey_chat`, `survey_voice`

**Completed:** 2026-01-07 via migration `20250107000000_interviews_research_link_support.sql`

### Phase 2: Survey Evidence Pipeline (Revised)

> **Note:** Original plan to migrate to interviews table has been revised. See "Decision: Keep research_link_responses" above.

- [ ] Add `research_link_response_id` FK to evidence table
- [ ] Update completion handler to create evidence per text question
- [ ] Add evidence_people creation on completion
- [ ] Add demographic field mapping processing

### Phase 3: Survey Lens Integration

- [ ] Create `survey-statistics` lens template
- [ ] Build stats computation from JSONB
- [ ] Build text theme extraction via BAML
- [ ] Show lens results on Ask responses page

### Phase 4: UI Updates

- [ ] Add source badges to evidence displays
- [ ] Reorganize person detail page into tabs
- [ ] Add demographic question template to Ask link editor
- [ ] Update theme views with source breakdown
- [ ] Fix AI analysis error display on responses page

## Risk Mitigation

| Risk | Mitigation |
| ---- | ---------- |
| Interview orphans from abandoned responses | Cleanup job for draft interviews > 30 days old |
| Person duplicates from email casing | Always lowercase, unique index on lower(email) |
| Organization duplicates | Match by email domain first, then fuzzy name match |
| Data loss on tab close | Save on beforeunload + on "Next" click |
| Partial analysis | Only trigger on status='uploaded' |
| Public route auth | Admin client server-side, strict validation |

## Confidence Assessment

**High Confidence (90%+):**

- Keeping research_link_responses separate from interviews is cleaner
- Survey Statistics Lens will provide aggregate analysis
- Theme clustering will pick up Ask response text evidence
- Demographic questions with field mapping is sound design

**Medium Confidence (70-90%):**

- Tab-based person page will improve UX (may need iteration)
- Default demographics included vs opt-in (user preference)
- Organization matching algorithm completeness

**Questions Resolved:**

1. ✅ Yes, create interview records for Ask responses - enables full pipeline
2. ✅ Demographic questions should be upfront, separate from research questions
3. ✅ Auto-match organizations by email domain first, then name
4. ✅ evidence_people junction is needed - currently missing link

---

## Ask Link Evidence & Lens Architecture

> **Decision:** Keep responses in `research_link_responses.responses` JSONB, but create evidence records per-question for text answers that need theme clustering. Statistics for likert/select computed directly from JSONB.

### Why This Approach?

| Data Type | Storage | Analysis Method |
|-----------|---------|-----------------|
| **Likert responses** | JSONB | Direct computation (avg, distribution) |
| **Single/Multi select** | JSONB | Direct computation (% breakdown) |
| **Text responses** | JSONB + Evidence | Theme clustering via evidence pipeline |

This avoids creating interview records for survey responses (which don't have transcripts or media) while still enabling the full evidence → theme → insight pipeline for qualitative analysis.

### Survey Evidence Data Flow

```mermaid
flowchart TB
    subgraph Collection["Response Collection"]
        FORM[Form Mode]
        VOICE[Voice Chat via LiveKit]
        TEXT[Text Chat]
    end

    subgraph Storage["Primary Storage"]
        RLR[research_link_responses.responses JSONB]
    end

    subgraph Analysis["Analysis Pipeline"]
        direction TB
        STATS[Stats Computation]
        EVEXT[Evidence Extraction]
    end

    subgraph Evidence["Evidence Pipeline"]
        EV[evidence records]
        EMBED[Embeddings]
        THEME[Theme Clustering]
        LENS[Survey Lens Analysis]
    end

    subgraph Output["Outputs"]
        AGGS[Aggregate Stats UI]
        SEARCH[Semantic Search]
        INS[Insights]
    end

    FORM --> RLR
    VOICE --> RLR
    TEXT --> RLR

    RLR --> STATS
    RLR --> EVEXT

    STATS --> AGGS

    EVEXT -->|"text questions only"| EV
    EV --> EMBED
    EV --> THEME
    EV --> LENS

    EMBED --> SEARCH
    THEME --> INS
    LENS --> INS
```

### Evidence Extraction Rules

```mermaid
flowchart LR
    Q[Question] --> TYPE{Question Type?}

    TYPE -->|likert| SKIP[No Evidence Record]
    TYPE -->|single_select| SKIP
    TYPE -->|multi_select| SKIP
    TYPE -->|short_text| CREATE[Create Evidence]
    TYPE -->|long_text| CREATE
    TYPE -->|auto| INFER{Infer Type}

    INFER -->|numeric| SKIP
    INFER -->|matches options| SKIP
    INFER -->|free text| CREATE

    CREATE --> EVTABLE[evidence table]
    SKIP --> JSONB[Stats from JSONB]
```

### Entity Relationships (Survey Extension)

```mermaid
erDiagram
    research_links ||--o{ research_link_responses : "collects"
    research_link_responses ||--o{ evidence : "generates (text only)"
    research_link_responses }o--|| people : "belongs to"

    research_links {
        uuid id PK
        uuid project_id FK
        text slug UK
        jsonb questions
        boolean allow_video
        boolean allow_voice
    }

    research_link_responses {
        uuid id PK
        uuid research_link_id FK
        uuid person_id FK
        jsonb responses
        boolean completed
        text video_url
    }

    evidence {
        uuid id PK
        uuid interview_id FK "nullable - for interviews"
        uuid research_link_response_id FK "nullable - for surveys"
        text verbatim
        text method
        jsonb anchors
    }

    people {
        uuid id PK
        text firstname
        text lastname
        text email
    }
```

**Key Change:** `evidence` table gets a new nullable FK `research_link_response_id`. Evidence can come from either:
- `interview_id` (traditional interviews/recordings)
- `research_link_response_id` (survey text responses)

Constraint: Exactly one should be set per evidence record.

### Likert Ratings in Search

**Problem:** If likert/select responses don't create evidence records, how do we search them?

**Solution:** Store searchable metadata in a dedicated column on `research_link_responses`:

```sql
-- Add searchable text representation of structured responses
ALTER TABLE research_link_responses ADD COLUMN
  search_text text GENERATED ALWAYS AS (
    -- Computed from responses JSONB for full-text search
    -- E.g., "satisfaction: 4/5, use case: Research & Analysis"
  ) STORED;

CREATE INDEX idx_research_link_responses_search
  ON research_link_responses USING gin(to_tsvector('english', search_text));
```

For semantic search, the person-level embedding already captures their survey responses via the `research_link_responses` → `people` link. The Survey Lens (below) also produces searchable summaries.

### Survey Statistics Lens

A new lens template specifically for aggregate survey analysis:

```mermaid
flowchart TB
    subgraph Input["Input: All Responses for Research Link"]
        R1[Response 1]
        R2[Response 2]
        R3[Response N...]
    end

    subgraph StatLens["Survey Statistics Lens"]
        direction TB
        NUM[Numeric Stats per Question]
        SEL[Select Stats per Question]
        TXT[Text Theme Extraction]
        SYN[Overall Synthesis]
    end

    subgraph Output["Lens Output"]
        NUMOUT["Likert: avg 3.8/5, distribution"]
        SELOUT["Select: 64% Research, 28% Interviews"]
        TXTOUT["Text Themes: speed, reliability, cost"]
        SYNOUT["Key Findings + Recommendations"]
    end

    R1 --> StatLens
    R2 --> StatLens
    R3 --> StatLens

    NUM --> NUMOUT
    SEL --> SELOUT
    TXT --> TXTOUT
    SYN --> SYNOUT
```

**Lens Template Definition:**

```sql
INSERT INTO conversation_lens_templates (
  template_key, template_name, summary, primary_objective,
  category, template_definition, is_active, is_system
) VALUES (
  'survey-statistics',
  'Survey Statistics',
  'Aggregate analysis of survey responses',
  'Surface patterns and insights across multiple survey respondents',
  'research',
  '{
    "sections": [
      {
        "section_key": "numeric_summary",
        "section_name": "Numeric Questions",
        "fields": [
          {"field_key": "question_id", "field_type": "text"},
          {"field_key": "average", "field_type": "numeric"},
          {"field_key": "distribution", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "choice_summary",
        "section_name": "Choice Questions",
        "fields": [
          {"field_key": "question_id", "field_type": "text"},
          {"field_key": "percentages", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "text_themes",
        "section_name": "Open Response Themes",
        "fields": [
          {"field_key": "question_id", "field_type": "text"},
          {"field_key": "themes", "field_type": "text_array"},
          {"field_key": "representative_quotes", "field_type": "text_array"}
        ]
      },
      {
        "section_key": "overall_insights",
        "section_name": "Overall Insights",
        "fields": [
          {"field_key": "key_findings", "field_type": "text_array"},
          {"field_key": "recommendations", "field_type": "text_array"}
        ]
      }
    ],
    "aggregation_mode": "research_link"
  }'::jsonb,
  true, true
);
```

### Survey Respondent Lens (Individual)

For per-person analysis (shown on Person page):

```sql
INSERT INTO conversation_lens_templates (
  template_key, template_name, summary, primary_objective,
  category, template_definition, is_active, is_system
) VALUES (
  'survey-respondent',
  'Survey Respondent Profile',
  'AI summary of a single respondent based on their survey answers',
  'Understand who this person is and what they care about',
  'research',
  '{
    "sections": [
      {
        "section_key": "respondent_summary",
        "section_name": "Respondent Summary",
        "fields": [
          {"field_key": "profile_summary", "field_type": "text"},
          {"field_key": "key_pain_points", "field_type": "text_array"},
          {"field_key": "key_goals", "field_type": "text_array"},
          {"field_key": "notable_quotes", "field_type": "text_array"}
        ]
      }
    ],
    "analysis_mode": "single_response"
  }'::jsonb,
  true, true
);
```

### Lenses on Survey Responses: What Works?

| Lens | Works on Surveys? | Notes |
|------|-------------------|-------|
| Empathy Map | ✅ Yes | Extracts pains/goals from text evidence |
| Research Lens | ✅ Yes | Answers DQs from survey responses |
| Sales BANT | ⚠️ Limited | Only if survey asks budget/timeline questions |
| Survey Statistics | ✅ Yes | **New lens** - aggregate stats + themes |
| Survey Respondent | ✅ Yes | **New lens** - per-person summary |

### Navigation Stack: Forward and Backward

```mermaid
flowchart TB
    subgraph Forward["Forward: Response → Insight"]
        RLR2[research_link_responses]
        EV2[evidence]
        TH2[themes]
        INS2[insights]

        RLR2 -->|"evidence per text Q"| EV2
        EV2 -->|"theme_evidence junction"| TH2
        TH2 -->|"insight_themes junction"| INS2
    end

    subgraph Backward["Backward: Insight → Source"]
        INS3[Insight clicked]
        TH3[Check insight_themes]
        EV3[Find evidence records]
        SRC{evidence.source?}
        INT3[Interview with video/audio]
        RESP3[Survey Q&A display]

        INS3 --> TH3
        TH3 --> EV3
        EV3 --> SRC
        SRC -->|"interview_id set"| INT3
        SRC -->|"research_link_response_id set"| RESP3
    end
```

**UI Implication:** When displaying evidence, check which FK is set:
- `interview_id` → Show video clip with timestamp seek
- `research_link_response_id` → Show Q&A card with question + answer

### Voice Chat via LiveKit

**Confirmed:** Voice chat responses are stored identically to form responses.
- `saveResearchResponseTool` saves each answer to `research_link_responses.responses` JSONB
- No audio is stored for chat mode - only transcribed text
- Same evidence extraction path as form submissions

### Implementation Phases

#### Phase 1: Evidence Per-Question (Foundation)
1. Add `research_link_response_id` FK to evidence table
2. Update completion handler to create evidence per text question
3. Link evidence to person via `evidence_people` junction
4. Update Person page to display survey evidence properly

#### Phase 2: Survey Statistics Lens
1. Create `survey-statistics` lens template in DB
2. Build stats computation (runs directly on JSONB)
3. Build text theme extraction (via BAML on evidence)
4. Store results in `conversation_lens_analyses`
5. Show lens results on Ask responses page

#### Phase 3: Survey Respondent Lens
1. Create `survey-respondent` lens template
2. Build BAML function for single-response profiling
3. Trigger on response completion
4. Show on Person page under their survey responses

#### Phase 4: Full Integration
1. Theme clustering includes survey text evidence
2. Insights can cite survey evidence with proper display
3. Project dashboard shows survey-derived insights
4. Cross-source analysis (interviews + surveys together)

### Evidence Extraction Code

```typescript
async function extractSurveyEvidence({
  responseId,
  questions,
  responses,
  personId,
  accountId,
  projectId,
}: SurveyEvidenceParams): Promise<string[]> {
  const evidenceIds: string[] = [];

  for (const question of questions) {
    const answer = responses[question.id];
    if (!answer) continue;

    // Skip structural responses - stats computed from JSONB
    if (['likert', 'single_select', 'multi_select', 'image_select'].includes(question.type)) {
      continue;
    }

    // Text responses → evidence records for theme clustering
    const { data: evidence } = await supabase
      .from('evidence')
      .insert({
        account_id: accountId,
        project_id: projectId,
        research_link_response_id: responseId,
        method: 'survey',
        modality: 'qual',
        verbatim: `${question.prompt}\n\n"${String(answer)}"`,
        context_summary: `Survey response to: ${question.prompt}`,
        anchors: [{
          type: 'survey_question',
          question_id: question.id,
          question_index: questions.indexOf(question),
        }],
      })
      .select('id')
      .single();

    if (evidence) {
      evidenceIds.push(evidence.id);

      // Link to person
      await supabase.from('evidence_people').insert({
        evidence_id: evidence.id,
        person_id: personId,
        account_id: accountId,
        project_id: projectId,
        role: 'respondent',
      });
    }
  }

  return evidenceIds;
}
```

### Theme Extraction: Per-Question AND Overall

Text analysis produces themes at two levels:

1. **Per-question themes:** "Q3 themes: speed, reliability, cost"
2. **Overall synthesis:** "Across all questions, users want faster, cheaper solutions"

Both are captured in the Survey Statistics Lens output.
