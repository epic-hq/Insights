#!/usr/bin/env tsx

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type InterviewRow = {
	id: string;
	title: string | null;
	account_id: string;
	project_id: string | null;
	status: string | null;
	created_at: string;
	updated_at: string;
	transcript: string | null;
	transcript_formatted: unknown;
	conversation_analysis: unknown;
	interaction_context: string | null;
	duration_sec: number | null;
};

type Candidate = {
	id: string;
	title: string | null;
	accountId: string;
	projectId: string | null;
	status: string | null;
	createdAt: string;
	updatedAt: string;
	interactionContext: string | null;
	durationSec: number | null;
	transcriptChars: number;
	speakerUtterances: number;
	chapterCount: number;
	workflowEvidenceCount: number;
	llmTotalTokens: number;
	llmTotalCostUsd: number;
	billingInputTokens: number;
	billingOutputTokens: number;
	billingEvents: number;
	score: number;
};

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

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function scoreCandidate(candidate: Omit<Candidate, "score">): number {
	let score = 0;

	if (candidate.speakerUtterances >= 120) score += 40;
	else if (candidate.speakerUtterances >= 60) score += 30;
	else if (candidate.speakerUtterances >= 25) score += 20;
	else if (candidate.speakerUtterances >= 10) score += 10;

	if (candidate.transcriptChars >= 12_000) score += 25;
	else if (candidate.transcriptChars >= 6_000) score += 20;
	else if (candidate.transcriptChars >= 2_500) score += 12;
	else if (candidate.transcriptChars >= 1_000) score += 6;

	if (candidate.workflowEvidenceCount >= 30) score += 20;
	else if (candidate.workflowEvidenceCount >= 10) score += 12;
	else if (candidate.workflowEvidenceCount >= 3) score += 6;

	if (candidate.llmTotalTokens >= 10_000) score += 10;
	else if (candidate.llmTotalTokens >= 2_000) score += 6;
	else if (candidate.llmTotalTokens > 0) score += 3;

	if (candidate.status === "ready") score += 5;

	return Math.min(100, score);
}

async function main() {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceRoleKey) {
		console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}

	const projectId = readArg("--project-id");
	const accountId = readArg("--account-id");
	const limit = readIntArg("--limit", 30);
	const scanLimit = readIntArg("--scan-limit", 500);
	const minUtterances = readIntArg("--min-utterances", 10);
	const minTranscriptChars = readIntArg("--min-transcript-chars", 1000);
	const outputPath = resolve(process.cwd(), readArg("--out") ?? "scripts/benchmarks/goldset-candidates.latest.json");

	const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: { persistSession: false },
	});

	let query = supabase
		.from("interviews")
		.select(
			"id, title, account_id, project_id, status, created_at, updated_at, transcript, transcript_formatted, conversation_analysis, interaction_context, duration_sec"
		)
		.order("updated_at", { ascending: false })
		.limit(scanLimit);

	if (projectId) query = query.eq("project_id", projectId);
	if (accountId) query = query.eq("account_id", accountId);

	const { data, error } = await query;
	if (error) {
		console.error("Failed querying interviews:", error.message);
		process.exit(1);
	}

	const interviews = (data ?? []) as InterviewRow[];
	if (!interviews.length) {
		console.error("No interviews found for the provided filters.");
		process.exit(1);
	}

	const billing = supabase.schema("billing");
	const interviewIds = interviews.map((i) => i.id);
	const usageByInterview = new Map<string, { inputTokens: number; outputTokens: number; events: number }>();
	for (let i = 0; i < interviewIds.length; i += 100) {
		const batch = interviewIds.slice(i, i + 100);
		const { data: usageRows, error: usageError } = await billing
			.from("usage_events")
			.select("resource_id, input_tokens, output_tokens")
			.eq("resource_type", "interview")
			.in("resource_id", batch)
			.in("feature_source", ["interview_extraction", "persona_synthesis"]);
		if (usageError) {
			console.warn(`Usage query failed for batch ${i / 100 + 1}: ${usageError.message}`);
			continue;
		}
		for (const row of usageRows ?? []) {
			const resourceId = typeof row.resource_id === "string" ? row.resource_id : null;
			if (!resourceId) continue;
			const current = usageByInterview.get(resourceId) ?? {
				inputTokens: 0,
				outputTokens: 0,
				events: 0,
			};
			current.inputTokens += asNumber(row.input_tokens);
			current.outputTokens += asNumber(row.output_tokens);
			current.events += 1;
			usageByInterview.set(resourceId, current);
		}
	}

	const candidates: Candidate[] = [];
	for (const interview of interviews) {
		const transcriptChars = interview.transcript?.length ?? 0;
		const formatted = asRecord(interview.transcript_formatted);
		const conversationAnalysis = asRecord(interview.conversation_analysis);
		const speakerUtterances = asArray(formatted?.speaker_transcripts).length;
		const chapterCount = asArray(formatted?.chapters).length;
		const workflowState = asRecord(conversationAnalysis?.workflow_state);
		const workflowEvidenceCount = asArray(workflowState?.evidenceIds).length;
		const llmUsage = asRecord(conversationAnalysis?.llm_usage);
		const llmTotals = asRecord(llmUsage?.totals);
		const llmTotalTokens = asNumber(llmTotals?.total_tokens);
		const llmTotalCostUsd = asNumber(llmTotals?.total_cost_usd);
		const billingUsage = usageByInterview.get(interview.id) ?? {
			inputTokens: 0,
			outputTokens: 0,
			events: 0,
		};

		if (speakerUtterances < minUtterances) continue;
		if (transcriptChars < minTranscriptChars) continue;

		const partial: Omit<Candidate, "score"> = {
			id: interview.id,
			title: interview.title,
			accountId: interview.account_id,
			projectId: interview.project_id,
			status: interview.status,
			createdAt: interview.created_at,
			updatedAt: interview.updated_at,
			interactionContext: interview.interaction_context,
			durationSec: interview.duration_sec,
			transcriptChars,
			speakerUtterances,
			chapterCount,
			workflowEvidenceCount,
			llmTotalTokens,
			llmTotalCostUsd,
			billingInputTokens: billingUsage.inputTokens,
			billingOutputTokens: billingUsage.outputTokens,
			billingEvents: billingUsage.events,
		};

		candidates.push({
			...partial,
			score: scoreCandidate(partial),
		});
	}

	candidates.sort((a, b) => b.score - a.score || b.speakerUtterances - a.speakerUtterances);
	const top = candidates.slice(0, limit);

	const report = {
		generatedAt: new Date().toISOString(),
		filters: {
			projectId: projectId ?? null,
			accountId: accountId ?? null,
			limit,
			scanLimit,
			minUtterances,
			minTranscriptChars,
		},
		totals: {
			scannedInterviews: interviews.length,
			eligibleCandidates: candidates.length,
			returnedCandidates: top.length,
		},
		candidates: top,
	};

	mkdirSync(resolve(process.cwd(), "scripts/benchmarks"), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

	console.log(
		JSON.stringify(
			{
				status: "ok",
				report: outputPath,
				scanned: interviews.length,
				eligible: candidates.length,
				returned: top.length,
			},
			null,
			2
		)
	);

	if (top.length) {
		console.log("\nTop candidates:");
		for (const candidate of top.slice(0, Math.min(15, top.length))) {
			console.log(
				[
					`- ${candidate.id}`,
					`score=${candidate.score}`,
					`utterances=${candidate.speakerUtterances}`,
					`transcriptChars=${candidate.transcriptChars}`,
					`workflowEvidence=${candidate.workflowEvidenceCount}`,
					`billingIn=${candidate.billingInputTokens}`,
					`billingOut=${candidate.billingOutputTokens}`,
					`status=${candidate.status ?? "n/a"}`,
					`title="${candidate.title ?? "Untitled"}"`,
				].join(" | ")
			);
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
