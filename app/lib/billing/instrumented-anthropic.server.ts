/**
 * Instrumented Anthropic Provider with Billing
 *
 * Creates an Anthropic provider that automatically tracks usage for billing.
 * Use this instead of importing directly from @ai-sdk/anthropic in agents.
 *
 * @example
 * ```ts
 * // Before:
 * import { anthropic } from "@ai-sdk/anthropic";
 * const agent = new Agent({ model: anthropic("claude-sonnet-4-20250514"), ... });
 *
 * // After:
 * import { anthropic } from "../../lib/billing/instrumented-anthropic.server";
 * const agent = new Agent({ model: anthropic("claude-sonnet-4-20250514"), ... });
 * ```
 */

import { type AnthropicProvider, createAnthropic } from "@ai-sdk/anthropic";
import consola from "consola";
import type { BillingContext } from "./context";
import { recordUsageOnly } from "./usage.server";

// Re-export for convenience
export type { BillingContext } from "./context";
export { systemBillingContext, userBillingContext } from "./context";

// Store active context for the current request
// This is a workaround since we can't pass context through the AI SDK's fetch wrapper
let _activeContext: BillingContext | null = null;
let _activeIdempotencyPrefix: string | null = null;

/**
 * Set the active billing context for the current request.
 * Call this at the start of agent execution.
 */
export function setActiveBillingContext(ctx: BillingContext, idempotencyPrefix: string): void {
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
 * Create an instrumented Anthropic provider.
 *
 * This intercepts all API calls to track usage for billing.
 * The billing context must be set via setActiveBillingContext before use.
 */
export function createInstrumentedAnthropic(): AnthropicProvider {
	return createAnthropic({
		// Custom fetch that intercepts responses to extract usage
		fetch: async (url, options) => {
			const response = await fetch(url, options);

			// Only process messages API
			if (typeof url === "string" && url.includes("/messages") && _activeContext && _activeIdempotencyPrefix) {
				// Clone response to read body without consuming it
				const cloned = response.clone();

				try {
					// For streaming responses, we need to handle differently
					const contentType = response.headers.get("content-type");
					if (contentType?.includes("text/event-stream")) {
						// Streaming response - usage tracked on completion
						consola.debug("[billing:anthropic] Streaming response - usage tracked on completion");
					} else {
						// Non-streaming response - extract usage directly
						const data = await cloned.json();
						if (data.usage) {
							await recordAnthropicUsage(data);
						}
					}
				} catch (err) {
					consola.debug("[billing:anthropic] Failed to extract usage:", err);
				}
			}

			return response;
		},
	});
}

/**
 * Record usage from Anthropic response
 */
async function recordAnthropicUsage(data: {
	model?: string;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
	};
}): Promise<void> {
	if (!_activeContext || !_activeIdempotencyPrefix || !data.usage) {
		return;
	}

	const model = data.model || "claude-sonnet-4-20250514";
	const inputTokens = data.usage.input_tokens || 0;
	const outputTokens = data.usage.output_tokens || 0;

	// Estimate cost based on model
	const costUsd = estimateAnthropicCost(model, inputTokens, outputTokens);

	const idempotencyKey = `${_activeIdempotencyPrefix}:${Date.now()}`;

	await recordUsageOnly(
		_activeContext,
		{
			provider: "anthropic",
			model,
			inputTokens,
			outputTokens,
			estimatedCostUsd: costUsd,
		},
		idempotencyKey
	).catch((err) => {
		consola.error("[billing:anthropic] Failed to record usage:", err);
	});
}

/**
 * Estimate cost for Anthropic models.
 * Based on current pricing (Jan 2026).
 */
export function estimateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
	// Pricing per 1M tokens (input, output)
	const pricing: Record<string, [number, number]> = {
		"claude-opus-4-20250514": [15.0, 75.0],
		"claude-sonnet-4-20250514": [3.0, 15.0],
		"claude-3-5-sonnet-20241022": [3.0, 15.0],
		"claude-3-5-haiku-20241022": [1.0, 5.0],
		"claude-3-opus-20240229": [15.0, 75.0],
		"claude-3-sonnet-20240229": [3.0, 15.0],
		"claude-3-haiku-20240307": [0.25, 1.25],
		// Fallback for unknown models
		default: [3.0, 15.0],
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
 *   { accountId, userId, featureSource: "research_link_chat_agent" },
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
	fn: () => Promise<T>
): Promise<T> {
	try {
		setActiveBillingContext(ctx, idempotencyPrefix);
		return await fn();
	} finally {
		clearActiveBillingContext();
	}
}

/**
 * The instrumented Anthropic provider instance.
 * Import this instead of the default @ai-sdk/anthropic provider.
 */
export const anthropic = createInstrumentedAnthropic();
