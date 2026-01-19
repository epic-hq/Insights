/**
 * Tests for Mastra tool inputSchema validation patterns
 * Ensures .nullish().transform() works correctly
 *
 * IMPORTANT: Use .nullish() (not .nullable().optional()) for all optional fields
 * because LLMs may send null for optional fields. See docs/bugs/backlog.md
 *
 * This tests the Zod patterns directly without importing tools
 * (which would trigger env validation side effects)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const DEFAULT_MATCH_COUNT = 10;
const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_EVIDENCE_LIMIT = 50;

describe("Zod nullish patterns for Mastra tools", () => {
  describe("pattern: .nullish().transform() - THE CORRECT PATTERN", () => {
    const schema = z.object({
      query: z.string(),
      matchThreshold: z
        .number()
        .min(0)
        .max(1)
        .nullish()
        .transform((val) => val ?? DEFAULT_MATCH_THRESHOLD),
      matchCount: z
        .number()
        .int()
        .min(1)
        .max(50)
        .nullish()
        .transform((val) => val ?? DEFAULT_MATCH_COUNT),
      interviewId: z.string().nullish(),
    });

    it("should accept minimal required fields only", () => {
      const result = schema.safeParse({
        query: "test search query",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe("test search query");
        expect(result.data.matchThreshold).toBe(0.5);
        expect(result.data.matchCount).toBe(10);
        expect(result.data.interviewId).toBeUndefined();
      }
    });

    it("should accept null values and apply defaults", () => {
      const result = schema.safeParse({
        query: "test query",
        matchThreshold: null,
        matchCount: null,
        interviewId: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matchThreshold).toBe(0.5);
        expect(result.data.matchCount).toBe(10);
        expect(result.data.interviewId).toBeNull();
      }
    });

    it("should accept explicit values", () => {
      const result = schema.safeParse({
        query: "budget concerns",
        matchThreshold: 0.7,
        matchCount: 25,
        interviewId: "int-456",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matchThreshold).toBe(0.7);
        expect(result.data.matchCount).toBe(25);
        expect(result.data.interviewId).toBe("int-456");
      }
    });

    it("should reject invalid range", () => {
      const result = schema.safeParse({
        query: "test",
        matchThreshold: 1.5, // Out of range
      });

      expect(result.success).toBe(false);
    });
  });

  describe("pattern: .optional() alone (BROKEN - rejects null)", () => {
    // This demonstrates why .optional() alone is problematic
    const brokenSchema = z.object({
      value: z.string().optional(),
    });

    it("accepts undefined", () => {
      const result = brokenSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("FAILS for null - this is why we need .nullish()", () => {
      const result = brokenSchema.safeParse({ value: null });
      expect(result.success).toBe(false); // This fails! LLMs send null.
    });
  });

  describe("boolean with .nullish().transform()", () => {
    const schema = z.object({
      includeInterview: z
        .boolean()
        .nullish()
        .transform((val) => val ?? true),
      includeInsights: z
        .boolean()
        .nullish()
        .transform((val) => val ?? false),
    });

    it("applies true default when omitted", () => {
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeInterview).toBe(true);
        expect(result.data.includeInsights).toBe(false);
      }
    });

    it("applies defaults for null values", () => {
      const result = schema.safeParse({
        includeInterview: null,
        includeInsights: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeInterview).toBe(true);
        expect(result.data.includeInsights).toBe(false);
      }
    });

    it("preserves explicit false", () => {
      const result = schema.safeParse({
        includeInterview: false,
        includeInsights: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeInterview).toBe(false);
        expect(result.data.includeInsights).toBe(true);
      }
    });
  });

  describe("enum with .nullish()", () => {
    const schema = z.object({
      modality: z.enum(["qual", "quant"]).nullish(),
      confidence: z.enum(["low", "medium", "high"]).nullish(),
    });

    it("accepts omitted values", () => {
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts null values", () => {
      const result = schema.safeParse({
        modality: null,
        confidence: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid enum values", () => {
      const result = schema.safeParse({
        modality: "qual",
        confidence: "high",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modality).toBe("qual");
        expect(result.data.confidence).toBe("high");
      }
    });

    it("rejects invalid enum values", () => {
      const result = schema.safeParse({
        modality: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });
});
