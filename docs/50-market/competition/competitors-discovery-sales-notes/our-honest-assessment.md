# Honest Assessment: UpSight vs. Competition

*Created: 2026-01-02*
*Purpose: Internal reality check - no sugar coating*
*Discussion*: includes Rick's thoughts and things to consider. AI should take this into consideration and potentially update the document. Make note of any changes in discussion section.

## Our Positioning

**Claim**: All-in-one customer intelligence platform for product AND sales teams.

**Reality Check**: We're early stage, trying to serve two audiences (product + sales). This is ambitious and potentially unfocused.

**Discussion**: Agreed. However, for SMBs (and especially startups), I wonder if having a single tool is beneficial vs the higher cost of separate tools and integration and complexity.

---

## Where We're Strong (Genuine Advantages)

### 1. Voice-First Setup
**Claim**: Natural language onboarding, not enterprise forms.
**Reality**:
- LiveKit agent is working with 30 tools
- MCP tools is minimal work to add
- **Nobody else has shipped this for research setup**
- Competitors (Dovetail, Looppanel) are form-based

**Verdict**: ✅ REAL ADVANTAGE

### 2. Human + AI Hybrid
**Claim**: AI assists, humans lead when needed.
**Reality**:
- VoicePanel is AI-only (no human option)
- Discuss.io has human OR AI (not blended)
- Our approach lets users choose
- Some research needs human judgment

**Verdict**: ✅ REAL ADVANTAGE (if we ship it well)

### 3. Research Lenses/Frameworks
**Claim**: Structured analysis, not just generic tagging.
**Reality**:
- Lenses exist in our codebase
- Competitors use generic tagging (Dovetail, Looppanel, Notably)
- Gong has sales-specific frameworks, but we have research ones

**Discussion**: Fathom.ai has some kind of templates I think. We lack keyword search, and packaged features like "detect competitor" or "detect upsell".

**Verdict**: ✅ REAL ADVANTAGE (execution matters)

---

## Where We're Weak (Honest Problems)

### 1. Market Presence: Non-Existent
| Competitor | ARR | Customers | Employees |
|------------|-----|-----------|-----------|
| Gong | $300M+ | 4,800+ | 1,000+ |
| Dovetail | $4.9M | Unknown | 190 |
| Fathom | Unknown | 8,500+ (HubSpot) | 10 |
| VoicePanel | Pre-revenue | Early | 3 |
| **UpSight** | **Pre-revenue** | **Pre-launch** | **Small** |

**Reality**: We have no brand recognition. Zero.

### 2. Integration Ecosystem: Almost Nothing
| Competitor | Integrations |
|------------|--------------|
| Gong | 250+ |
| Dovetail | 50+ |
| Nutshell | 5,000+ (via Zapier) |
| **UpSight** | **Few** |

**Discussion**: We need a good integration story. Top of mind use cases include:
1. meeting recordings (zoom, google meet, teams) which we can do via recall.ai - working alpha is in progress, eta Jan 15.
2. Automated meeting join & transcription based on calendar invite (Nothing here yet)
3. Inputs for user research
	- a. import xls/csv, docs, pdfs - we do csv, docs partly
	- b. linked & sync (docs, sheets) could do with picaos
4. Write-back updates to existing CRM (Nothing here yet)
5. Email workflow input to CRM, AI analysis (Nothing here yet)

**Reality**: Teams need tools that work with what they have.

### 3. Enterprise Features: Not Ready
- No SSO
- No SOC2 compliance
- No audit logs
- No team management (discussion: we do orgs, basic permissions management, but no admin features)
- No custom roles/permissions

**Reality**: We can't sell to enterprise today.

### 4. Repository Maturity: Early Stage
- Dovetail has years of iteration on search, organization, sharing
- Looppanel has question-grouped analysis nailed
- We're building basics

**Discussion**: agreed. what is quesiton-grouped analysis? how can we identify key research-needed features and nail them?

**Reality**: Our repository is functional but not differentiated.

### 5. Pricing: Not Defined
| Competitor | Pricing |
|------------|---------|
| Looppanel | $27/mo |
| Fathom | Free + $19/mo |
| Clarify | Free + credit-based |
| Nutshell | $13-79/mo |
| **UpSight** | **TBD** |

**Reality**: We can't even tell users what we cost.

**Discussion**: agreed. What strategy makes sense here that doesn't have us losing money? processing and storing conversations is not free, and we are bootstrapped. We need a strategy that doesn't have us losing money. One that gets users to pay for the value they get. Maybe some number of free contacts and translations, but not too many? TBD. High importance.


### 6. AI Interviewer: Not Shipped
- VoicePanel has shipped AI-conducted interviews
- We have LiveKit working, but not the full interview flow
- They're ahead on this specific capability

**Reality**: Our "differentiator" isn't shipped yet.

---

## Competitive Threats: Reality Check

### VoicePanel (HIGHEST THREAT)
**Why dangerous**:
- Same space (AI voice research)
- YC W24 + strong angels (Dropbox, Instacart founders)
- Already shipped AI interviewer
- If they add human modes, our differentiation shrinks

**Discussion**: agreed. But can we credibly make the claim that voice-first and human options work best for this early-stage, high-touch market?

**Our actual advantage**: Human+AI hybrid (if we ship it)

### Dovetail (HIGH THREAT)
**Why dangerous**:
- Market leader, $700M+ valuation
- $57M to execute
- Could buy a voice startup
- Direct competitor for product teams

**Our actual advantage**: Voice-first (they might copy), simpler UX (subjective)

### Clarify/Nutshell (MEDIUM THREAT)
**Why dangerous**:
- CRM + conversation intelligence
- If we target sales teams, they're already there
- Better pricing transparency than us
- Simpler value prop (CRM that just works)

**Our actual advantage**: Depth of research analysis

---

## The Hard Questions

### 1. Are we too broad?
**Product teams** want: Research repository, interview analysis, insight sharing
**Sales teams** want: CRM integration, deal intelligence, coaching

Can we serve both well? Or are we half-assing two things?

### 2. Is voice-first actually differentiated?
- Granola: Native app, no bot, beautiful
- Fathom: Free, simple, accurate
- VoicePanel: AI conducts interviews
- Clarify: Ask Meeting queries

Voice is becoming table stakes. Is our implementation special enough?

### 3. Can we ship fast enough?
- VoicePanel is live with AI interviewer
- Dovetail has 190 people iterating
- Gong has $300M ARR for R&D

We need to move faster than well-funded competitors.

### 4. What's our actual wedge?
Options:
1. **Research + Sales in one** - Unique but complex
2. **Voice-first setup** - Differentiating but copyable
3. **Human + AI hybrid** - Unique if shipped well
4. **Simplicity** - Dovetail has UX issues we can exploit

**Best bet**: Focus on Human + AI hybrid for customer research. It's defensible and neither VoicePanel (AI-only) nor Dovetail (no AI interviews) can copy easily.

---

## Recommended Actions

### Immediate (This Week)
1. **Ship AI interviewer** - VoicePanel is ahead
2. **Define pricing** - Can't sell without it
3. **Focus positioning** - Pick product OR sales teams first

### Short-Term (This Month)
1. **Nail the hybrid experience** - Our actual differentiation
2. **Build basic integrations** - Slack, Zoom at minimum
3. **Launch publicly** - Need market feedback

### Medium-Term (This Quarter)
1. **Enterprise basics** - SSO, compliance for upmarket
2. **Expand integrations** - CRM connections for sales angle
3. **Build case studies** - Social proof matters

---

## Summary

| Area | Honest Assessment |
|------|-------------------|
| Voice-first setup | ✅ Real advantage, needs polish |
| Human + AI hybrid | ✅ Real advantage, needs shipping |
| Research lenses | ✅ Real advantage, needs usage |
| Market presence | ❌ Non-existent |
| Integrations | ❌ Almost none |
| Enterprise features | ❌ Not ready |
| Pricing | ❌ Not defined |
| AI interviewer | ⚠️ Behind VoicePanel |
| Repository | ⚠️ Functional but basic |

**Bottom Line**: We have real differentiators, but they're not shipped or proven. VoicePanel is our most dangerous competitor because they're in the same space and moving fast. We need to ship the hybrid experience and prove it works.

---

*This is an internal document. Be honest, not optimistic.*
