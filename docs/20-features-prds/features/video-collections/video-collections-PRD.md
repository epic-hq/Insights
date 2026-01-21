# Video Collections & Research Stories – Product Requirements Document

> **Status:** Draft v2 | **Last Updated:** January 2025
> **Scope:** v1 (Video Collections) + v1.5 (AI Stories) + v2 Vision (Rich Stories)
> **Relationship:** Parallel track to [Decision Reels](../reels/reels-PRD.md) – eventually converges

---

## Executive Summary

This PRD covers a **progressive capability** for presenting customer voice data:

| Version | Name | What It Does | Complexity |
|---------|------|--------------|------------|
| **v1** | Video Collections | Curate video responses into embeddable galleries | Medium |
| **v1.5** | AI Stories | Chief of Staff generates narrative documents with evidence | Medium |
| **v2** | Rich Stories | Block-based collaborative canvas for human+AI storytelling | High |

**Core Value Proposition:** "Turn scattered customer evidence into compelling, trustworthy stories – whether you're building testimonials, investor decks, or research reports."

**Why this matters:**
- UpSight captures rich customer voice data (interviews, video responses)
- Currently, this data is fragmented across pages (evidence, responses, insights)
- Teams need to **tell stories** with this data to drive decisions and communicate value
- Competitors offer highlight reels (video-only) – we can offer **mixed-media narratives**

---

## Part 1: The Vision – Research Stories

### 1.1 What We're Building Toward

A **Research Story** weaves together multiple content types into a trustworthy narrative:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH STORY: Why SMB Customers Churn After Day 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## The Problem

┌─────────────────────────────────────────────────────────────┐
│  📊 42% of trial users never complete onboarding            │
│     Source: Product analytics | Last 90 days | n=847        │
└─────────────────────────────────────────────────────────────┘

▶ [Video: Sarah Chen, PM @ TechCo]
  "I just couldn't figure out how to connect my data source"
  Confidence: High | Interview: Dec 15 | Theme: Setup confusion

This pattern appeared across 8 of 12 interviews. The primary
blockers were integration complexity and unclear documentation.

## The Impact

▶ [Video: Marcus Lee, Founder @ StartupX]
  "Our team wasted 3 hours trying to set this up before giving up"

┌─────────────────────────────────────────────────────────────┐
│  📊 Avg setup time: 47 min (target: 10 min)                 │
│  📊 Support tickets: 340/month related to setup             │
└─────────────────────────────────────────────────────────────┘

## What They Need

▶ [Video: Lisa Park, Ops @ AgencyCo]
  "If there was a wizard that just asked me 3 questions..."

[🖼 Feature mockup: Proposed setup wizard]

## Recommendation

Based on 12 interviews across 8 companies, we recommend
prioritizing onboarding improvements for Q2.

[🔗 View all evidence] [📊 Full analysis]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.2 The Human + AI Collaboration Model

**The false dichotomy:**
- Decision Reels = AI generates, human approves
- Research Stories = Human writes, AI assists

**Better model:** Collaborative canvas where either can contribute, clearly labeled.

```
┌─────────────────────────────────────────────────────────────┐
│                    COLLABORATION SPECTRUM                    │
│                                                              │
│  Full AI ◄────────────────────────────────────► Full Human  │
│                                                              │
│  "Generate     "Help me      "Suggest      "I'll build      │
│   Reel"         structure"    evidence"     from scratch"   │
│      │              │             │              │           │
│      ▼              ▼             ▼              ▼           │
│   AI drafts     AI suggests   AI assists    Human creates   │
│   everything,   structure,    when asked,   AI available    │
│   human         human fills   human leads   if needed       │
│   approves      + edits                                     │
└─────────────────────────────────────────────────────────────┘
```

**Human strengths:**
- Knowing the audience and context
- Framing the question/decision
- Judging what's compelling
- Adding interpretation and recommendations
- Ensuring accuracy and trust

**AI strengths:**
- Finding relevant evidence across large corpus
- Surfacing patterns and connections
- Drafting narrative from structured data
- Suggesting structure and flow
- Flagging gaps and imbalances

### 1.3 Chief of Staff as Story Collaborator

Chief of Staff already has deep context on projects. **New capability:** Help frame and build stories.

```
┌─────────────────────────────────────────────────────────────┐
│ User: "I need to make the case for investing in onboarding" │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 💬 Chief of Staff:                                          │
│                                                              │
│ I found 47 evidence items across 12 interviews related to   │
│ onboarding. Here's a structure that would tell this story:  │
│                                                              │
│ 1. THE PROBLEM (18 items, 6 videos)                         │
│    └─ Setup confusion, documentation gaps, integration pain │
│                                                              │
│ 2. THE IMPACT (12 items, 4 videos)                          │
│    └─ Time wasted, churn risk, support burden               │
│    💡 I can pull support ticket stats if you connect Zendesk│
│                                                              │
│ 3. WHAT THEY NEED (17 items, 5 videos)                      │
│    └─ Guided setup, better examples, faster support         │
│                                                              │
│ ⚠️ Note: 2 interviews had positive onboarding experiences.  │
│    Include for balance?                                      │
│                                                              │
│ [Build this story] [Adjust structure] [Show me the evidence]│
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Data Sources That Feed Into Stories

| Source | What It Provides | Trust Level | Exists? |
|--------|------------------|-------------|---------|
| **Evidence** | Verbatim quotes, video clips, timestamps | High ✓ | ✅ Yes |
| **Interviews** | Full transcripts, speaker info, media | High ✓ | ✅ Yes |
| **Insights** | Published findings, AI summaries | Medium | ✅ Yes |
| **Themes** | Clustered topics, evidence counts | Medium | ✅ Yes |
| **Personas** | Attributes, quotes, patterns | Medium | ✅ Yes |
| **People** | Names, titles, companies | High ✓ | ✅ Yes |
| **Research Questions** | What we're trying to learn | High ✓ | ✅ Yes |
| **Decision Questions** | What bets we're making | High ✓ | ✅ Yes |
| **Key Facts** | Manually entered metrics | High ✓ | ❌ New |
| **Tables** | Structured data, survey results | Varies | ❌ New |
| **Docs** | Uploaded documents, notes | Varies | ✅ Partial |
| **External Data** | Analytics, support tickets, CRM | High ✓ | ❌ Integration |

### 1.5 The Trust Architecture

For stories to be trustworthy, every element needs:

**1. Provenance** – Every claim links to source
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 "42% of trial users never complete onboarding"           │
│                                                              │
│ Source: Product analytics                                    │
│ Period: Last 90 days                                         │
│ Sample: n=847                                                │
│ [View in dashboard →]                                        │
└─────────────────────────────────────────────────────────────┘
```

**2. Transparency** – Clear what's AI vs human
```
┌───────────────────────────────────────────────────── [Human]│
│ This pattern appeared across 8 of 12 interviews...          │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────── [AI ✨]│
│ Based on the evidence, the primary blocker is setup         │
│ complexity, particularly around data source integration...  │
│                                                              │
│ [Edit] [Regenerate] [Convert to human block]                │
└─────────────────────────────────────────────────────────────┘
```

**3. Balance** – Don't cherry-pick
```
⚠️ Story Health Warning:
   6 of 8 clips are from 2 interviews.

   Suggestions:
   • Add evidence from Sarah (TechCo) - different perspective
   • Include dissenting view from Marcus (positive experience)

   [Auto-balance] [Ignore]
```

**4. Confidence + Freshness** – Show uncertainty
```
┌─────────────────────────────────────────────────────────────┐
│ 🎬 Evidence Block                                           │
│                                                              │
│ Confidence: ●●●○○ Medium                                    │
│ Interview: Dec 15, 2024 (36 days ago)                       │
│ Theme: Setup confusion                                       │
└─────────────────────────────────────────────────────────────┘
```

**5. Story Health Score** – Overall quality indicator
```
STORY HEALTH: ████████░░░░ 67%

✅ Good evidence coverage (12 interviews, 4 personas)
✅ Balanced sources (no interview > 25% of clips)
⚠️ Missing: quantitative impact data
⚠️ Missing: dissenting views (2 positive experiences exist)
💡 Suggestion: Add support ticket metrics
```

---

## Part 2: Complexity Analysis & Phasing

### 2.1 Where Complexity Lives

**v1: Video Collections** – Achievable
| Component | Complexity | Notes |
|-----------|------------|-------|
| Schema (collections, items) | Low | Two simple tables |
| Collection CRUD UI | Low | Standard patterns |
| Metadata editing | Low | Form fields |
| Gallery layouts | Medium | Multiple layout options |
| Embed system | Medium | Extend existing embed.js |
| Vertical video capture | Low | Update VideoRecorder constraints |

**v1.5: AI Stories** – Achievable
| Component | Complexity | Notes |
|-----------|------------|-------|
| Chief of Staff story generation | Medium | Extend existing agent |
| Markdown rendering with evidence | Medium | Custom renderer |
| Evidence linking in output | Low | Already have anchors |
| Regenerate with prompts | Low | Existing chat pattern |

**v2: Rich Stories** – Significant
| Component | Complexity | Notes |
|-----------|------------|-------|
| Block-based editor | **High** | Building mini-Notion |
| Multiple block types | **High** | Each needs render/edit |
| Drag-drop reordering | Medium | Libraries help |
| AI collaboration UX | **High** | Inline suggestions |
| Trust indicators | Medium | New UI patterns |
| Story health scoring | Medium | Algorithm + UI |
| Key Facts primitive | Low | Simple table + UI |
| Data integrations | **High** | External APIs |

**The big jump is the block editor** – that's ~60% of v2 complexity.

### 2.2 Phased Approach

```
v1: Video Collections (4-6 weeks)
├── Curate videos from Ask link responses
├── Add metadata (name, title, quote)
├── Embed galleries on external sites
└── Foundation for v1.5 and v2

v1.5: AI Stories (2-3 weeks after v1)
├── Chief of Staff generates narrative docs
├── Rendered as styled document with evidence
├── Regenerate with different prompts
└── No block editor – simpler path to "stories"

v2: Rich Stories (8-12 weeks)
├── Block-based collaborative canvas
├── Human + AI co-creation
├── Full trust architecture
└── Converges with Decision Reels
```

### 2.3 How This Relates to Decision Reels

| Aspect | Decision Reels (existing PRD) | Video Collections (v1) | Rich Stories (v2) |
|--------|------------------------------|------------------------|-------------------|
| **Source** | Interviews | Ask link responses | Both |
| **Output** | Compiled video | Gallery/embed | Interactive doc |
| **AI Role** | Full generation | Suggestions only | Collaborative |
| **Human Role** | Approve/reject | Full control | Co-creation |
| **Content** | Video clips only | Video + metadata | Mixed media |

**Eventual convergence:**
- Decision Reels becomes a "preset" in Rich Stories
- Click "Generate Decision Reel" → AI fills canvas with narrative structure
- Human edits on same canvas → exports as video OR interactive story

---

## Part 3: v1 – Video Collections (Detailed Spec)

### 3.1 Use Cases

#### Use Case 1: Testimonials (Marketing)
**Persona:** Marketing Manager, Founder
**Need:** Social proof on website, landing pages, sales decks
**Flow:**
1. Customer records video response on Ask link
2. Team reviews and approves best responses
3. Adds pull quote + attribution
4. Embeds testimonial gallery on marketing site

#### Use Case 2: User Feedback Gallery (Product)
**Persona:** Product Manager, UX Researcher
**Need:** Show stakeholders real user voices without scheduling a meeting
**Flow:**
1. Collect video feedback via Ask link after feature launch
2. Tag/categorize responses by theme
3. Share internal gallery link with team
4. Async review replaces sync meeting

#### Use Case 3: Investor Highlights (Founders)
**Persona:** Founder preparing for board meeting or fundraise
**Need:** Show traction through customer voices
**Flow:**
1. Select best customer videos across multiple Ask links
2. Add context (company size, deal value, use case)
3. Export as storyboard or compilation
4. Include in investor update or deck

#### Use Case 4: Training (Internal)
**Persona:** Customer Success, Sales Enablement
**Need:** Show new hires what real customers sound like
**Flow:**
1. Curate collection of "voice of customer" clips
2. Organize by persona, pain point, or use case
3. Share as internal training resource

### 3.2 Core Concepts

#### Video Response (Existing)
A video recorded by a respondent on an Ask link. Stored in `research_link_responses.video_url`.

#### Collection (New)
A curated set of video responses with a purpose:
- **Type:** `testimonials` | `feedback` | `highlights` | `custom`
- **Scope:** Single Ask link or cross-Ask link
- **Visibility:** `private` | `internal` | `public`

#### Collection Item (New)
A single video in a collection with overlay metadata:
- Display name, title, company (can override person record)
- Pull quote (highlighted excerpt)
- Aspect ratio preference for display
- Order in collection

### 3.3 User Flows

#### Flow 1: Approve Video for Testimonials
```
Responses Page
    ↓
Click video → Video Detail Drawer
    ↓
"Add to Collection" → Select/Create Collection
    ↓
Edit Metadata:
  - Display name: "Victoria F."
  - Title: "CFO"
  - Company: "BioTech Inc."
  - Pull quote: "ACME gave me confidence to make these investments..."
    ↓
Save → Video appears in Collection
```

#### Flow 2: Create Embeddable Testimonials Gallery
```
Collections Page → "New Collection"
    ↓
Name: "Customer Stories"
Type: Testimonials
Visibility: Public
    ↓
Add videos from responses (drag to reorder)
    ↓
Preview → Looks good
    ↓
"Get Embed Code" → Copy iframe snippet
    ↓
Paste on marketing site
```

#### Flow 3: Share Internal Feedback Gallery
```
Collections Page → "New Collection"
    ↓
Name: "v2.3 Launch Feedback"
Type: Feedback
Visibility: Internal (link-only)
    ↓
Add videos, optionally tag by theme
    ↓
Copy share link → Paste in Slack
    ↓
Team watches async, comments
```

### 3.4 Aspect Ratio Support

**Recording:**
- Default to device orientation (mobile = vertical, desktop = horizontal)
- Allow toggle before recording starts
- Lock once recording begins

**Display:**
- Store aspect ratio in metadata
- Render appropriately:
  - Vertical (9:16): Great for mobile, social, storyboard
  - Horizontal (16:9): Traditional web, presentations
  - Square (1:1): Works everywhere, social-friendly

```
┌──────────────┐    ┌────────┐    ┌────────┐
│              │    │        │    │        │
│  Horizontal  │    │  Vert  │    │ Square │
│   (16:9)     │    │ (9:16) │    │  (1:1) │
│              │    │        │    │        │
└──────────────┘    └────────┘    └────────┘
 "Best for web"   "Best for     "Works
                   social"      everywhere"
```

### 3.5 Testimonial Card Component

**Structure:**
```
Horizontal Layout:
┌─────────────────────────────────┐
│                                 │
│         [Video Player]          │
│                                 │
├─────────────────────────────────┤
│ "ACME gave me confidence to     │
│  make these investments..."     │
│                                 │
│ Victoria F.                     │
│ CFO, BioTech Inc.               │
└─────────────────────────────────┘

Vertical Layout (overlay):
┌───────────────┐
│               │
│               │
│   [Video]     │
│               │
│ ┌───────────┐ │
│ │ "Quote..."│ │  ← gradient overlay
│ │ Name      │ │
│ │ Title, Co │ │
│ └───────────┘ │
└───────────────┘
```

**Variants:**
- `card`: Metadata below video (best for grids)
- `overlay`: Metadata overlays video bottom (best for vertical, social)
- `minimal`: Just video with play button (dense galleries)
- `featured`: Larger format for hero sections

### 3.6 Gallery Layouts

| Layout | Use Case | Description |
|--------|----------|-------------|
| **Grid** | Testimonials page | 2-4 columns, responsive |
| **Carousel** | Homepage section | Horizontal scroll, auto-play optional |
| **Featured + Grid** | Landing page | One large hero, rest in grid |
| **Storyboard** | Investor deck | Vertical scroll, context between videos |
| **Single** | Email embed | One testimonial, minimal chrome |

### 3.7 Embed System

Extends existing embed architecture (`/embed/*` routes):

**New Routes:**
- `/embed/collection/:collectionId` – Full gallery
- `/embed/testimonial/:itemId` – Single testimonial card

**Configuration (data attributes):**
```html
<div id="upsight-testimonials"
     data-upsight-collection="abc123"
     data-upsight-layout="grid"
     data-upsight-columns="3"
     data-upsight-theme="light"
     data-upsight-show-quotes="true"
     data-upsight-autoplay="false">
</div>
<script src="https://getupsight.com/embed.js" async></script>
```

### 3.8 Schema (v1)

```sql
-- Collections table
CREATE TABLE public.video_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Basic info
    name TEXT NOT NULL,
    description TEXT,
    collection_type TEXT NOT NULL DEFAULT 'custom'
        CHECK (collection_type IN ('testimonials', 'feedback', 'highlights', 'custom')),

    -- Visibility & sharing
    visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'internal', 'public')),
    share_token TEXT UNIQUE,

    -- Display settings
    default_layout TEXT DEFAULT 'grid'
        CHECK (default_layout IN ('grid', 'carousel', 'featured', 'storyboard', 'single')),
    settings JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Collection items (videos in a collection)
CREATE TABLE public.video_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES video_collections(id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES research_link_responses(id) ON DELETE CASCADE,

    -- Order in collection
    order_index INTEGER NOT NULL DEFAULT 0,

    -- Display metadata (overrides person record if set)
    display_name TEXT,
    display_title TEXT,
    display_company TEXT,
    pull_quote TEXT,

    -- Video settings
    aspect_ratio TEXT DEFAULT 'auto'
        CHECK (aspect_ratio IN ('auto', 'vertical', 'horizontal', 'square')),

    -- Status
    is_approved BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(collection_id, response_id)
);

-- Indexes
CREATE INDEX idx_video_collections_account ON video_collections(account_id);
CREATE INDEX idx_video_collections_share_token ON video_collections(share_token)
    WHERE share_token IS NOT NULL;
CREATE INDEX idx_video_collection_items_collection ON video_collection_items(collection_id);
CREATE INDEX idx_video_collection_items_response ON video_collection_items(response_id);
```

### 3.9 Implementation Plan (v1)

#### Phase 1: Foundation (Week 1)
- [ ] Create database schema (collections, items)
- [ ] Add "Add to Collection" action on response video
- [ ] Create collection management page (CRUD)
- [ ] Basic metadata editing (name, title, company, quote)
- [ ] Internal share link for collections

#### Phase 2: Vertical Video (Week 2)
- [ ] Update `VideoRecorder.tsx` to accept `aspectRatio` prop
- [ ] Add orientation toggle in preview state
- [ ] Store aspect ratio in response metadata
- [ ] Update player to handle both orientations

#### Phase 3: Testimonial Cards (Week 2-3)
- [ ] Create `TestimonialCard` component with variants
- [ ] Create `TestimonialGallery` with layout options
- [ ] Add to collection detail page
- [ ] Preview mode for embed configuration

#### Phase 4: Embed System (Week 3-4)
- [ ] Create `/embed/collection/:id` route
- [ ] Create `/embed/testimonial/:id` route
- [ ] Add collection embed options to `EmbedCodeGenerator`
- [ ] Support all layout configurations

#### Phase 5: Polish (Week 4+)
- [ ] Lazy loading for galleries
- [ ] Video thumbnails
- [ ] Analytics (view counts)
- [ ] Bulk operations (approve multiple)

---

## Part 4: v1.5 – AI Stories (Detailed Spec)

### 4.1 Concept

Chief of Staff generates **narrative documents** with embedded evidence. Not a block editor – just AI output that can be regenerated with different prompts.

**Why v1.5 before v2:**
- Gets "story" capability without block editor complexity
- Tests whether users want AI-generated vs hand-crafted stories
- Validates the collaboration model
- Can ship in 2-3 weeks after v1

### 4.2 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Chief of Staff                                           │
│                                                              │
│ What story do you want to tell?                              │
│                                                              │
│ Based on your recent research:                               │
│ • "Why onboarding drives churn" (47 items, strong)          │
│ • "Enterprise vs SMB needs" (23 items, emerging)            │
│ • "Pricing perception gaps" (18 items, needs data)          │
│                                                              │
│ Or describe what you need...                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ I want to convince the team that we should prioritize   │ │
│ │ onboarding improvements for Q2...                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Generate story] [Show me the evidence first]               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ GENERATED STORY                                    [AI ✨]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ # Why We Should Prioritize Onboarding for Q2                │
│                                                              │
│ Based on 12 interviews with trial users and churned         │
│ customers, onboarding complexity is the #1 driver of        │
│ early-stage churn.                                          │
│                                                              │
│ ## The Problem                                               │
│                                                              │
│ **42% of trial users never complete onboarding.**           │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▶ "I just couldn't figure out how to connect my data"  │ │
│ │   — Sarah Chen, PM @ TechCo                             │ │
│ │   [Watch clip] [See full interview]                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▶ "The docs assumed I already knew the terminology"    │ │
│ │   — Marcus Lee, Founder @ StartupX                      │ │
│ │   [Watch clip] [See full interview]                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ This pattern appeared in 8 of 12 interviews...              │
│                                                              │
│ ## The Impact                                                │
│ ...                                                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ [🔄 Regenerate] [📝 Adjust prompt] [📤 Share] [📥 Export]  │
│                                                              │
│ Story Health: ████████░░░░ 72%                              │
│ ⚠️ Consider adding quantitative impact data                 │
│ ⚠️ 2 positive experiences not included                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Key Differences from v2

| Aspect | v1.5: AI Stories | v2: Rich Stories |
|--------|------------------|------------------|
| Editing | Regenerate with new prompt | Edit blocks directly |
| Composition | AI-driven | Human+AI collaborative |
| Flexibility | Prompt-based control | Full canvas control |
| Complexity | Medium | High |
| Time to ship | 2-3 weeks | 8-12 weeks |

### 4.4 Implementation Notes

**Chief of Staff integration:**
- New tool: `generateStory(topic, options)`
- Options: structure preference, evidence sources, tone
- Returns: Markdown with evidence references

**Rendering:**
- Custom React component for story display
- Evidence references become embedded players
- Stats become styled callout boxes
- Links to full evidence/interviews

**Storage:**
- Stories table: id, account_id, project_id, title, prompt, content, evidence_refs, created_at
- Or: Store as special collection type with narrative content

---

## Part 5: v2 – Rich Stories (Vision)

### 5.1 Block Architecture

Semantic blocks that can be arranged flexibly:

```
BLOCK TYPES:

┌─────────────────────────────────────────┐
│ ❓ QUESTION BLOCK                       │
│ Research or decision question           │
│ Auto-links to related evidence          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📊 STAT BLOCK                           │
│ Metric + value + source + timeframe     │
│ Manual or from Key Facts / integration  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🎬 EVIDENCE BLOCK                       │
│ Video/audio clip or verbatim quote      │
│ Attribution, confidence, theme tags     │
│ Links to full interview                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 💡 INSIGHT BLOCK                        │
│ AI or human-written insight             │
│ Supporting evidence linked              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📝 NARRATIVE BLOCK                      │
│ Freeform text (always human-attributed) │
│ Can reference other blocks              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 👤 PERSONA BLOCK                        │
│ Persona card with key attributes        │
│ Representative quotes                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📋 TABLE BLOCK                          │
│ Structured data, comparison             │
│ Can be imported or AI-generated         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🖼 MEDIA BLOCK                          │
│ Image, screenshot, diagram, mockup      │
│ Caption + source                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📑 SECTION BLOCK                        │
│ Groups blocks under heading             │
│ Can have story arc label                │
└─────────────────────────────────────────┘
```

### 5.2 Key Facts Primitive (New)

Teams have quantitative data that should anchor stories:

```sql
CREATE TABLE key_facts (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),

    -- The fact
    label TEXT NOT NULL,           -- "Trial completion rate"
    value TEXT NOT NULL,           -- "42%"
    value_type TEXT,               -- "percentage" | "number" | "currency"

    -- Context
    source TEXT,                   -- "Product analytics"
    source_url TEXT,               -- Link to dashboard
    as_of_date DATE,               -- When measured
    comparison_value TEXT,         -- "vs 65% target"
    comparison_direction TEXT,     -- "down" | "up"

    -- Connections
    theme_ids UUID[],
    decision_question_ids UUID[],

    -- Metadata
    created_by UUID,
    is_verified BOOLEAN DEFAULT false,
    notes TEXT
);
```

### 5.3 Canvas UX

```
┌──────────────────────────────────────────────────────────────────────┐
│                         STORY CANVAS                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 💬 Chief of Staff                                               │ │
│  │                                                                 │ │
│  │ What would you like to add next?                                │ │
│  │                                                                 │ │
│  │ Suggestions based on your story so far:                         │ │
│  │ • Add impact evidence (5 clips about time wasted)              │ │
│  │ • Include a dissenting view for balance                         │ │
│  │ • Pull in support ticket metrics                                │ │
│  │                                                                 │ │
│  │ [Add impact section] [Show suggestions] [I'll add manually]    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ═══════════════════════════════════════════════════════════════════ │
│                                                                       │
│  ❓ Should we prioritize onboarding over Feature X?          [Human] │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                       │
│  ┌─ SECTION: The Problem ──────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  📊 42% of trial users never complete onboarding        [Human] │ │
│  │     Source: Product analytics, last 90 days                     │ │
│  │                                                                  │ │
│  │  🎬 "I just couldn't figure out how to connect..."              │ │
│  │     — Sarah Chen, PM @ TechCo | High confidence                 │ │
│  │     [▶ Play] [See full] [Find similar]                          │ │
│  │                                                                  │ │
│  │  📝 This pattern appeared across 8 of 12 interviews...  [Human] │ │
│  │                                                                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [+ Add block]  [🤖 AI suggest]  [📊 Add data]  [🎬 Add evidence]   │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ STORY HEALTH: ████████░░░░ 67%                                        │
│                                                                       │
│ ✅ Good coverage (12 interviews, 4 personas)                          │
│ ✅ Balanced (no source > 25%)                                         │
│ ⚠️ Missing: quantitative impact                                       │
│ ⚠️ Missing: dissenting views                                          │
│                                                                       │
│ [Preview] [Share draft] [Publish]                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.4 Decision Reels Convergence

In v2, Decision Reels becomes a **preset**:

```
"Generate Decision Reel" =
  1. Create new Story canvas
  2. AI fills with Problem → Impact → Outcome structure
  3. Auto-selects evidence using scoring algorithm
  4. Auto-balances across interviews
  5. User reviews and edits on canvas
  6. Export as: Interactive story OR Compiled video
```

---

## Part 6: Competitive Positioning

### 6.1 Landscape

| Tool | What It Does | Gap We Fill |
|------|--------------|-------------|
| **Dovetail** | Highlight reels (video-only) | No mixed media, no data integration |
| **Looppanel** | Clip stitching | Internal only, no external sharing |
| **Testimonial.to** | Testimonial capture + wall | Separate tool, no research connection |
| **Notion** | Docs with embeds | Not research-native, no evidence linking |
| **Pitch/Tome** | AI presentations | Generic, no research data integration |
| **Grain/Gong** | Call snippets | Sales-focused, no story structure |

### 6.2 UpSight's Unique Position

```
                    RESEARCH-NATIVE
                          │
                          │
         Dovetail ●       │       ● UpSight (Rich Stories)
                          │
    ──────────────────────┼──────────────────────
    VIDEO-ONLY            │            MIXED MEDIA
                          │
         Grain ●          │       ● Notion
                          │
                          │
                    GENERIC TOOLS
```

**Why we win:**
- Evidence, themes, personas already in system
- AI already extracts insights from interviews
- Same platform for capture AND presentation
- Trust architecture built-in (provenance, confidence, balance)

---

## Part 7: Open Questions

1. **Consent:** Explicit consent UI for public testimonials?
2. **Cross-project:** Collections/stories spanning multiple projects?
3. **Collaboration:** Comments/reactions on drafts?
4. **Versioning:** Track story changes over time?
5. **Export:** PDF, slides, video compilation?
6. **Integrations:** Pull data from Segment, Amplitude, Zendesk?

---

## Part 8: Success Metrics

### v1 Metrics
| Metric | Target | Why |
|--------|--------|-----|
| Collections created | 2+ per account in 30 days | Value discovery |
| Videos added | 50% of video responses | Curation happening |
| Embed installations | 20% of accounts | External sharing |
| Time to testimonial | <24 hours | Workflow efficiency |

### v1.5 Metrics
| Metric | Target | Why |
|--------|--------|-----|
| Stories generated | 3+ per account in 30 days | AI value |
| Regeneration rate | <3 per story | Prompt quality |
| Share rate | 40% of stories | Useful output |
| Evidence click-through | 20%+ | Trust/exploration |

### v2 Metrics
| Metric | Target | Why |
|--------|--------|-----|
| Blocks per story | 8+ average | Rich content |
| AI vs Human ratio | 40/60 | Collaboration working |
| Story health score | 75%+ average | Quality |
| Publish rate | 60% of drafts | Completion |

---

## Appendix: Why This Isn't Feature Creep

| Concern | Response |
|---------|----------|
| "We already have Reels planned" | Different source, different audience. Eventually converges. |
| "Just use a testimonial tool" | Adds another tool. We already capture video – surface it. |
| "Too many features" | This is presenting data we already have. Minimal new capture. |
| "Should focus on core research" | Stories ARE research output. This is how teams demonstrate what they learned. |
| "Building a Notion clone" | v1 and v1.5 don't need block editor. v2 is focused (research blocks, not general docs). |

**The key insight:** UpSight captures rich customer voice data but presents it poorly (fragmented pages, buried videos). Stories unify this into compelling, trustworthy narratives for different audiences.
