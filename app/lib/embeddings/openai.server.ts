/**
 * OpenAI Embeddings - Shared Utility
 *
 * Single source of truth for generating text embeddings via OpenAI.
 * Uses text-embedding-3-small model (1536 dimensions).
 *
 * All embedding generation in the codebase should use this module.
 */

import consola from "consola";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_LENGTH = 8000; // OpenAI token limit safety

/**
 * Semantic similarity thresholds for different use cases.
 * These are tuned based on empirical testing with text-embedding-3-small.
 */
export const SIMILARITY_THRESHOLDS = {
	/** Theme-to-theme deduplication (strict - 80%+ means same concept) */
	THEME_DEDUPLICATION: 0.8,
	/** Theme merging in clustering (very strict) */
	THEME_MERGE: 0.85,
	/** Evidence-to-theme linking (broader match for coverage) */
	EVIDENCE_TO_THEME: 0.4,
	/** General semantic search (balanced) */
	SEMANTIC_SEARCH: 0.5,
	/** Facet clustering */
	FACET_CLUSTERING: 0.75,
} as const;

export type SimilarityThresholdKey = keyof typeof SIMILARITY_THRESHOLDS;

interface GenerateEmbeddingOptions {
	/** Truncate input to this length (default: 8000 chars) */
	maxLength?: number;
	/** Retry attempts on failure (default: 2) */
	retries?: number;
	/** Label for logging (optional) */
	label?: string;
}

/**
 * Generate an embedding vector for the given text.
 *
 * @param text - The text to embed
 * @param options - Configuration options
 * @returns The embedding vector (1536 dimensions), or null if generation fails
 *
 * @example
 * ```ts
 * import { generateEmbedding } from "~/lib/embeddings/openai.server";
 *
 * const embedding = await generateEmbedding("User is frustrated with slow load times");
 * if (embedding) {
 *   // Use embedding for semantic search
 * }
 * ```
 */
export async function generateEmbedding(
	text: string,
	options: GenerateEmbeddingOptions = {}
): Promise<number[] | null> {
	const { maxLength = MAX_INPUT_LENGTH, retries = 2, label } = options;

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		consola.warn("[embeddings] OPENAI_API_KEY not configured, skipping embedding");
		return null;
	}

	if (!text || text.trim().length === 0) {
		consola.warn("[embeddings] Empty text provided, skipping embedding");
		return null;
	}

	// Truncate to avoid token limits
	const truncatedText = text.slice(0, maxLength);

	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetch(OPENAI_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: EMBEDDING_MODEL,
					input: truncatedText,
					dimensions: EMBEDDING_DIMENSIONS,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();

				// Rate limit - wait and retry
				if (response.status === 429 && attempt < retries) {
					const retryAfter = Number.parseInt(response.headers.get("Retry-After") || "5", 10);
					consola.warn(`[embeddings] Rate limited, retrying in ${retryAfter}s...`);
					await new Promise((r) => setTimeout(r, retryAfter * 1000));
					continue;
				}

				throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
			}

			const data = await response.json();
			return data.data[0].embedding as number[];
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < retries) {
				const delay = 2 ** attempt * 1000; // Exponential backoff
				consola.warn(
					`[embeddings] Attempt ${attempt + 1} failed${label ? ` for "${label}"` : ""}, retrying in ${delay}ms...`
				);
				await new Promise((r) => setTimeout(r, delay));
			}
		}
	}

	consola.error(`[embeddings] Failed after ${retries + 1} attempts:`, lastError?.message);
	return null;
}

/**
 * Generate an embedding, throwing on failure (for critical paths).
 *
 * @throws Error if embedding generation fails
 */
export async function generateEmbeddingOrThrow(
	text: string,
	options: GenerateEmbeddingOptions = {}
): Promise<number[]> {
	const embedding = await generateEmbedding(text, options);
	if (!embedding) {
		throw new Error(`Failed to generate embedding${options.label ? ` for "${options.label}"` : ""}`);
	}
	return embedding;
}

/**
 * Generate embeddings for multiple texts in parallel.
 *
 * @param texts - Array of texts to embed
 * @param options - Configuration options
 * @returns Array of embeddings (null for failed items)
 */
export async function generateEmbeddingsBatch(
	texts: string[],
	options: GenerateEmbeddingOptions = {}
): Promise<(number[] | null)[]> {
	// Process in parallel with concurrency limit to avoid rate limits
	const CONCURRENCY = 5;
	const results: (number[] | null)[] = new Array(texts.length).fill(null);

	for (let i = 0; i < texts.length; i += CONCURRENCY) {
		const batch = texts.slice(i, i + CONCURRENCY);
		const batchResults = await Promise.all(
			batch.map((text, idx) =>
				generateEmbedding(text, {
					...options,
					label: options.label || `batch-${i + idx}`,
				})
			)
		);
		batchResults.forEach((result, idx) => {
			results[i + idx] = result;
		});
	}

	return results;
}
