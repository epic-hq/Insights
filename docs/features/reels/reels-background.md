Cool feature. Let’s break it into: (1) what others do, (2) how to pick “most important” snippets, (3) light PRD, (4) tech/FFmpeg plan.

---

## 1. What others do today (patterns + “killer” bits)

**Dovetail**

* Treats *highlights* (tagged text in transcripts) as first-class. Each highlight from a transcript becomes a searchable video clip.([docs.dovetail.com][1])
* *Reels* = stitched collections of highlights across interviews, sales calls, etc., presented as a single video.([docs.dovetail.com][2])
* AI “Magic” features: auto-find important moments and suggest highlights/reels.([Looppanel][3])

**Grain / similar**

* Real-time clipping during call (hotkeys/bookmarks).([grain.com][4])
* “Grain Stories”: turn hours of interviews into short video stories by stitching clips.([grain.com][5])
* Easy sharing to Slack, Notion, etc.([grain.com][4])

**Zoom Clips & others (Chopcast, AI Video Cut, etc.)**

* Zoom: record, trim, comment, save highlights as separate clips; optional add-to-Clips library.([Zoom][6])
* Chopcast / AI Video Cut: auto-generate highlights from long recordings and export social-ready segments.([Reddit][7])

**Pattern:**

* Base unit = “highlighted moment” from transcript.
* Reel = curated sequence of those units, often AI-assisted.
* Strong sharing & embedding.
* Very little “decision-question” context; it’s mostly “theme/tag + reel”.

---

## 2. Where you can differentiate (UpSight-specific)

You already have: **decision questions, themes, evidence, personas, encounters**. Use that.

Ideas:

1. **Decision-centric reels, not just theme reels**

   * “Show me a 3-minute reel that answers: *Why do trial users churn after day 3?*”
   * Under the hood: choose clips tagged with that decision question + key themes (churn, onboarding, confusion, etc.).

2. **Story-arc auto-ordering**

   * Auto-order clips into: *Problem → Impact → Workarounds → Current solutions → Desired outcome*.
   * Show this arc visually over the reel timeline.

3. **Balanced evidence, not just “loudest quote”**

   * Ensure coverage across:

     * personas (Founder, AE, CS, etc.),
     * segments (SMB vs Mid-market),
     * life-cycle stages (prospect, customer, churned).
   * Avoid 10 clips from same meeting.

4. **Evidence overlays**

   * While reel plays, show an overlay ribbon: tags, emotion, theme, decision question, project.
   * Click any overlay → jump to full encounter, evidence card, or insight doc.

5. **Reel templates**

   * “Investor reel”, “Design critique reel”, “Sales enablement reel” → different default length, structure, and overlay info.

6. **Tight integration with insights UI**

   * From an insight or theme, click **“Generate reel from evidence”** → pre-built reel you can tweak.
   * Surface as a first-class “Highlights” object in your existing insights/encounters mobile UI.

---

## 3. How to pick “most important snippets”

Assume you already have **EvidenceTurn** objects:

```ts
type EvidenceTurn = {
  id: string
  encounter_id: string
  recording_id: string
  start_sec: number
  end_sec: number
  speaker: "customer" | "team" | string
  themes: string[]         // “Onboarding”, “Pricing”
  decision_questions: string[]
  personas: string[]
  impact_score: number     // 1–5, manually or AI-rated
  emotion: string          // “frustrated”, “excited”
  created_at: Date
}
```

### Scoring model (per theme / decision question)

For a reel request like “Reel for theme: Onboarding”, compute:

* `impact_component` = normalized impact_score
* `recency_component` = exp(-age_days / half_life_days)
* `emotion_component` = boost for strong negative or positive emotions
* `coverage_penalty` = penalize if too many from same encounter/persona

Example scoring:

```text
score = 0.5 * impact_component
      + 0.3 * recency_component
      + 0.2 * emotion_component
      - 0.1 * coverage_penalty
```

Flow:

1. Filter EvidenceTurns by:

   * project(s), theme(s), decision_question(s), segment filters.
2. Score each.
3. Group by (recording_id, speaker) and cap N per group.
4. Sort by score; keep top K total (e.g., enough for 2–4 minutes).
5. Expand window around each:

   * `clip_start = max(0, start_sec - 3)`
   * `clip_end = min(recording_length, end_sec + 3)`
6. Merge overlapping clips per recording.

Result: an ordered list of `(recording_id, clip_start, clip_end)` segments.

---

## 4. Light PRD – “Highlights Reel” (v1)

**Goal**

Enable users to quickly create and share short video reels that **showcase real customer evidence** tied to themes and decision questions, without manual video editing.

### Users / Jobs

* **Founder / PM / Researcher**

  * “I want to show my team why this problem matters using real customer voices.”
* **Sales / CS**

  * “I want a reel of customers describing pain X for a training session or deck.”
* **Exec / Stakeholder**

  * “I want a 2–3 minute reel that convinces me this is worth funding.”

### Core v1 scope

1. **Reel object**

   * Fields: id, project_id, title, description, decision_question_id (nullable), themes[], personas[], created_by, share_url, status, duration, segments[].

2. **Create reel from:**

   * a Theme,
   * a Decision Question,
   * or a hand-selected list of EvidenceTurns.

3. **Automatic clip selection**

   * Use scoring model above to auto-pick top clips.
   * Default duration target: 90–240 seconds (config).

4. **Timeline editor (simple)**

   * Show ordered clips: thumbnail, transcript snippet, duration.
   * Allow:

     * reordering,
     * deleting a clip,
     * optionally trimming each clip’s in/out by a few seconds.

5. **Playback**

   * Player with:

     * chapters per clip,
     * transcript view synced,
     * overlays showing tags/persona/decision question on each chapter.

6. **Sharing**

   * Public/organization share link (view-only).
   * Embed in insight page, project overview, maybe export URL to copy into slide deck.

7. **Permissions**

   * Inherit from project; reels are read-only for viewers without edit rights.

### Non-goals (v1)

* Fancy multi-track editing, b-roll, background music.
* Social-media aspect ratios (TikTok/Shorts) – can be future “social reel” mode.
* Heavy branding/custom lower-thirds.

### Success metrics

* # reels created per active project.
* % of insights/themes that have at least one reel.
* Playback completion rate & unique viewers.
* Time-to-reel: from “create” click to shareable reel < X minutes (including processing).

---

## 5. Implementation sketch (how to actually do it)

### 5.1 Data model additions (Supabase/Postgres)

1. **Table: reels**

```sql
id uuid PK
project_id uuid FK
title text
description text
decision_question_id uuid null
themes text[] null
personas text[] null
status text check in ('draft','processing','ready','failed')
total_duration_seconds int
created_by uuid
created_at timestamptz
updated_at timestamptz
share_token text unique -- for public link
```

2. **Table: reel_segments**

```sql
id uuid PK
reel_id uuid FK
recording_id uuid FK
evidence_turn_id uuid null
order_index int
clip_start_sec numeric
clip_end_sec numeric
speaker text
```

3. Ensure **recordings** table knows:

   * storage_path (R2 object key),
   * duration_seconds,
   * media_type (audio/video).

---

### 5.2 Clip selection service

Backend route (Remix loader/action or edge function):

`POST /api/reels/create`

Body: project_id, filters (themes, decision_question_id, duration_target, etc.)

Steps:

1. Query EvidenceTurns with filters.
2. Score and select as described.
3. Create `reels` row (status = 'draft').
4. Create ordered `reel_segments` rows.
5. Publish reel metadata back to client (for editing).
6. Client can tweak segments and then call `/api/reels/render`.

---

### 5.3 Rendering the reel (FFmpeg vs dynamic streaming)

You have two main options:

#### Option A – Pre-rendered MP4 (use FFmpeg)

**Pros:** simple to share/export, small player logic.
**Cons:** processing time, storage cost, re-render on edits.

**Process**

1. Backend job takes reel_id.
2. Fetch `reel_segments` & associated `recording.storage_path`.
3. For each unique recording, download from R2 to local temp (or mount via HTTP/FFmpeg if latency ok).
4. Build an FFmpeg command:

**Simpler: two-step pipeline**

* Step 1: generate segment files

For each segment `i`:

```bash
ffmpeg -i input.mp4 -ss {clip_start} -to {clip_end} \
  -c copy segment{i}.mp4
```

* Step 2: concat

Create `concat_list.txt`:

```text
file 'segment1.mp4'
file 'segment2.mp4'
...
```

Then:

```bash
ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c copy output_reel.mp4
```

If you need re-encode (different resolution, watermark, etc.):

```bash
ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c:v libx264 -preset veryfast -crf 23 \
  -c:a aac -b:a 128k \
  output_reel.mp4
```

5. Upload `output_reel.mp4` back to R2; store URL on `reels` (`status = 'ready'`).

**Implementation detail**

* Use a wrapper like **fluent-ffmpeg** in Node or call CLI from a background worker (e.g., Fly.io worker, Trigger.dev job).
* Ensure you sanitize input; only use paths looked up from DB.

#### Option B – Dynamic HLS / MSE stitching

Instead of pre-rendering, you can:

* Expose each full recording as HLS or chunked MP4.
* Use Media Source Extensions (MSE) in the browser to append segments in order.
* Or pre-generate an HLS playlist that jumps between different recordings with `#EXT-X-DISCONTINUITY`.

**Pros:** instant edits, no render step.
**Cons:** more complex player; harder for download/export.

**Recommendation for v1:**
Start with **Option A (pre-rendered MP4)** and add dynamic later if needed.

---

### 5.4 UI/UX pieces

In your existing insights/encounters views:

* **From Theme view**

  * Button: “Build reel from evidence”.
  * Opens Reel Builder:

    * left: filters (project, themes, personas),
    * middle: suggested clips list with scores & transcript snippets,
    * right: timeline of chosen clips.

* **From Decision Question view**

  * Shortcut: “Evidence reel” with default story arc ordering.

* **Reel detail page**

  * Player + chapter list.
  * Evidence cards inline under each chapter.
  * “Copy link”, “Add to insight”, “Duplicate”.

---

### 5.5 Tools stack

* **Storage:** Cloudflare R2 (already your default) for raw recordings + reels.
* **Transcription & timestamps:** keep using your current STT; ensure you store word/phrase timestamps per utterance.
* **DB:** Supabase/Postgres for reels/segments metadata and evidence turns.
* **Video processing:** FFmpeg (called from Node or Python job):

  * Node: `fluent-ffmpeg` or exec.
  * Python: `ffmpeg-python` or subprocess.
* **Job orchestration:** Trigger.dev, worker queue, or Supabase Functions + cron.
* **Frontend:** Remix route + your design system to build the Reel Builder & player.

---

If you’d like, next step I can:

* draft the exact Postgres migrations,
* sketch the `/api/reels/create` + `/api/reels/render` handlers in TypeScript,
* and outline scoring logic as a small reusable module.

Confidence: high.

[1]: https://docs.dovetail.com/help/highlights?utm_source=chatgpt.com "Highlights"
[2]: https://docs.dovetail.com/help/highlight-reels?utm_source=chatgpt.com "Highlight reels"
[3]: https://www.looppanel.com/blog/dovetail-ai?utm_source=chatgpt.com "Dovetail AI Review: Is It Worth The Hype?"
[4]: https://grain.com/blog/how-user-interviews-uses-grain?utm_source=chatgpt.com "How User Interviews Bring Voice of the Customers into ..."
[5]: https://grain.com/blog/ux-research-tools?utm_source=chatgpt.com "The 10 Best UX Research Tools to Try in 2023 [Reviewed]"
[6]: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0057723&utm_source=chatgpt.com "Quick start guide for Zoom Clips"
[7]: https://www.reddit.com/r/AIVideoCut/comments/1kg2ls6/turn_your_zoom_recordings_into_tiktoks_reels_and/?utm_source=chatgpt.com "Turn Your Zoom Recordings into TikToks, Reels, and ..."


**yes, “highlight reels” are basically table stakes *within each category*** now — but *how* they’re built and framed is where you can still stand out.

Let’s look side-by-side.

---

## 1. Who has “reels” / snippets today?

### Dovetail (closest to your research use case)

* **Highlights → Reels**: transcript highlights become individual clips; Reels are stitched highlight compilations across projects.([Dovetail][1])
* **AI Magic Reels / Magic Highlight**: scans long videos, suggests key moments, auto-builds reels of “most impactful” clips.([Looppanel][2])
* **Embeds & sharing**: play reels inside Slack, Teams, Notion via special links.([Dovetail][3])

👉 For UX / qual research, **“highlight reels of key moments” is absolutely table stakes** now.

---

### Looppanel

* Every note is a **video clip by default**; you one-click share/download.([Looppanel Help Center][4])
* **Reels**: stitch multiple clips into highlight reels that communicate a specific insight or theme (their docs literally call them “mini showreels”).([Looppanel Help Center][5])

👉 Also fully table stakes in UX research land; they compete directly on “easier, better highlight reels than Dovetail”.([Looppanel][2])

---

### Gong

* **Call snippets**: short segments from a call you can create from the timeline/transcript, share, save to library, embed in apps.([Gong][6])
* Strong post-call review UX: briefs, highlights, “Ask anything”, mobile review.([Gong][7])

They don’t market them as “reels”, but functionally you can:

* cut **snippets**,
* save/share/download them for decks, training, etc.([Claap][8])

👉 In **sales conversation intelligence**, *having at least snippets + easy share* is table stakes. “Multi-clip stitched reels” are nice but not the hero; coaching, scoring, and deal insights are.

---

### Clari (Copilot)

* Records + transcribes calls, surfaces **highlights / key moments**, and lets you quickly review snippets of interest.([Clari Community][9])
* They talk more about **playlists of good calls** for coaching than explicit “highlight reels,” but you still get:

  * snippets / highlights,
  * curated lists of calls/segments for training.([Clari][10])

👉 Again, **snippets + playlist / feed of key moments** = standard CI pattern. Reels are implicit rather than branded as such.

---

## 2. So is your highlight-reel feature table stakes?

Depends **which market lens** you choose:

* **UX / product research stack (Dovetail, Looppanel, Maze, etc.)**

  * Having **highlight clips + stitched reels + share links** = yes, table stakes. Dovetail, Looppanel, Maze all shout about this.([LinkedIn][11])
* **Sales conversation intelligence (Gong, Clari, Salesloft, etc.)**

  * **Snippets** are non-negotiable table stakes.
  * Explicit “reels” are more of a **nice-to-have UX layer**; the real buying drivers are pipeline visibility, coaching, forecasts.

Your feature as we scoped it (decision-centric, cross-persona reels tied to themes) **is *not* table stakes in either camp yet**. The primitives (snips + stitching) are table stakes; the *decision-question framing + story arc + evidence coverage* is not.

---

## 3. How you can position / differentiate vs each

Here’s where your version can be clearly “not just another reels feature”.

### Versus Dovetail & Looppanel

They do:

* Text/tag-driven reels for **insights & themes**.
* AI to pick “important moments” from transcripts.

They do **not** (as far as public material shows):

* Anchor reels to **explicit decision questions / bets** (“Should we prioritize X over Y for segment Z?”).
* Guarantee **balanced coverage** across personas, stages, and segments automatically.
* Present reels as a **structured story arc** (Problem → Impact → Workarounds → Current solutions → Desired outcome); they’re more like playlists of good moments.([Looppanel][2])

So you can claim:

> Not just highlight reels – **“decision reels”** that answer a specific question with balanced, cross-segment evidence.

And back it with:

* scoring model (impact + recency + emotion + diversity),
* arc-based ordering,
* overlays showing which decision question / theme each clip supports.

---

### Versus Gong & Clari

They optimize for **rep coaching & revenue intelligence**, with:

* snippets,
* keyword alerts,
* talk–listen ratios,
* deal risk indicators, etc.([Clari][10])

Your reel feature can:

* Operate across **customer discovery, product interviews, sales, CS** — not just sales calls.
* Sit inside a broader **evidence → insight → decision** pipeline rather than just coaching.

So you don’t need to “beat Gong at snippets”; you can:

* **Import Gong/Clari calls** (recording URL, transcript),
* turn their calls into **multi-source decision reels** that combine qual interviews + sales calls + support conversations.

That’s a very different narrative: **“bridge research and revenue teams around the same evidence reels.”**

---

## 4. Strategic answer for you

* **Yes**, the underlying mechanics (transcript highlights, snippets, stitched reels, share links) are now **hygiene** in both UX research and CI categories.
* **No**, a **decision-centric, auto-balanced reel builder** that:

  * starts from a **decision question/bet**,
  * picks clips using an evidence-aware scoring model,
  * structures them as a **story arc**,
  * and plugs directly into your insights & personas views
    is **not widely available** and is a credible differentiator.

I’d treat it as:

1. **Hygiene layer**: “Of course you can cut clips & reels like Dovetail/Looppanel.”
2. **Differentiator layer**: “But our reels are *about decisions*, not just themes.”

If you want, next we can do:

* a **positioning grid** (you vs Dovetail/Looppanel/Gong/Clari just on this feature), and
* 2–3 **marketing one-liners** for the website and in-app copy that make this sound obviously better than “just highlight reels.”

Confidence: high.

[1]: https://docs.dovetail.com/help/highlights?utm_source=chatgpt.com "Highlights"
[2]: https://www.looppanel.com/blog/dovetail-ai?utm_source=chatgpt.com "Dovetail AI Review: Is It Worth The Hype?"
[3]: https://dovetail.com/changelog/embed-highlight-reels-in-other-tools/?utm_source=chatgpt.com "Embed highlight reels in other tools"
[4]: https://help.looppanel.com/en/articles/8267823-how-ai-notes-on-looppanel-work?utm_source=chatgpt.com "🤖 How AI Notes on Looppanel Work"
[5]: https://help.looppanel.com/en/articles/11010020-how-to-make-reels-on-looppanel?utm_source=chatgpt.com "🎞️ How to Make Reels on Looppanel"
[6]: https://help.gong.io/docs/create-a-call-snippet?utm_source=chatgpt.com "Create a call snippet"
[7]: https://help.gong.io/docs/review-what-happened-in-a-call?utm_source=chatgpt.com "Review what happened in a call"
[8]: https://www.claap.io/blog/gong-call-recording?utm_source=chatgpt.com "Gong Call Recording: Features, Setup & Pricing Guide [2026]"
[9]: https://community.clari.com/community-announcements-3/become-a-pro-at-call-recording-and-reviewing-on-copilot-301?utm_source=chatgpt.com "Become a Pro at Call Recording and Reviewing on Copilot"
[10]: https://www.clari.com/conversation-intelligence/?utm_source=chatgpt.com "Conversation Intelligence"
[11]: https://www.linkedin.com/learning/getting-started-with-dovetail-for-ux-projects/key-dovetail-features?utm_source=chatgpt.com "Key Dovetail features - Reason Video Tutorial"
