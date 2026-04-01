# UpSight MCP Server — Strategy & Implementation Spec

> **Status**: Phase 1 implemented (API key auth + 11 read tools)
> **Branch**: `claude/agent-crm-upsight-OvEFf`
> **Last updated**: 2026-03-20

---

## Strategic Context

### One-Liner
**"Human-curated intelligence, agent-consumed at scale."**

Against Gong: *"Gong records your sales calls. UpSight turns all your customer conversations into searchable, verifiable intelligence that any AI agent can reason over — at 1/10th the price."*

### Market Landscape

| Market | Size (2026) | Growth | Relevance |
|---|---|---|---|
| Conversation Intelligence | $4.5-6B | 14-28% CAGR | Core market — Gong, Chorus |
| Online Survey Software | $5-6B | 14-19% CAGR → $15-18B by 2031 | Adjacent — SurveyMonkey, Typeform |
| AI Agents | $7.6B → $183B by 2033 | 49.6% CAGR | Future market — agent infrastructure |
| MCP Ecosystem | 97M+ monthly SDK downloads | Explosive | Distribution mechanism |

### Competitive Landscape

| Player | Revenue | MCP Status | What They Miss |
|---|---|---|---|
| **Gong** | $300M+ ARR, 5K+ customers | MCP server shipped Oct 2025 | Calls only, bolt-on architecture, $1,200-1,600/user/yr |
| **Salesforce Agentforce** | $540M ARR | MCP via platform | CRM-first, not intelligence-first |
| **SurveyMonkey** | ~$500M ARR | None | Zero intelligence, zero conversation linking |
| **Typeform** | ~$100M ARR, 36% YoY growth | None | Beautiful forms, zero analysis |
| **Qualtrics** | $1.7B ARR (SAP) | None | Enterprise-only, $100K+ deals |

**Nobody connects surveys + conversations + notes into searchable, agent-queryable intelligence.**

---

## GTM Strategy

### Primary Wedge
PMs and sales people using **Claude cowork** (or ChatGPT/Cursor) with UpSight MCP connector.

**Demo that sells itself:**
1. Open Claude Desktop
2. Connect UpSight MCP server with API key
3. Ask: "What are customers saying about pricing?"
4. Get evidence-backed answers with exact quotes and attribution

No dashboard. No training. No onboarding.

### Agent-Native vs Bolt-On (How We Explain It)

**The dinner party analogy:**
- **Bolt-on** (Gong, Salesforce): You built a house, then added a kitchen. The plumbing wasn't designed for it.
- **Agent-native** (UpSight): You designed the house knowing dinner parties were the whole point.

**Technical differences:**

| | Bolt-On (Gong) | Agent-Native (UpSight) |
|---|---|---|
| Data model | Human dashboards → API | Machine reasoning from day 1 |
| Evidence | Transcript highlights (unstructured) | Typed evidence with attribution, confidence, themes |
| Query pattern | "Get calls from last week" | "Find evidence supporting claim X across all sources" |
| Context efficiency | Returns raw transcripts (token-heavy) | Returns distilled evidence (token-efficient) |
| Multi-source | Calls only | Calls + notes + imports + surveys |

### Survey as Landing Pad (Not Distraction)

The survey market is $5-6B and growing fast. But we're not building a "better survey tool."

**Position:** Surveys that feed your customer intelligence graph. The survey is an ingestion mechanism — the product is the connected intelligence.

**Who cares:** Everyone who does surveys AND talks to customers — PMs, marketers, CS, non-profits, consultants. Much bigger than "UX researchers."

---

## ICP & Personas

| Persona | Company | Title | Pain | WTP/mo | TAM |
|---|---|---|---|---|---|
| **AI-Forward Founder** (Primary) | Series A-C, 20-200 emp, B2B SaaS | CEO, CPO | Can't search 200 calls, can't prove customers want Feature X | $200-500 | $180M |
| **Product Leader at Scale** | Series C+, 200-2K emp | VP Product, Director | Gong owned by Sales, needs cross-functional intelligence | $500-2K | $180M |
| **Agent Builder** (Infrastructure) | AI-native companies | CTO, Head of AI | Agents need verified evidence, not just intent signals | $1-5K | $120M→$1.2B |
| **Survey + Research Users** | Any size, product-led | PM, Marketer, CS Lead | Surveys in SurveyMonkey, calls in Gong, insights die in Notion | $100-500 | $120M+ |

**Who we don't target:** UX Researchers as a standalone persona (skeptical of AI, low budget authority, small market).

### Agent Builder Segment — Deep Dive

**Why $24K ARPU is plausible:** Companies spend $50-150K/yr per human SDR. AI SDR costs $2-5K/mo. Customer intelligence infrastructure is a rounding error on agent spend.

**Target companies:**

| Company | Funding | What They Have | What's Missing (UpSight fills) |
|---|---|---|---|
| **11x.ai** (Alice) | Series B, $50M+ | LinkedIn data, email reply history | No call transcripts, no quote database, no cross-customer patterns |
| **Artisan AI** (Ava) | Series A, $25M+ | 300M contacts, firmographic data | Personalization is demographic only, not evidence-based |
| **Warmly** | Series B | Website visitor tracking, intent signals | Behavioral signals only — knows who's interested, not what they said |
| **Salesforge** (Agent Frank) | Growing | Email A/B results, response rates | Learns what messaging works statistically, zero customer voice data |
| **Conversica** | Enterprise | Multi-turn email history, engagement scoring | Remembers own conversations, can't reference what other customers said |

**In-house builders (larger opportunity):** Teams building with LangChain, OpenAI Agents SDK, Microsoft Semantic Kernel, Google ADK, CrewAI, AutoGen. Every Series B+ company with an internal AI copilot project needs customer intelligence APIs.

**Unique features needed:**
1. Evidence-grounded claim generation (verified quotes with attribution)
2. Competitive intelligence from conversations
3. Deal-specific briefing packs
4. Programmatic theme subscriptions
5. Confidence-scored assertions

---

## Capability Matrix — "Who Cares How Much"

| Capability | SF | HubSpot | Gong | **UpSight** | Who Cares | Priority |
|---|---|---|---|---|---|---|
| Contact/Deal CRUD | Yes | Yes | No | Yes | Everyone | **3/10** — commodity |
| Pipeline management | Yes | Yes | No | Partial | Sales managers | **2/10** — solved |
| Call recording + transcription | No | No | Yes | Yes | Sales teams | **5/10** — Gong owns this |
| **Semantic search over conversations** | No | No | Yes | **Yes** | PMs, founders | **9/10** |
| **Evidence with exact quotes + timestamps** | No | No | Partial | **Yes** | Legal, CS, founders | **8/10** |
| Structured lens analysis (BANT, JTBD) | No | No | Partial | **Yes** | Sales enablement | **5/10** — hard to explain |
| **Theme/pattern clustering** | No | No | Partial | **Yes** | Product, VPs | **9/10** |
| Persona segmentation | No | No | No | **Yes** | Product marketing | **5/10** |
| **Multi-source ingestion** | No | No | Calls only | **Yes** | Customer research | **9/10** |
| **Survey + conversation linking** | No | No | No | **Yes** | PMs, marketers | **8/10** |
| **Agent-native (MCP-first)** | Bolt-on | Bolt-on | Bolt-on | **Yes** | AI-forward teams | **8/10** |
| Works without CRM | No | No | No | **Yes** | Startups, researchers | **6/10** |
| **Price (10x cheaper)** | $$$$ | $$$ | $$$$ | **$** | Everyone | **9/10** |

---

## Market Sizing

| Segment | Companies | ARPU/yr | TAM |
|---|---|---|---|
| AI-forward startups (primary) | 50,000 | $3,600 | $180M |
| Product-led mid-market | 15,000 | $12,000 | $180M |
| Survey-as-ingestion users | 100,000+ | $1,200 | $120M+ |
| Agent builder infrastructure | 5,000→50,000 | $24,000 | $120M→$1.2B |
| **Total addressable** | | | **$600M→$1.7B+** |

Serviceable addressable (SAM, next 2 years): ~$50-100M

---

## Implementation Architecture

### Phase 1: Auth + Intelligence Read (SHIPPED)

**Database:**
- `project_api_keys` table: hash-only storage, soft revoke, scoped to project+account
- Key format: `upsk_<32 hex chars>` (SHA-256 hash stored)

**MCP Server (`app/mastra/mcp-server.ts`):**
- Resolves `UPSIGHT_API_KEY` at startup → project/account context
- 11 read-only tools registered:

| Tool | Purpose |
|---|---|
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

**API Key Management UI:**
- Added to project settings page
- Generate, copy (show-once), list, revoke
- MCP config snippet shown for Claude Desktop

**Tests:**
- 9 unit tests for key generation/hashing
- 12 tool registration tests

### Phase 2: CRM Write Operations (Next)

Keep lean — only tools agents actually need:
- `upsert_person` — create/update with auto org link
- `manage_people` — list, get, delete
- `create_task` — with assignee resolution
- `manage_tasks` — list, update, complete
- `manage_annotations` — notes/comments on any entity

Defer: `manage_organizations`, `manage_opportunities` (commodity CRM ops)

### Phase 3: Import + Survey Intelligence (Future)

- `import_video_from_url` — multi-source ingestion differentiator
- Survey mutations only if demand emerges from agent builders

### Claude Desktop Config

```json
{
  "mcpServers": {
    "upsight": {
      "command": "npx",
      "args": ["tsx", "<path>/app/mastra/mcp-server.ts"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "OPENAI_API_KEY": "...",
        "UPSIGHT_API_KEY": "upsk_..."
      }
    }
  }
}
```

---

## Sources

- [Gong MCP Announcement (Oct 2025)](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others)
- [Conversation Intelligence Market Size](https://www.businessresearchinsights.com/market-reports/conversation-intelligence-platform-market-102311)
- [Online Survey Software Market](https://www.precedenceresearch.com/online-survey-software-market)
- [AI Agents Market — MarketsAndMarkets](https://www.marketsandmarkets.com/Market-Reports/ai-agents-market-15761548.html)
- [Agentic AI Enterprise 2026 Analysis](https://tech-insider.org/agentic-ai-enterprise-2026-market-analysis/)
- [AI Agent Adoption Statistics](https://www.salesmate.io/blog/ai-agents-adoption-statistics/)
- [MCP vs A2A Protocol Guide](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li)
- [a16z Deep Dive on MCP](https://a16z.com/a-deep-dive-into-mcp-and-the-future-of-ai-tooling/)
- [AI-Native vs Bolt-On Architecture](https://medium.com/@the_AI_doctor/ai-native-vs-ai-bolted-on-architectures-a-technical-white-paper-for-enterprise-decision-makers-bf081efdc648)
- [Top AI SDR Platforms 2026](https://www.landbase.com/blog/top-ai-sdr-platforms-in-2025)
