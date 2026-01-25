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
  FEATURE_SOURCES,
  type FeatureSource,
  systemBillingContext,
  userBillingContext,
  validateBillingContext,
} from "./context";
// Instrumented BAML
export {
  runBamlWithBilling,
  runBamlWithBillingOrThrow,
  UsageLimitError,
} from "./instrumented-baml.server";
// Instrumented embeddings
export {
  estimateBatchEmbeddingCost,
  estimateEmbeddingCost,
  generateEmbeddingsBatchWithBilling,
  generateEmbeddingWithBilling,
  generateEmbeddingWithBillingOrThrow,
} from "./instrumented-embeddings.server";
// Instrumented OpenAI (for Mastra agents)
export {
  clearActiveBillingContext,
  createInstrumentedOpenAI,
  openai,
  setActiveBillingContext,
  withAgentBilling,
} from "./instrumented-openai.server";
// Instrumented Anthropic (for Mastra agents)
export {
  anthropic,
  createInstrumentedAnthropic,
  clearActiveBillingContext as clearAnthropicBillingContext,
  setActiveBillingContext as setAnthropicBillingContext,
  withAgentBilling as withAnthropicAgentBilling,
} from "./instrumented-anthropic.server";
// Core usage recording
export {
  checkAccountLimits,
  recordUsageAndSpendCredits,
  recordUsageOnly,
  type UsageEvent,
  type UsageResult,
} from "./usage.server";
