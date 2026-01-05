# Research Links — Product Specification

> **Renamed**: Research Links were previously called "Sign-up Lists"

## Overview

Research Links let you collect structured feedback via a simple shareable URL. Create a link in under a minute, share it with respondents, and watch responses flow in.

**Public URL format**: `/survey/<slug>` (e.g., `upsight.io/survey/pricing-study`)

## Design Principles

1. **Simple by default** — Most users just need: title + questions + share link
2. **Progressive disclosure** — Advanced options hidden until needed
3. **Auto-generate everything** — Slug auto-derived from title, sensible defaults everywhere
4. **One minute to share** — From "New" button to shareable link in under 60 seconds

---

## UX Redesign: Stepper-Based Flow

### Problem with Current UI

The current create/edit page shows **4 cards with 15+ fields** simultaneously:
- Research link basics (name, slug, description)
- Hero section (title, subtitle, CTA label, helper, calendar URL, redirect URL)
- Survey questions (complex nested editor with 5 fields per question)
- Experience options (allow chat, default mode, is live)

This is overwhelming. Most users only need a title and some questions.

### Proposed Solution: 3-Step Wizard

#### Step 1: Basics (30 seconds)
```
┌─────────────────────────────────────────────────────────────┐
│  Step 1 of 3: Name your survey                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Title *                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pricing Discovery Survey                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description (optional)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Help us understand what pricing model works for you │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Your link: upsight.io/survey/pricing-discovery-survey      │
│  (auto-generated from title)                                │
│                                                             │
│                                         [ Next: Questions ] │
└─────────────────────────────────────────────────────────────┘
```

**Fields shown**: Title, Description
**Auto-generated**: Slug (from title via slugify)
**Hidden by default**: Everything else

#### Step 2: Questions (60 seconds)
```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 3: Add your questions                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Paste questions or type them below:                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ What's your biggest challenge with pricing?          │   │
│  │ How do you currently track competitor pricing?       │   │
│  │ What would make you switch to a new solution?        │   │
│  └─────────────────────────────────────────────────────┘   │
│  [+ Add question]                                           │
│                                                             │
│  Questions auto-detect response type (text, choice, etc.)   │
│                                                             │
│                               [ Back ]   [ Next: Review ] │
└─────────────────────────────────────────────────────────────┘
```

**Simplified question entry**:
- Paste a list of questions (newline-separated) → auto-creates question objects
- Type directly → one question at a time
- Response type defaults to `auto` (AI infers at render time)
- Advanced options (required, type override, options) collapsed per question

#### Step 3: Review & Share (10 seconds)
```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 3: Review and share                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PREVIEW                                              │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ Pricing Discovery Survey                        │ │   │
│  │ │ Help us understand what pricing model...        │ │   │
│  │ │ ┌────────────────────────────────┐              │ │   │
│  │ │ │ your@email.com                 │ [Start]      │ │   │
│  │ │ └────────────────────────────────┘              │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                             │
│  Your shareable link:                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ https://upsight.io/survey/pricing-discovery  [Copy]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ ] Go live immediately                                    │
│                                                             │
│  [Show advanced options]                                    │
│                                                             │
│                         [ Back ]   [ Create & Copy Link ] │
└─────────────────────────────────────────────────────────────┘
```

**Advanced options (collapsed by default)**:
- Custom slug override
- Hero headline & subtitle overrides
- CTA button text
- Calendar scheduling URL
- Redirect URL after completion
- Allow chat mode toggle
- Default response mode (form/chat)

---

## URL Structure

### Public Survey URLs

| Current | New |
|---------|-----|
| `/research/<slug>` | `/survey/<slug>` |

Shorter and clearer. Examples:
- `upsight.io/survey/pricing-study`
- `upsight.io/survey/user-research-q1`
- `upsight.io/survey/beta-feedback`

Note: `/s/<slug>` is reserved for interview share links (`/s/:token`).

### Admin URLs (unchanged)

| Route | Purpose |
|-------|---------|
| `/a/{accountId}/research-links` | List all links |
| `/a/{accountId}/research-links/new` | Create wizard |
| `/a/{accountId}/research-links/{id}/edit` | Edit existing |
| `/a/{accountId}/research-links/{id}/responses` | View responses |

---

## Simplified Data Model

### Essential Fields (shown in wizard)

| Field | Step | Required | Notes |
|-------|------|----------|-------|
| `name` | 1 | Yes | Internal title, also used for hero if not overridden |
| `description` | 1 | No | Shown below hero title |
| `slug` | 1 | Yes | Auto-generated from name, can override |
| `questions` | 2 | Yes | At least one question |
| `is_live` | 3 | No | Toggle on review step |

### Advanced Fields (hidden in "Advanced options")

| Field | Default | Notes |
|-------|---------|-------|
| `hero_title` | Same as `name` | Override display title |
| `hero_subtitle` | Same as `description` | Override display description |
| `hero_cta_label` | "Continue" | Button text |
| `hero_cta_helper` | "We'll only contact you about this study" | Fine print |
| `calendar_url` | null | Cal.com/Calendly link for scheduling |
| `redirect_url` | null | Where to send after completion |
| `allow_chat` | false | Enable chat response mode |
| `default_response_mode` | "form" | form or chat |

### Question Fields

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `prompt` | Yes | — | The question text |
| `type` | No | "auto" | auto, short_text, long_text, single_select, multi_select |
| `required` | No | true | Whether answer is required |
| `placeholder` | No | null | Input placeholder text |
| `helperText` | No | null | Clarification below input |
| `options` | No | null | For select types only |

---

## Implementation Plan

### Phase 1: Simplified Create Flow

1. Create new `StepperCreatePage.tsx` with 3-step wizard
2. Update route to use stepper for `/new`
3. Keep edit page as-is (full form for power users)
4. Auto-generate slug from title on step 1
5. Bulk question paste support on step 2

### Phase 2: URL Shortening (Complete)

1. ~~Add `/survey/:slug` route pointing to public survey page~~ ✅
2. ~~Keep `/research/:slug` as redirect for backwards compatibility~~ ✅
3. ~~Update `route-definitions.ts` to use `/survey/` for new links~~ ✅
4. Update UI to show `/survey/` URLs

### Phase 3: Edit Page Simplification

1. Add collapsible "Advanced" section
2. Move hero customization, chat mode, redirect URL into advanced
3. Keep full question editor (power users need it)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time from "New" to shareable link | < 60 seconds |
| Create flow completion rate | > 90% |
| % of users who expand "Advanced" | < 20% (indicates defaults are good) |
| Respondent email submission rate | > 60% |
| Respondent completion rate | > 40% |

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Default to form vs chat? | Form (simpler, higher completion) |
| Should slug be editable? | Yes, but auto-generate first and hide in "Advanced" |
| Calendar link placement? | After email capture, before questions |
| Response mode configurable? | Yes, in "Advanced" options |
