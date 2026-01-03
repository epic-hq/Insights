# Competitive Analysis

This directory contains competitive analysis for key competitors in the customer research and conversation intelligence space.

## Our Positioning

**UpSight**: All-in-one customer intelligence platform for **product AND sales teams**.

Not just product research. Not just sales intelligence. Both.

**Key Differentiators**:
1. **Voice-First Setup** - Natural language onboarding, not enterprise forms
2. **AI Interviewer** - LiveKit agent that conducts and guides research
3. **Human + AI Hybrid** - AI assists, humans lead when needed (VoicePanel is AI-only)
4. **Research Frameworks** - Lenses for structured analysis (not just generic tagging)
5. **Consumer-Grade UX** - Typeform-style simplicity with professional features

See [our-honest-assessment.md](./our-honest-assessment.md) for an unvarnished look at our strengths and weaknesses.

---

## Competitor Landscape

### Direct Competitors (Same Space)

| Company | Category | Threat | Revenue/Stage | Our Edge |
|---------|----------|--------|---------------|----------|
| [VoicePanel](./voicepanel.md) | AI Voice Research | **HIGH** | $2.4M seed, YC W24 | Human+AI hybrid (they're AI-only) |
| [Dovetail](./dovetail.md) | Research Repository | **HIGH** | $4.9M ARR, $57M raised | Voice-first, simpler UX, AI collection |

### Adjacent Competitors (Different Focus)

| Company | Category | Threat | Revenue/Stage | Why Different |
|---------|----------|--------|---------------|---------------|
| [Looppanel](./looppanel.md) | UX Research AI | Medium-High | $1.1M raised | Analysis-only (we collect too) |
| [Notably](./notably.md) | Research Synthesis | Medium | Unknown | Analysis-only |
| [Condens](./condens.md) | Research Repository | Medium | Unknown | Two-interface pattern to learn from |
| [Discuss.io](./discuss-io.md) | Enterprise Research | Medium | $6M ARR (2019) | Enterprise complexity vs. our simplicity |
| [Grain](./grain.md) | AI Notetaker | Medium | $20M raised | Text-based clips pattern |

### CRM with Conversation Intelligence

| Company | Category | Threat | Revenue/Stage | Why Different |
|---------|----------|--------|---------------|---------------|
| [Nutshell](./nutshell.md) | CRM + AI | Medium | ~$5-11M ARR | CRM-first (we're research-first) |
| [Clarify](./clarify.md) | Autonomous CRM | Medium | $15M raised | CRM automation (we're insight extraction) |

### Sales Intelligence (Different Buyer)

| Company | Category | Threat | Revenue/Stage | Why Different |
|---------|----------|--------|---------------|---------------|
| [Gong](./gong.md) | Revenue Intelligence | Low | $300M+ ARR, $7B val | Sales-only, enterprise pricing |
| [Chorus](./chorus.md) | Conversation Intel | Low | Acquired by ZoomInfo | Sales-only |

### Meeting Notetakers (Different Use Case)

| Company | Category | Threat | Revenue/Stage | Why Different |
|---------|----------|--------|---------------|---------------|
| [Fathom](./fathom.md) | AI Notetaker | Low-Med | $21.8M raised | Meeting notes (we're research insights) |
| [Granola](./granola.md) | AI Notes App | Low | Unknown | Personal productivity |

### Research Recruiting (Complementary)

| Company | Category | Threat | Revenue/Stage | Why Different |
|---------|----------|--------|---------------|---------------|
| [User Interviews](./userinterviews.md) | Research Recruiting | None | 6M+ participants | Recruiting (we're analysis) - integration opportunity |

---

## Threat Matrix

| Competitor | Threat | Reasoning |
|------------|--------|-----------|
| VoicePanel | **HIGH** | Same space, YC backing, shipped AI interviewer |
| Dovetail | **HIGH** | Market leader, resources, direct competition |
| Looppanel | Medium-High | Same buyer, strong UX patterns |
| Discuss.io | Medium | Enterprise presence, could simplify |
| Grain | Medium | Good UX, could add research features |
| Clarify | Medium | If we target sales, they compete |
| Nutshell | Medium | If we target sales, they compete |
| Condens | Medium | Smart design, could grow |
| Notably | Medium | Good AI, could add collection |
| Fathom | Low-Med | Different category, could expand |
| Gong | Low | Different market, won't simplify |
| Chorus | Low | Different market, ZoomInfo focused |
| Granola | Low | Personal productivity focus |

---

## Key Market Data

| Competitor | Revenue | Customers | Funding | Employees |
|------------|---------|-----------|---------|-----------|
| Gong | $300M+ ARR | 4,800+ | $7.25B val | 1,000+ |
| Dovetail | $4.9M ARR | Unknown | $57M | 190 |
| Fathom | Unknown | 8,500+ (HubSpot) | $21.8M | 10 |
| Discuss.io | $6M (2019) | 100+ | $7.7M | 55 |
| Nutshell | $5-11M | Thousands | $5.6M | 63-76 |
| Clarify | Unknown | Unknown | $15M | ~25 |
| VoicePanel | Pre-revenue | Unknown | $2.4M | 3 |
| Looppanel | ~$213K | PandaDoc, etc. | $1.1M | Unknown |
| User Interviews | Unknown | Thousands | Unknown | Unknown |

---

## Pricing Landscape

| Competitor | Model | Price Range |
|------------|-------|-------------|
| Looppanel | Per user | $27/mo |
| Fathom | Freemium | Free + $19-39/mo |
| Clarify | Credit-based | Free + $20/mo |
| Nutshell | Per user | $13-79/mo |
| Granola | Per user | $14-35/mo |
| Dovetail | Per user | ~$30-50/mo (hidden) |
| Gong | Enterprise | $100-150+/user/mo |
| Discuss.io | Enterprise | Contact sales |

**Implication**: We need transparent, competitive pricing. Consider:
- Free tier (like Fathom, Clarify)
- ~$20-40/mo for individuals
- Team pricing for collaboration

---

## UX Patterns to Adopt

Priority patterns from competitive research:

| Pattern | Source | Priority | Notes |
|---------|--------|----------|-------|
| Two interfaces (researcher + stakeholder) | Condens | **High** | Critical for adoption |
| Question-grouped analysis | Looppanel | **High** | Game-changer for insights |
| Text-based highlight creation | Grain | **High** | Click transcript = clip |
| Traceability for AI outputs | Looppanel | **High** | Trust-building |
| Recipes/templates | Granola | Medium | Repeatable prompts |
| Role-based dashboards | Gong | Medium | Rep/Manager/VP views |
| Free stakeholder access | Looppanel | Medium | Adoption driver |
| Natural language search | Dovetail, Fathom | Medium | "Ask" feature |
| Credit-based AI pricing | Clarify | Consider | Fair for heavy/light users |

---

## User Flows to Study

Detailed flows documented in competitor files:

| Flow | Best Implementation | Why |
|------|---------------------|-----|
| AI Interview | VoicePanel | Follow-up questions based on answers |
| Call Analysis | Gong | Role-based views, emotional analytics |
| Research Analysis | Dovetail | Multiple view modes (board/canvas/table) |
| Meeting Notes | Granola | Enhance user notes with AI (not replace) |
| Highlight Creation | Grain | Select transcript text = video clip |
| Timeline Summary | Nutshell | Summarize all interactions with contact |

---

## Watch List

Trends and developments to monitor:

| Competitor | Watch For |
|------------|-----------|
| VoicePanel | Human moderation features, Series A, pricing |
| Dovetail | Voice features, UX improvements, acquisitions |
| Gong | Product team features, SMB tier |
| Clarify | Growth, feature expansion |
| Grain | Research-specific features |
| Fathom | Research features, analysis layer |
| User Interviews | Analysis features, AI interviewer |

---

## Adding New Competitors

When adding a new competitor analysis:

1. Create `{company-name}.md` in this directory
2. Include:
   - Overview and positioning
   - **Market data** (revenue, customers, funding, employees)
   - **Pricing** (all tiers with prices)
   - Key products/features
   - Strengths and weaknesses
   - **GTM strategy**
   - **User flows** (with diagrams)
   - How we beat them (specific tactics)
   - **Where they beat us** (honest assessment)
   - Threat assessment
3. Update this README with the new entry
4. Update [our-honest-assessment.md](./our-honest-assessment.md) if relevant

---

*Last updated: 2025-01-02*
