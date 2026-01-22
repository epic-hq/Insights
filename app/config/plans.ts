/**
 * Plan Configuration - Single Source of Truth
 *
 * All plan definitions MUST be imported from this file.
 * Do NOT duplicate plan data elsewhere (PricingTable, billing page, etc).
 *
 * @see docs/20-features-prds/specs/billing-credits-entitlements.md
 */

// -----------------------------------------------------------------------------
// Plan Types
// -----------------------------------------------------------------------------

export const PLAN_IDS = ["free", "starter", "pro", "team"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** Number of AI analyses per month (Infinity = unlimited with soft cap) */
  ai_analyses: number;
  /** Voice chat minutes per month (0 = not included) */
  voice_minutes: number;
  /** Survey responses per month */
  survey_responses: number;
  /** Number of projects allowed */
  projects: number;
}

export interface PlanCredits {
  /** Monthly credit allocation (internal, never shown to users) */
  monthly: number;
  /** Whether soft caps apply (false = hard limit for free tier) */
  softCapEnabled: boolean;
}

export interface PlanFeatures {
  /** AI analysis of survey responses */
  survey_ai_analysis: boolean;
  /** Team workspace with multiple members */
  team_workspace: boolean;
  /** Single sign-on support */
  sso: boolean;
  /** Interview guide with AI prompts */
  interview_guide: boolean;
  /** Smart personas generation */
  smart_personas: boolean;
  /** AI-native CRM */
  ai_crm: boolean;
  /** Remove "Powered by UpSight" branding from embeds */
  white_label: boolean;
  /** Calendar sync for meeting intelligence */
  calendar_sync: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  price: {
    monthly: number;
    annual: number; // per month when billed annually
  };
  /** Per-user pricing (for team plan) */
  perUser: boolean;
  /** User-facing limits (shown in UI) */
  limits: PlanLimits;
  /** Internal credit allocation (hidden from users) */
  credits: PlanCredits;
  /** Feature entitlements */
  features: PlanFeatures;
  /** CTA button configuration */
  cta: {
    label: string;
    link: string;
    external?: boolean;
    style: "primary" | "secondary";
  };
  /** Marketing badge (e.g., "Most Popular") */
  badge?: string;
}

// -----------------------------------------------------------------------------
// Plan Definitions
// -----------------------------------------------------------------------------

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Record everything, analyze 5 interviews/month",
    price: { monthly: 0, annual: 0 },
    perUser: false,
    limits: {
      ai_analyses: 5,
      voice_minutes: 0,
      survey_responses: 50,
      projects: 1,
    },
    credits: {
      monthly: 500,
      softCapEnabled: false, // Hard limit for free tier
    },
    features: {
      survey_ai_analysis: false,
      team_workspace: false,
      sso: false,
      interview_guide: false,
      smart_personas: false,
      ai_crm: false,
      white_label: false,
      calendar_sync: false,
    },
    cta: {
      label: "Start Free",
      link: "/sign-up?plan=free",
      style: "secondary",
    },
  },

  starter: {
    id: "starter",
    name: "Starter",
    description: "Unlimited analysis, find themes, organize your discovery",
    price: { monthly: 15, annual: 12 },
    perUser: false,
    limits: {
      ai_analyses: Number.POSITIVE_INFINITY,
      voice_minutes: 60,
      survey_responses: 500,
      projects: 3,
    },
    credits: {
      monthly: 2000,
      softCapEnabled: true,
    },
    features: {
      survey_ai_analysis: true,
      team_workspace: false,
      sso: false,
      interview_guide: true,
      smart_personas: true,
      ai_crm: true,
      white_label: true,
      calendar_sync: true,
    },
    cta: {
      label: "Get Started",
      link: "/sign-up?plan=starter",
      style: "secondary",
    },
  },

  pro: {
    id: "pro",
    name: "Pro",
    description: "Advanced insights, more voice chat, unlimited projects",
    price: { monthly: 29, annual: 23 },
    perUser: false,
    limits: {
      ai_analyses: Number.POSITIVE_INFINITY,
      voice_minutes: 180,
      survey_responses: 2000,
      projects: Number.POSITIVE_INFINITY,
    },
    credits: {
      monthly: 5000,
      softCapEnabled: true,
    },
    features: {
      survey_ai_analysis: true,
      team_workspace: false,
      sso: false,
      interview_guide: true,
      smart_personas: true,
      ai_crm: true,
      white_label: true,
      calendar_sync: true,
    },
    cta: {
      label: "Go Pro",
      link: "/sign-up?plan=pro",
      style: "primary",
    },
    badge: "Most Popular",
  },

  team: {
    id: "team",
    name: "Team",
    description: "Collaborate with your team, pooled resources, SSO",
    price: { monthly: 39, annual: 31 },
    perUser: true,
    limits: {
      ai_analyses: Number.POSITIVE_INFINITY,
      voice_minutes: 300, // per user
      survey_responses: 5000,
      projects: Number.POSITIVE_INFINITY,
    },
    credits: {
      monthly: 4000, // per user, pooled across team
      softCapEnabled: true,
    },
    features: {
      survey_ai_analysis: true,
      team_workspace: true,
      sso: true,
      interview_guide: true,
      smart_personas: true,
      ai_crm: true,
      white_label: true,
      calendar_sync: true,
    },
    cta: {
      label: "Contact Sales",
      link: "https://cal.com/rickmoy",
      external: true,
      style: "secondary",
    },
  },
} as const;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get plan configuration by ID
 */
export function getPlan(planId: PlanId): PlanConfig {
  return PLANS[planId];
}

/**
 * Check if a plan has a specific feature enabled
 */
export function hasFeature(
  planId: PlanId,
  feature: keyof PlanFeatures,
): boolean {
  return PLANS[planId].features[feature];
}

/**
 * Get the user-facing limit for a feature
 * Returns "Unlimited" string for Infinity values
 */
export function getLimitDisplay(
  planId: PlanId,
  limit: keyof PlanLimits,
): string {
  const value = PLANS[planId].limits[limit];
  if (value === Number.POSITIVE_INFINITY) return "Unlimited";
  if (value === 0 && limit === "voice_minutes") return "—";
  return value.toLocaleString();
}

/**
 * Get internal credit allocation for a plan
 * For teams, multiply by seat count
 */
export function getMonthlyCredits(planId: PlanId, seatCount = 1): number {
  const plan = PLANS[planId];
  return plan.perUser ? plan.credits.monthly * seatCount : plan.credits.monthly;
}

/**
 * Check if plan uses soft caps (vs hard limits)
 */
export function usesSoftCaps(planId: PlanId): boolean {
  return PLANS[planId].credits.softCapEnabled;
}

// -----------------------------------------------------------------------------
// Feature Keys (for entitlements table)
// -----------------------------------------------------------------------------

export const FEATURE_KEYS = [
  "ai_analysis",
  "voice_chat",
  "survey_responses",
  "survey_ai_analysis",
  "team_workspace",
  "sso",
  "interview_guide",
  "smart_personas",
  "ai_crm",
  "white_label",
  "calendar_sync",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
