/**
 * Tests for campaign API route schema validation.
 * Tests Zod schemas without importing the full route handlers
 * to avoid Supabase initialization.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ============================================================================
// Recreate schemas from the API routes (avoids importing server code)
// ============================================================================

const CreateCampaignSchema = z.object({
  strategy: z.enum([
    "pricing_validation",
    "sparse_data_discovery",
    "theme_validation",
    "general_research",
  ]),
  goal: z.string().optional(),
  name: z.string().optional(),
});

const AddToCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  personIds: z.array(z.string().uuid()).min(1),
  surveyGoal: z
    .enum(["validate", "discover", "deep_dive", "pricing"])
    .default("discover"),
});

const GenerateQuestionsSchema = z.object({
  campaignId: z.string().uuid(),
  personIds: z.array(z.string().uuid()).optional(),
  questionCount: z.number().int().min(3).max(10).default(5),
});

const GetRecommendationsSchema = z.object({
  strategy: z.enum([
    "pricing_validation",
    "sparse_data_discovery",
    "theme_validation",
    "general_research",
  ]),
  limit: z.number().int().min(1).max(50).default(10),
});

// ============================================================================
// CreateCampaign schema tests
// ============================================================================

describe("CreateCampaignSchema", () => {
  it("accepts valid minimal input", () => {
    const result = CreateCampaignSchema.safeParse({
      strategy: "sparse_data_discovery",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all strategy types", () => {
    for (const strategy of [
      "pricing_validation",
      "sparse_data_discovery",
      "theme_validation",
      "general_research",
    ]) {
      const result = CreateCampaignSchema.safeParse({ strategy });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional goal and name", () => {
    const result = CreateCampaignSchema.safeParse({
      strategy: "pricing_validation",
      goal: "Validate enterprise pricing",
      name: "Q1 Pricing Survey",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBe("Validate enterprise pricing");
      expect(result.data.name).toBe("Q1 Pricing Survey");
    }
  });

  it("rejects invalid strategy", () => {
    const result = CreateCampaignSchema.safeParse({
      strategy: "invalid_strategy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing strategy", () => {
    const result = CreateCampaignSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// AddToCampaign schema tests
// ============================================================================

describe("AddToCampaignSchema", () => {
  const validUuid = "00000000-0000-0000-0000-000000000001";

  it("accepts valid input with default goal", () => {
    const result = AddToCampaignSchema.safeParse({
      campaignId: validUuid,
      personIds: [validUuid],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surveyGoal).toBe("discover");
    }
  });

  it("accepts explicit survey goal", () => {
    const result = AddToCampaignSchema.safeParse({
      campaignId: validUuid,
      personIds: [validUuid],
      surveyGoal: "pricing",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surveyGoal).toBe("pricing");
    }
  });

  it("accepts multiple person IDs", () => {
    const ids = Array.from(
      { length: 10 },
      (_, i) => `0000000${i}-0000-0000-0000-000000000001`,
    );
    const result = AddToCampaignSchema.safeParse({
      campaignId: validUuid,
      personIds: ids,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personIds).toHaveLength(10);
    }
  });

  it("rejects empty person IDs array", () => {
    const result = AddToCampaignSchema.safeParse({
      campaignId: validUuid,
      personIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID campaign ID", () => {
    const result = AddToCampaignSchema.safeParse({
      campaignId: "not-a-uuid",
      personIds: [validUuid],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid survey goal", () => {
    const result = AddToCampaignSchema.safeParse({
      campaignId: validUuid,
      personIds: [validUuid],
      surveyGoal: "invalid_goal",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// GenerateQuestions schema tests
// ============================================================================

describe("GenerateQuestionsSchema", () => {
  const validUuid = "00000000-0000-0000-0000-000000000001";

  it("accepts minimal input with defaults", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questionCount).toBe(5);
      expect(result.data.personIds).toBeUndefined();
    }
  });

  it("accepts custom question count", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
      questionCount: 8,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questionCount).toBe(8);
    }
  });

  it("accepts optional person IDs filter", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
      personIds: [validUuid],
      questionCount: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects question count below minimum (3)", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
      questionCount: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects question count above maximum (10)", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
      questionCount: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer question count", () => {
    const result = GenerateQuestionsSchema.safeParse({
      campaignId: validUuid,
      questionCount: 5.5,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// GetRecommendations schema tests
// ============================================================================

describe("GetRecommendationsSchema", () => {
  it("accepts valid input with default limit", () => {
    const result = GetRecommendationsSchema.safeParse({
      strategy: "sparse_data_discovery",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("accepts custom limit", () => {
    const result = GetRecommendationsSchema.safeParse({
      strategy: "pricing_validation",
      limit: 25,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit above maximum (50)", () => {
    const result = GetRecommendationsSchema.safeParse({
      strategy: "general_research",
      limit: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects limit below minimum (1)", () => {
    const result = GetRecommendationsSchema.safeParse({
      strategy: "general_research",
      limit: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Helper function tests
// ============================================================================

describe("generateCampaignName", () => {
  function generateCampaignName(strategy: string, date: Date): string {
    const strategyNames: Record<string, string> = {
      pricing_validation: "Pricing Validation",
      sparse_data_discovery: "Discovery Campaign",
      theme_validation: "Theme Validation",
      general_research: "Research Campaign",
    };
    const strategyName = strategyNames[strategy] || "Survey Campaign";
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${strategyName} - ${dateStr}`;
  }

  it("generates correct name for each strategy", () => {
    const date = new Date(2026, 1, 11); // month is 0-indexed
    expect(generateCampaignName("pricing_validation", date)).toBe(
      "Pricing Validation - Feb 11",
    );
    expect(generateCampaignName("sparse_data_discovery", date)).toBe(
      "Discovery Campaign - Feb 11",
    );
    expect(generateCampaignName("theme_validation", date)).toBe(
      "Theme Validation - Feb 11",
    );
    expect(generateCampaignName("general_research", date)).toBe(
      "Research Campaign - Feb 11",
    );
  });

  it("falls back for unknown strategy", () => {
    const date = new Date(2026, 2, 15); // month is 0-indexed
    expect(generateCampaignName("unknown", date)).toBe(
      "Survey Campaign - Mar 15",
    );
  });
});

describe("generateSlug", () => {
  function generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
  }

  it("generates URL-safe slug", () => {
    const slug = generateSlug("Pricing Validation - Feb 11");
    expect(slug).toMatch(/^pricing-validation-feb-11-[a-z0-9]{6}$/);
  });

  it("strips leading/trailing hyphens", () => {
    const slug = generateSlug("--test--");
    expect(slug).toMatch(/^test-[a-z0-9]{6}$/);
  });

  it("generates unique slugs", () => {
    const slug1 = generateSlug("Test");
    const slug2 = generateSlug("Test");
    expect(slug1).not.toBe(slug2);
  });
});
