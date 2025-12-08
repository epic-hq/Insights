/**
 * BAML tracing utility for Trigger.dev tasks
 *
 * Provides Langfuse tracing for BAML calls within Trigger.dev tasks.
 * Tracks token usage, costs, and errors.
 */

import { Collector } from "@boundaryml/baml"
import consola from "consola"
import { Langfuse } from "langfuse"
import { b } from "~/../baml_client"

// Lazy-initialized Langfuse client for Trigger.dev context
let langfuseInstance: Langfuse | null = null

function getLangfuse(): Langfuse | null {
	if (langfuseInstance) return langfuseInstance

	if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
		consola.debug("[BAML Tracing] Langfuse credentials not found, tracing disabled")
		return null
	}

	langfuseInstance = new Langfuse({
		publicKey: process.env.LANGFUSE_PUBLIC_KEY,
		secretKey: process.env.LANGFUSE_SECRET_KEY,
		baseUrl: process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
	})

	return langfuseInstance
}

export type BamlUsageSummary = {
	inputTokens?: number
	outputTokens?: number
	cachedInputTokens?: number
	billedInputTokens?: number
	totalTokens?: number
	promptCostUsd?: number
	completionCostUsd?: number
	totalCostUsd?: number
}

type InstrumentedClient = ReturnType<typeof b.withOptions>

export interface RunBamlOptions<TResult> {
	/** BAML function name for tracing */
	functionName: string
	/** Optional trace name override */
	traceName?: string
	/** Input data to log */
	input?: Record<string, unknown> | string | null
	/** Additional metadata */
	metadata?: Record<string, unknown>
	/** The BAML call to execute */
	bamlCall: (client: InstrumentedClient) => Promise<TResult>
	/** Model name for cost tracking */
	model?: string
	/** Custom cost rates */
	costOptions?: {
		promptCostPer1KTokens?: number
		completionCostPer1KTokens?: number
	}
}

function summarizeUsage(collector: Collector, costOptions?: RunBamlOptions<unknown>["costOptions"]): BamlUsageSummary | null {
	const usage = collector.usage
	const inputTokens = usage.inputTokens ?? undefined
	const outputTokens = usage.outputTokens ?? undefined
	const cachedInputTokens = usage.cachedInputTokens ?? undefined
	const billedInputTokens =
		typeof inputTokens === "number"
			? Math.max(0, inputTokens - (typeof cachedInputTokens === "number" ? cachedInputTokens : 0))
			: undefined
	const totalTokens =
		typeof inputTokens === "number" || typeof outputTokens === "number"
			? (inputTokens ?? 0) + (outputTokens ?? 0)
			: undefined

	const summary: BamlUsageSummary = {}
	if (typeof inputTokens === "number") summary.inputTokens = inputTokens
	if (typeof outputTokens === "number") summary.outputTokens = outputTokens
	if (typeof cachedInputTokens === "number") summary.cachedInputTokens = cachedInputTokens
	if (typeof billedInputTokens === "number") summary.billedInputTokens = billedInputTokens
	if (typeof totalTokens === "number") summary.totalTokens = totalTokens

	// Calculate costs if rates provided
	if (costOptions?.promptCostPer1KTokens && typeof summary.inputTokens === "number") {
		summary.promptCostUsd = Number(((summary.inputTokens / 1000) * costOptions.promptCostPer1KTokens).toFixed(6))
	}
	if (costOptions?.completionCostPer1KTokens && typeof summary.outputTokens === "number") {
		summary.completionCostUsd = Number(((summary.outputTokens / 1000) * costOptions.completionCostPer1KTokens).toFixed(6))
	}
	if (typeof summary.promptCostUsd === "number" || typeof summary.completionCostUsd === "number") {
		summary.totalCostUsd = Number(((summary.promptCostUsd ?? 0) + (summary.completionCostUsd ?? 0)).toFixed(6))
	}

	return Object.keys(summary).length ? summary : null
}

function mapUsageToLangfuse(usage: BamlUsageSummary | null) {
	if (!usage) return undefined
	const promptTokens = usage.billedInputTokens ?? usage.inputTokens
	const completionTokens = usage.outputTokens
	const totalTokens = usage.totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0)

	const payload: Record<string, number> = {}
	if (typeof promptTokens === "number") payload.prompt_tokens = promptTokens
	if (typeof completionTokens === "number") payload.completion_tokens = completionTokens
	if (typeof totalTokens === "number") payload.total_tokens = totalTokens
	if (typeof usage.cachedInputTokens === "number") payload.cached_tokens = usage.cachedInputTokens

	return Object.keys(payload).length ? payload : undefined
}

/**
 * Run a BAML function with Langfuse tracing
 *
 * @example
 * ```ts
 * const { result, usage } = await runBaml({
 *   functionName: "ApplyConversationLens",
 *   input: { templateName, evidenceCount: evidence.length },
 *   metadata: { interviewId, templateKey },
 *   bamlCall: (client) => client.ApplyConversationLens(templateDef, templateName, evidenceJson, context, instructions)
 * })
 * ```
 */
export async function runBaml<TResult>({
	functionName,
	traceName,
	input,
	metadata,
	bamlCall,
	model,
	costOptions,
}: RunBamlOptions<TResult>): Promise<{ result: TResult; usage: BamlUsageSummary | null }> {
	const langfuse = getLangfuse()
	const resolvedModel = model ?? process.env.BAML_DEFAULT_MODEL ?? "gpt-4o"

	// Create trace and generation spans
	const trace = langfuse?.trace({
		name: traceName ?? `trigger.baml.${functionName}`,
		metadata: { ...metadata, source: "trigger.dev" },
	})

	const generation = trace?.generation({
		name: `baml.${functionName}`,
		input,
		model: resolvedModel,
	})

	// Create collector for token tracking
	const collector = new Collector(functionName)
	const instrumentedClient = b.withOptions({ collector })

	let usageSummary: BamlUsageSummary | null = null

	try {
		const result = await bamlCall(instrumentedClient)
		usageSummary = summarizeUsage(collector, costOptions)

		const langfuseUsage = mapUsageToLangfuse(usageSummary)
		const costPayload = typeof usageSummary?.totalCostUsd === "number"
			? { amount: usageSummary.totalCostUsd, currency: "USD" as const }
			: undefined

		generation?.end({
			output: result,
			usage: langfuseUsage,
			model: resolvedModel,
			metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
		})

		trace?.update({
			usage: langfuseUsage,
			metadata: { ...metadata, cost: costPayload },
		})

		return { result, usage: usageSummary }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		usageSummary = summarizeUsage(collector, costOptions)

		generation?.end({
			level: "ERROR",
			statusMessage: message,
			usage: mapUsageToLangfuse(usageSummary),
			model: resolvedModel,
		})

		throw error
	} finally {
		// Flush traces to ensure they're sent before task completes
		await langfuse?.flushAsync().catch((err) => {
			consola.warn("[BAML Tracing] Failed to flush Langfuse:", err)
		})
	}
}

/**
 * Flush any pending Langfuse traces
 * Call this at the end of a task to ensure all traces are sent
 */
export async function flushTraces(): Promise<void> {
	const langfuse = getLangfuse()
	if (langfuse) {
		await langfuse.flushAsync().catch((err) => {
			consola.warn("[BAML Tracing] Failed to flush Langfuse:", err)
		})
	}
}
