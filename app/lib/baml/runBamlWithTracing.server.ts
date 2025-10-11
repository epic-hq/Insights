import consola from "consola"
import { b } from "~/../baml_client"
import type { BamlUsageSummary } from "~/lib/baml/collector.server"
import { createBamlCollector, mapUsageToLangfuse, summarizeCollectorUsage } from "~/lib/baml/collector.server"
import { getLangfuseClient } from "~/lib/langfuse.server"

type InstrumentedClient = ReturnType<typeof b.withOptions>

interface RunBamlWithTracingOptions<TResult> {
	functionName: string
	traceName?: string
	input?: Record<string, unknown> | string | null
	metadata?: Record<string, unknown>
	bamlCall: (client: InstrumentedClient) => Promise<TResult>
	costEnvPrefix?: string
	logUsageLabel?: string
	model?: string
}

const PROMPT_COST_SUFFIX = "_PROMPT_COST_PER_1K_TOKENS"
const COMPLETION_COST_SUFFIX = "_COMPLETION_COST_PER_1K_TOKENS"

function camelToScreamingSnake(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[-\s]+/g, "_")
		.toUpperCase()
}

function resolveCostOptions(functionName: string, overridePrefix?: string) {
	const prefix = overridePrefix ?? `BAML_${camelToScreamingSnake(functionName)}`
	const prompt = Number(process.env[`${prefix}${PROMPT_COST_SUFFIX}`])
	const completion = Number(process.env[`${prefix}${COMPLETION_COST_SUFFIX}`])
	return {
		promptCostPer1KTokens: Number.isFinite(prompt) ? prompt : undefined,
		completionCostPer1KTokens: Number.isFinite(completion) ? completion : undefined,
	}
}

export async function runBamlWithTracing<TResult>({
	functionName,
	traceName,
	input,
	metadata,
	bamlCall,
	costEnvPrefix,
	logUsageLabel,
	model,
}: RunBamlWithTracingOptions<TResult>): Promise<{ result: TResult; usage?: BamlUsageSummary | null }> {
	const langfuse = getLangfuseClient()
	const resolvedModel = model ?? process.env.BAML_DEFAULT_MODEL ?? "CustomGPT4o"
	const trace = (langfuse as any).trace?.({
		name: traceName ?? `baml.${functionName}`,
		metadata,
	})
	const generation = trace?.generation?.({
		name: `baml.${functionName}`,
		input,
		model: resolvedModel,
	})

	const collector = createBamlCollector(functionName)
	const instrumentedClient = b.withOptions({ collector })

	let usageSummary: BamlUsageSummary | null = null
	let langfuseUsage: Record<string, number> | undefined
	let generationEnded = false

	const costOptions = resolveCostOptions(functionName, costEnvPrefix)

	try {
		const result = await bamlCall(instrumentedClient)
		usageSummary = summarizeCollectorUsage(collector, costOptions)
		if (usageSummary && logUsageLabel) {
			consola.log(`[BAML usage] ${logUsageLabel}:`, usageSummary)
		}
		langfuseUsage = mapUsageToLangfuse(usageSummary)
		const costPayload =
			typeof usageSummary?.totalCostUsd === "number"
				? { amount: usageSummary.totalCostUsd, currency: "USD" as const }
				: undefined
		generation?.update?.({
			output: result,
			usage: langfuseUsage,
			metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
			model: resolvedModel,
			cost: costPayload,
		})
		trace?.update?.({ usage: langfuseUsage, cost: costPayload, metadata })
		return { result, usage: usageSummary }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		langfuseUsage = mapUsageToLangfuse(usageSummary)
		const costPayload =
			typeof usageSummary?.totalCostUsd === "number"
				? { amount: usageSummary.totalCostUsd, currency: "USD" as const }
				: undefined
		generation?.end?.({
			level: "ERROR",
			statusMessage: message,
			usage: langfuseUsage,
			metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
			model: resolvedModel,
			cost: costPayload,
		})
		trace?.update?.({ usage: langfuseUsage, cost: costPayload, metadata })
		generationEnded = true
		throw error
	} finally {
		if (!generationEnded) {
			langfuseUsage = langfuseUsage ?? mapUsageToLangfuse(usageSummary)
			const costPayload =
				typeof usageSummary?.totalCostUsd === "number"
					? { amount: usageSummary.totalCostUsd, currency: "USD" as const }
					: undefined
			generation?.end?.({
				usage: langfuseUsage,
				metadata: usageSummary ? { tokenUsage: usageSummary } : undefined,
				model: resolvedModel,
				cost: costPayload,
			})
			trace?.update?.({ usage: langfuseUsage, cost: costPayload, metadata })
		}
		const finalUsage = langfuseUsage ?? mapUsageToLangfuse(usageSummary)
		const finalCost =
			typeof usageSummary?.totalCostUsd === "number"
				? { amount: usageSummary.totalCostUsd, currency: "USD" as const }
				: undefined
		trace?.end?.({ usage: finalUsage, cost: finalCost, metadata })
	}
}
