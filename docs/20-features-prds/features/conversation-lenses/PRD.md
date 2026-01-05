# Conversation Lenses - Product Requirements Document

## Overview

Conversation Lenses enables users to apply structured analytical frameworks ("lenses") to interview conversations, extracting specific insights like sales qualification data, customer research findings, product feedback, and more.

## Problem Statement

Users need to quickly extract actionable insights from interview conversations without manually reviewing transcripts. Different use cases (sales calls, user research, product feedback) require different analytical frameworks.

## Target Users

| User | Need |
|------|------|
| **Sales Teams** | Qualify leads and track deal progression |
| **Product Managers** | Understand user needs, pain points, and feature requests |
| **UX Researchers** | Extract behavioral patterns and user journey insights |
| **Customer Success** | Identify satisfaction signals and escalation risks |

---

## Features & User Flows

This section consolidates all major features and their associated user flows.

### Feature 1: Interview Lens Analysis

Apply and view lens analyses on individual interviews.

**Route:** `/a/:accountId/:projectId/interviews/:interviewId` (Lenses tab)

#### Flow 1.1: View Analyzed Interview

**Trigger:** User opens an interview that has already been analyzed

**Steps:**
1. User navigates to interview detail page
2. System displays conversation lenses section with tabs for each lens type
3. User clicks a tab (e.g., "Sales BANT", "Customer Discovery", "Product Feedback")
4. System shows the extracted data for that lens
5. User sees:
   - Structured fields with extracted values
   - Confidence scores for each extraction
   - **Clickable evidence timestamps** linking to exact points in recording
   - Recommendations/next steps

**Acceptance Criteria:**
- [ ] All completed lens analyses appear as tabs
- [ ] Each tab shows status icon (complete, processing, failed, pending)
- [ ] Evidence timestamps are clickable and navigate to media playback
- [ ] Timestamp format: MM:SS (e.g., "12:45")
- [ ] Fields display with proper formatting by type (text, array, boolean, numeric, date)

#### Flow 1.2: Apply Lens to Interview

**Trigger:** User wants to analyze an interview with a specific lens

**Steps:**
1. User opens interview without lens analysis
2. User sees lens selector dropdown
3. User selects a lens template (e.g., "Sales BANT")
4. User clicks "Apply" button
5. System queues lens analysis
6. Tab shows "Processing" status with spinner
7. When complete, tab shows green checkmark and analysis is visible

**Acceptance Criteria:**
- [ ] Dropdown shows all available lens templates grouped by category
- [ ] Already-applied lenses show "Done" badge and are disabled
- [ ] "Apply All" button triggers all enabled project lenses
- [ ] Status updates in real-time (polling or webhooks)

#### Flow 1.3: Edit Lens Field Values

**Trigger:** User wants to correct or supplement AI-extracted data

**Steps:**
1. User views a lens analysis
2. User clicks on any text field value
3. Field becomes editable (inline edit mode)
4. User modifies the value
5. User clicks away or presses Enter
6. System saves the updated value
7. Original AI confidence indicator updates to show "edited"

**Acceptance Criteria:**
- [ ] Text fields are editable via inline edit
- [ ] Changes save immediately on blur
- [ ] Visual feedback shows save in progress
- [ ] Edited fields are distinguishable from AI-extracted values

#### Flow 1.4: Navigate to Evidence

**Trigger:** User wants to see/hear the source of an extraction

**Steps:**
1. User sees a field with evidence timestamp badges
2. User clicks on a timestamp badge (e.g., "12:45")
3. System navigates to evidence detail page with `?t=765` parameter
4. Media player starts at that timestamp
5. User can see the transcript context and hear the audio/video

**Acceptance Criteria:**
- [ ] Timestamp badges are styled consistently
- [ ] Clicking opens evidence in same tab or new tab (configurable)
- [ ] Media player auto-seeks to the timestamp
- [ ] Transcript highlights the relevant portion

---

### Feature 2: Project Lens Dashboard (Aggregated Views)

View consolidated insights across all interviews in a project.

**Route:** `/a/:accountId/:projectId/lenses` (Project sidebar item)

#### Flow 2.1: View Aggregated Lens Analysis

**Trigger:** User wants to see consolidated insights across project interviews

**Steps:**
1. User navigates to Project → Lenses (sidebar item)
2. System shows lens type selector (Sales BANT, Empathy Map, etc.)
3. User selects a lens type
4. System displays aggregated view:
   - **Hero section**: AI-synthesized key takeaways (2-3 bullets)
   - **Metrics cards**: Quick stats with trend indicators
   - **Detailed sections**: Expandable panels with clustered data
   - **Interview list**: Table of all interviews with lens status
5. User clicks on a metric/insight
6. System shows evidence drawer with source interviews and timestamps
7. User clicks interview row
8. System navigates to interview lens detail

**Acceptance Criteria:**
- [ ] Aggregation page accessible from project sidebar
- [ ] AI synthesis runs on page load (or cached with refresh button)
- [ ] Conflicts/discrepancies are highlighted visually
- [ ] Every insight links back to source interview(s) and evidence
- [ ] Loading states for aggregation computation
- [ ] Empty state when no interviews have lens applied

#### Flow 2.2: Drill Down from Aggregation to Interview

**Trigger:** User sees an aggregated insight and wants to explore the source

**Steps:**
1. User views aggregated lens page
2. User clicks on a specific metric, cluster, or insight
3. System shows evidence drawer with:
   - List of contributing interviews
   - Relevant quotes/timestamps from each
   - Confidence indicators
4. User clicks on an interview
5. System navigates to that interview's lens detail tab

**Acceptance Criteria:**
- [ ] Evidence drawer shows all contributing sources
- [ ] Each source links to specific interview + timestamp
- [ ] Drawer can be dismissed to return to aggregation
- [ ] Navigation preserves context (back button returns to aggregation)

---

### Feature 3: Lens Library & Project Settings

Manage available lenses and configure which run automatically.

**Route:** `/a/:accountId/:projectId/lenses/library` (Settings tab within Lenses)

#### Flow 3.1: Configure Project Lens Defaults

**Trigger:** User wants to change which lenses are enabled for their project

**Steps:**
1. User navigates to Project → Lenses → Library/Settings
2. System shows all available lens templates grouped by category
3. Each lens shows:
   - Toggle (enabled/disabled)
   - Name and description
   - Estimated cost per interview
4. User toggles lenses on/off
5. System updates estimated cost per interview
6. User sees "Apply to existing interviews" checkbox with:
   - Count of existing interviews
   - Estimated total cost for backfill
7. User clicks "Save Changes"
8. System saves project settings
9. If "Apply to existing" checked:
   - System queues background job to apply lenses
   - Toast shows progress: "Applying lenses to 23 interviews..."

**Acceptance Criteria:**
- [ ] Settings page shows all lens templates grouped by category
- [ ] Toggles reflect current project settings
- [ ] Cost estimates update in real-time as toggles change
- [ ] "Apply to existing" shows accurate interview count
- [ ] Save triggers immediate settings update
- [ ] Backfill job runs asynchronously with progress tracking
- [ ] New interviews automatically use saved settings

#### Flow 3.2: New Interview Auto-Analysis

**Trigger:** User uploads new interview to project with lens defaults configured

**Steps:**

1. User uploads/records new interview
2. Interview processing completes (transcription, evidence extraction)
3. System checks project lens settings
4. For each enabled lens:
   - System queues lens analysis
   - Analysis runs automatically
5. User views interview
6. All enabled lenses show as "Completed" in tabs

**Acceptance Criteria:**

- [ ] Lens analysis starts automatically after interview processing
- [ ] Only enabled lenses are applied (not all available)
- [ ] User doesn't need to manually trigger analysis
- [ ] If all lenses disabled, no auto-analysis occurs

---

### Feature 4: AI Auto-Lens Selection

Automatically detect content type and apply the most relevant lenses.

#### Flow 4.1: Smart Content Detection & Lens Selection

**Trigger:** User uploads content without specifying type (or with "auto-detect" selected)

**Steps:**

1. User uploads content (audio, video, document, or pastes transcript)
2. User optionally specifies content type, or leaves as "Auto-detect"
3. System processes content:
   - For audio/video: Transcription runs first
   - For documents: Text extraction runs
4. AI analyzes first ~2000 tokens to detect:
   - **Content type** (sales call, internal meeting, voice memo, etc.)
   - **Participants** (customer vs internal, roles)
   - **Topic signals** (competitive mentions, HR language, product feedback, etc.)
5. System matches detected signals to lens `content_types` and `auto_apply_rules`
6. System applies matching lenses (filtered by project's enabled lenses)
7. User sees:
   - Detected content type badge on interview
   - Applied lenses with "Auto-selected" indicator
   - Option to override and apply additional lenses

**Acceptance Criteria:**

- [ ] Content type detection runs before lens selection
- [ ] Detection confidence shown to user (high/medium/low)
- [ ] User can override detected type
- [ ] Only project-enabled lenses are auto-applied
- [ ] Fallback to "General" lens if no strong match

#### Flow 4.2: Document Upload & Analysis

**Trigger:** User uploads a document (PDF, DOCX, spreadsheet, etc.)

**Steps:**

1. User uploads document to project
2. System extracts text content
3. AI detects document type:
   - Competitive matrix → Competitive Analysis lens
   - Analyst report → Market Research lens
   - Meeting notes → Meeting Summary lens
   - Product spec → Product Insights lens
4. System applies matching lenses
5. User views document with lens analysis sidebar

**Acceptance Criteria:**

- [ ] Supports PDF, DOCX, XLSX, PPTX, TXT, MD formats
- [ ] Document preview available alongside lens results
- [ ] Page/section references link to source location
- [ ] Large documents chunked for analysis (token limits)

#### Flow 4.3: Voice Memo Quick Capture

**Trigger:** User records or uploads a quick voice memo

**Steps:**

1. User records voice memo (mobile or desktop)
2. System transcribes audio
3. AI detects memo type:
   - Field observation → Empathy Map lens
   - Idea/brainstorm → Ideas Capture lens
   - Competitive note → Competitive Analysis lens
   - Action items → Meeting Summary lens
4. System applies lightweight lens (faster, fewer fields)
5. User sees quick summary card with key extractions

**Acceptance Criteria:**

- [ ] Voice memos process faster than full interviews (<30 sec)
- [ ] Lightweight lens variants for short content
- [ ] Quick capture UI optimized for mobile
- [ ] Tags auto-generated from content

---

## Data Model

### Lens Template

- `template_key`: Unique identifier (e.g., "sales-bant")
- `template_name`: Display name (e.g., "Sales BANT")
- `category`: Category for grouping (e.g., "sales", "research", "product")
- `content_types`: Array of content types this lens applies to (see Content Types below)
- `source_types`: Array of source types this lens applies to (see Source Types below)
- `template_definition`: JSON defining sections, fields, and field types
- `display_order`: Sort order in UI
- `auto_apply_rules`: Optional JSON for AI auto-selection logic (keywords, patterns)

### Content Types

Defines what kind of conversation or content the lens is designed to analyze:

| Type | Description | Example Use Cases |
|------|-------------|-------------------|
| `customer_interview` | External user/customer research | Discovery calls, user testing, feedback sessions |
| `sales_call` | Sales/BD conversations | Discovery, demo, negotiation calls |
| `internal_meeting` | Team discussions | Strategy sessions, reviews, planning |
| `voice_memo` | Quick personal recordings | Ideas, observations, field notes |
| `employee_review` | HR/performance conversations | 1:1s, performance reviews, feedback |
| `competitive_intel` | Market/competitor analysis | Win/loss calls, competitive research |
| `document` | Uploaded files (non-audio) | Reports, decks, matrices |

### Source Types

Defines the input format:

| Type | Description |
|------|-------------|
| `audio` | Recorded audio (interviews, calls, voice memos) |
| `video` | Recorded video |
| `transcript` | Text transcript (pasted or imported) |
| `document` | Uploaded document (PDF, DOCX, etc.) |
| `live` | Real-time transcription |

### Lens Analysis

- `interview_id`: Interview being analyzed
- `template_key`: Which lens template was used
- `detected_content_type`: AI-detected content type (may differ from user-specified)
- `analysis_data`: JSON containing extracted sections, fields, entities, recommendations
- `confidence_score`: Overall confidence (0.0-1.0)
- `status`: pending | processing | completed | failed

### Field Types

- `text`: Single text value (editable)
- `text_array`: List of text values
- `numeric`: Number value
- `boolean`: Yes/No value
- `date`: Date value

### Lens-to-Content Mapping (System Defaults)

| Lens | Content Types | Source Types |
|------|---------------|---------------|
| **Sales BANT** | `sales_call`, `customer_interview` | `audio`, `video`, `transcript` |
| **Project Research** | `customer_interview`, `internal_meeting` | `audio`, `video`, `transcript` |
| **Empathy Map / JTBD** | `customer_interview`, `voice_memo` | `audio`, `video`, `transcript` |
| **Competitive Analysis** | `competitive_intel`, `sales_call` | `audio`, `video`, `transcript`, `document` |
| **Meeting Summary** | `internal_meeting`, `employee_review` | `audio`, `video`, `transcript` |
| **Document Insights** | `document`, `competitive_intel` | `document` |

---

## UI Components

### LensTabs
- Tabbed interface for switching between lens analyses
- Status indicators per tab
- Template name and category badge

### GenericLensView
- Renders any lens based on template definition
- Supports all field types
- Inline editing for text fields
- Evidence timestamp badges

### EvidenceTimestampBadges
- Reusable component for displaying clickable timestamps
- Formats MM:SS
- Links to evidence detail with `?t=` parameter

### LensSelector
- Dropdown for selecting lens to apply
- "Apply" and "Apply All" buttons
- Status badges for processing/complete

---

## Success Metrics

1. **Lens Adoption**: % of interviews with at least one lens applied
2. **Completion Rate**: % of triggered lenses that complete successfully
3. **Edit Rate**: % of lens fields edited by users (indicates AI accuracy)
4. **Evidence Navigation**: Click-through rate on evidence timestamps
5. **Time to Insight**: Time from interview upload to first lens result

---

## User Stories

### Story 1: Sales Pipeline Qualitative View

**As a sales manager**, I want to see a qualitative pipeline summary across discovery calls
**So that** I can understand the number and quality of opportunities from what customers are actually saying (not just deal values)

**Actions I'll take:**

- Identify high-intent prospects to prioritize
- Find patterns: "Seek more customers like X"
- Surface common blockers to address in sales materials
- Feed qualified opportunities into CRM Pipeline (financial view)

**Relationship to CRM Pipeline:**

- Lens aggregation = *qualitative* view (what customers said, pain severity, readiness signals)
- CRM Pipeline = *quantitative* view (deal value, stage, probability)
- Combined: Dashboard shows both views side-by-side or linked

### Story 2: Product Pain/Feature Prioritization

**As a product manager**, I want to see clustered pains and goals across user segments
**So that** I can identify which features are most likely to create valuable, paying users

**Actions I'll take:**

- Identify top pains to develop features for
- Understand segment-specific needs (Enterprise vs SMB)
- Create Tasks in the Priority List for feature work
- Track progress: "We addressed 3 of the top 5 pains this quarter"

### Story 3: Research Question Tracking

**As a researcher**, I want to see which decision questions have been answered across interviews
**So that** I can identify research gaps and know when we have enough evidence to decide

**Actions I'll take:**

- Mark questions as "answered with confidence"
- Identify questions needing more interviews
- Share findings with stakeholders with evidence links

### Story 4: Dashboard as Home Base

**As a project member**, I want the Dashboard to show lens results and key insights at a glance
**So that** I immediately see what's new and important without digging through interviews

**What I see:**

- Top insights from recent lenses (Pains/Goals always shown)
- Pipeline summary (qualitative + link to CRM)
- Unanswered questions / research gaps
- Recent activity feed

**Actions available:**

- Configure which lenses are active
- Add project context (goals, decision questions)
- Dive into specific lens results
- Quick-add interview

**Empty state (no lens analyses yet):**

- Still shows basic extractions (evidence, people, topics)
- Key Insights from evidence (AI-generated)
- Pains/Goals extracted (default lens, always runs)
- Prompt: "Add your first interview to see lens insights"

### Story 5: Configure Project Lenses

**As a project owner**, I want to choose which lenses run on my conversations
**So that** I only see frameworks relevant to my use case (sales vs research vs product)

**Actions I'll take:**

- Enable/disable lenses per project
- Apply changes to existing interviews (backfill)
- Set project defaults once, forget about it

---

## Appendix A: Aggregation Logic by Lens Type

### Sales BANT Aggregation

| Metric | Aggregation Method | Display |
|--------|-------------------|---------|
| **Pipeline Summary** | Count interviews by qualification status | Cards: Qualified / Pending / Disqualified |
| **Budget Range** | AI synthesis with min/max/consensus | "Budget: $50K-$200K (consensus: $100K)" |
| **Common Blockers** | Cluster similar blockers, count frequency | Ranked list with interview count |
| **Timeline Distribution** | Group by timeframe buckets | Bar chart or list |
| **Stakeholder Map** | Dedupe by person, aggregate influence | Table with influence scores |

**Conflict Resolution Example:**

```text
Budget
├── AI Consensus: "$100K annual" (confidence: 75%)
├── Range: $50K - $200K across 5 interviews
└── Discrepancy: Interview #3 mentioned "no budget" - review recommended
    └── [Click to view evidence]
```

### Empathy Map / JTBD Aggregation

| Metric | Aggregation Method | Display |
|--------|-------------------|---------|
| **Pains by Segment** | Cluster similar pains, group by user type | Matrix: Pain × Segment with frequency |
| **Gains by Segment** | Cluster similar gains, group by user type | Matrix: Gain × Segment with frequency |
| **Jobs to be Done** | Dedupe similar jobs, rank by frequency | Ranked list with evidence count |
| **Emotional Themes** | AI clustering of feelings | Word cloud or themed cards |

**Clustering Example:**

```text
Top Pains (across 12 interviews)
├── "Manual data entry" (8 mentions, 3 segments)
│   ├── Enterprise PM: 4 mentions [view evidence]
│   ├── SMB Designer: 3 mentions [view evidence]
│   └── Freelancer: 1 mention [view evidence]
├── "Lack of collaboration" (6 mentions, 2 segments)
└── "Reporting limitations" (5 mentions, 2 segments)
```

### Project Research Aggregation

| Metric | Aggregation Method | Display |
|--------|-------------------|---------|
| **Decision Questions** | Track answer status per question | Checklist: Answered / Partial / Unanswered |
| **Research Questions** | Track evidence coverage | Progress bars per question |
| **Confidence Rollup** | Average confidence by question | Color-coded confidence indicators |
| **Unknowns Status** | Track resolution across interviews | List: Resolved / Open / Needs follow-up |

**Question Tracking Example:**

```text
Decision Questions
├── ✅ "What pricing model should we use?"
│   ├── Consensus: "Freemium with premium features"
│   ├── Confidence: 82% (based on 6 interviews)
│   └── [3 supporting findings] [1 contradicting]
├── 🟡 "Who is our primary buyer persona?"
│   ├── Status: Partial answer
│   ├── Confidence: 45% (based on 2 interviews)
│   └── Recommendation: "Need 3+ more interviews with enterprise buyers"
└── ❌ "What's the competitive moat?"
    ├── Status: Not yet answered
    └── 0 relevant evidence found
```

---

## Appendix B: Lens Consolidation Recommendation

Current 6 lenses have some overlap. Recommended simplification:

| Current | Recommendation | Rationale |
|---------|---------------|-----------|
| **Sales BANT** | Keep, add Opportunity extraction | Feeds into CRM Pipeline |
| **Project Research** | Keep | Unique: answers decision/research questions |
| **Empathy Map/JTBD** | Keep as default | Pains/Goals always valuable |
| **Customer Discovery** | Merge into Product Insights | Problem/solution validation overlaps |
| **User Testing** | Merge into Product Insights | Usability feedback overlaps |
| **Product Insights** | Expand to include Discovery + Testing | Single "Product" lens |

**Simplified set (4 lenses):**

1. **Sales** - BANT + Opportunities + Stakeholders
2. **Research** - Goal/DQ/RQ answers + Unknowns
3. **Empathy** - Pains/Goals + JTBD (default, always runs)
4. **Product** - Feature requests + Gaps + Usability + Competitive

---

## Appendix C: AI Auto-Selection Logic

### Content Type Detection

The system uses a lightweight classifier on the first ~2000 tokens to detect content type:

```typescript
interface ContentDetectionResult {
  content_type: ContentType
  confidence: 'high' | 'medium' | 'low'
  signals: string[]  // Evidence for the classification
  suggested_lenses: string[]
}

// Detection signals by content type
const CONTENT_TYPE_SIGNALS: Record<ContentType, string[]> = {
  sales_call: [
    'pricing', 'budget', 'decision maker', 'timeline', 'competitor',
    'demo', 'proposal', 'contract', 'deal', 'close'
  ],
  customer_interview: [
    'tell me about', 'how do you', 'what challenges', 'walk me through',
    'user research', 'feedback', 'experience'
  ],
  internal_meeting: [
    'team', 'sprint', 'roadmap', 'quarterly', 'OKR', 'standup',
    'sync', 'review', 'planning', 'retrospective'
  ],
  voice_memo: [
    'note to self', 'quick thought', 'reminder', 'idea',
    // Also detected by: short duration (<5 min), single speaker
  ],
  employee_review: [
    'performance', 'goals', 'feedback', 'growth', 'compensation',
    '1:1', 'career', 'development', 'promotion'
  ],
  competitive_intel: [
    'competitor', 'market', 'positioning', 'win/loss', 'alternative',
    'switched from', 'compared to', 'versus'
  ],
  document: [
    // Detected by source_type, not content signals
  ]
}
```

### Lens Selection Algorithm

```typescript
function selectLenses(
  detectedType: ContentType,
  sourceType: SourceType,
  projectEnabledLenses: string[]
): string[] {
  // 1. Get all lenses matching content_type AND source_type
  const matchingLenses = ALL_LENSES.filter(lens =>
    lens.content_types.includes(detectedType) &&
    lens.source_types.includes(sourceType)
  )

  // 2. Filter to only project-enabled lenses
  const enabledMatches = matchingLenses.filter(lens =>
    projectEnabledLenses.includes(lens.template_key)
  )

  // 3. Sort by relevance (primary content_type match first)
  enabledMatches.sort((a, b) => {
    const aIsPrimary = a.content_types[0] === detectedType
    const bIsPrimary = b.content_types[0] === detectedType
    return bIsPrimary - aIsPrimary
  })

  // 4. Apply auto_apply_rules for additional filtering
  return enabledMatches.filter(lens => {
    if (!lens.auto_apply_rules) return true
    return evaluateAutoApplyRules(lens.auto_apply_rules, transcript)
  })
}
```

### Example Auto-Apply Rules

```json
{
  "template_key": "sales-bant",
  "auto_apply_rules": {
    "require_any": ["budget", "timeline", "decision"],
    "exclude_if": ["internal only", "team sync"],
    "min_duration_minutes": 10,
    "min_speakers": 2
  }
}
```

---

## Appendix D: Settings UI Mockup

```text
Project Settings → Conversation Lenses
┌─────────────────────────────────────────────────────────────┐
│ Lens Activation Settings                                     │
│                                                              │
│ Enable lenses to automatically apply to new conversations.   │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Sales                                                    │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │ [✓] Sales BANT                              ~$0.02/int││ │
│ │ │     Budget, Authority, Need, Timeline qualification  ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Research                                                 │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │ [✓] Project Research                        ~$0.03/int││ │
│ │ │     Answer decision questions, track unknowns        ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Product                                                  │ │
│ │ ┌──────────────────────────────────────────────────────┐│ │
│ │ │ [✓] Empathy Map / JTBD                      ~$0.03/int││ │
│ │ │     Says, Thinks, Does, Feels + Jobs to be Done       ││ │
│ │ └──────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Estimated cost per interview: ~$0.08                         │
│ (3 lenses enabled × ~$0.03 avg)                              │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [x] Apply to existing interviews (23 interviews)        │ │
│ │     Estimated cost: ~$1.84                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Save Changes]                                    [Cancel]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix D: Visual Hierarchy

```text
Project Dashboard
└── Lens Aggregation Page (e.g., "/a/:accountId/:projectId/lenses/sales-bant")
    ├── Summary Cards (key metrics, AI takeaways)
    │   ├── "Pipeline: 5 qualified, 2 pending, 1 disqualified"
    │   ├── "Top Blocker: Budget constraints (mentioned in 4/8 calls)"
    │   └── "Avg Timeline: 2-4 weeks"
    ├── Detailed Sections (expandable)
    │   ├── BANT Breakdown Table
    │   │   └── Row per interview with status indicators
    │   ├── Common Blockers (clustered)
    │   │   └── Each blocker → linked evidence from multiple interviews
    │   └── Stakeholder Map (aggregated)
    └── Drill-down to Interview
        └── Click any row → opens interview lens detail
```

---

## Implementation Phases

### Phase 1: Lens Activation Settings ✅ COMPLETE
- [x] Use existing `project_settings.enabled_lenses` (no new table needed)
- [x] Build settings UI in Lens Library (Settings tab)
- [x] Wire up toggles to save enabled lenses
- [x] Update `applyAllLenses` to check project settings
- [x] Implement backfill trigger for existing interviews
- [x] Implement lens defaults hierarchy (project → account → platform)

### Phase 2: Aggregated Lens Views - Sales BANT (2-3 days)
- [ ] Create project lenses route and page
- [ ] Build Sales BANT aggregation logic
- [ ] Implement AI synthesis for consensus views
- [ ] Build summary cards and metrics UI
- [ ] Add drill-down to evidence

### Phase 3: Aggregated Lens Views - Research & Empathy (2-3 days)
- [ ] Build Project Research aggregation (question tracking)
- [ ] Build Empathy Map aggregation (pain/gain clustering)
- [ ] Implement segment-based grouping
- [ ] Add confidence rollup visualization

### Phase 4: Cost Tracking & Polish (1 day)

- [ ] Create `lens_usage_log` table
- [ ] Log usage on each lens application
- [ ] Show cost estimates in settings UI
- [ ] Add usage reporting endpoint

### Phase 5: AI Auto-Lens Selection (2-3 days)

- [ ] Add `content_types` and `source_types` columns to lens templates
- [ ] Build content type detection classifier (BAML function)
- [ ] Implement lens selection algorithm based on detected type
- [ ] Add "Auto-detect" option to upload flow
- [ ] Show detected type badge on interviews
- [ ] Allow user override of detected type

### Phase 6: Document & Voice Memo Support (3-4 days)

- [ ] Add document text extraction (PDF, DOCX, XLSX, PPTX)
- [ ] Create document-specific lenses (Competitive Analysis, Market Research)
- [ ] Build document preview UI with lens sidebar
- [ ] Implement voice memo quick capture flow
- [ ] Create lightweight lens variants for short content
- [ ] Mobile-optimized voice memo UI

---

## Future Enhancements (v2+)

### Custom Lenses Data Model

When implementing custom lenses, use this simple architecture:

**System Lenses** (current)
- Owned by: Platform
- Activation: Per-project in `project_settings.enabled_lenses`
- Runs for: Everyone in project

**Custom Lenses** (future)
- Created by: Individual users
- Default scope: **Personal** - automatically runs on interviews created by the lens creator
- To share: Add custom lens key to `project_settings.enabled_lenses` (same pattern as system lenses)

```sql
-- Custom lens templates (just the definition, no activation table needed)
CREATE TABLE custom_lens_templates (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES accounts,
  created_by uuid REFERENCES auth.users,
  template_key text UNIQUE,
  template_name text,
  template_definition jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Processing Logic (in applyAllLenses):**
1. Get project-wide lenses from `project_settings.enabled_lenses` (system + shared custom)
2. Get personal custom lenses: `WHERE created_by = interview.created_by`
3. Apply union of all enabled lenses

**Why no lens_activations table?**
- Personal lenses: Just check `created_by = interview.created_by` at runtime
- Shared lenses: Add to `project_settings.enabled_lenses` like system lenses
- One pattern, no extra table, simpler queries

### Other Future Features

1. **Feed/Subscriptions**: Subscribe to lens outputs with hashtag filtering
2. **Slack/Email Alerts**: Notify when high-priority insights are extracted
3. **Cross-Project Aggregation**: Aggregate lenses across multiple projects
4. **Trend Analysis**: Show how metrics change over time
