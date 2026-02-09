import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
	buildHowtoContractPatchText,
	buildHowtoFallbackResponse,
	estimateApproxTokens,
	evaluateHowtoResponseContract,
} from "~/features/project-chat/howto-contract";
import { detectHowtoPromptMode, type HowtoResponseMode } from "~/features/project-chat/howto-routing";

type BenchmarkCase = {
	id: string;
	prompt: string;
	expectedMode: HowtoResponseMode;
	seedResponse: string;
};

type BenchmarkResult = {
	id: string;
	expectedMode: HowtoResponseMode;
	detectedMode: HowtoResponseMode;
	isHowto: boolean;
	latencyMs: number;
	inputTokensApprox: number;
	outputTokensApprox: number;
	responseChars: number;
	usedFallback: boolean;
	contractPatched: boolean;
	quality: ReturnType<typeof evaluateHowtoResponseContract>;
	passed: boolean;
};

const PROMPT_SET_PATH = resolve(process.cwd(), "scripts/benchmarks/howto-smoke.prompts.json");
const LATEST_SNAPSHOT_PATH = resolve(process.cwd(), "scripts/benchmarks/howto-smoke.latest.json");
const BASELINE_SNAPSHOT_PATH = resolve(process.cwd(), "scripts/benchmarks/howto-smoke.snapshot.json");
const UPDATE_SNAPSHOT = process.argv.includes("--update-snapshot");
const ACCOUNT_ID = process.env.HOWTO_BENCHMARK_ACCOUNT_ID ?? "acct-benchmark";
const PROJECT_ID = process.env.HOWTO_BENCHMARK_PROJECT_ID ?? "project-benchmark";

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function runCase(testCase: BenchmarkCase): BenchmarkResult {
	const startedAt = performance.now();
	const routing = detectHowtoPromptMode(testCase.prompt);
	let text = testCase.seedResponse.trim();
	let usedFallback = false;
	let contractPatched = false;

	if (!text) {
		text = buildHowtoFallbackResponse(ACCOUNT_ID, PROJECT_ID);
		usedFallback = true;
	} else {
		const patch = buildHowtoContractPatchText(text, ACCOUNT_ID, PROJECT_ID);
		if (patch) {
			text = `${text}${patch}`;
			contractPatched = true;
		}
	}

	const quality = evaluateHowtoResponseContract(text);
	const latencyMs = round2(performance.now() - startedAt);
	const passed =
		routing.isHowto && routing.responseMode === testCase.expectedMode && quality.passes && text.trim().length > 0;

	return {
		id: testCase.id,
		expectedMode: testCase.expectedMode,
		detectedMode: routing.responseMode,
		isHowto: routing.isHowto,
		latencyMs,
		inputTokensApprox: estimateApproxTokens(testCase.prompt),
		outputTokensApprox: estimateApproxTokens(text),
		responseChars: text.trim().length,
		usedFallback,
		contractPatched,
		quality,
		passed,
	};
}

function main() {
	const benchmarkSet = JSON.parse(readFileSync(PROMPT_SET_PATH, "utf8")) as BenchmarkCase[];
	const results = benchmarkSet.map(runCase);
	const failed = results.filter((result) => !result.passed);
	const summary = {
		totalCases: results.length,
		passedCases: results.filter((result) => result.passed).length,
		failedCases: failed.length,
		averageLatencyMs: round2(results.reduce((sum, result) => sum + result.latencyMs, 0) / Math.max(results.length, 1)),
		averageInputTokensApprox: round2(
			results.reduce((sum, result) => sum + result.inputTokensApprox, 0) / Math.max(results.length, 1)
		),
		averageOutputTokensApprox: round2(
			results.reduce((sum, result) => sum + result.outputTokensApprox, 0) / Math.max(results.length, 1)
		),
		emptyResponses: results.filter((result) => !result.quality.isNonEmpty).length,
		contractFailures: results.filter((result) => !result.quality.passes).length,
		fallbackCount: results.filter((result) => result.usedFallback).length,
		patchCount: results.filter((result) => result.contractPatched).length,
	};

	const report = {
		generatedAt: new Date().toISOString(),
		accountId: ACCOUNT_ID,
		projectId: PROJECT_ID,
		summary,
		results,
	};

	mkdirSync(resolve(process.cwd(), "scripts/benchmarks"), { recursive: true });
	writeFileSync(LATEST_SNAPSHOT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

	if (UPDATE_SNAPSHOT) {
		writeFileSync(BASELINE_SNAPSHOT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
		console.log(`Updated benchmark baseline: ${BASELINE_SNAPSHOT_PATH}`);
	}

	if (!UPDATE_SNAPSHOT) {
		try {
			const baseline = JSON.parse(readFileSync(BASELINE_SNAPSHOT_PATH, "utf8")) as {
				summary?: { emptyResponses?: number; contractFailures?: number };
			};
			const baselineEmpty = baseline.summary?.emptyResponses ?? 0;
			const baselineContractFailures = baseline.summary?.contractFailures ?? 0;
			if (summary.emptyResponses > baselineEmpty) {
				failed.push({
					id: "baseline-empty-regression",
					expectedMode: "ux_research_mode",
					detectedMode: "ux_research_mode",
					isHowto: true,
					latencyMs: 0,
					inputTokensApprox: 0,
					outputTokensApprox: 0,
					responseChars: 0,
					usedFallback: false,
					contractPatched: false,
					quality: {
						isNonEmpty: false,
						hasMarkdownLink: false,
						missingSections: ["direct answer"],
						passes: false,
					},
					passed: false,
				});
			}
			if (summary.contractFailures > baselineContractFailures) {
				failed.push({
					id: "baseline-contract-regression",
					expectedMode: "ux_research_mode",
					detectedMode: "ux_research_mode",
					isHowto: true,
					latencyMs: 0,
					inputTokensApprox: 0,
					outputTokensApprox: 0,
					responseChars: 0,
					usedFallback: false,
					contractPatched: false,
					quality: {
						isNonEmpty: true,
						hasMarkdownLink: false,
						missingSections: ["quick links"],
						passes: false,
					},
					passed: false,
				});
			}
		} catch {
			console.log("No baseline snapshot found; run with --update-snapshot to create one.");
		}
	}

	if (failed.length > 0 || summary.emptyResponses > 0 || summary.contractFailures > 0) {
		console.error("Howto smoke benchmark failed.");
		console.error(JSON.stringify({ summary, failed }, null, 2));
		process.exit(1);
	}

	console.log(
		JSON.stringify(
			{
				status: "ok",
				snapshot: LATEST_SNAPSHOT_PATH,
				summary,
			},
			null,
			2
		)
	);
}

main();
