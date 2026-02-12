# Survey Campaigns - Redesign Summary
**Date:** February 12, 2026
**Based on:** Rick's feedback after dinner review

---

## 🎯 Major Concept Shifts

### 1. From "Surveys" to "Survey Campaigns"

**OLD THINKING:** Generate personalized surveys one-off
**NEW THINKING:** Smart campaign management with strategy-based recipient selection

**Key Changes:**
- Campaigns have a **strategy** (pricing validation, sparse data discovery, theme validation)
- AI recommends people based on strategy
- Campaign-level completion tracking and metrics
- User builds campaign by adding people from multiple sources

---

## 📋 Your Feedback & Our Response

### ✅ FEEDBACK 1: "Add to Survey Campaign" Button

**What you said:**
> "We already have a button that says send survey. Maybe that button should say add to survey campaign. That's all the user has to do. And then they build up a list essentially of a few people."

**Solution:**
1. Person detail page: **"Add to Campaign"** button (replaces/augments "Send Survey")
2. ICP lists: Multi-select + bulk **"Add to Campaign"**
3. Builds up a draft campaign list before generation

**Database support:**
- New `personalized_surveys` table tracks each person + their survey
- Status flow: `draft` → `approved` → `sent` → `opened` → `completed`

---

### ✅ FEEDBACK 2: AI-Recommended People Selection

**What you said:**
> "I also think that the step one select people could be smarter, just have the AI recommend who to include in the survey. Strategies might include who would be good to answer pricing questions, or pick people with very little evidence that we need more info on."

**Solution:**
New RPC function: `get_campaign_recommendations(account_id, project_id, strategy, limit)`

**Strategies implemented:**

1. **`pricing_validation`**
   - High ICP matches (score >= 0.5)
   - Sorted by ICP score
   - Reason: "Strong ICP match - valuable for pricing validation"

2. **`sparse_data_discovery`**
   - People with < 3 evidence pieces
   - High ICP + Low evidence = High priority
   - Reason: "No evidence yet - great for discovery"

3. **`theme_validation`**
   - People related to themes needing validation
   - (Future: can filter by theme_id)

4. **`general_research`**
   - Balanced scoring: ICP + evidence gaps
   - Default fallback

**UI Flow:**
1. User clicks "New Campaign"
2. Selects strategy from dropdown
3. AI shows recommended people with scores + reasons
4. User can accept all, cherry-pick, or manually add more

---

### ✅ FEEDBACK 3: Quick View UI Tweaks

**What you said:**
> "Survey goal should be closer to name. Questions/estimated time on a separate line below. More space between goal and questions/time."

**Implemented:**
```
┌─────────────────────────────────────┐
│ Sarah Chen                          │ ← Name
│ Pricing Validation                  │ ← Goal (close to name)
│                                     │
│ 5 questions • ~8 min               │ ← Questions/time (separate line, spaced)
│                                     │
│ [Question cards with rationale...]  │
└─────────────────────────────────────┘
```

---

### ✅ FEEDBACK 4: No Manual Link Generation

**What you said:**
> "I don't think the user needs to be involved in that. Generating the personalized links."

**Solution:**
- Links auto-generated when surveys approved
- CSV export happens in ONE click: **"Export Campaign Links"**
- No intermediate "Generate Links" step

---

### ✅ FEEDBACK 5: Campaign Summary Page

**What you said:**
> "Probably need a campaign summary. A campaign summary page that has the links to all these emails, the previews, and the completion rate."

**New Page:** `/campaigns/:campaignId/summary`

**Shows:**
- **Campaign Stats Card:**
  - Total sent: 10
  - Opened: 7 (70%)
  - Completed: 5 (50% completion rate)
  - Avg evidence per response: 3.2
  - Total evidence extracted: 16 pieces

- **Recipient List Table** (1 per row):
  - Name | Email | Status | Questions Preview | Evidence Count | Actions

- **Campaign Timeline:**
  - Created: Feb 11, 2026
  - First sent: Feb 11, 2026
  - Last completed: Feb 12, 2026

- **Quick Actions:**
  - Re-export CSV
  - Send reminders (future)
  - Pause/Resume campaign

**Database support:**
- New RPC: `get_campaign_stats(research_link_id)` returns all metrics
- Real-time status updates via polling or webhook

---

### ✅ FEEDBACK 6: Evidence Extraction - Multiple Pieces Per Answer

**What you said:**
> "There could be multiple points of evidence from a single answer, right? Depending how long the answer is. Does our evidence schema properly handle that?"

**Current State:**
- ✅ YES! Evidence schema already supports multiple records per `research_link_response_id`
- ❌ BUT: Current code creates only ONE evidence per question

**Updated BAML:**
- New `ExtractEvidenceFromAnswer` function extracts **1-5 pieces per answer**
- Uses GPT-4 (more capable than GPT-4-mini)
- Comprehensive prompt with examples showing multi-evidence extraction
- Returns `ExtractedEvidence[]` with:
  - `gist` (12-word max)
  - `verbatim` (exact quote, never paraphrased)
  - `context_summary` (why it matters)
  - `confidence` (0-1 score)
  - Empathy map facets (`says`, `thinks`, `feels`, `pains`, `gains`)
  - `theme_matches` (for auto-linking)

**Auto-accept threshold:** confidence >= 0.6 (same as interviews)

---

### ✅ FEEDBACK 7: Timeline Display Improvements

**What you said:**
> "I don't care about completed check mark, obviously. The three evidence pieces extracted, but I don't know if they care like what were they, are there a synopsis? Can you get the gist of what came back from the evidence if that's possible. Show a couple like the first four."

**New Timeline Event Component:**

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Survey Completed                                     │
│ Feb 12, 2026 at 3:45 PM                                │
│                                                          │
│ ✨ 4 evidence pieces extracted:                         │
│                                                          │
│ 1. "Spends 3-4 hrs/week manually tagging notes"        │ ← Gist
│    🔗 Workflow • High confidence                        │
│                                                          │
│ 2. "Email surveys get ~10% response rate"              │
│    🔗 Pain • High confidence                            │
│                                                          │
│ 3. "Pricing feedback often vague without details"      │
│    🔗 Pain • Medium confidence                          │
│                                                          │
│ 4. "Considering live pricing walkthroughs"             │
│    🔗 Goal • Medium confidence                          │
│                                                          │
│ [View Full Survey Response] [View All Evidence]        │
└─────────────────────────────────────────────────────────┘
```

**Shows:**
- First 4 evidence gists (max)
- Category + confidence for each
- Link to full response + all evidence

---

### ✅ FEEDBACK 8: Survey List Redesign

**What you said:**
> "We have cards in there right now for the different surveys. That are two columns. Is that the right format or should we redesign the layout? It's got a little more. It's like one per row maybe."

**New Layout:** 1 card per row (not 2-column grid)

**Rationale:**
- Campaign-level data needs more horizontal space
- Completion metrics, evidence counts, recipient list previews
- Expandable rows for recipient details

**Card Structure:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 Pricing Validation Campaign                    [Draft ▾] [...] │
│ Validate pricing sensitivity for enterprise segment                 │
│                                                                       │
│ 📈 10 recipients • 5 completed (50%) • 16 evidence pieces           │
│                                                                       │
│ 👥 Sarah Chen, Mike Jones, Emily Davis, +7 more                     │
│                                                                       │
│ Created Feb 11 • Updated 2 hours ago                                │
│                                                                       │
│ [View Campaign] [Export Links] [View Evidence]                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- More scannable (campaign name + strategy prominent)
- Key metrics at a glance
- Room for recipient preview
- Expandable for inline details

---

### ✅ FEEDBACK 9: Evidence Vectorization

**What you said:**
> "And our survey responses being included as evidence, that's a very important point. But yeah, that might need to be done individually per answer and also vectorized."

**Current State:**
- ✅ Evidence created per answer
- ✅ Links to `research_link_response_id`
- ❌ NOT vectorized

**Solution:**
- Existing evidence embedding pipeline should handle survey evidence automatically
- Evidence records have `method: 'survey'` already
- Embedding worker should pick up new evidence via `created_at` index
- **Action item:** Verify embedding worker processes survey evidence (check `34_embeddings.sql`)

---

### ✅ FEEDBACK 10: Declarative Schemas First

**What you said:**
> "we never just make sql migrations. we have declarative schemas in supabase. make those first and derive the migrations."

**Fixed:**
- ✅ Created `supabase/schemas/19_survey_campaigns.sql`
- Contains:
  - `research_links` extensions (campaign_strategy, campaign_goal, etc.)
  - New `personalized_surveys` table
  - `research_link_responses` extensions (evidence tracking)
  - RPC: `get_campaign_stats(research_link_id)`
  - RPC: `get_campaign_recommendations(account_id, project_id, strategy, limit)`
  - Full RLS policies

**Next step:** Run `pnpm db:migrate` to derive migration from schema

---

## 📊 New Database Schema

### `personalized_surveys` Table

```sql
create table public.personalized_surveys (
  id uuid primary key,
  research_link_id uuid not null references research_links (id),
  person_id uuid not null references people (id),

  -- Personalization
  survey_goal text check (survey_goal in ('validate', 'discover', 'deep_dive', 'pricing')),
  generation_metadata jsonb not null, -- PersonContext, question rationale
  questions jsonb not null default '[]',

  -- Lifecycle
  status text check (status in ('draft', 'approved', 'sent', 'opened', 'completed')),
  approved_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,

  -- Evidence tracking
  evidence_extracted boolean default false,
  evidence_count int default 0,
  extraction_metadata jsonb,

  unique(research_link_id, person_id) -- One survey per person per campaign
);
```

### `research_links` Extensions

```sql
alter table research_links
  add column campaign_strategy text check (...),
  add column campaign_goal text,
  add column ai_recommendation_metadata jsonb,
  add column campaign_status text default 'draft' check (...);
```

---

## 🎨 Updated User Flow

### Flow 1: Create Campaign with AI Recommendations

```
1. User clicks "New Campaign"
2. Enters campaign name + goal
3. Selects strategy:
   ☐ Pricing Validation (high ICP people good for pricing)
   ☐ Sparse Data Discovery (people with little evidence)
   ☐ Theme Validation (validate specific themes)
   ☐ General Research (balanced approach)

4. AI generates recommended people:
   ┌─────────────────────────────────────┐
   │ ✨ AI Recommendations                │
   │                                     │
   │ ☑ Sarah Chen                        │
   │   VP Engineering @ Acme            │
   │   ICP: Strong (0.85)               │
   │   Evidence: 2 pieces               │
   │   💡 Minimal evidence - good for   │
   │      discovery                      │
   │                                     │
   │ ☑ Mike Jones                        │
   │   Product Manager @ Beta           │
   │   ICP: Moderate (0.62)             │
   │   Evidence: 0 pieces               │
   │   💡 No evidence yet - great for   │
   │      discovery                      │
   │                                     │
   │ [Select All] [Add Selected (10)]   │
   └─────────────────────────────────────┘

5. User can:
   - Accept all recommendations
   - Cherry-pick specific people
   - Manually add more from People list

6. Click "Generate Personalized Surveys"
7. Opens Quick View carousel for review
```

### Flow 2: Add to Campaign from Person Detail

```
1. User on person detail page
2. Clicks "Add to Campaign" button
3. Modal opens:
   ┌─────────────────────────────────────┐
   │ Add Sarah Chen to Campaign          │
   │                                     │
   │ ○ Existing campaign:                │
   │   ▾ [Select campaign...]            │
   │                                     │
   │ ● New campaign:                     │
   │   Name: _______________________    │
   │   Strategy: [Pricing Validation ▾] │
   │                                     │
   │ [Cancel] [Add to Campaign]         │
   └─────────────────────────────────────┘

4. Person added to draft campaign
5. User continues browsing, adds more people
6. When ready: Opens campaign, generates surveys
```

### Flow 3: Campaign Summary View

```
1. User clicks "View Campaign" from survey list
2. Opens campaign summary page:

   ┌──────────────────────────────────────────────────┐
   │ Pricing Validation Campaign                      │
   │ Validate pricing sensitivity for enterprise      │
   │                                                   │
   │ 📊 Campaign Stats                                │
   │                                                   │
   │ 10 Sent • 7 Opened (70%) • 5 Completed (50%)    │
   │ 16 Evidence Pieces • 3.2 avg per response       │
   │                                                   │
   │ [Export CSV] [Send Reminders] [Pause Campaign]  │
   └──────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │ Recipients                                               │
   │                                                           │
   │ Name          Status      Evidence  Questions  Actions   │
   │ ─────────────────────────────────────────────────────── │
   │ Sarah Chen    Completed   4 pieces  5 qs       [View]   │
   │ Mike Jones    Opened      0 pieces  5 qs       [Remind] │
   │ Emily Davis   Completed   3 pieces  5 qs       [View]   │
   │ John Smith    Sent        0 pieces  5 qs       [Remind] │
   │ ...                                                       │
   └──────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Plan (Updated)

### Phase 1: Database & Schema (2 days)
- ✅ Create `19_survey_campaigns.sql` declarative schema
- ⏳ Run `pnpm db:migrate` to generate migration
- ⏳ Verify RPC functions work
- ⏳ Update database.types.ts

### Phase 2: Campaign Creation (3 days)
- AI recommendation UI + API
- "Add to Campaign" button on person detail
- Campaign builder page
- Bulk add from People list

### Phase 3: Quick View Carousel (2 days)
- Redesigned layout (goal closer to name, spaced correctly)
- Keyboard navigation
- Approve/skip/edit flow

### Phase 4: Campaign Summary (2 days)
- Campaign detail page
- Stats cards
- Recipient table (1 per row)
- CSV export

### Phase 5: Evidence Pipeline (3 days)
- Update BAML extraction to use new multi-evidence function
- Trigger.dev task for survey completion
- Timeline integration with gist display
- Verify vectorization works

### Phase 6: Survey List Redesign (1 day)
- Switch to 1-per-row layout
- Campaign-focused cards
- Completion metrics prominent

---

## ✅ What's Ready Now

1. ✅ Declarative schema (`19_survey_campaigns.sql`)
2. ✅ Updated BAML with multi-evidence extraction
3. ✅ Comprehensive requirements doc (this file)
4. ✅ Database support for campaigns, personalized surveys, evidence tracking
5. ✅ AI recommendation RPCs (pricing, sparse data, general)

---

## 🎯 Next Steps

1. **Review this document** - confirm we're aligned on all changes
2. **Apply migration** - run `pnpm db:migrate` when Docker is running
3. **Create visual mockups** - updated HTML showing campaign flow
4. **Start Phase 1 implementation** - database setup
5. **Internal QA** - test with 13 personas

---

## 📝 Open Questions for Rick

1. **Campaign naming:** Should users name campaigns, or auto-generate from strategy?
   - Suggestion: Auto-generate ("Pricing Validation - Feb 12") but allow editing
RIck: Autogen

1. **Reminder cadence:** How often should we allow "Send Reminder" clicks?
   - Suggestion: Max 1 reminder per person per 48 hours
rick: once per 72hr

1. **Campaign completion:** When does a campaign move to "completed" status?
   - Suggestion: Manual close, or auto-close when X% response rate hit
leave them open for 30 days by default

1. **Multiple campaigns per person:** Can same person be in multiple campaigns?
   - Current design: YES (unique constraint per campaign, not global)
OK, it's up to user to manage for now

1. **Campaign strategies:** Are the 4 strategies sufficient, or need more?
   - Current: pricing_validation, sparse_data_discovery, theme_validation, general_research
YES

---

**END OF SUMMARY - Ready for review and implementation**
