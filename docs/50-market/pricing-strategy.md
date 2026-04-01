# UpSight / AgentCRM Pricing Strategy

> **Status**: Draft v1 | **Author**: Mary (Business Analyst) | **Date**: 2026-03-20
> **Objective**: No-brainer pricing competitive with Gong, Attio, Day.ai — targeting 70% gross margins at scale, traction-first early on.

---

## 1. Competitive Pricing Landscape

### The Market Map (March 2026)

| Product | Category | Free Tier | Starter | Mid-Tier | Enterprise | Pricing Model |
|---|---|---|---|---|---|---|
| **Gong** | Conv Intelligence | No | — | $1,298-1,600/user/yr | $50K platform fee + $1,200/user/yr | Per-seat + platform fee + onboarding |
| **Attio** | AI-Native CRM | 3 users free | $29/user/mo | $59/user/mo | $119/user/mo | Per-seat, self-serve |
| **Day.ai** | AI-Native CRM | Yes (limited) | ~$10/user/mo | TBD | TBD | Per-seat (early, post-Series A) |
| **Grain** | Conv Intelligence | Unlimited recordings | $15/user/mo | $29/user/mo | $48/user/mo | Per-seat, self-serve |
| **Fireflies.ai** | Meeting Notes | 800 min/mo free | $10/user/mo | $19/user/mo | $39/user/mo | Per-seat + AI credits |
| **tl;dv** | Meeting Notes | Unlimited (90-day retention) | $18/user/mo | $59/user/mo | Custom | Per-seat |
| **Fathom** | Meeting Notes | Unlimited recordings, 5 AI summaries/mo | $16/mo | $15/user/mo | $25/user/mo | Per-seat |
| **Otter.ai** | Transcription | 300 min/mo | $8.33/user/mo | — | Custom | Per-seat |

### Key Observations

1. **The "Gong Tax"**: Gong charges $28K-170K+ Year 1. Minimum viable Gong deal is ~$30K. This is UpSight's biggest pricing wedge — 10x cheaper and you get MORE (multi-source, not just calls).

2. **The $10-29/user/mo Sweet Spot**: Every competitor from Attio to Fireflies lands here for starter plans. This is the price point where teams say "yes" without procurement.

3. **Free Tiers Win Adoption**: Day.ai, Fathom, tl;dv, Fireflies all offer generous free tiers. Fathom's "unlimited recordings, 5 AI summaries/mo" is particularly clever — it hooks you on the recording habit, then upsells on intelligence.

4. **AI Credit Systems Are Hated**: Fireflies' AI credits are universally criticized. Avoid this model.

5. **Per-Seat Pricing Under Pressure**: Attio and Day.ai both face pushback from teams that want "the whole company to benefit" without paying per-seat. Agent builders especially hate per-seat — they want per-project or usage-based.

---

## 2. UpSight's Unit Economics

### Cost Structure Per Customer

| Cost Component | Monthly Estimate | Notes |
|---|---|---|
| **Supabase (Postgres + pgvector)** | $0.50-2/project | Scales with evidence count; pgvector embeddings are stored, not re-computed |
| **OpenAI Embeddings** (ada-003) | $0.10-0.50/project/mo | ~$0.00002/1K tokens; one-time per evidence item; search queries are cheap |
| **OpenAI/Anthropic for Analysis** | $1-5/project/mo | Theme extraction, lens analysis, survey review; batch operations |
| **Trigger.dev** (background jobs) | $0.50-1/project/mo | Transcription pipelines, async processing |
| **AssemblyAI Transcription** | $0.37/hour of audio | Biggest variable cost; ~$2-10/interview |
| **R2 Storage** (audio/video) | $0.015/GB/mo | Cheap; ~$0.50/project/mo for 30 hours |
| **Infrastructure (Fly.io + edge)** | $0.50-1/project/mo | Shared across customers |

### Gross Margin Scenarios

| Tier | Revenue/project/mo | COGS/project/mo | Gross Margin |
|---|---|---|---|
| **Free** (5 conversations) | $0 | ~$3 | -100% (acquisition cost) |
| **Starter** ($29/mo) | $29 | ~$5 | **83%** |
| **Pro** ($79/mo) | $79 | ~$12 | **85%** |
| **Team** ($29/user × 5 users) | $145 | ~$15 | **90%** |
| **Agent Builder** ($199/mo) | $199 | ~$20 | **90%** |
| **Heavy usage** (100+ conversations/mo) | $199+ | ~$40 | **80%** |

**Key insight**: The biggest variable cost is transcription ($0.37/hour). Everything else is pennies. As long as we're not giving away unlimited transcription on free, margins stay above 70%.

Smart model routing (use GPT-4o-mini for 80% of operations, GPT-4o/Claude for complex analysis only) keeps AI costs under control. Embeddings are nearly free and only computed once per evidence item.

---

## 3. Recommended Pricing Model

### Design Principles

1. **Project-based, not per-seat** — Differentiation vs. everyone else. Teams share one project. No "how many licenses do I need?" friction.
2. **Generous free tier** — Hook on the recording + evidence habit. Limit AI intelligence, not access.
3. **Predictable base + transparent overages** — No opaque AI credits. Generous included usage with clear per-unit overages. Users always know what they'll pay.
4. **Agent access included** — MCP/API access is not a premium feature. It's the product.
5. **Traction first** — Price low enough that it's a no-brainer impulse buy. Raise later.

### The Plans

---

#### **FREE** — $0/mo
*"See what your customers actually said"*

| Included | Limit |
|---|---|
| 1 project | — |
| 5 conversations/mo (interviews, notes, imports) | Rolling |
| 50 AI queries/mo (theme, lens, analysis) | Rolling |
| Unlimited semantic search (embedding lookups) | — |
| Unlimited survey responses | — |
| Basic evidence extraction | — |
| 2 team members | — |
| MCP server access (read-only) | — |
| Community support | — |

**NOT included**: Theme clustering, persona generation, lens analysis, export, write via MCP

**Why this works**: 5 conversations is enough to feel the magic. They upload 3 sales calls and 2 research interviews. See evidence extracted. Semantic search is free (embeddings cost ~$0.000004/query) so they get hooked on searching. Want themes? Upgrade. Want to connect Claude? Free MCP read works, but write requires Starter+.

**Margin**: Negative (~$3/mo COGS). Acquisition cost. Cap at ~2,000 free projects before reviewing.

---

#### **STARTER** — $29/mo per project
*"Your AI-powered customer intelligence system"*

| Included | Limit |
|---|---|
| 1 project | — |
| 25 conversations/mo | Rolling |
| 500 AI queries/mo (theme, lens, analysis) | Rolling; $0.03/query overage |
| Unlimited semantic search | — |
| Unlimited survey responses | — |
| Full evidence extraction + themes | — |
| Persona & segment generation | — |
| 5 team members | — |
| MCP server (read + write) | — |
| Email support | — |

**Target buyer**: Solo founder, small PM team, consultant
**Comparison**: Cheaper than Attio Plus ($29/seat), cheaper than Grain Business ($48/seat), **40x cheaper than Gong minimum**
**AI query COGS**: 500 queries × ~$0.005 avg = ~$2.50/mo. Overage at $0.03 = ~70% margin on overages.
**Margin**: ~83%

---

#### **PRO** — $79/mo per project
*"Cross-source intelligence for growing teams"*

| Included | Limit |
|---|---|
| 1 project | — |
| 100 conversations/mo | Rolling; $1.00/conversation overage |
| 5,000 AI queries/mo | Rolling; $0.02/query overage |
| Unlimited semantic search | — |
| Everything in Starter | — |
| Lens analysis (BANT, JTBD, competitive) | — |
| Advanced theme clustering | — |
| ICP scoring | — |
| Unlimited team members | — |
| MCP server (full access) | — |
| Priority support | — |
| Export & API access | — |

**Target buyer**: Product team at Series A-C, sales enablement lead
**Comparison**: Less than 1 Gong seat ($108/mo minimum). Less than 2 Attio Pro seats ($118/mo).
**AI query COGS**: 5,000 queries × ~$0.005 avg = ~$25/mo. Overage at $0.02 = ~60% margin.
**Margin**: ~85%

---

#### **SCALE** — $199/mo per project (or $149/mo annual)
*"Customer intelligence infrastructure for your agents and team"*

| Included | Limit |
|---|---|
| 1 project | — |
| 500 conversations/mo | Rolling; $0.75/conversation overage |
| 25,000 AI queries/mo | Rolling; $0.015/query overage |
| Unlimited semantic search | — |
| Everything in Pro | — |
| Agent builder API (bulk queries, webhooks) | — |
| Programmatic theme subscriptions | — |
| Confidence-scored evidence API | — |
| Custom lens templates | — |
| SSO / SAML | — |
| Dedicated support + Slack channel | — |
| Multiple MCP server instances | — |

**Target buyer**: Agent builder companies, mid-market product orgs, companies with 50+ interviews/mo
**Comparison**: Less than the Gong platform fee alone ($50K/yr vs $1,788/yr). Fraction of agent infrastructure budgets.
**AI query COGS**: 25,000 queries × ~$0.005 avg = ~$125/mo. Overage at $0.015 = ~50% margin (volume discount).
**Heavy agent builder example**: 50K queries/mo = $199 + (25K × $0.015) = $574/mo — still 10x cheaper than Gong.
**Margin**: ~75-90% (depends on volume; transcription is the swing factor)

---

#### **ENTERPRISE** — Custom
*"For organizations with compliance, security, and scale requirements"*

| Included | Notes |
|---|---|
| Multiple projects | Per-account pricing |
| Volume conversation pricing | Negotiated |
| HIPAA compliance | If needed |
| Private cloud / data residency | — |
| Custom integrations | — |
| Dedicated CSM | — |
| SLA | 99.9% uptime |

**Target**: Large enterprise with multiple teams using UpSight. $500-2,000/mo depending on scope.

---

### AI Query Cost Reference (March 2026)

Understanding our COGS per AI operation to validate overage pricing:

| Operation | Model Used | Approx Tokens (in/out) | Cost/Call | Notes |
|---|---|---|---|---|
| **Semantic search** (embedding lookup) | text-embedding-3-small | ~200 in | **$0.000004** | Essentially free — unlimited on all tiers |
| **Evidence summary** | GPT-4o-mini | ~2K/500 | **$0.0006** | Cheap, high-volume operation |
| **Theme extraction** | Claude Sonnet 4.5 | ~4K/2K | **$0.042** | Most common "AI query" |
| **Lens analysis** (BANT, JTBD) | Claude Sonnet 4.5 | ~8K/3K | **$0.069** | Heavier analysis |
| **Full interview analysis** | Claude Opus 4.6 | ~15K/5K | **$0.20** | Premium operation |
| **Daily brief workflow** | Mixed (3-5 calls) | ~20K total | **$0.15-0.30** | Multi-step workflow |

**Blended average**: ~$0.005-0.01/query with smart model routing (80% mini/Haiku, 20% Sonnet/Opus).

**Key pricing decisions:**
- Semantic search is **always free** — it's the hook ($0.000004/call is noise)
- "AI queries" = theme, lens, analysis, briefs — the expensive stuff
- Overages at $0.015-0.03/query give 50-70% margin on variable cost
- Prices drop ~80% YoY — we can pass savings to customers or improve margins

**Model routing strategy:**
- GPT-4o-mini / Haiku 4.5 for evidence extraction, summaries, simple queries
- Claude Sonnet 4.5 for theme clustering, lens analysis, survey review
- Claude Opus 4.6 only for complex multi-step reasoning (daily briefs, ICP scoring)
- Prompt caching reduces input costs by 90% for repeated system prompts

---

### Agent Builder API — Pure Usage-Based Option

For companies integrating UpSight as infrastructure (like Twilio/Stripe pricing):

| Operation | Price | COGS | Margin |
|---|---|---|---|
| Evidence query (semantic search) | $0.005/query | ~$0.00001 | 99%+ |
| AI analysis call (theme, lens) | $0.03/call | ~$0.01 | 70% |
| Conversation ingestion | $1.50/conversation | ~$0.40 | 73% |
| Embedding generation | $0.001/item | ~$0.00002 | 98% |
| **Volume discount** | 20% off at 10K+/mo queries | — | — |

**Why offer this**: Agent builders (11x.ai, Artisan, Warmly) expect infrastructure pricing. They don't want tiers — they want predictable unit economics they can build into their own pricing model.

---

## 4. Competitive Positioning

### The Price Comparison That Sells

```
                        Annual Cost for a 10-Person Team
┌─────────────────────────────────────────────────────────────┐
│ Gong (Foundation)     ████████████████████████████  $66,000 │
│ Gong (Bundled)        ████████████████████████████████████  │
│                                                     $80,000 │
│ Attio Pro             ████                          $7,080  │
│ Grain Business        █████                         $5,760  │
│ Fireflies Business    ███                           $2,280  │
│ UpSight Pro           █                               $948  │
│ UpSight Starter       ░                               $348  │
└─────────────────────────────────────────────────────────────┘
```

**Key message**: UpSight Pro costs less per YEAR than Gong costs per MONTH for one user.

### Why Per-Project Beats Per-Seat

| Model | 5 People | 10 People | 25 People | 50 People |
|---|---|---|---|---|
| Gong ($1,400/user/yr) | $7,000 | $14,000 | $35,000 | $70,000 |
| Attio Pro ($59/user/mo) | $3,540 | $7,080 | $17,700 | $35,400 |
| **UpSight Pro ($79/mo)** | **$948** | **$948** | **$948** | **$948** |

Per-project pricing means the whole team benefits. The PM, the sales lead, the founder, the CS manager — everyone searches the same intelligence. No "we only have 3 Gong licenses" problem.

### Agent Builder Value Proposition

For companies like 11x.ai, Artisan, Warmly:

| What They Pay Now | What UpSight Costs |
|---|---|
| $50-150K/yr per human SDR | — |
| $2-5K/mo per AI SDR agent | — |
| $0 on customer intelligence for agents | **$199/mo** |

**The pitch**: "Your AI SDR costs $5K/mo. For $199/mo, give it a memory of what customers actually said. Evidence-backed outreach converts 2x better than demographic spam."

---

## 5. Margin Protection Strategies

### Transcription (Biggest Variable Cost)

| Strategy | Impact |
|---|---|
| Cap free tier at 5 conversations | Prevents margin bleed |
| Batch transcription (not real-time) for imported content | 40% cheaper |
| AssemblyAI volume discounts at scale | 20-30% reduction at 1000+ hours/mo |
| User-provided transcripts (Zoom, Teams auto-transcribe) | Zero transcription cost |
| Import text notes (no audio) | Zero transcription cost |

### AI Processing

| Strategy | Impact |
|---|---|
| GPT-4o-mini for 80% of operations (evidence extraction, summaries) | 10x cheaper than GPT-4o |
| GPT-4o/Claude only for theme clustering, lens analysis, survey review | Quality where it matters |
| Cache embeddings (compute once, reuse forever) | Near-zero marginal cost for search |
| Batch processing via Trigger.dev (off-peak) | Lower API costs |

### Target Margin by Stage

| Stage | Target Gross Margin | Rationale |
|---|---|---|
| **0-500 customers** | 60-70% | Traction > margin. Generous free tier. |
| **500-2,000 customers** | 70-75% | Optimize model routing, negotiate API rates |
| **2,000+ customers** | 75-80% | Volume discounts, potential custom models |

---

## 6. Launch Pricing (First 90 Days)

### "Founding Member" Offer

```
🚀 UpSight Founding Member — $19/mo (locked for life)
   Everything in Pro ($79 value)
   Limited to first 100 projects
   "You're building this with us"
```

**Why**: Creates urgency, seeds word-of-mouth, gets 100 paying customers fast. At $19/mo with ~$12 COGS, margin is ~37% — acceptable for early traction. These customers become case studies.

### Free Beta for Agent Builders

```
🤖 Agent Builder Program — Free for 6 months
   Everything in Scale ($199 value)
   Must integrate via MCP and provide feedback
   Limited to 20 companies
```

**Why**: Get 11x.ai, Artisan, Warmly, etc. using UpSight as customer intelligence infrastructure. Their success stories become the most compelling marketing. Zero revenue, but the strategic value is immense.

---

## 7. Pricing Evolution Roadmap

| Quarter | Action | Why |
|---|---|---|
| **Q2 2026** | Launch Free + Starter ($29) + Founding Member ($19) | Traction. Get 200+ projects. |
| **Q3 2026** | Introduce Pro ($79) + Scale ($199) | Upsell path for growing teams |
| **Q4 2026** | Retire Founding Member offer | Scarcity + FOMO for late adopters |
| **Q1 2027** | Introduce Enterprise tier | As enterprise interest materializes |
| **Q2 2027** | Usage-based add-ons (extra conversations) | Monetize heavy users without raising base price |

---

## 8. The No-Brainer Test

For each persona, does the pricing pass the "no-brainer" test?

| Persona | Their Current Spend | UpSight Price | No-Brainer? |
|---|---|---|---|
| **Solo founder** | $0 (spreadsheets) or $200/mo (Gong minimum) | Free → $29/mo | **Yes** — less than a lunch |
| **PM at startup** | $0 (Notion) + $500/mo (meeting tool) | $29-79/mo | **Yes** — cheaper than their current stack |
| **Sales team (10 people)** | $14,000/yr (Gong) | $948/yr (Pro) | **Yes** — 15x cheaper |
| **Agent builder** | $0 (nothing exists) | $199/mo | **Yes** — rounding error on $5K/mo agent cost |
| **Consultant** | $0 (manual analysis) | $29/mo | **Yes** — saves 10+ hours/mo |

**Verdict: Every persona passes.** The pricing is aggressive enough to remove objections while maintaining 70%+ margins at the Starter tier and above.

---

## Sources

- [Gong Pricing Breakdown 2026](https://marketbetter.ai/blog/gong-pricing-breakdown-2026/)
- [Gong Pricing — Claap](https://www.claap.io/blog/gong-pricing)
- [Attio Pricing Breakdown 2026](https://marketbetter.ai/blog/attio-crm-pricing-breakdown-2026/)
- [Attio Official Pricing](https://attio.com/pricing)
- [Day.ai Series A — Upstarts Media](https://www.upstartsmedia.com/p/day-ai-sequoia-ai-crm)
- [Grain Pricing — Claap](https://www.claap.io/blog/grain-pricing)
- [Fireflies.ai Pricing — Lindy](https://www.lindy.ai/blog/fireflies-ai-pricing)
- [tl;dv Pricing — Claap](https://www.claap.io/blog/tl-dv-pricing)
- [Fathom Pricing — Alfred](https://get-alfred.ai/blog/fathom-pricing)
- [Otter.ai Pricing — tl;dv](https://tldv.io/blog/otter-pricing/)
- [Economics of AI-First B2B SaaS 2026](https://www.getmonetizely.com/blogs/the-economics-of-ai-first-b2b-saas-in-2026)
- [AI SaaS Gross Margins — SaaStr](https://www.saastr.com/have-ai-gross-margins-really-turned-the-corner-the-real-math-behind-openais-70-compute-margin-and-why-b2b-startups-are-still-running-on-a-treadmill/)
- [Hidden AI Tax 2026 — Valere](https://www.valere.io/ai-infrastructure-costs-gross-margin-erosion/)
- [How to Price AI Products 2026](https://www.news.aakashg.com/p/how-to-price-ai-products)
