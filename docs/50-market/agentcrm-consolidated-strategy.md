# AgentCRM / UpSight MCP — Consolidated Strategy

> **Status**: Active | **Last Updated**: 2026-03-21
> **Purpose**: Single source of truth for the agent-distribution strategy. Supersedes fragments across `mcp-server-strategy.md`, `OPENCLAW-STRATEGY.md`, and prior session notes.

---

## 1. The Strategic Position

### Why This, Not That

We explored three options during planning:

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: MCP Skill → UpSight** | Build an open-source MCP server that connects agents to UpSight as the backend | **Chosen** |
| **B: Open-Source Standalone CRM** | Build a separate, self-hosted CRM for agents | Rejected — splits engineering focus, duplicates what UpSight already does |
| **C: Hybrid (Skill + Open-Source SDK)** | MCP server + lightweight open-source client library | Partial — the MCP server IS the open-source component |

**Why A wins**: UpSight already has the CRM (people, orgs, opportunities), the intelligence engine (evidence, themes, lenses, personas), and 88 Mastra tools. Building a second CRM is wasted effort. The MCP server is a distribution channel for the existing platform, not a new product.

**The key reframe**: We initially pitched "CRM for agents." Research killed that positioning — Salesforce, HubSpot, Attio, and Gong all shipped MCP servers by early 2026. CRM CRUD is commodity. What they can't do is answer: *"What did enterprise customers say about our pricing vs. competitors, and what evidence backs it up?"*

**Final position**: **Customer intelligence layer for agents, not agent CRM.**

### One-Liner

> "Customer intelligence your AI agents can reason over."

### The 30-Second Pitch

Every AI agent — your sales copilot, your support bot, your product analyst — needs to know what customers actually said. Not CRM fields. Not pipeline stages. Real evidence: who said what, when, with confidence scores. UpSight gives any AI agent that memory, via MCP. Connect in 30 seconds. First 5 conversations free.

### Category

**Agent-Native Customer Intelligence** — not CRM, not conversation intelligence, not a research repository. A new category at the intersection of all three.

### How We Explain "Agent-Native" vs "Bolt-On"

**The dinner party analogy:**
- **Bolt-on** (Gong, Salesforce): You built a house, then decided to add a kitchen. The plumbing wasn't designed for it.
- **Agent-native** (UpSight): You designed the house knowing dinner parties were the whole point.

| Dimension | Bolt-On (Gong, Salesforce) | Agent-Native (UpSight) |
|-----------|---------------------------|------------------------|
| Data model | Designed for human dashboards, adapted for API | Designed for machine reasoning from day 1 |
| Evidence | Transcript highlights (unstructured) | Typed evidence with attribution, confidence, themes (structured) |
| Query pattern | "Get calls from last week" (list fetch) | "Find evidence supporting claim X across all sources" (semantic) |
| Context efficiency | Returns raw transcripts (token-heavy) | Returns distilled evidence (token-efficient) |
| Multi-source | Calls only | Calls + notes + imports + surveys + PDFs |

---

## 2. Who We Serve

### Primary Personas (Agent Distribution)

| Persona | Company | Pain | WTP/mo | TAM |
|---------|---------|------|--------|-----|
| **AI-Forward Founder** (Primary) | Series A-C, 20-200 people, B2B SaaS | Can't search 200 calls, can't prove customers want Feature X | $200-500 | $180M |
| **Product Leader at Scale** | Series C+, 200-2K people | Gong is owned by Sales; needs cross-functional intelligence | $500-2K | $180M |
| **Agent Builder** (Infrastructure) | AI-native companies (11x.ai, Warmly, Artisan, Conversica) | Agents need verified evidence, not just intent signals | $1-5K | $120M→$1.2B |
| **Survey + Research Users** | Any size, product-led | Surveys in SurveyMonkey, calls in Gong, insights die in Notion | $100-500 | $120M+ |

### Agent Builder Segment (Highest Growth)

These companies are building the *mouth* (outreach, messaging, engagement) but none are building the *memory* (what customers actually said, evidence, patterns). UpSight is the memory layer.

| Company | What They Have | What's Missing (UpSight fills) |
|---------|---------------|-------------------------------|
| **11x.ai** (Alice) | LinkedIn data, email history | No quote database, no cross-customer patterns |
| **Artisan AI** (Ava) | 300M contacts, firmographic data | Personalization is demographic only, not evidence-based |
| **Warmly** | Website visitor tracking, intent signals | Knows who's interested, not what they said |
| **Salesforge** (Agent Frank) | Email A/B results, response rates | Zero customer voice data |
| **Conversica** | Multi-turn email history | Can't reference what *other* customers said |

**In-house builder teams** (LangChain, OpenAI SDK, Semantic Kernel, Google ADK, CrewAI, AutoGen) may be an even larger opportunity — every Series B+ company with an internal AI copilot project needs customer intelligence APIs.

### Who We Don't Target via Agent Distribution

- **UX Researchers** as standalone persona — skeptical of AI, low budget authority, small market
- **Enterprise sales teams** — invites Gong/Salesforce comparison where we lose
- Companies that don't talk to customers

---

## 3. Competitive Landscape

### Capability Matrix — "Who Cares How Much"

| Capability | Salesforce | HubSpot | Gong | **UpSight** | Priority |
|------------|-----------|---------|------|-------------|----------|
| Contact/Deal CRUD | Yes | Yes | No | Yes | 3/10 — commodity |
| Pipeline management | Yes | Yes | No | Partial | 2/10 — solved |
| Call recording | No | No | Yes | Yes | 5/10 — Gong owns |
| **Semantic search over conversations** | No | No | Yes | **Yes** | **9/10** |
| **Evidence with exact quotes + timestamps** | No | No | Partial | **Yes** | **8/10** |
| Structured lens analysis (BANT, JTBD) | No | No | Partial | **Yes** | 5/10 |
| **Theme/pattern clustering** | No | No | Partial | **Yes** | **9/10** |
| **Multi-source ingestion** | No | No | Calls only | **Yes** | **9/10** |
| **Survey + conversation linking** | No | No | No | **Yes** | **8/10** |
| **Agent-native (MCP-first)** | Bolt-on | Bolt-on | Bolt-on | **Yes** | **8/10** |
| **Price (10x cheaper)** | $$$$ | $$$ | $$$$ | **$** | **9/10** |

### Competitive Positioning

**Against Gong**: "Gong records your sales calls. UpSight turns all your customer conversations into searchable, verifiable intelligence any AI agent can reason over — at 1/10th the price."

**Against Salesforce AgentForce**: "Salesforce lets your agent look up contacts and update deal stages. UpSight lets your agent answer 'What did our top 10 customers say about pricing, and what exact quotes prove it?'"

**Against HubSpot MCP**: "HubSpot's MCP server gives agents read-only access to CRM objects. UpSight gives agents semantic search over every customer conversation, with evidence attribution you can verify."

**Against Day.ai**: "Day.ai captures context but can't expose it programmatically — no SDK, no API, no MCP. UpSight makes intelligence accessible to any agent on any platform."

### Three Wedges That Win

1. **Price** — Gong costs $1,200+/user/yr. UpSight Pro is $948/yr for the whole team (per-project, not per-seat).
2. **Multi-source** — Gong only does calls. The moment someone needs to search across calls AND research interviews AND survey responses, Gong can't help.
3. **MCP-native architecture** — The data model (evidence + themes + lenses) was designed for machine reasoning, not human browsing.

---

## 4. Differentiators (The Moat)

### Hard to Copy

- **Evidence graph**: Connection layer between insight and source across all conversation types
- **Multi-source synthesis**: Unified model across calls, surveys, tickets, notes, transcripts, PDFs
- **Research lenses**: Structured analysis frameworks (BANT, JTBD, competitive) — not generic tagging
- **Trust through transparency**: "Show receipts" paradigm — click any theme, see who said it

### Easy to Copy (Not Our Moat)

- Transcription (commodity)
- AI summaries (everyone has GPT)
- CRM CRUD (literally everyone)
- Pretty dashboards

### The Litmus Test

> "Was the AI added to the product, or was the product built around the AI?"

UpSight's evidence model (quotes + attribution + confidence + themes + lenses) exists because machines need structured, verifiable data to reason well. Humans benefit from the structure too, but it was designed for agent consumption.

---

## 5. Market Sizing

| Segment | Companies | ARPU/yr | TAM |
|---------|-----------|---------|-----|
| AI-forward startups (primary) | 50,000 | $3,600 | $180M |
| Product-led mid-market | 15,000 | $12,000 | $180M |
| Survey-as-ingestion users | 100,000+ | $1,200 | $120M+ |
| Agent builder infrastructure | 5,000→50,000 | $24,000 | $120M→$1.2B |
| **Total addressable** | | | **$600M→$1.7B+** |

Serviceable addressable (SAM, next 2 years): ~$50-100M

Adjacent markets: Conversation Intelligence ($4.5-6B), Online Survey Software ($5-6B), AI Agents ($7.6B→$183B by 2033).

---

## 6. Pricing Strategy

### Design Principles

1. **Per-project, not per-seat** — Everyone else charges per-seat. A 10-person team on Gong pays $14,000/yr. On UpSight Pro: $948/yr.
2. **Generous free tier** — Hook on the evidence habit. Limit AI intelligence, not access.
3. **Predictable base + transparent overages** — No opaque AI credits.
4. **Agent/MCP access included** — Not a premium feature. It IS the product.

### Tiers

| Plan | Price | Target | Key Limits |
|------|-------|--------|------------|
| **Free** | $0/mo | Hook | 5 conversations/mo, 50 AI queries, read-only MCP |
| **Starter** | $29/mo | Solo founders, consultants | 25 conversations, 500 AI queries, full MCP |
| **Pro** | $79/mo | Product teams, sales enablement | 100 conversations, 5K AI queries, lens analysis |
| **Scale** | $199/mo | Agent builders, mid-market | 500 conversations, 25K AI queries, bulk API |
| **Enterprise** | Custom | Compliance-heavy orgs | Volume pricing, HIPAA, data residency |

### Agent Builder API (Usage-Based Alternative)

| Operation | Price | COGS | Margin |
|-----------|-------|------|--------|
| Evidence query (semantic search) | $0.005 | ~$0.00001 | 99%+ |
| AI analysis call (theme, lens) | $0.03 | ~$0.01 | 70% |
| Conversation ingestion | $1.50 | ~$0.40 | 73% |

### Launch Tactics

- **Founding Member**: $19/mo locked for life (first 100 projects)
- **Agent Builder Program**: Free 6 months for 20 companies (11x.ai, Warmly, etc.)

Full pricing analysis: [pricing-strategy.md](./pricing-strategy.md)

---

## 7. Platform Distribution (Agent Platforms as Channels)

### The Flywheel

```
Developer finds UpSight MCP on Claude/ChatGPT/OpenClaw
        ↓
Installs MCP server, gets API key (free tier)
        ↓
Needs data → uploads conversations / imports contacts
        ↓
Sees evidence, themes, intelligence in the dashboard
        ↓
Team discovers the human UI → broader adoption
        ↓
Upgrades to paid ($29-79/mo)
        ↓
Tells other developers → repeat
```

This is the Twilio/Stripe playbook: developer discovers via API → team adopts the dashboard → enterprise expands.

### Platform Compatibility

| Platform | Protocol | How It Connects |
|----------|----------|-----------------|
| **Claude Desktop/Code** | MCP (stdio) | `claude_desktop_config.json` or Claude Connector |
| **Claude.ai (web)** | MCP (remote SSE) | Connectors / integrations page |
| **ChatGPT** | OpenAI Actions (OpenAPI) | Custom GPT or ChatGPT Connector |
| **OpenClaw** | MCP (stdio or remote) | ClawHub skill listing |
| **Cursor / Windsurf** | MCP (stdio) | `.cursor/mcp.json` |
| **Custom agents** | REST API + SDK | `@upsight/sdk` npm package |
| **Zapier / Make** | REST API | Webhook + API key auth |

### Two Deployment Modes

1. **stdio (local)**: `npx @agentcrm/mcp-server --api-key upsk_...` — for Claude Desktop, Cursor
2. **SSE/Streamable HTTP (remote)**: Hosted at `mcp.getupsight.com/v1` — for web agents, enterprise

### Demo That Sells Itself (60 seconds)

1. Open Claude Desktop (or ChatGPT)
2. "What did customers say about our onboarding experience?"
3. Agent returns 4 evidence items with exact quotes, speaker names, timestamps
4. "Which customers mentioned pricing concerns in the last 30 days?"
5. Agent returns people with evidence, cross-referenced across calls AND survey responses
6. "Create a brief for the product team about the top 3 themes"
7. Agent generates a brief backed by verifiable evidence

**Why this wins**: No login, no dashboard, no training. The agent platform IS the UI.

---

## 8. User Flows by Persona

### Developer / Agent Builder
1. Connect MCP → `fetch_themes` → `semantic_search_evidence("pricing objections")` → structured JSON with confidence scores
2. **"Wow" moment**: "This is a customer intelligence API I can build on"

### PM / Founder (via Claude Desktop)
1. "What should we build next based on customer feedback?" → evidence-backed prioritization with receipts
2. **"Wow" moment**: "I can ask my AI assistant and get answers with proof"

### Consultant
1. Upload 3 stakeholder interviews → ask Claude "What are the key disagreements between stakeholders?" → attributed quotes
2. **"Wow" moment**: "I just saved 2 days of synthesis"

### Sales Leader
1. "Which deals have pricing risk?" → evidence from actual call quotes → "Draft a response addressing their concerns"
2. **"Wow" moment**: "It's like Gong but my agent can actually use it"

---

## 9. What's Built (PRD of Current State)

### MCP Server (`app/mastra/mcp-server.ts`)

**Phase 1 — Intelligence Read (Shipped)**

API key auth (`upsk_` format, SHA-256 hash stored, project-scoped) + 11 read tools:

| Tool | Purpose |
|------|---------|
| `semantic_search_evidence` | Vector + keyword search across all evidence |
| `fetch_evidence` | Filtered evidence with interview/person joins |
| `fetch_themes` | Themes with evidence counts |
| `fetch_people_details` | Rich person read (facets, orgs, evidence) |
| `fetch_surveys` | Survey list with response counts |
| `search_survey_responses` | Aggregated responses with stats |
| `fetch_interview_context` | Full interview with participants + empathy map |
| `fetch_personas` | Persona definitions |
| `fetch_segments` | Customer segments |
| `semantic_search_people` | Vector search on people by traits |
| `fetch_project_status` | Project overview (counts, health) |

**Phase 2 — CRM Write (Shipped)**

7 write tools:

| Tool | Purpose |
|------|---------|
| `upsert_person` | Create/update person with auto org linking |
| `manage_people` | List, get, delete people |
| `create_task` | Create task with assignee resolution |
| `update_task` | Update task status/fields |
| `delete_task` | Archive task |
| `mark_task_complete` | Quick completion |
| `manage_annotations` | Notes/comments on any entity |

### API Key Infrastructure

| Component | Status |
|-----------|--------|
| Schema: `supabase/schemas/50_api_keys.sql` | Written |
| Library: `app/lib/api-keys.server.ts` | Shipped (generate, hash, resolve, list, revoke) |
| UI: `ApiKeyManager` in project settings | Shipped |
| API Route: `app/features/api-keys/api/manage.tsx` | Shipped |
| Tests: 43 passing (9 unit + 12 tool registration + 14 edge case + 8 QA) | Green |

### Agent-CRM Standalone Server (`mcp-servers/agent-crm/`)

Separate MCP server with 16 CRM CRUD tools across people, organizations, opportunities. Uses `@modelcontextprotocol/sdk` directly. Has npm package config (`@agentcrm/mcp-server`), MIT license, README.

**Plan**: Merge intelligence tools from `mcp-server.ts` into this package (v0.3) so external users get one install with everything.

### Marketing Assets Built

| Asset | Location |
|-------|----------|
| Landing page (dark, dev-focused) | `docs/50-market/agentcrm-landing.html` |
| Pricing strategy | `docs/50-market/pricing-strategy.md` |
| Keyword research (15 keywords) | `docs/50-market/agentcrm-keyword-research.md` |
| OpenClaw distribution strategy | `mcp-servers/agent-crm/docs/OPENCLAW-STRATEGY.md` |
| Docs platform evaluation (Mintlify) | `docs/50-market/docs-platform-evaluation.md` |

### UX: Settings Gear Icon

Added settings gear icon to the TeamSwitcher component in the sidebar, linking to project settings where API key management lives.

---

## 10. What's Left to Win

### Phase 0: Foundation (Must-Do Before Launch)

| Task | Why | Effort |
|------|-----|--------|
| Run `supabase db diff` to generate migration from `50_api_keys.sql` | API keys can't work without the table | 1 hour |
| End-to-end test: generate key → configure Claude Desktop → query evidence | Validate the demo flow actually works | Half day |
| Merge two MCP servers into one npm package (`@agentcrm/mcp-server` v0.3) | Users shouldn't configure two servers | 1-2 days |
| Usage metering (track AI query counts per API key) | Required for overage billing | 1-2 days |

### Phase 1: Launch (Weeks 1-2)

| Task | Why |
|------|-----|
| npm publish `@agentcrm/mcp-server` | One-command install: `npx @agentcrm/mcp-server` |
| SSE/Streamable HTTP transport | Remote MCP for Claude.ai web, enterprise |
| OpenAPI spec auto-generation | Gets ChatGPT Custom Actions for free |
| ClawHub listing submission | OpenClaw is 285K+ stars, first CRM intelligence listing |
| Demo video: 60-second Claude Desktop flow | The single most important marketing asset |
| "Show HN" post | Developer audience, loves OSS MCP servers |
| Reddit posts (r/ClaudeAI, r/ChatGPT, r/LocalLLaMA) | "I built an MCP server that gives agents customer intelligence" |

### Phase 2: Distribution (Weeks 3-6)

| Task | Why |
|------|-----|
| ChatGPT Custom Action or GPT | Broad user base, PMs and founders |
| OAuth 2.0 flow | Required for marketplace listings where users click "Connect" |
| Blog post: "Building a Customer Intelligence API" | Low-competition keyword, developer audience |
| Blog post: "Why Your AI Agent Is Flying Blind Without Customer Context" | Explains MCP + UpSight |
| Agent Builder Program outreach (11x.ai, Warmly, Artisan, etc.) | 20 companies, free Scale tier for 6 months |
| Webhook support (notify agent when new evidence extracted) | Agent builders need event-driven workflows |

### Phase 3: Scale (Month 2+)

| Task | Why |
|------|-----|
| Conversation ingestion via MCP (`log_conversation` tool) | Close the loop: ingest → analyze → query |
| Multi-project support in MCP server | Enterprise requirement |
| Rate limiting by tier | Protect margins |
| Docs site (Mintlify free tier + UpSight's own AI for Q&A) | Developer experience |
| Agent-to-agent handoff | Moltbook-era: seller's agent negotiates with buyer's agent |

### SEO Keywords to Own (Near-Zero Competition)

1. "conversation intelligence for AI agents" — Very Low competition, literally no one
2. "MCP server CRM" — Low, we're already built
3. "customer data for AI agents" — Low, developer-intent
4. "customer intelligence API" — Medium, white space in builder-agent context
5. "evidence-based selling" — Very Low, category creation opportunity
6. "conversation receipts CRM" — Very Low, no one using this language

---

## 11. GTM Plan (Agent Distribution Channel)

### Channel Priority (Agent-Specific)

| Channel | Content | Why |
|---------|---------|-----|
| **Claude Desktop / Claude.ai** | MCP Connector in settings | Primary wedge — PMs already use Claude daily |
| **ClawHub marketplace** | Skill listing + demo | 285K+ OpenClaw users, underserved CRM category |
| **ChatGPT Actions** | Custom GPT or Connector | Broadest user base for PMs and founders |
| **r/ClaudeAI + r/ChatGPT** | "I built an MCP server that gives agents customer intelligence" | These subs love MCP tools |
| **Hacker News** | Show HN | Developer audience, loves open-source |
| **Twitter/X** | Thread: "Your AI agent hallucinates about customers. Here's why." | AI/product Twitter hungry for real tools |
| **MCP Discord + awesome-mcp-servers** | PR + announcement | Direct reach to MCP ecosystem builders |
| **Dev.to / Hashnode** | Tutorial: "Build a customer intelligence agent with UpSight MCP + Claude" | SEO + developer education |

### Content Angles That Resonate

1. **"Receipts, not summaries"** — Every competitor just summarizes. You prove.
2. **"Agent-native, not agent-bolted"** — Built for AI from day one, not a legacy CRM with a chatbot added.
3. **"One command to connect"** — `npx @agentcrm/mcp-server` is the hook. Low friction wins.
4. **"10x cheaper than Gong"** — UpSight Pro costs less per YEAR than Gong costs per MONTH for one user.

### Example Agents to Ship (Best Marketing)

1. **Meeting prep bot** — "Brief me on Sarah Chen before my 2pm call"
2. **Post-call analyzer** — "I just finished a call, here's the transcript, analyze it"
3. **Weekly digest** — "What did customers say this week that I should know about?"

### Success Metrics

| Metric | Month 1 | Month 3 |
|--------|---------|---------|
| API keys created | 50 | 500 |
| Daily active keys | 10 | 100 |
| npm downloads (weekly) | 100 | 1,000 |
| Paid conversions from MCP | 2 | 20 |
| GitHub stars | 25 | 200 |

---

## 12. Naming & Branding Decision

### Recommendation: Lead with AgentCRM for Developer GTM, UpSight for Platform

| Brand | Audience | Use |
|-------|----------|-----|
| **AgentCRM** (agentcrm.dev) | Developers, agent builders, MCP ecosystem | npm package, ClawHub listing, HN/Reddit |
| **UpSight** (getupsight.com) | PMs, founders, consultants, teams | Web app, dashboards, marketing site |

"AgentCRM, powered by UpSight" — or — "UpSight MCP Server" depending on audience.

**Why not rename everything to AgentCRM**: The brand brief explicitly warns against CRM positioning (invites Salesforce/HubSpot comparison). AgentCRM works for developers who think in tools; UpSight works for buyers who think in outcomes.

### Open Source Strategy

- **MIT license on `@agentcrm/mcp-server`** — builds trust, lets community contribute
- **UpSight platform stays closed-source SaaS** — the intelligence is in the backend
- The MCP server is a thin client; the moat is the evidence engine

---

## 13. Relationship to Existing GTM

This agent-distribution strategy is **additive** to the existing UpSight GTM plan (consultants → founders → PMs via LinkedIn, direct outreach, Product Hunt). It opens a new channel:

| Existing GTM | Agent Distribution GTM |
|-------------|----------------------|
| Human discovers UpSight via LinkedIn/SEO/referral | Developer discovers MCP server via Claude/ClawHub/HN |
| Signs up, uploads conversations manually | Installs MCP server, queries programmatically |
| Value delivered through web UI | Value delivered through agent responses |
| Per-project subscription | Same subscription (MCP access included) |
| Converts on "time saved" | Converts on "intelligence accessible to my agent" |

Both funnels lead to the same UpSight subscription. The agent channel is expected to grow faster as MCP adoption accelerates (97M+ monthly SDK downloads and climbing).

---

## Appendix: Source Documents

| Document | What's In It | Status |
|----------|-------------|--------|
| `docs/features/mcp-server-strategy.md` | Original MCP strategy + implementation spec | Superseded by this doc |
| `docs/50-market/pricing-strategy.md` | Full pricing analysis with competitive benchmarks | Active (companion) |
| `docs/50-market/brand-brief.md` | Canonical UpSight positioning (v3.1) | Active (parent doc) |
| `docs/50-market/positioning-brief.md` | Tactical messaging, objection handling | Active (companion) |
| `docs/50-market/gtm-plan-2026.md` | Full UpSight GTM with budget, calendar, channels | Active (companion) |
| `docs/50-market/agentcrm-keyword-research.md` | 15 SEO keywords + 7 blog post ideas for AgentCRM | Active (companion) |
| `docs/50-market/agentcrm-landing.html` | Landing page with tabbed setup guides | Active |
| `mcp-servers/agent-crm/docs/OPENCLAW-STRATEGY.md` | OpenClaw distribution plan | Partially superseded |
| `docs/50-market/docs-platform-evaluation.md` | Mintlify evaluation | Active |
| `docs/50-market/user-success-journeys.md` | Per-persona activation flows | Active (companion) |
