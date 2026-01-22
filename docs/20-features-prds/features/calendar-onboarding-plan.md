# Calendar Integration Onboarding Plan

## Problem

Users who upgrade to a paid plan don't know calendar sync exists. They must:
1. Navigate to Account Settings
2. Scroll to find "Calendar Integration" section
3. Manually connect

**Result**: Low feature discovery, missed value.

---

## Proposed Solution

Add calendar connection prompt at two key moments:

### 1. Post-Upgrade Redirect (High Priority)

**When**: User completes Polar checkout and returns to app

**Current flow**:
```
Polar checkout → /settings/billing?checkout=success&plan=starter
```

**Proposed flow**:
```
Polar checkout → /welcome-upgrade?plan=starter
                     ↓
            [Connect Calendar Card]
            [Skip to Dashboard]
                     ↓
            If connected: /a/{accountId}/settings?calendar_connected=1
            If skipped: /a/{accountId}/{projectId}/dashboard
```

**UI**: Simple celebration screen with calendar CTA
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     🎉 Welcome to Starter!                                  │
│                                                             │
│     You've unlocked:                                        │
│     ✓ Unlimited AI analysis                                 │
│     ✓ Smart personas                                        │
│     ✓ Calendar sync for Meeting Intelligence                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📅 Connect Google Calendar                          │   │
│  │                                                      │   │
│  │  Get AI-generated meeting briefs before every call   │   │
│  │  and smart follow-up drafts after.                   │   │
│  │                                                      │   │
│  │  [Connect Calendar]              [Maybe Later]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Go to Dashboard →]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. New User Onboarding (Lower Priority)

**When**: New user on paid plan (direct upgrade during signup)

**Current flow**:
```
Signup → login_success → /a/{accountId}/{projectId}/setup?onboarding=1
```

**Proposed addition**: Add calendar connection as optional step in setup chat

```
Agent: "One more thing - want me to help prep you for customer calls?

        I can connect to your Google Calendar and:
        • Brief you on who you're meeting before calls
        • Draft follow-up emails after

        [Connect Calendar]  [Skip for now]"
```

---

## Implementation Tasks

### Phase 1: Post-Upgrade Flow (Do First)

1. **Create `/app/routes/welcome-upgrade.tsx`**
   - Shows upgrade celebration + calendar CTA
   - Checks if user already has calendar connected
   - Handles plan param to show relevant features

2. **Update `/app/routes/api.billing.checkout.tsx`**
   - Change successUrl from `/settings/billing?checkout=success` to `/welcome-upgrade?plan={plan}`

3. **Update Polar webhook handler** (if exists)
   - Ensure plan_id is set on account after successful payment

### Phase 2: Onboarding Chat Integration (Later)

1. **Update signup/project-setup agent**
   - Add calendar connection tool
   - Add calendar prompt after main setup completes

2. **Create calendar connection tool for Mastra**
   - Returns OAuth URL for redirect
   - Handles connection status check

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Calendar connection rate (new upgrades) | 40%+ |
| Time from upgrade to first calendar sync | < 24 hours |
| Meeting Intelligence feature adoption | Track separately |

---

## Files to Modify

| File | Change |
|------|--------|
| `app/routes/welcome-upgrade.tsx` | CREATE - Post-upgrade celebration page |
| `app/routes/api.billing.checkout.tsx` | UPDATE - Change success redirect |
| `app/features/accounts/pages/settings.tsx` | REFERENCE - Reuse CalendarIntegrationSection |
| `app/config/plans.ts` | REFERENCE - Feature flags |

---

## Open Questions

1. Should we show calendar CTA to Free users who upgrade via in-app prompt?
2. Should calendar connection block proceeding, or always be skippable?
3. Do we need a "remind me later" that prompts again in 24h?
