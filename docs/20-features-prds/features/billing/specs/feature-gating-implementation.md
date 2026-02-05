# Feature Gating Implementation Spec

## Overview

This document specifies the implementation pattern for feature gating based on pricing tiers. The system enables:
1. **Server-side enforcement**: Block unauthorized feature access
2. **Client-side hints**: Display "Upgrade to unlock" badges before users attempt to use features

## Current Plan Structure

Plans are defined in `app/config/plans.ts`:

| Plan | Price | Key Limits |
|------|-------|------------|
| Free | $0 | 5 AI analyses, 1 project, 50 survey responses |
| Starter | $15/mo | Unlimited AI, 3 projects, 500 surveys, 60 voice min |
| Pro | $29/mo | Unlimited AI/projects, 2000 surveys, 180 voice min |
| Team | $25/user/mo | All features + SSO + team workspace |

### Boolean Features (on/off by plan)

| Feature Key | Free | Starter | Pro | Team |
|-------------|------|---------|-----|------|
| `survey_ai_analysis` | - | ✓ | ✓ | ✓ |
| `team_workspace` | - | - | - | ✓ |
| `sso` | - | - | - | ✓ |
| `interview_guide` | - | ✓ | ✓ | ✓ |
| `smart_personas` | - | ✓ | ✓ | ✓ |
| `ai_crm` | - | ✓ | ✓ | ✓ |

### Usage Limits (metered)

| Limit Key | Free | Starter | Pro | Team |
|-----------|------|---------|-----|------|
| `ai_analyses` | 5 | ∞ | ∞ | ∞ |
| `voice_minutes` | 0 | 60 | 180 | 300/user |
| `survey_responses` | 50 | 500 | 2000 | 5000 |
| `projects` | 1 | 3 | ∞ | ∞ |

## Implementation Architecture

### 1. Server-Side: Feature Gate Module

Create `app/lib/feature-gate/` module with:

```
app/lib/feature-gate/
├── index.ts              # Public exports
├── check-feature.server.ts   # Boolean feature checks
├── check-limit.server.ts     # Usage limit checks
├── types.ts              # Type definitions
└── errors.ts             # FeatureGateError classes
```

#### Core Types (`types.ts`)

```typescript
import type { PlanFeatures, PlanLimits, PlanId } from "~/config/plans"

export type FeatureKey = keyof PlanFeatures
export type LimitKey = keyof PlanLimits

export interface FeatureGateContext {
  accountId: string
  userId: string
  planId: PlanId
}

export interface FeatureCheckResult {
  allowed: boolean
  reason?: "feature_disabled" | "limit_exceeded" | "limit_approaching"
  currentUsage?: number
  limit?: number
  upgradeUrl?: string
  requiredPlan?: PlanId
}

export interface LimitCheckResult extends FeatureCheckResult {
  remaining?: number
  percentUsed?: number
}
```

#### Feature Check (`check-feature.server.ts`)

```typescript
import { PLANS, hasFeature, type PlanId } from "~/config/plans"
import type { FeatureKey, FeatureCheckResult, FeatureGateContext } from "./types"

/**
 * Check if account has access to a boolean feature.
 * Use in API routes before executing feature logic.
 */
export async function checkFeatureAccess(
  ctx: FeatureGateContext,
  feature: FeatureKey
): Promise<FeatureCheckResult> {
  const allowed = hasFeature(ctx.planId, feature)

  if (!allowed) {
    // Find the minimum plan that has this feature
    const requiredPlan = findMinimumPlanForFeature(feature)
    return {
      allowed: false,
      reason: "feature_disabled",
      requiredPlan,
      upgradeUrl: `/pricing?highlight=${requiredPlan}`,
    }
  }

  return { allowed: true }
}

/**
 * Require feature access - throws FeatureGateError if not allowed.
 * Use for cleaner control flow in API routes.
 */
export async function requireFeatureAccess(
  ctx: FeatureGateContext,
  feature: FeatureKey
): Promise<void> {
  const result = await checkFeatureAccess(ctx, feature)
  if (!result.allowed) {
    throw new FeatureGateError(feature, result)
  }
}

function findMinimumPlanForFeature(feature: FeatureKey): PlanId {
  const planOrder: PlanId[] = ["free", "starter", "pro", "team"]
  for (const plan of planOrder) {
    if (hasFeature(plan, feature)) return plan
  }
  return "team"
}
```

#### Limit Check (`check-limit.server.ts`)

```typescript
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { PLANS, type PlanId } from "~/config/plans"
import type { LimitKey, LimitCheckResult, FeatureGateContext } from "./types"

/**
 * Check if account is within usage limits.
 * Queries current usage from database.
 */
export async function checkLimitAccess(
  ctx: FeatureGateContext,
  limit: LimitKey
): Promise<LimitCheckResult> {
  const plan = PLANS[ctx.planId]
  const maxLimit = plan.limits[limit]

  // Unlimited = always allowed
  if (maxLimit === Number.POSITIVE_INFINITY) {
    return { allowed: true }
  }

  // Get current usage from database
  const currentUsage = await getCurrentUsage(ctx.accountId, limit)
  const remaining = maxLimit - currentUsage
  const percentUsed = (currentUsage / maxLimit) * 100

  // Check if at or over limit
  if (currentUsage >= maxLimit) {
    return {
      allowed: false,
      reason: "limit_exceeded",
      currentUsage,
      limit: maxLimit,
      remaining: 0,
      percentUsed: 100,
      upgradeUrl: `/pricing?reason=${limit}_limit`,
      requiredPlan: findNextPlanWithHigherLimit(ctx.planId, limit),
    }
  }

  // Warn if approaching limit (80%+)
  if (percentUsed >= 80) {
    return {
      allowed: true,
      reason: "limit_approaching",
      currentUsage,
      limit: maxLimit,
      remaining,
      percentUsed,
    }
  }

  return {
    allowed: true,
    currentUsage,
    limit: maxLimit,
    remaining,
    percentUsed,
  }
}

async function getCurrentUsage(accountId: string, limit: LimitKey): Promise<number> {
  switch (limit) {
    case "ai_analyses":
      return getMonthlyAiAnalysisCount(accountId)
    case "voice_minutes":
      return getMonthlyVoiceMinutes(accountId)
    case "survey_responses":
      return getMonthlySurveyResponses(accountId)
    case "projects":
      return getActiveProjectCount(accountId)
    default:
      return 0
  }
}

// ... usage query implementations
```

### 2. Client-Side: React Hooks

Create `app/hooks/useFeatureGate.ts`:

```typescript
import { useFetcher } from "react-router"
import { useMemo } from "react"
import type { FeatureKey, LimitKey } from "~/lib/feature-gate/types"

interface UseFeatureGateReturn {
  /** Whether the feature is available on current plan */
  isEnabled: boolean
  /** Whether currently loading */
  isLoading: boolean
  /** Upgrade URL if feature is disabled */
  upgradeUrl?: string
  /** The minimum plan required */
  requiredPlan?: string
}

interface UseLimitGateReturn extends UseFeatureGateReturn {
  /** Current usage count */
  currentUsage: number
  /** Maximum allowed */
  limit: number
  /** Remaining quota */
  remaining: number
  /** Usage percentage (0-100) */
  percentUsed: number
  /** Whether approaching limit (80%+) */
  isApproachingLimit: boolean
}

/**
 * Check if a boolean feature is enabled for current account.
 *
 * @example
 * const { isEnabled, upgradeUrl } = useFeatureGate("smart_personas")
 * if (!isEnabled) {
 *   return <UpgradeBanner href={upgradeUrl} feature="Smart Personas" />
 * }
 */
export function useFeatureGate(feature: FeatureKey): UseFeatureGateReturn {
  // Get from loader data or dedicated endpoint
  const accountPlan = useAccountPlan()

  return useMemo(() => {
    const isEnabled = hasFeature(accountPlan.planId, feature)
    return {
      isEnabled,
      isLoading: false,
      upgradeUrl: isEnabled ? undefined : `/pricing?highlight=${findMinPlan(feature)}`,
      requiredPlan: isEnabled ? undefined : findMinPlan(feature),
    }
  }, [accountPlan.planId, feature])
}

/**
 * Check usage limits for metered features.
 *
 * @example
 * const { isEnabled, remaining, percentUsed } = useLimitGate("projects")
 * if (!isEnabled) {
 *   return <UpgradeBanner reason="project_limit" />
 * }
 * if (remaining <= 1) {
 *   return <LimitWarning remaining={remaining} />
 * }
 */
export function useLimitGate(limit: LimitKey): UseLimitGateReturn {
  // Fetch from dedicated endpoint with caching
  const fetcher = useFetcher()
  // ... implementation
}
```

### 3. UI Components

Create reusable upgrade prompts in `app/components/feature-gate/`:

```typescript
// UpgradeBadge.tsx - Small inline badge
interface UpgradeBadgeProps {
  feature: FeatureKey | LimitKey
  size?: "sm" | "md"
}

export function UpgradeBadge({ feature, size = "sm" }: UpgradeBadgeProps) {
  return (
    <Link to={`/pricing?highlight=${feature}`}>
      <Badge variant="outline" className="gap-1">
        <Sparkles className="h-3 w-3" />
        {size === "md" ? "Upgrade to unlock" : "Pro"}
      </Badge>
    </Link>
  )
}

// FeatureGate.tsx - Wrapper component
interface FeatureGateProps {
  feature: FeatureKey
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { isEnabled, upgradeUrl } = useFeatureGate(feature)

  if (!isEnabled) {
    return fallback ?? <UpgradePrompt feature={feature} href={upgradeUrl} />
  }

  return <>{children}</>
}
```

## Integration Points

### API Routes Requiring Gates

| Route | Gate Type | Key |
|-------|-----------|-----|
| `api.generate-personas.tsx` | Feature | `smart_personas` |
| `api.analyze-responses.tsx` | Feature | `survey_ai_analysis` |
| `api.teams.create.tsx` | Feature | `team_workspace` |
| `api.improve-question.tsx` | Feature | `interview_guide` |
| `api.generate-questions.tsx` | Feature | `interview_guide` |
| `api.opportunity-advisor.tsx` | Feature | `ai_crm` |
| `api.create-project.tsx` | Limit | `projects` |
| `api.apply-lens.tsx` | Limit | `ai_analyses` |
| `api.auto-insights.tsx` | Limit | `ai_analyses` |
| `features/voice/api/transcribe.ts` | Limit | `voice_minutes` |
| `research-links/api/upload-video.tsx` | Limit | `survey_responses` |

### UI Components Requiring Gates

| Component/Page | Gate Type | Key | UI Treatment |
|----------------|-----------|-----|--------------|
| Personas > Generate button | Feature | `smart_personas` | Badge + disabled |
| Survey responses > Analyze | Feature | `survey_ai_analysis` | Badge + disabled |
| Team settings > Invite | Feature | `team_workspace` | Upgrade banner |
| Interview guide section | Feature | `interview_guide` | Blurred + overlay |
| Opportunities page | Feature | `ai_crm` | Upgrade prompt |
| New project button | Limit | `projects` | Counter + upgrade |
| Voice chat button | Limit | `voice_minutes` | Time remaining |

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `app/lib/feature-gate/` module with types and checks
2. Add `useFeatureGate` and `useLimitGate` hooks
3. Create basic `UpgradeBadge` and `FeatureGate` components

### Phase 2: High-Value Gates
1. Gate `smart_personas` (AI-intensive)
2. Gate `survey_ai_analysis` (AI-intensive)
3. Gate `projects` limit (core metric)

### Phase 3: Complete Coverage
1. Gate remaining boolean features
2. Gate remaining usage limits
3. Add limit warning notifications

### Phase 4: Polish
1. Add usage tracking dashboard enhancements
2. Implement soft-cap warnings
3. Add upgrade conversion analytics

## Error Handling

```typescript
// errors.ts
export class FeatureGateError extends Error {
  constructor(
    public feature: FeatureKey | LimitKey,
    public result: FeatureCheckResult
  ) {
    super(`Feature "${feature}" not available: ${result.reason}`)
    this.name = "FeatureGateError"
  }
}

// In API routes, catch and return proper response
try {
  await requireFeatureAccess(ctx, "smart_personas")
  // ... feature logic
} catch (error) {
  if (error instanceof FeatureGateError) {
    return json({
      error: "upgrade_required",
      feature: error.feature,
      upgradeUrl: error.result.upgradeUrl,
      requiredPlan: error.result.requiredPlan,
    }, { status: 403 })
  }
  throw error
}
```

## Getting Account Plan

The account's current plan needs to be available in:
1. **Loader data**: Include in root/layout loader
2. **API context**: Resolve from `account_id` in request context

```typescript
// In root loader or account-aware layout
export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getAuthenticatedUser(request)
  const accountPlan = await getAccountPlan(user.account_id)

  return {
    // ... other data
    accountPlan: {
      planId: accountPlan.planId,
      limits: PLANS[accountPlan.planId].limits,
      features: PLANS[accountPlan.planId].features,
    }
  }
}
```

## Testing Strategy

1. **Unit tests**: Test `checkFeatureAccess` and `checkLimitAccess` with mock data
2. **Integration tests**: Test API routes return 403 for gated features
3. **E2E tests**: Verify upgrade badges appear for free users

## Related Files

- `app/config/plans.ts` - Plan definitions (source of truth)
- `app/lib/billing/` - Usage tracking infrastructure
- `app/features/billing/pages/index.tsx` - Billing dashboard
