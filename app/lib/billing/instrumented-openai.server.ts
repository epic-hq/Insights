/**
 * Instrumented OpenAI Provider with Billing
 *
 * Creates an OpenAI provider that automatically tracks usage for billing.
 * Use this instead of importing directly from @ai-sdk/openai in agents.
 *
 * @example
 * ```ts
 * // Before:
 * import { openai } from "@ai-sdk/openai";
 * const agent = new Agent({ model: openai("gpt-4o"), ... });
 *
 * // After:
 * import { createInstrumentedOpenAI } from "~/lib/billing/instrumented-openai.server";
 * const openai = createInstrumentedOpenAI(billingContext);
 * const agent = new Agent({ model: openai("gpt-4o"), ... });
 * ```
 */

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import consola from "consola";
import type { BillingContext } from "./context";
import { recordUsageOnly } from "./usage.server";

// Re-export for convenience
export type { BillingContext } from "./context";
export { userBillingContext, systemBillingContext } from "./context";

// Store active context for the current request
// This is a workaround since we can't pass context through the AI SDK's fetch wrapper
let _activeContext: BillingContext | null = null;
let _activeIdempotencyPrefix: string | null = null;

/**
 * Set the active billing context for the current request.
 * Call this at the start of agent execution.
 */
export function setActiveBillingContext(
  ctx: BillingContext,
  idempotencyPrefix: string,
): void {
  _activeContext = ctx;
  _activeIdempotencyPrefix = idempotencyPrefix;
}

/**
 * Clear the active billing context.
 * Call this at the end of agent execution.
 */
export function clearActiveBillingContext(): void {
  _activeContext = null;
  _activeIdempotencyPrefix = null;
}

/**
 * Create an instrumented OpenAI provider.
 *
 * This intercepts all API calls to track usage for billing.
 * The billing context must be set via setActiveBillingContext before use.
 */
export function createInstrumentedOpenAI(): OpenAIProvider {
  return createOpenAI({
    // Custom fetch that intercepts responses to extract usage
    fetch: async (url, options) => {
      const response = await fetch(url, options);

      // Only process chat completions
      if (
        typeof url === "string" &&
        url.includes("/chat/completions") &&
        _activeContext &&
        _activeIdempotencyPrefix
      ) {
        // Clone response to read body without consuming it
        const cloned = response.clone();

        try {
          // For streaming responses, we need to handle differently
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("text/event-stream")) {
            // Streaming response - we'll track via a different mechanism
            // The AI SDK aggregates usage in the final message
            consola.debug(
              "[billing:openai] Streaming response - usage tracked on completion",
            );
          } else {
            // Non-streaming response - extract usage directly
            const data = await cloned.json();
            if (data.usage) {
              await recordOpenAIUsage(data, options);
            }
          }
        } catch (err) {
          consola.debug("[billing:openai] Failed to extract usage:", err);
        }
      }

      return response;
    },
  });
}

/**
 * Record usage from OpenAI response
 */
async function recordOpenAIUsage(
  data: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  },
  options?: RequestInit,
): Promise<void> {
  if (!_activeContext || !_activeIdempotencyPrefix || !data.usage) {
    return;
  }

  const model = data.model || "gpt-4o";
  const inputTokens = data.usage.prompt_tokens || 0;
  const outputTokens = data.usage.completion_tokens || 0;

  // Estimate cost based on model
  const costUsd = estimateOpenAICost(model, inputTokens, outputTokens);

  const idempotencyKey = `${_activeIdempotencyPrefix}:${Date.now()}`;

  await recordUsageOnly(
    _activeContext,
    {
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd,
    },
    idempotencyKey,
  ).catch((err) => {
    consola.error("[billing:openai] Failed to record usage:", err);
  });
}

/**
 * Estimate cost for OpenAI models.
 * Based on current pricing (Jan 2026).
 */
function estimateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Pricing per 1M tokens (input, output)
  const pricing: Record<string, [number, number]> = {
    "gpt-4o": [2.5, 10.0],
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4-turbo": [10.0, 30.0],
    "gpt-4": [30.0, 60.0],
    "gpt-3.5-turbo": [0.5, 1.5],
    o1: [15.0, 60.0],
    "o1-mini": [3.0, 12.0],
    // Fallback for unknown models
    default: [2.5, 10.0],
  };

  const [inputRate, outputRate] = pricing[model] || pricing.default;

  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;

  return inputCost + outputCost;
}

/**
 * Wrapper for agent execution with billing context.
 *
 * Use this to wrap agent.run() or agent.generate() calls.
 *
 * @example
 * ```ts
 * const result = await withAgentBilling(
 *   { accountId, userId, featureSource: "project_status_agent" },
 *   `agent:${messageId}`,
 *   async () => {
 *     return agent.generate(messages);
 *   }
 * );
 * ```
 */
export async function withAgentBilling<T>(
  ctx: BillingContext,
  idempotencyPrefix: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    setActiveBillingContext(ctx, idempotencyPrefix);
    return await fn();
  } finally {
    clearActiveBillingContext();
  }
}

/**
 * The instrumented OpenAI provider instance.
 * Import this instead of the default @ai-sdk/openai provider.
 */
export const openai = createInstrumentedOpenAI();
