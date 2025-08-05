# Insights Ops Voting

### 1. What UX research teams actually do

| Context                             | Common method                              | Why it works                                                       | Typical tooling                        |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------- |
| Daily, asynchronous knowledge base  | **Binary “thumbs-up / thumbs-down”**       | Fast, zero training, good enough to flag duplicates & obvious gems | Airtable/Notion reactions, Dovetail 👍 |
| Sprint / workshop prioritisation    | **Dot voting (1 vote ≈ 1 dot per person)** | Equal voice, simple tally on Miro/Post-it walls                    | Miro, FigJam, paper dots               |
| Road-mapping & resourcing decisions | **2-axis Impact × Effort (or ICE / RICE)** | Forces trade-off thinking, reveals “quick wins” vs. “bets”         | Google Sheets, ProdPad, Productboard   |

> **Take-away:** Teams start with binary votes, then step up to a *structured* score only when they need to schedule real work. A 1-5 “like” scale rarely survives long—it adds noise but no insight.

---

### 2. Design options for your app

| Option                                               | Data captured                        | Pros                                  | Cons                                                   |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------ |
| **A. Binary vote** (current)                         | `+1 / –1`                            | Fast, recognisable, good for large N  | Early votes bias list; no notion of effort             |
| **B. Single dot per member**                         | `1` per user (no down-vote)          | Equalises influence, one click        | Still ignores effort; workshop-only feel               |
| **C. Likert 1-5**                                    | `1–5` per user                       | Finer grain of “importance”           | People interpret numbers differently; averages mislead |
| **D. Impact (1-5) + Effort (1-5)**                   | Two scores per user                  | Enables ICE (Impact ÷ Effort) or RICE | Slightly longer form; needs good UI                    |
| **E. Full RICE** (Reach, Impact, Confidence, Effort) | Four numbers per user or facilitator | Industry-standard roadmap score       | Too heavy for most contributors; requires guidance     |

---

### 3. Best-practice guidance

1. **Keep voting atomic**
   Track one row per user × insight no matter which scheme you choose.

   ```sql
   create table insight_votes (
     id          uuid primary key default gen_random_uuid(),
     insight_id  uuid references insights(id) on delete cascade,
     user_id     uuid references auth.users(id) on delete cascade,
     impact      int  /* 1–5 or null */,
     effort      int  /* 1–5 or null */,
     value       int  /* +1, -1 or null */,
     inserted_at timestamptz default now(),
     unique (insight_id, user_id)  -- guarantees one vote each
   );
   ```

   Materialise an `insight_priority` view that rolls up count, net score, avg impact, avg ICE, etc.

2. **Surface *relative* priority, not raw totals**

   * For binary votes use a Wilson-score ranking (reduces early-bird bias).
   * For Impact × Effort calculate **ICE = Impact ÷ (Effort or 1)**; sort by ICE descending.

3. **Match the UI to the moment**

   * **Card-level quick vote**: keep 👍 / 👎 visible on every insight.
   * **“Prioritise” mode** (modal or separate page): show a 5 × 5 grid where each teammate drags the insight to the cell that best represents Impact vs. Effort. Save scores in the same table.
   * Display a quadrant chart (bubble size = # votes) so patterns jump out; let users filter by their own votes vs. team median.

4. **Default to anonymity, log identity**
   Showing aggregated scores keeps the interface clean, but storing `user_id` lets you:

   * Enforce single votes and allow edits.
   * Audit decisions later (“Why did we pick this?”).
   * Weight votes differently in the future (e.g., researcher vs. engineer).

5. **Progressive enhancement roadmap**

   | Phase                            | Shipping scope                                            | Effort   |
   | -------------------------------- | --------------------------------------------------------- | -------- |
   | **1. Binary** (today)            | Add vote table & Wilson-ranked list; expose 👍 / 👎 in UI | 1–2 days |
   | **2. Impact × Effort**           | Activate “Prioritise” mode; reuse same table, new columns | 3–5 days |
   | **3. ICE/RICE or custom fields** | Allow admins to toggle scoring schema via settings        | backlog  |

---

### 4. Recommendation

1. **Keep the current 👍 / 👎 for lightweight, continuous signal.**
2. **Add a “Prioritise insights” workshop view that records *Impact* and *Effort* (1–5 each) per user.**

   * Stores richer data without over-engineering.
   * Supports both async input and live voting sessions.
3. **Compute ICE automatically and rank by it in the backlog list.**
4. **Log every vote row, but reveal only aggregates in the UI.**
5. **Avoid a plain 1-5 single score**—it gives neither direction (effort) nor clear priority benefit.

This path mirrors how UX teams naturally mature their insight workflows while keeping complexity—and database design—under tight control.
