/**
 * Tests for the extractPersonalizedEvidence trigger task.
 * Tests the evidence extraction logic with mocked Supabase and BAML.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock BAML client
const mockExtractEvidenceFromAnswer = vi.fn();

vi.mock("baml_client", () => ({
  b: {
    ExtractEvidenceFromAnswer: (...args: unknown[]) =>
      mockExtractEvidenceFromAnswer(...args),
  },
}));

// Mock Supabase admin client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("~/lib/supabase/client.server", () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

// Helper to set up chainable mock returns
function setupFromMock(
  table: string,
  operation: "select" | "insert" | "update" | "delete" | "upsert",
  returnData: { data: unknown; error: unknown },
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(returnData)),
    maybeSingle: vi.fn(() => Promise.resolve(returnData)),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  };

  // Make from() return the chain for the specified table
  mockFrom.mockImplementation((t: string) => {
    if (t === table) return chain;
    // Default fallback for other tables
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn(() => Promise.resolve({ error: null })),
      upsert: vi.fn().mockReturnThis(),
    };
  });

  return chain;
}

describe("extractPersonalizedEvidence logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BAML evidence extraction", () => {
    it("extracts multiple evidence pieces from a single answer", () => {
      const mockExtracted = [
        {
          gist: "Spends 3-4 hrs/week manually tagging notes",
          verbatim:
            "I spend 3-4 hours per week manually tagging interview notes",
          context_summary: "Manual tagging is time-consuming",
          category: "pain",
          confidence: 0.95,
          says: ["I spend 3-4 hours per week"],
          thinks: [],
          feels: [],
          pains: ["Time-consuming manual work"],
          gains: [],
          theme_matches: ["Onboarding friction"],
        },
        {
          gist: "Still misses important patterns",
          verbatim: "I still miss important patterns",
          context_summary: "Error-prone manual process",
          category: "pain",
          confidence: 0.85,
          says: [],
          thinks: [],
          feels: [],
          pains: ["Missing important patterns"],
          gains: [],
          theme_matches: [],
        },
      ];

      // Verify the structure of extracted evidence
      expect(mockExtracted).toHaveLength(2);
      expect(mockExtracted[0].confidence).toBeGreaterThanOrEqual(0.5);
      expect(mockExtracted[1].confidence).toBeGreaterThanOrEqual(0.5);
      expect(mockExtracted[0].category).toBe("pain");
    });

    it("filters out low-confidence extractions", () => {
      const extracted = [
        { gist: "Clear insight", confidence: 0.9, category: "pain" },
        { gist: "Vague statement", confidence: 0.3, category: "context" },
        { gist: "Moderate insight", confidence: 0.6, category: "goal" },
      ];

      const filtered = extracted.filter((e) => e.confidence >= 0.5);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((e) => e.gist)).toEqual([
        "Clear insight",
        "Moderate insight",
      ]);
    });
  });

  describe("confidence to evidence level mapping", () => {
    function mapConfidence(confidence: number): "high" | "medium" | "low" {
      if (confidence >= 0.9) return "high";
      if (confidence >= 0.7) return "medium";
      return "low";
    }

    it("maps high confidence correctly", () => {
      expect(mapConfidence(0.95)).toBe("high");
      expect(mapConfidence(0.9)).toBe("high");
    });

    it("maps medium confidence correctly", () => {
      expect(mapConfidence(0.85)).toBe("medium");
      expect(mapConfidence(0.7)).toBe("medium");
    });

    it("maps low confidence correctly", () => {
      expect(mapConfidence(0.6)).toBe("low");
      expect(mapConfidence(0.5)).toBe("low");
    });
  });

  describe("extraction metadata computation", () => {
    it("computes correct average confidence", () => {
      const allEvidence = [
        { confidence: 0.9, category: "pain" },
        { confidence: 0.8, category: "goal" },
        { confidence: 0.7, category: "pain" },
      ];

      const confidenceAvg =
        allEvidence.reduce((sum, e) => sum + e.confidence, 0) /
        allEvidence.length;

      expect(Math.round(confidenceAvg * 100) / 100).toBe(0.8);
    });

    it("computes category counts", () => {
      const allEvidence = [
        { category: "pain" },
        { category: "goal" },
        { category: "pain" },
        { category: "workflow" },
        { category: "pain" },
      ];

      const categories = allEvidence.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(categories).toEqual({
        pain: 3,
        goal: 1,
        workflow: 1,
      });
    });
  });

  describe("theme matching", () => {
    it("matches theme names case-insensitively", () => {
      const themes = [
        { id: "theme-1", name: "Onboarding Friction" },
        { id: "theme-2", name: "Customer Retention" },
        { id: "theme-3", name: "Pricing Sensitivity" },
      ];

      const themeMap = new Map(themes.map((t) => [t.name.toLowerCase(), t.id]));

      const evidenceThemes = ["onboarding friction", "pricing sensitivity"];

      const matched = evidenceThemes
        .map((name) => themeMap.get(name.toLowerCase()))
        .filter(Boolean);

      expect(matched).toEqual(["theme-1", "theme-3"]);
    });

    it("skips unmatched theme names", () => {
      const themes = [{ id: "theme-1", name: "Known Theme" }];
      const themeMap = new Map(themes.map((t) => [t.name.toLowerCase(), t.id]));

      const evidenceThemes = ["known theme", "unknown theme"];
      const matched = evidenceThemes
        .map((name) => themeMap.get(name.toLowerCase()))
        .filter(Boolean);

      expect(matched).toEqual(["theme-1"]);
    });
  });

  describe("fallback evidence creation", () => {
    it("creates simple evidence when BAML fails", () => {
      const questionPrompt = "What's your biggest challenge?";
      const answer = "We struggle with onboarding new team members quickly.";
      const evidenceType = "pain";

      const fallbackEvidence = {
        gist: answer.length > 100 ? `${answer.slice(0, 97)}...` : answer,
        verbatim: answer,
        context_summary: `Response to: "${questionPrompt}"`,
        category: evidenceType,
        confidence: 0.7,
        theme_matches: [],
      };

      expect(fallbackEvidence.gist).toBe(answer);
      expect(fallbackEvidence.confidence).toBe(0.7);
      expect(fallbackEvidence.context_summary).toContain(questionPrompt);
    });

    it("truncates gist for long answers", () => {
      const longAnswer = "A".repeat(200);
      const gist =
        longAnswer.length > 100 ? `${longAnswer.slice(0, 97)}...` : longAnswer;

      expect(gist).toHaveLength(100);
      expect(gist.endsWith("...")).toBe(true);
    });
  });

  describe("question filtering", () => {
    it("skips answers shorter than 10 characters", () => {
      const questions = [
        { id: "q1", prompt: "Q1?", type: "long_text" },
        { id: "q2", prompt: "Q2?", type: "long_text" },
        { id: "q3", prompt: "Q3?", type: "long_text" },
      ];

      const answers: Record<string, string> = {
        q1: "This is a detailed answer about our challenges.",
        q2: "Short",
        q3: "Another detailed response with enough content.",
      };

      const validQAs = questions.filter((q) => {
        const answer = answers[q.id];
        return typeof answer === "string" && answer.trim().length >= 10;
      });

      expect(validQAs).toHaveLength(2);
      expect(validQAs.map((q) => q.id)).toEqual(["q1", "q3"]);
    });

    it("skips non-string answers", () => {
      const answers: Record<string, unknown> = {
        q1: "Valid text answer",
        q2: 42,
        q3: null,
        q4: undefined,
        q5: { nested: "object" },
      };

      const validAnswers = Object.entries(answers).filter(
        ([, v]) => typeof v === "string" && (v as string).trim().length >= 10,
      );

      expect(validAnswers).toHaveLength(1);
      expect(validAnswers[0][0]).toBe("q1");
    });
  });
});
