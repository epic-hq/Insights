#!/usr/bin/env tsx

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runs, tasks } from "@trigger.dev/sdk";

type UsageEventRow = {
	id: string;
	created_at: string;
	feature_source: string;
	provider: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
	estimated_cost_usd: number | string;
	credits_charged: number;
	idempotency_key: string | null;
};

type BenchRunResult = {
	index: number;
	analysisJobId: string;
	orchestratorRunId: string;
	extractTaskRunId: string | null;
	status: string;
	isSuccess: boolean;
	isFailed: boolean;
	orchestratorDurationMs: number;
	extractDurationMs: number | null;
	wallDurationMs: number;
	stepDurationsMs: Record<string, number>;
	usageQueryMode: "run_id_match" | "time_window_fallback" | "none";
	usageEventsCount: number;
	usage: {
		inputTokens: number;
		outputTokens: number;
		estimatedCostUsd: number;
		creditsCharged: number;
		byFeature: Record<
			string,
			{
				inputTokens: number;
				outputTokens: number;
				estimatedCostUsd: number;
				creditsCharged: number;
			}
		>;
	};
	error?: string;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function readArg(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
}

function readIntArg(name: string, fallback: number): number {
	const raw = readArg(name);
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureEnvFromDotenv(): void {
	const envPath = resolve(process.cwd(), ".env");
	let content = "";
	try {
		content = readFileSync(envPath, "utf8");
	} catch {
		return;
	}
	const lines = content.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		if (!key || process.env[key]) continue;
		const rawValue = trimmed.slice(eq + 1).trim();
		process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
	}
}

function round(value: number, places = 2): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

function percentile(values: number[], p: number): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[index];
}

function latestChildRunByTask(children: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
	const latest = new Map<string, Record<string, unknown>>();
	for (const child of children) {
		const taskIdentifier = typeof child.taskIdentifier === "string" ? child.taskIdentifier : null;
		if (!taskIdentifier) continue;
		const current = latest.get(taskIdentifier);
		if (!current) {
			latest.set(taskIdentifier, child);
			continue;
		}
		const currentUpdated =
			current.updatedAt instanceof Date ? current.updatedAt.getTime() : Date.parse(String(current.updatedAt ?? 0));
		const nextUpdated =
			child.updatedAt instanceof Date ? child.updatedAt.getTime() : Date.parse(String(child.updatedAt ?? 0));
		if (nextUpdated >= currentUpdated) {
			latest.set(taskIdentifier, child);
		}
	}
	return latest;
}

async function main() {
	ensureEnvFromDotenv();

	const interviewId = readArg("--interview-id");
	if (!interviewId) {
		console.error("Missing required arg: --interview-id <uuid>");
		process.exit(1);
	}

	const runsCount = readIntArg("--runs", 3);
	const pollMs = readIntArg("--poll-ms", 5_000);
	const billingSettleMs = readIntArg("--billing-settle-ms", 2_000);
	const outputPath = resolve(process.cwd(), readArg("--out") ?? "scripts/benchmarks/extract-evidence-v2.latest.json");

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const triggerSecretKey = process.env.TRIGGER_SECRET_KEY;

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}
	if (!triggerSecretKey) {
		console.error("Missing TRIGGER_SECRET_KEY");
		console.error(
			"Example: TRIGGER_SECRET_KEY=tr_prod_xxx tsx scripts/benchmarks/extract-evidence-v2.ts --interview-id <uuid>"
		);
		process.exit(1);
	}

	const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: { persistSession: false },
	});
	const billing = supabase.schema("billing");

	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.select("id, title, account_id, project_id, created_by, media_url, transcript, transcript_formatted")
		.eq("id", interviewId)
		.single();

	if (interviewError || !interview) {
		console.error("Failed to load interview:", interviewError?.message ?? "not found");
		process.exit(1);
	}

	const skipSteps = ["enrich-person", "personas", "answers", "finalize"];
	const benchStartedAt = new Date().toISOString();
	const runResults: BenchRunResult[] = [];

	console.log(
		JSON.stringify(
			{
				benchmark: "extract-evidence-v2",
				interviewId,
				interviewTitle: interview.title ?? null,
				runs: runsCount,
				pollMs,
				billingSettleMs,
				skipSteps,
				startedAt: benchStartedAt,
			},
			null,
			2
		)
	);

	for (let i = 0; i < runsCount; i++) {
		const runIndex = i + 1;
		const analysisJobId = interview.id;
		const benchIterationId = `bench-${Date.now()}-${runIndex}`;
		const startedAt = new Date();
		console.log(
			`\n[${runIndex}/${runsCount}] Triggering orchestrator (analysisJobId=${analysisJobId}, iteration=${benchIterationId})`
		);

		try {
			const handle = await tasks.trigger("interview.v2.orchestrator", {
				analysisJobId,
				existingInterviewId: interview.id,
				mediaUrl: interview.media_url ?? "",
				transcriptData: (interview.transcript_formatted as Record<string, unknown> | null) ?? undefined,
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id ?? undefined,
					userId: interview.created_by ?? undefined,
					interviewTitle: interview.title ?? undefined,
				},
				resumeFrom: "evidence",
				skipSteps,
			});

			const run = await runs.poll(handle.id, { pollIntervalMs: pollMs });
			const endedAt = new Date();
			const wallDurationMs = endedAt.getTime() - startedAt.getTime();

			const children = Array.isArray(run.relatedRuns?.children)
				? (run.relatedRuns.children as Array<Record<string, unknown>>)
				: [];
			const latestChildren = latestChildRunByTask(children);
			const extractStep = latestChildren.get("interview.v2.extract-evidence");
			const extractTaskRunId = extractStep && typeof extractStep.id === "string" ? extractStep.id : null;
			const extractDurationMs =
				extractStep && typeof extractStep.durationMs === "number" ? extractStep.durationMs : null;

			const stepDurationsMs = Object.fromEntries(
				Array.from(latestChildren.entries()).map(([taskId, child]) => [
					taskId,
					typeof child.durationMs === "number" ? child.durationMs : 0,
				])
			);

			await sleep(billingSettleMs);

			const usageFields =
				"id, created_at, feature_source, provider, model, input_tokens, output_tokens, estimated_cost_usd, credits_charged, idempotency_key";

			let usageRows: UsageEventRow[] = [];
			let usageQueryMode: BenchRunResult["usageQueryMode"] = "none";

			if (extractTaskRunId) {
				const { data: byRunId, error: byRunIdError } = await billing
					.from("usage_events")
					.select(usageFields)
					.eq("resource_type", "interview")
					.eq("resource_id", interviewId)
					.in("feature_source", ["interview_extraction", "persona_synthesis"])
					.like("idempotency_key", `%:${extractTaskRunId}`);

				if (byRunIdError) {
					console.warn(`[${runIndex}] billing query (run id) failed: ${byRunIdError.message}`);
				} else if (Array.isArray(byRunId) && byRunId.length > 0) {
					usageRows = byRunId as UsageEventRow[];
					usageQueryMode = "run_id_match";
				}
			}

			if (usageRows.length === 0) {
				const windowStart = new Date(startedAt.getTime() - 5_000).toISOString();
				const windowEnd = new Date(endedAt.getTime() + 30_000).toISOString();
				const { data: byWindow, error: byWindowError } = await billing
					.from("usage_events")
					.select(usageFields)
					.eq("resource_type", "interview")
					.eq("resource_id", interviewId)
					.in("feature_source", ["interview_extraction", "persona_synthesis"])
					.gte("created_at", windowStart)
					.lte("created_at", windowEnd);
				if (byWindowError) {
					console.warn(`[${runIndex}] billing query (window fallback) failed: ${byWindowError.message}`);
				} else if (Array.isArray(byWindow) && byWindow.length > 0) {
					usageRows = byWindow as UsageEventRow[];
					usageQueryMode = "time_window_fallback";
				}
			}

			const usage = usageRows.reduce(
				(acc, row) => {
					const inputTokens = Number(row.input_tokens ?? 0) || 0;
					const outputTokens = Number(row.output_tokens ?? 0) || 0;
					const estimatedCostUsd = Number(row.estimated_cost_usd ?? 0) || 0;
					const creditsCharged = Number(row.credits_charged ?? 0) || 0;
					const featureSource = row.feature_source || "unknown";
					if (!acc.byFeature[featureSource]) {
						acc.byFeature[featureSource] = {
							inputTokens: 0,
							outputTokens: 0,
							estimatedCostUsd: 0,
							creditsCharged: 0,
						};
					}
					acc.inputTokens += inputTokens;
					acc.outputTokens += outputTokens;
					acc.estimatedCostUsd += estimatedCostUsd;
					acc.creditsCharged += creditsCharged;
					acc.byFeature[featureSource].inputTokens += inputTokens;
					acc.byFeature[featureSource].outputTokens += outputTokens;
					acc.byFeature[featureSource].estimatedCostUsd += estimatedCostUsd;
					acc.byFeature[featureSource].creditsCharged += creditsCharged;
					return acc;
				},
				{
					inputTokens: 0,
					outputTokens: 0,
					estimatedCostUsd: 0,
					creditsCharged: 0,
					byFeature: {} as BenchRunResult["usage"]["byFeature"],
				}
			);

			const result: BenchRunResult = {
				index: runIndex,
				analysisJobId,
				orchestratorRunId: run.id,
				extractTaskRunId,
				status: run.status,
				isSuccess: run.isSuccess,
				isFailed: run.isFailed,
				orchestratorDurationMs: run.durationMs,
				extractDurationMs,
				wallDurationMs,
				stepDurationsMs,
				usageQueryMode,
				usageEventsCount: usageRows.length,
				usage: {
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					estimatedCostUsd: round(usage.estimatedCostUsd, 6),
					creditsCharged: usage.creditsCharged,
					byFeature: Object.fromEntries(
						Object.entries(usage.byFeature).map(([featureSource, values]) => [
							featureSource,
							{
								inputTokens: values.inputTokens,
								outputTokens: values.outputTokens,
								estimatedCostUsd: round(values.estimatedCostUsd, 6),
								creditsCharged: values.creditsCharged,
							},
						])
					),
				},
				error: run.error?.message,
			};

			runResults.push(result);
			console.log(
				`[${runIndex}] status=${result.status} extract=${result.extractDurationMs ?? "n/a"}ms cost=$${result.usage.estimatedCostUsd}`
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			runResults.push({
				index: runIndex,
				analysisJobId,
				orchestratorRunId: "",
				extractTaskRunId: null,
				status: "FAILED",
				isSuccess: false,
				isFailed: true,
				orchestratorDurationMs: 0,
				extractDurationMs: null,
				wallDurationMs: 0,
				stepDurationsMs: {},
				usageQueryMode: "none",
				usageEventsCount: 0,
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					estimatedCostUsd: 0,
					creditsCharged: 0,
					byFeature: {},
				},
				error: message,
			});
			console.error(`[${runIndex}] failed: ${message}`);
		}
	}

	const successful = runResults.filter((r) => r.isSuccess);
	const extractDurations = successful
		.map((r) => r.extractDurationMs)
		.filter((n): n is number => typeof n === "number" && n > 0);
	const orchestratorDurations = successful.map((r) => r.orchestratorDurationMs);
	const wallDurations = successful.map((r) => r.wallDurationMs);
	const costs = successful.map((r) => r.usage.estimatedCostUsd);
	const inputTokens = successful.map((r) => r.usage.inputTokens);
	const outputTokens = successful.map((r) => r.usage.outputTokens);

	const summary = {
		totalRuns: runResults.length,
		successfulRuns: successful.length,
		failedRuns: runResults.length - successful.length,
		extractDurationMs: {
			avg: round(extractDurations.reduce((sum, value) => sum + value, 0) / Math.max(extractDurations.length, 1)),
			p50: round(percentile(extractDurations, 50)),
			p95: round(percentile(extractDurations, 95)),
			min: round(extractDurations.length ? Math.min(...extractDurations) : 0),
			max: round(extractDurations.length ? Math.max(...extractDurations) : 0),
		},
		orchestratorDurationMs: {
			avg: round(
				orchestratorDurations.reduce((sum, value) => sum + value, 0) / Math.max(orchestratorDurations.length, 1)
			),
			p50: round(percentile(orchestratorDurations, 50)),
			p95: round(percentile(orchestratorDurations, 95)),
		},
		wallDurationMs: {
			avg: round(wallDurations.reduce((sum, value) => sum + value, 0) / Math.max(wallDurations.length, 1)),
		},
		usage: {
			avgCostUsd: round(costs.reduce((sum, value) => sum + value, 0) / Math.max(costs.length, 1), 6),
			avgInputTokens: round(inputTokens.reduce((sum, value) => sum + value, 0) / Math.max(inputTokens.length, 1)),
			avgOutputTokens: round(outputTokens.reduce((sum, value) => sum + value, 0) / Math.max(outputTokens.length, 1)),
			totalCostUsd: round(
				costs.reduce((sum, value) => sum + value, 0),
				6
			),
		},
	};

	const report = {
		generatedAt: new Date().toISOString(),
		benchmark: "extract-evidence-v2",
		interview: {
			id: interview.id,
			title: interview.title ?? null,
			accountId: interview.account_id,
			projectId: interview.project_id ?? null,
		},
		config: {
			runs: runsCount,
			pollMs,
			billingSettleMs,
			skipSteps,
		},
		summary,
		runs: runResults,
	};

	mkdirSync(resolve(process.cwd(), "scripts/benchmarks"), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

	console.log("\nBenchmark complete:");
	console.log(JSON.stringify(summary, null, 2));
	console.log(`Report written to ${outputPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
