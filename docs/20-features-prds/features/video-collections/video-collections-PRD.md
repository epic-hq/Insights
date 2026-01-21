# Video Collections – Product Requirements Document

> **Status:** Draft v1 | **Last Updated:** January 2025
> **Relationship:** Parallel track to [Decision Reels](../reels/reels-PRD.md) – shares infrastructure, different audiences

---

## Executive Summary

Video Collections surfaces and curates video responses from Ask links (surveys) into shareable, embeddable presentations for different audiences. While Decision Reels serve internal teams making product decisions from interview data, Video Collections serves external communication needs.

**Core Value Proposition:** "Turn every video response into shareable social proof, feedback galleries, or investor highlights – without leaving UpSight."

### How This Relates to Decision Reels

| Aspect | Decision Reels | Video Collections |
|--------|---------------|-------------------|
| **Source** | Interview recordings | Ask link video responses |
| **Primary Audience** | Internal team (PM, Design, Exec) | External (website visitors, investors, team) |
| **Structure** | Story arc (Problem → Impact → Outcome) | Curated gallery or single features |
| **Complexity** | AI-selected, balanced, narrative | Human-curated, simple approval flow |
| **Output** | 2-3 min compiled video | Gallery embed, individual cards, or storyboard |

**Shared Infrastructure:**
- Media storage (R2)
- Clip extraction (FFmpeg on Trigger.dev)
- Evidence metadata (timestamps, confidence, sentiment)
- Embedding system (iframe-based)

---

## Part 1: The Opportunity

### 1.1 What Exists Today (and What's Hidden)

UpSight already captures video responses via Ask links:
- `research_link_responses.video_url` stores the R2 key
- Videos appear in a modal gallery on the responses page
- **But:** They're buried behind a small "N videos" button – easy to miss

**Current UX Flow:**
```
Survey Creator → Ask Link Settings → Enable Video → User Records Response
                                                            ↓
                                    Responses Page → Click "3 videos" → Modal Gallery
                                                            ↓
                                                    [End of journey]
```

**Missing:**
- No way to curate (approve for public use)
- No metadata overlay (name, title, quote)
- No embeddable output
- No dedicated gallery view
- No vertical video support (hardcoded 16:9)

### 1.2 Use Cases This Unlocks

#### Use Case 1: Testimonials (Marketing)
**Persona:** Marketing Manager, Founder
**Need:** Social proof on website, landing pages, sales decks
**Flow:**
1. Customer records video response on Ask link
2. Team reviews and approves best responses
3. Adds pull quote + attribution
4. Embeds testimonial gallery on marketing site

**Differentiator:** Closed loop from capture → curation → embed, no separate testimonial tool needed.

#### Use Case 2: User Feedback Gallery (Product)
**Persona:** Product Manager, UX Researcher
**Need:** Show stakeholders real user voices without scheduling a meeting
**Flow:**
1. Collect video feedback via Ask link after feature launch
2. Tag/categorize responses by theme
3. Share internal gallery link with team
4. Async review replaces sync meeting

**Differentiator:** Bridges the gap between "we ran a survey" and "here's what users actually said."

#### Use Case 3: Investor Highlights (Founders)
**Persona:** Founder preparing for board meeting or fundraise
**Need:** Show traction through customer voices
**Flow:**
1. Select best customer videos across multiple Ask links
2. Add context (company size, deal value, use case)
3. Export as storyboard or single compilation
4. Include in investor update or deck

**Differentiator:** Reuses existing data (no separate testimonial requests).

#### Use Case 4: Onboarding / Training (Internal)
**Persona:** Customer Success, Sales Enablement
**Need:** Show new hires what real customers sound like
**Flow:**
1. Curate collection of "voice of customer" clips
2. Organize by persona, pain point, or use case
3. Share as internal training resource

**Differentiator:** Authentic voices, not scripted training videos.

### 1.3 Competitive Landscape

| Tool | What It Does | Gap |
|------|--------------|-----|
| **VideoAsk** | Captures video responses, basic gallery | No AI analysis, no integration with research |
| **Testimonial.to** | Dedicated testimonial capture + wall | Separate tool, doesn't connect to survey/research |
| **Vocal Video** | Prompted video testimonials | Marketing-only, no product feedback use case |
| **Dovetail** | Highlight reels from interviews | Internal focus, no Ask link / testimonial flow |

**UpSight's Advantage:**
- Already captures video responses (no new tool to adopt)
- Connected to evidence extraction (AI can surface best moments)
- Same system handles research interviews AND testimonials
- Unified view: one dashboard for all customer voice data

---

## Part 2: Feature Design

### 2.1 Core Concepts

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

### 2.2 User Flows

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

### 2.3 Aspect Ratio Support

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

**UI Guidance:**
```
┌──────────────┐    ┌────────┐
│              │    │        │
│  Horizontal  │    │  Vert  │
│   (16:9)     │    │ (9:16) │
│              │    │        │
└──────────────┘    └────────┘
  "Best for web"   "Best for social"
```

### 2.4 Testimonial Card Component

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

### 2.5 Gallery Layouts

| Layout | Use Case | Description |
|--------|----------|-------------|
| **Grid** | Testimonials page | 2-4 columns, responsive |
| **Carousel** | Homepage section | Horizontal scroll, auto-play optional |
| **Featured + Grid** | Landing page | One large hero, rest in grid |
| **Storyboard** | Investor deck | Vertical scroll, context between videos |
| **Single** | Email embed | One testimonial, minimal chrome |

### 2.6 Embed System

Extends existing embed architecture (`/embed/*` routes):

**New Routes:**
- `/embed/collection/:collectionId` – Full gallery
- `/embed/testimonial/:itemId` – Single testimonial card

**Configuration (data attributes):**
```html
<div id="upsight-testimonials"
     data-upsight-collection="abc123"
     data-upsight-layout="grid"        <!-- grid | carousel | featured | storyboard -->
     data-upsight-columns="3"          <!-- for grid layout -->
     data-upsight-theme="light"        <!-- light | dark | transparent -->
     data-upsight-show-quotes="true"   <!-- show pull quotes -->
     data-upsight-autoplay="false">    <!-- autoplay videos -->
</div>
<script src="https://getupsight.com/embed.js" async></script>
```

---

## Part 3: Data Model

### 3.1 Schema Changes

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
    share_token TEXT UNIQUE,  -- For internal/public sharing

    -- Display settings
    default_layout TEXT DEFAULT 'grid'
        CHECK (default_layout IN ('grid', 'carousel', 'featured', 'storyboard', 'single')),
    settings JSONB DEFAULT '{}',  -- Layout-specific settings

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
    display_name TEXT,      -- "Victoria F."
    display_title TEXT,     -- "CFO"
    display_company TEXT,   -- "BioTech Inc."
    pull_quote TEXT,        -- Key quote to highlight

    -- Video settings
    aspect_ratio TEXT DEFAULT 'auto'
        CHECK (aspect_ratio IN ('auto', 'vertical', 'horizontal', 'square')),

    -- Status
    is_approved BOOLEAN DEFAULT false,  -- Explicit approval for public use

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(collection_id, response_id)
);

-- Indexes
CREATE INDEX idx_video_collections_account ON video_collections(account_id);
CREATE INDEX idx_video_collections_share_token ON video_collections(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_video_collection_items_collection ON video_collection_items(collection_id);
CREATE INDEX idx_video_collection_items_response ON video_collection_items(response_id);

-- RLS policies (to be added)
```

### 3.2 View for Easy Querying

```sql
CREATE VIEW public.collection_items_with_details AS
SELECT
    vci.*,
    vc.name as collection_name,
    vc.collection_type,
    vc.visibility,
    vc.share_token,
    rlr.video_url,
    rlr.email as respondent_email,
    p.name as person_name,
    p.title as person_title,
    p.company as person_company,
    rl.name as ask_link_name,
    rl.slug as ask_link_slug
FROM video_collection_items vci
JOIN video_collections vc ON vc.id = vci.collection_id
JOIN research_link_responses rlr ON rlr.id = vci.response_id
JOIN research_links rl ON rl.id = rlr.research_link_id
LEFT JOIN people p ON p.id = rlr.person_id;
```

---

## Part 4: Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Enable basic curation from existing video responses

- [ ] Create database schema (collections, items)
- [ ] Add "Add to Collection" action on response video
- [ ] Create collection management page (CRUD)
- [ ] Basic metadata editing (name, title, company, quote)
- [ ] Internal share link for collections

**Deliverable:** Team can curate videos into named collections with metadata.

### Phase 2: Vertical Video (Week 2)
**Goal:** Support mobile-native video capture

- [ ] Update `VideoRecorder.tsx` to accept `aspectRatio` prop
- [ ] Add orientation toggle in preview state
- [ ] Store aspect ratio in response metadata
- [ ] Update player to handle both orientations

**Deliverable:** Respondents can record vertical video on mobile.

### Phase 3: Testimonial Cards (Week 2-3)
**Goal:** Beautiful display components

- [ ] Create `TestimonialCard` component with variants
- [ ] Create `TestimonialGallery` with layout options
- [ ] Add to collection detail page
- [ ] Preview mode for embed configuration

**Deliverable:** Collections display as polished galleries.

### Phase 4: Embed System (Week 3-4)
**Goal:** Embeddable testimonials widget

- [ ] Create `/embed/collection/:id` route
- [ ] Create `/embed/testimonial/:id` route
- [ ] Add collection embed options to `EmbedCodeGenerator`
- [ ] Support all layout configurations

**Deliverable:** Customers can embed testimonial galleries on their sites.

### Phase 5: Polish & Integration (Week 4+)
**Goal:** Production-ready quality

- [ ] Lazy loading for galleries
- [ ] Video thumbnails (reuse from Reels infrastructure)
- [ ] Analytics (view counts, engagement)
- [ ] AI-suggested pull quotes (from transcript if available)
- [ ] Bulk operations (approve multiple, add to collection)

---

## Part 5: Future Considerations

### Integration with Decision Reels

Once both features are built, they share significant infrastructure:
- Media storage and playback
- Clip extraction (FFmpeg)
- Thumbnail generation
- Embedding system

**Potential Unified Model:**
```
Video Moments
├── Source: Interviews → Decision Reels (narrative, internal)
├── Source: Ask Links → Collections (curated, external)
└── Shared: Clips, Thumbnails, Embeds, Analytics
```

### AI Enhancement Opportunities

1. **Auto-suggest testimonials:** Flag high-sentiment positive responses
2. **Pull quote extraction:** AI identifies most compelling quotes
3. **Categorization:** Auto-tag by theme, sentiment, topic
4. **Smart ordering:** Suggest order based on narrative flow

### Storyboard for Investors

Extended collection type with:
- Section headers between videos
- Context/narrative text blocks
- Metrics alongside testimonials
- Export to PDF/slides

---

## Appendix: Why This Isn't Feature Creep

| Concern | Response |
|---------|----------|
| "We already have Reels planned" | Different source (Ask links vs interviews), different audience (external vs internal), different complexity (curated vs narrative). They complement, not compete. |
| "Just use a testimonial tool" | Adds another tool to the stack. UpSight already captures the video – surfacing it is natural extension. |
| "Too many features" | This is about surfacing data that's already captured but hidden. Minimal new capture, maximum new value. |
| "Should focus on core research" | Testimonials, user feedback, and investor highlights ARE research outputs. This helps teams demonstrate what they learned. |

**The key insight:** UpSight captures rich customer voice data. Currently, only interviews get presented well (via evidence, lenses, future reels). Ask link video responses are captured but buried. This feature simply extends the same "capture → analyze → present" pattern to a different source.

---

## Open Questions

1. **Consent:** Should there be explicit consent UI for public testimonials? (vs. implied from survey terms)
2. **Cross-project collections:** Allow collections spanning multiple projects/Ask links?
3. **Team collaboration:** Comments/reactions on collection items?
4. **Versioning:** Track changes to collections over time?

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Collections created per account | 2+ in first 30 days | Proves value discovery |
| Videos added to collections | 50% of video responses | Shows curation is happening |
| Embed installations | 20% of accounts with collections | External sharing adoption |
| Time from response to testimonial | <24 hours | Workflow efficiency |
