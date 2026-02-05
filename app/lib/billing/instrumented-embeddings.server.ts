/**
 * Instrumented Embeddings Wrapper with Billing
 *
 * Wraps the existing embedding functions to add billing integration.
 * Use these instead of direct generateEmbedding calls when billing is enabled.
 *
 * @example
 * ```ts
 * import { generateEmbeddingWithBilling } from "~/lib/billing/instrumented-embeddings.server";
 *
 * const embedding = await generateEmbeddingWithBilling(
 *   { accountId, userId, featureSource: "semantic_search" },
 *   "User is frustrated with slow load times",
 *   { idempotencyKey: `embed:${evidenceId}` }
 * );
 * ```
 */

import consola from "consola"
import { generateEmbedding, generateEmbeddingsBatch } from "~/lib/embeddings/openai.server"
import type { BillingContext } from "./context"
import { recordUsageOnly } from "./usage.server"

// Re-export for convenience
export type { BillingContext } from "./context"
export { systemBillingContext, userBillingContext } from "./context"

// Embedding model constants
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_PROVIDER = "openai"
// Cost: $0.02 per 1M tokens, ~4 chars per token
const COST_PER_TOKEN = 0.00000002 // $0.02 / 1M = $0.00000002

/**
 * Options for embedding generation (mirrors openai.server interface)
 */
interface BaseEmbeddingOptions {
	/** Truncate input to this length (default: 8000 chars) */
	maxLength?: number
	/** Retry attempts on failure (default: 2) */
	retries?: number
	/** Label for logging (optional) */
	label?: string
}

interface EmbeddingWithBillingOptions extends BaseEmbeddingOptions {
	/** Unique key to prevent duplicate charges */
	idempotencyKey: string
	/** Resource being embedded (for tracking) */
	resourceType?: string
	resourceId?: string
}

/**
 * Generate an embedding with billing tracking.
 *
 * @param ctx - Billing context
 * @param text - Text to embed
 * @param options - Options including idempotencyKey
 * @returns Embedding vector or null on failure
 */
export async function generateEmbeddingWithBilling(
	ctx: BillingContext,
	text: string,
	options: EmbeddingWithBillingOptions
): Promise<number[] | null> {
	const startTime = Date.now()

	// Generate embedding using existing function
	const embedding = await generateEmbedding(text, options)

	// Record usage (async, non-blocking)
	if (embedding) {
		const estimatedTokens = estimateTokens(text)
		const estimatedCostUsd = estimatedTokens * COST_PER_TOKEN

		recordUsageOnly(
			ctx,
			{
				provider: EMBEDDING_PROVIDER,
				model: EMBEDDING_MODEL,
				inputTokens: estimatedTokens,
				outputTokens: 0, // Embeddings don't have output tokens
				estimatedCostUsd,
				resourceType: options.resourceType,
				resourceId: options.resourceId,
			},
			options.idempotencyKey
		).catch((err) => {
			consola.error("[billing:embeddings] Failed to record usage:", err)
		})
	}

	return embedding
}

/**
 * Generate embedding with billing, throwing on failure.
 */
export async function generateEmbeddingWithBillingOrThrow(
	ctx: BillingContext,
	text: string,
	options: EmbeddingWithBillingOptions
): Promise<number[]> {
	const embedding = await generateEmbeddingWithBilling(ctx, text, options)
	if (!embedding) {
		throw new Error(`Failed to generate embedding${options.label ? ` for "${options.label}"` : ""}`)
	}
	return embedding
}

interface BatchEmbeddingWithBillingOptions extends BaseEmbeddingOptions {
	/** Base key for idempotency (index will be appended) */
	idempotencyKeyBase: string
	/** Resource type being embedded */
	resourceType?: string
}

/**
 * Generate embeddings for multiple texts with billing tracking.
 *
 * @param ctx - Billing context
 * @param texts - Array of texts to embed
 * @param options - Options including idempotencyKeyBase
 * @returns Array of embeddings (null for failed items)
 */
export async function generateEmbeddingsBatchWithBilling(
	ctx: BillingContext,
	texts: string[],
	options: BatchEmbeddingWithBillingOptions
): Promise<(number[] | null)[]> {
	// Generate embeddings using existing batch function
	const embeddings = await generateEmbeddingsBatch(texts, options)

	// Record usage for successful embeddings
	const successfulIndices = embeddings.map((e, i) => (e ? i : -1)).filter((i) => i >= 0)

	if (successfulIndices.length > 0) {
		// Aggregate for single usage record
		const totalTokens = successfulIndices.reduce((sum, i) => sum + estimateTokens(texts[i]), 0)
		const estimatedCostUsd = totalTokens * COST_PER_TOKEN

		recordUsageOnly(
			ctx,
			{
				provider: EMBEDDING_PROVIDER,
				model: EMBEDDING_MODEL,
				inputTokens: totalTokens,
				outputTokens: 0,
				estimatedCostUsd,
				resourceType: options.resourceType,
			},
			`${options.idempotencyKeyBase}:batch:${successfulIndices.length}`
		).catch((err) => {
			consola.error("[billing:embeddings] Failed to record batch usage:", err)
		})
	}

	return embeddings
}

/**
 * Estimate token count for text.
 * OpenAI uses ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
	// More accurate estimation: ~1.3 tokens per word, ~4 chars per token
	return Math.ceil(text.length / 4)
}

/**
 * Get estimated cost for embedding text.
 * Useful for pre-flight cost estimation.
 */
export function estimateEmbeddingCost(text: string): {
	tokens: number
	costUsd: number
	credits: number
} {
	const tokens = estimateTokens(text)
	const costUsd = tokens * COST_PER_TOKEN
	const credits = Math.ceil(costUsd * 100)
	return { tokens, costUsd, credits }
}

/**
 * Get estimated cost for batch embedding.
 */
export function estimateBatchEmbeddingCost(texts: string[]): {
	totalTokens: number
	costUsd: number
	credits: number
} {
	const totalTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0)
	const costUsd = totalTokens * COST_PER_TOKEN
	const credits = Math.ceil(costUsd * 100)
	return { totalTokens, costUsd, credits }
}
