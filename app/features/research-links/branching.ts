/**
 * Survey Branching Logic Engine
 *
 * Provides conditional branching for survey questions with AND/OR logic.
 * Used by both form mode (client-side) and chat mode (server-side agent).
 */

import { z } from "zod";

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Condition operators for evaluating responses
 */
export const ConditionOperatorSchema = z.enum([
  "equals", // Exact match
  "not_equals", // Not exact match
  "contains", // String contains (case-insensitive)
  "not_contains", // String does not contain
  "selected", // For multi-select: value is in array
  "not_selected", // For multi-select: value not in array
  "answered", // Question has any response
  "not_answered", // Question has no response
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

/**
 * Single condition to evaluate
 */
export const ConditionSchema = z.object({
  questionId: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

/**
 * Group of conditions with AND/OR logic
 */
export const ConditionGroupSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z.array(ConditionSchema).min(1),
});

export type ConditionGroup = z.infer<typeof ConditionGroupSchema>;

/**
 * Branch action types
 */
export const BranchActionSchema = z.enum(["skip_to", "end_survey"]);

export type BranchAction = z.infer<typeof BranchActionSchema>;

/**
 * Source of how the rule was created
 */
export const RuleSourceSchema = z.enum([
  "user_ui",
  "user_voice",
  "ai_generated",
]);

export type RuleSource = z.infer<typeof RuleSourceSchema>;

/**
 * Confidence level for AI-parsed rules
 */
export const RuleConfidenceSchema = z.enum(["high", "medium", "low"]);

export type RuleConfidence = z.infer<typeof RuleConfidenceSchema>;

/**
 * Complete branch rule with conditions and action
 *
 * Supports both traditional UI-created rules and natural language guidelines:
 * - UI rules: conditions + action (structured)
 * - NL guidelines: naturalLanguage + summary (human-friendly) + conditions + action (parsed)
 */
export const BranchRuleSchema = z.object({
  id: z.string().min(1),
  conditions: ConditionGroupSchema,
  action: BranchActionSchema,
  targetQuestionId: z.string().optional(), // Required for skip_to
  label: z.string().optional(), // Human-readable description (legacy)

  // Natural language fields (for AI-parsed guidelines)
  naturalLanguage: z.string().optional(), // Original user input preserved
  summary: z.string().optional(), // AI-generated summary: "When sponsors respond, skip to budget"
  guidance: z.string().optional(), // AI hint for chat mode: "Probe on approval process"

  // Metadata
  source: RuleSourceSchema.optional(), // How the rule was created
  confidence: RuleConfidenceSchema.optional(), // AI parsing confidence
  createdAt: z.string().optional(), // ISO timestamp
});

export type BranchRule = z.infer<typeof BranchRuleSchema>;

/**
 * Branching configuration for a question
 */
export const QuestionBranchingSchema = z.object({
  rules: z.array(BranchRuleSchema),
  defaultNext: z.string().optional(), // Override linear order
});

export type QuestionBranching = z.infer<typeof QuestionBranchingSchema>;

// ============================================================================
// Response Types
// ============================================================================

export type ResponseValue = string | string[] | boolean | null | undefined;

export type ResponseRecord = Record<string, ResponseValue>;

// ============================================================================
// Evaluation Functions
// ============================================================================

/**
 * Normalize a response value for comparison
 */
function normalizeValue(value: ResponseValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

/**
 * Check if a response has a meaningful value
 */
function hasValue(value: ResponseValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Evaluate a single condition against responses
 */
export function evaluateCondition(
  condition: Condition,
  responses: ResponseRecord,
): boolean {
  const answer = responses[condition.questionId];
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return normalizeValue(answer) === normalizeValue(expectedValue);

    case "not_equals":
      return normalizeValue(answer) !== normalizeValue(expectedValue);

    case "contains":
      return normalizeValue(answer)
        .toLowerCase()
        .includes(normalizeValue(expectedValue).toLowerCase());

    case "not_contains":
      return !normalizeValue(answer)
        .toLowerCase()
        .includes(normalizeValue(expectedValue).toLowerCase());

    case "selected":
      // For multi-select: check if value is in the array
      if (!Array.isArray(answer)) return false;
      if (Array.isArray(expectedValue)) {
        return expectedValue.some((v) => answer.includes(v));
      }
      return answer.includes(expectedValue as string);

    case "not_selected":
      // For multi-select: check if value is NOT in the array
      if (!Array.isArray(answer)) return true;
      if (Array.isArray(expectedValue)) {
        return !expectedValue.some((v) => answer.includes(v));
      }
      return !answer.includes(expectedValue as string);

    case "answered":
      return hasValue(answer);

    case "not_answered":
      return !hasValue(answer);

    default:
      return false;
  }
}

/**
 * Evaluate a condition group (AND/OR logic)
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  responses: ResponseRecord,
): boolean {
  if (group.logic === "and") {
    return group.conditions.every((c) => evaluateCondition(c, responses));
  }
  return group.conditions.some((c) => evaluateCondition(c, responses));
}

/**
 * Evaluate all branch rules for a question and return the matching action
 */
export function evaluateBranchRules(
  branching: QuestionBranching | null | undefined,
  responses: ResponseRecord,
): { action: BranchAction; targetQuestionId?: string; ruleId?: string } | null {
  if (!branching?.rules?.length) return null;

  for (const rule of branching.rules) {
    if (evaluateConditionGroup(rule.conditions, responses)) {
      return {
        action: rule.action,
        targetQuestionId: rule.targetQuestionId,
        ruleId: rule.id,
      };
    }
  }

  return null;
}

// ============================================================================
// Navigation Functions
// ============================================================================

export interface QuestionWithBranching {
  id: string;
  branching?: QuestionBranching | null;
}

/**
 * Get the next question ID based on branching rules
 *
 * @param currentQuestion - The question that was just answered
 * @param questions - All questions in order
 * @param responses - Current response values
 * @returns The next question ID, or null if survey should end
 */
export function getNextQuestionId(
  currentQuestion: QuestionWithBranching,
  questions: QuestionWithBranching[],
  responses: ResponseRecord,
): string | null {
  // Evaluate branch rules
  const branchResult = evaluateBranchRules(
    currentQuestion.branching,
    responses,
  );

  if (branchResult) {
    if (branchResult.action === "end_survey") {
      return null;
    }
    if (branchResult.action === "skip_to" && branchResult.targetQuestionId) {
      // Verify target exists and is after current
      const targetIndex = questions.findIndex(
        (q) => q.id === branchResult.targetQuestionId,
      );
      const currentIndex = questions.findIndex(
        (q) => q.id === currentQuestion.id,
      );
      if (targetIndex > currentIndex) {
        return branchResult.targetQuestionId;
      }
      // If target is before current or not found, fall through to default
    }
  }

  // Check for defaultNext override
  if (currentQuestion.branching?.defaultNext) {
    const targetIndex = questions.findIndex(
      (q) => q.id === currentQuestion.branching?.defaultNext,
    );
    const currentIndex = questions.findIndex(
      (q) => q.id === currentQuestion.id,
    );
    if (targetIndex > currentIndex) {
      return currentQuestion.branching.defaultNext;
    }
  }

  // Default: next question in linear order
  const currentIndex = questions.findIndex((q) => q.id === currentQuestion.id);
  const nextQuestion = questions[currentIndex + 1];
  return nextQuestion?.id ?? null;
}

/**
 * Get the index of the next question based on branching rules
 *
 * @param currentIndex - Current question index
 * @param questions - All questions in order
 * @param responses - Current response values
 * @returns The next question index, or questions.length if survey should end
 */
export function getNextQuestionIndex(
  currentIndex: number,
  questions: QuestionWithBranching[],
  responses: ResponseRecord,
): number {
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return questions.length;

  const nextId = getNextQuestionId(currentQuestion, questions, responses);

  if (nextId === null) {
    return questions.length; // End survey
  }

  const nextIndex = questions.findIndex((q) => q.id === nextId);
  return nextIndex >= 0 ? nextIndex : currentIndex + 1;
}

// ============================================================================
// Helpers for Building Rules
// ============================================================================

/**
 * Create a simple "if equals, skip to" rule
 */
export function createSkipRule(
  questionId: string,
  value: string,
  targetQuestionId: string,
  label?: string,
): BranchRule {
  return {
    id: `skip-${questionId}-${value}`.replace(/\s+/g, "-").toLowerCase(),
    conditions: {
      logic: "and",
      conditions: [{ questionId, operator: "equals", value }],
    },
    action: "skip_to",
    targetQuestionId,
    label,
  };
}

/**
 * Create an "if equals, end survey" rule
 */
export function createEndRule(
  questionId: string,
  value: string,
  label?: string,
): BranchRule {
  return {
    id: `end-${questionId}-${value}`.replace(/\s+/g, "-").toLowerCase(),
    conditions: {
      logic: "and",
      conditions: [{ questionId, operator: "equals", value }],
    },
    action: "end_survey",
    label,
  };
}

/**
 * Create an OR condition group
 */
export function createOrConditions(
  conditions: Omit<Condition, "operator">[],
  operator: ConditionOperator,
): ConditionGroup {
  return {
    logic: "or",
    conditions: conditions.map((c) => ({ ...c, operator })),
  };
}

/**
 * Create an AND condition group
 */
export function createAndConditions(
  conditions: Omit<Condition, "operator">[],
  operator: ConditionOperator,
): ConditionGroup {
  return {
    logic: "and",
    conditions: conditions.map((c) => ({ ...c, operator })),
  };
}
