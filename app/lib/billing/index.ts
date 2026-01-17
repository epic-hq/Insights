/**
 * Billing Module - Unified Exports
 *
 * Import from this module for all billing-related functionality.
 *
 * @example
 * ```ts
 * import {
 *   type BillingContext,
 *   userBillingContext,
 *   systemBillingContext,
 *   runBamlWithBilling,
 *   generateEmbeddingWithBilling,
 *   withAgentBilling,
 * } from "~/lib/billing";
 * ```
 */

// Context types and helpers
export {
  type BillingContext,
  type FeatureSource,
  FEATURE_SOURCES,
  userBillingContext,
  systemBillingContext,
  validateBillingContext,
} from "./context";

// Core usage recording
export {
  type UsageEvent,
  type UsageResult,
  recordUsageAndSpendCredits,
  recordUsageOnly,
  checkAccountLimits,
} from "./usage.server";

// Instrumented BAML
export {
  runBamlWithBilling,
  runBamlWithBillingOrThrow,
  UsageLimitError,
} from "./instrumented-baml.server";

// Instrumented embeddings
export {
  generateEmbeddingWithBilling,
  generateEmbeddingWithBillingOrThrow,
  generateEmbeddingsBatchWithBilling,
  estimateEmbeddingCost,
  estimateBatchEmbeddingCost,
} from "./instrumented-embeddings.server";

// Instrumented OpenAI (for Mastra agents)
export {
  openai,
  createInstrumentedOpenAI,
  withAgentBilling,
  setActiveBillingContext,
  clearActiveBillingContext,
} from "./instrumented-openai.server";
