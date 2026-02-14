import { Collector } from "@boundaryml/baml";

export type BamlUsageSummary = {
	inputTokens?: number;
	outputTokens?: number;
	cachedInputTokens?: number;
	billedInputTokens?: number;
	totalTokens?: number;
	promptCostUsd?: number;
	completionCostUsd?: number;
	totalCostUsd?: number;
};

export function createBamlCollector(name: string): Collector {
	return new Collector(name);
}

type CostOptions = {
	promptCostPer1KTokens?: number;
	completionCostPer1KTokens?: number;
};

export function summarizeCollectorUsage(
	collector?: Collector | null,
	costOptions?: CostOptions
): BamlUsageSummary | null {
	if (!collector) return null;
	const usage = collector.usage;
	const inputTokens = usage.inputTokens ?? undefined;
	const outputTokens = usage.outputTokens ?? undefined;
	const cachedInputTokens = usage.cachedInputTokens ?? undefined;
	const billedInputTokens =
		typeof inputTokens === "number"
			? Math.max(0, inputTokens - (typeof cachedInputTokens === "number" ? cachedInputTokens : 0))
			: undefined;
	const totalTokens =
		typeof inputTokens === "number" || typeof outputTokens === "number"
			? (inputTokens ?? 0) + (outputTokens ?? 0)
			: undefined;

	const summary: BamlUsageSummary = {};
	if (typeof inputTokens === "number") summary.inputTokens = inputTokens;
	if (typeof outputTokens === "number") summary.outputTokens = outputTokens;
	if (typeof cachedInputTokens === "number") summary.cachedInputTokens = cachedInputTokens;
	if (typeof billedInputTokens === "number") summary.billedInputTokens = billedInputTokens;
	if (typeof totalTokens === "number") summary.totalTokens = totalTokens;

	const promptCostRate = costOptions?.promptCostPer1KTokens;
	const completionCostRate = costOptions?.completionCostPer1KTokens;
	const promptTokenBase = summary.billedInputTokens ?? summary.inputTokens;
	if (typeof promptCostRate === "number" && typeof promptTokenBase === "number") {
		summary.promptCostUsd = Number(((promptTokenBase / 1000) * promptCostRate).toFixed(6));
	}
	if (typeof completionCostRate === "number" && typeof summary.outputTokens === "number") {
		summary.completionCostUsd = Number(((summary.outputTokens / 1000) * completionCostRate).toFixed(6));
	}
	if (typeof summary.promptCostUsd === "number" || typeof summary.completionCostUsd === "number") {
		summary.totalCostUsd = Number(((summary.promptCostUsd ?? 0) + (summary.completionCostUsd ?? 0)).toFixed(6));
	}
	return Object.keys(summary).length ? summary : null;
}

export function mapUsageToLangfuse(usage: BamlUsageSummary | null | undefined) {
	if (!usage) return undefined;
	const promptTokens = usage.billedInputTokens ?? usage.inputTokens;
	const completionTokens = usage.outputTokens;
	const totalTokens =
		usage.totalTokens ??
		(typeof promptTokens === "number" || typeof completionTokens === "number"
			? (promptTokens ?? 0) + (completionTokens ?? 0)
			: undefined);
	const cachedTokens = usage.cachedInputTokens;
	const payload: Record<string, number> = {};
	if (typeof promptTokens === "number") payload.promptTokens = promptTokens;
	if (typeof completionTokens === "number") payload.completionTokens = completionTokens;
	if (typeof totalTokens === "number") payload.totalTokens = totalTokens;
	if (typeof cachedTokens === "number") payload.cached_tokens = cachedTokens;
	return Object.keys(payload).length ? payload : undefined;
}
