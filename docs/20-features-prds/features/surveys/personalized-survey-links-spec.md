# Personalized Survey Links — Quick Spec

**Date:** 2026-02-07 | **Epic:** Insights-4ud | **Author:** Cascade + Rocko
**Effort:** ~8-12 stories | **Priority:** P1 (PLG hook — reduces friction for enterprise distribution)

---

## Problem

Large organizations have email lists and CRM systems. When they send a survey link via email or SMS, the respondent clicks through and has to manually enter their email/phone — even though the sender already knows who they are. This creates:

1. **Friction** — respondents drop off at the identity gate
2. **Missed personalization** — we have CRM data on this person but don't use it
3. **No continuity** — if they answered a previous survey, we start from scratch instead of building on what we know

## Solution

### 1. URL-Based Identity Pre-Population

Support query parameters on the survey URL that pre-populate and optionally auto-submit the identity step:

```
/research/:slug?email=jane@acme.com
/research/:slug?phone=+15551234567
/research/:slug?email=jane@acme.com&name=Jane+Doe
/research/:slug?token=<signed-jwt>  (Phase 2 — tamper-proof)
```

**Behavior:**
- If `?email=` or `?phone=` is present → pre-fill the input field
- If the person exists in our `people` table → auto-submit, skip identity gate entirely, go straight to survey
- If person is unknown → show pre-filled field, let them confirm with one click
- If `?name=` is present → skip the name collection step too
- Store the source as `utm_source=email` or `utm_source=sms` for attribution

### 2. Person Context Injection into AI Chat Agent

When a known person starts a survey (via URL params or manual entry), enrich the AI chat agent with their context:

**Already implemented (moderate/adaptive autonomy):**
- Person name, title, company, segment, job function
- Past interview count

**New — to add:**
- Previous survey responses (same survey = resume, different surveys = cross-reference)
- Key themes/insights extracted from their past interviews
- Their ICP score and band (if scored)
- Organization context (industry, size, stage)

**AI behavior changes:**
- Address respondent by first name in greeting
- Reference their role/company naturally: "As a VP of Engineering at Acme..."
- Mention relevant past responses: "Last time you mentioned pricing was a concern — has that changed?"
- Adapt follow-up probing based on what we already know vs. what's new
- Skip questions we can confidently answer from existing data (with confirmation)

### 3. Embed & Email Integration

Update the embed code generator and email template system to support personalized links:

- **Embed code** — document how to pass `?email=` via merge tags (Brevo: `{{ contact.EMAIL }}`, Mailchimp: `*|EMAIL|*`)
- **Email template helper** — generate personalized survey URLs with merge tag placeholders
- **Tracking** — add `utm_medium`, `utm_source`, `utm_campaign` support to the URL

---

## Implementation Stories

### Story 1: URL Parameter Parsing in Loader (Foundation)
**Files:** `app/routes/research.$slug.tsx`

Parse `?email`, `?phone`, `?name`, `?utm_source`, `?utm_medium`, `?utm_campaign` from the URL in the loader. Pass them to the client as `prefill` data.

```typescript
// In loader:
const url = new URL(request.url)
const prefill = {
  email: url.searchParams.get("email"),
  phone: url.searchParams.get("phone"),
  name: url.searchParams.get("name"),
  firstName: url.searchParams.get("first_name"),
  lastName: url.searchParams.get("last_name"),
  utmSource: url.searchParams.get("utm_source"),
  utmMedium: url.searchParams.get("utm_medium"),
  utmCampaign: url.searchParams.get("utm_campaign"),
}
```

**Acceptance criteria:**
- Loader extracts all supported query params
- Prefill data is returned alongside existing loader data
- No behavior change yet — just data plumbing

### Story 2: Auto-Fill Identity Fields from URL Params
**Files:** `app/routes/research.$slug.tsx`

When `prefill.email` or `prefill.phone` is present:
- Pre-populate the email/phone input field
- If the identity field matches the survey's `identity_field`, auto-focus the submit button

```typescript
// In component:
const { prefill } = useLoaderData()

// Initialize state from prefill
const [email, setEmail] = useState(prefill?.email ?? "")
const [phone, setPhone] = useState(prefill?.phone ?? "")
const [firstName, setFirstName] = useState(prefill?.firstName ?? "")
const [lastName, setLastName] = useState(prefill?.lastName ?? "")
```

**Acceptance criteria:**
- Email/phone fields pre-populated from URL
- User can still edit before submitting
- Works for both email-identified and phone-identified surveys

### Story 3: Auto-Submit for Known People
**Files:** `app/routes/research.$slug.tsx`, `app/routes/api.research-links.$slug.start.tsx`

When prefill data matches a known person in the `people` table, skip the identity gate entirely:
- On mount, if `prefill.email` exists → call `startSignup()` automatically
- If `startSignup` returns a `personId` → skip straight to survey (or instructions)
- If person is unknown → show pre-filled form for confirmation

Add a `prefilled` flag to the start API response so the frontend knows this was auto-submitted.

**Acceptance criteria:**
- Known person with `?email=` → lands directly on survey (zero clicks)
- Unknown person with `?email=` → sees pre-filled email, one-click to continue
- Session stored in localStorage as usual for resume
- No auto-submit if email is malformed

### Story 4: UTM Tracking on Responses
**Files:** `app/routes/api.research-links.$slug.start.tsx`, DB migration

Add `utm_source`, `utm_medium`, `utm_campaign` columns to `research_link_responses` table. Populate from the start payload.

```sql
ALTER TABLE research_link_responses
  ADD COLUMN utm_source TEXT,
  ADD COLUMN utm_medium TEXT,
  ADD COLUMN utm_campaign TEXT;
```

**Acceptance criteria:**
- UTM params stored on the response record
- Visible in response data table (admin side)
- Filterable in response analytics

### Story 5: Enrich Person Context for AI Chat Agent
**Files:** `app/routes/api.research-links.$slug.chat.tsx`

Expand the existing `personContext` fetch (lines 196-231) to include:

1. **Previous survey responses** — query `research_link_responses` for this person across all surveys
2. **Key themes** — query `evidence` → `themes` for insights linked to this person's interviews
3. **ICP score** — query `person_scale` where `kind_slug='icp_match'`
4. **Organization** — if person has `organization_id`, fetch org name/industry/size

Pass all of this into the agent's `requestContext`.

**Acceptance criteria:**
- Chat agent receives enriched person context
- Context only fetched for moderate/adaptive autonomy (not strict)
- Graceful degradation if any lookup fails
- Token budget: keep total person context under ~500 tokens

### Story 6: AI Personalization in Chat Agent Instructions
**Files:** `app/mastra/agents/research-link-chat-agent.ts` (or wherever the agent prompt lives)

Update the agent system prompt to use person context:

- **Greeting:** "Hi {firstName}! Thanks for taking the time..." (if name known)
- **Role acknowledgment:** "Given your role as {title} at {company}..." (if known)
- **Past response references:** "In a previous survey, you mentioned {key_theme} — we'd love to dig deeper on that."
- **Smart skip:** If a question asks for info we already have (e.g., "What's your role?"), the agent can say "I see you're a {title} — is that still accurate?" instead of asking from scratch.

**Acceptance criteria:**
- Agent uses first name when available
- Agent references past responses when relevant
- Agent doesn't hallucinate context it doesn't have
- Strict mode ignores all personalization (stays script-only)

### Story 7: Personalized Link Generator in Survey Builder
**Files:** `app/features/research-links/pages/edit.$listId.tsx` (or new component)

Add a "Generate Personalized Links" section to the survey distribution tab:

- **Single link:** Enter an email → get a personalized URL
- **Bulk CSV:** Upload CSV with email column → download CSV with personalized URLs
- **Email template:** Show merge tag examples for Brevo, Mailchimp, HubSpot
- **Copy button** for each format

**Acceptance criteria:**
- Can generate single personalized link
- Can bulk-generate from CSV
- Shows merge tag examples for major ESPs
- Copy-to-clipboard for all outputs

### Story 8: Signed Token Links (Phase 2 — Security)
**Files:** New API route, `app/routes/research.$slug.tsx`

For enterprise customers, support signed JWT tokens in the URL to prevent email spoofing:

```
/research/:slug?token=eyJhbGciOiJIUzI1NiJ9...
```

The token encodes `{ email, name, exp }` signed with the account's secret. The loader verifies the signature before trusting the identity.

**Acceptance criteria:**
- Token generation API for account admins
- Loader verifies JWT signature
- Expired tokens fall back to manual entry
- Invalid tokens show friendly error, not crash

---

## Existing Code Analysis

### What already works (leverage these):
| Component | Status | Notes |
|-----------|--------|-------|
| Person lookup by email | ✅ | `start.tsx` line 364-369 — queries `people.primary_email` |
| Person context in chat agent | ✅ | `chat.tsx` lines 196-231 — fetches name, title, company, segment |
| Project context in chat agent | ✅ | `chat.tsx` lines 233-260 — fetches research goals, unknowns |
| Session resume via localStorage | ✅ | `research.$slug.tsx` — stores `{email, responseId}` |
| Identity modes (anon/email/phone) | ✅ | Full routing in `start.tsx` |
| AI autonomy levels | ✅ | strict/moderate/adaptive with gated context |

### What needs fixing / extending:
| Issue | Severity | Notes |
|-------|----------|-------|
| Loader doesn't read query params | 🔴 Blocker | `research.$slug.tsx` loader ignores `request.url` — only uses `params.slug` |
| Loader needs `request` arg | 🔴 Blocker | Current signature is `loader({ params })` — needs `loader({ request, params })` |
| No UTM tracking on responses | 🟡 Gap | `research_link_responses` has no UTM columns |
| Chat agent person context is shallow | 🟡 Gap | No past survey responses, no themes, no ICP score |
| No personalized link generator UI | 🟡 Gap | Embed code exists but no merge tag guidance |
| No signed token support | 🟢 Phase 2 | Nice-to-have for enterprise security |

### Loader fix (critical path):

The current loader signature:
```typescript
export async function loader({ params }: LoaderFunctionArgs) {
```

Needs to become:
```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  // ... parse query params
```

This is a one-line change but gates the entire feature.

---

## Data Flow

```
Email campaign (Brevo/Mailchimp)
  ↓
User clicks: /research/my-survey?email=jane@acme.com&utm_source=email&utm_campaign=q1-feedback
  ↓
Loader: parse query params → return prefill data
  ↓
Component: auto-fill email → auto-call startSignup()
  ↓
Start API: lookup people.primary_email → found Jane Doe (person_id: abc123)
  ↓
Response: { responseId, personId: abc123, responses: {prev answers if resuming} }
  ↓
Component: skip identity gate → show instructions or survey directly
  ↓
Chat agent (if chat mode): fetch enriched person context
  → name: "Jane Doe"
  → title: "VP Engineering"
  → company: "Acme Corp"
  → past themes: ["pricing concerns", "onboarding friction"]
  → ICP score: 0.87 (high)
  ↓
Agent greeting: "Hi Jane! Thanks for taking the time. Last time we chatted,
you mentioned onboarding friction was a big concern — we'd love to hear
if anything has changed since then."
```

---

## Priority Order

1. **Stories 1-3** — URL params + auto-fill + auto-submit (core value, ~3-4 hours)
2. **Story 4** — UTM tracking (quick win, ~1 hour)
3. **Stories 5-6** — AI personalization (high wow factor, ~4-6 hours)
4. **Story 7** — Link generator UI (~2-3 hours)
5. **Story 8** — Signed tokens (Phase 2, enterprise only)

**Total estimated effort:** ~12-16 hours across 8 stories

---

## Open Questions

1. **Rate limiting on auto-submit?** — If someone scripts `?email=` with random addresses, we'd create many empty responses. Consider: only auto-submit if person exists in DB; otherwise require manual confirmation.
2. **Privacy banner?** — Should we show "We recognized you from your email" or silently skip? Leaning toward silent skip with a small "Not you? Use a different email" link.
3. **Cross-survey response sharing?** — When referencing past survey answers, should we only reference surveys from the same account, or also cross-account? (Same account only, for privacy.)
4. **Token budget for person context?** — The chat agent has finite context. Cap enriched person context at ~500 tokens to avoid crowding out the actual conversation.
