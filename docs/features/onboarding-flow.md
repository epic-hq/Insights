# Onboarding Flow: Define → Collect → Learn

This document outlines the onboarding experience for new users following a clear 3-phase journey.

## Overview

New users follow a structured path: **Define** their goals, **Collect** customer input, and **Learn** from insights. This approach helps business leaders quickly gain clarity and confidence.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEW USER SIGNUP                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DEFINE                                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Step 1a: Company Context (Account Settings)                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  • Company website URL (auto-fill available)                       │ │
│  │  • Company description                                              │ │
│  │  • Customer problem you solve                                       │ │
│  │  • Industry, target roles, target company sizes                    │ │
│  │  • Competitors                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                         │                                                │
│                         ▼                                                │
│  Step 1b: Project Goals (Project Setup)                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  • Research goal for this project                                   │ │
│  │  • Target roles for this research                                   │ │
│  │  • Target organizations                                             │ │
│  │  • Assumptions to test                                              │ │
│  │  • Unknowns to explore                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: COLLECT                                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Add conversations through any channel:                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ Upload        │  │ Record Live   │  │ Share Survey  │               │
│  │ Recording     │  │ Interview     │  │ Form          │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                          │
│  AI automatically:                                                       │
│  • Transcribes audio/video                                              │
│  • Extracts evidence (quotes + timestamps)                              │
│  • Applies conversation lenses                                          │
│  • Identifies themes and patterns                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: LEARN                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Review what you've learned:                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ View Evidence │  │ Explore       │  │ Prioritize    │               │
│  │ (quotes)      │  │ Insights      │  │ Tasks         │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                          │
│  Lens summaries provide structured analysis:                             │
│  • Customer Discovery lens                                              │
│  • Question Coverage lens                                               │
│  • Sales BANT lens                                                      │
│  • And more...                                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Phase 1a: Company Context (Account Settings)

**Route:** `/a/{accountId}/settings?onboarding=1`

**When triggered:**
- New user signup (first login after account creation)
- Redirect from `login_success.tsx` for new users

**Data stored:** `accounts.accounts` table
- `website_url`
- `company_description`
- `customer_problem`
- `offerings[]`
- `target_industries[]`
- `target_company_sizes[]`
- `target_roles[]`
- `competitors[]`
- `industry`

**UI behavior in onboarding mode:**
- Show only CompanyContextSection (hide pipeline configuration)
- Show progress indicator (Phase 1 of 3: Define)
- "Continue to Project Setup" button after saving
- Auto-fill from website available

### Phase 1b: Project Goals (Project Setup)

**Route:** `/a/{accountId}/{projectId}/setup`

**When triggered:**
- After completing company context in onboarding mode
- From dashboard "Set Up Project Context" button

**Data stored:** `project_sections` table with various `kind` values:
- `research_goal`
- `customer_problem`
- `target_roles`
- `target_orgs`
- `assumptions`
- `unknowns`
- `decision_questions`

**UI options:**
- Chat mode: Interactive AI conversation to gather context
- Form mode: Direct input fields for each section

**Important:** Both modes MUST sync to the same database fields.

### Phase 2: Collect

**Route:** `/a/{accountId}/{projectId}/interviews/*`

**Entry points:**
- Upload Recording: `/interviews/upload`
- Record Interview: `/interviews/quick`
- Share Form: `/questions`

**Processing:**
- Transcription via Deepgram/AssemblyAI
- Evidence extraction via BAML
- Lens application via Trigger.dev background tasks

### Phase 3: Learn

**Routes:**
- Evidence: `/a/{accountId}/{projectId}/evidence`
- Insights: `/a/{accountId}/{projectId}/insights`
- Tasks: `/a/{accountId}/{projectId}/tasks`

**Dashboard shows:**
- Lens summaries (any lens with data)
- Top 3 insights
- Top 3 tasks

## Dashboard States

### Empty State (No conversations, no goals)
Shows OnboardingDashboard with Define phase active:
- Phase progress: Define → Collect → Learn
- Primary CTA: "Set Up Project Context"

### Empty State (Has goals, no conversations)
Shows OnboardingDashboard with Collect phase active:
- Phase progress: Define ✓ → Collect → Learn
- CTAs: Upload Recording, Record Interview, Share Form

### Active State (Has conversations)
Shows ActiveDashboard:
- Lens summaries at top
- Interview prompts link
- Context settings links (Project Context, Account Settings)
- Top 3 insights + Top 3 tasks (2-column layout)

## Key Requirements

1. **Account setup comes first:** New users MUST set company context before project context
2. **Form/Chat sync:** Both input modes write to same DB fields
3. **Company URL must save:** Ensure website_url is persisted on save
4. **AI inherits context:** Project setup agent checks for account context first
5. **Clear progression:** Visual phase indicators show progress through journey
