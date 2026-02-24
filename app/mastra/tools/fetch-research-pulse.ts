/**
 * Fetch Research Pulse — weekly delta data for the ResearchPulse gen-ui widget.
 *
 * Compares current project metrics against the snapshot from ~7 days ago
 * to produce a "what changed this week" summary.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { validateUUID } from "./context-utils";

interface SnapshotData {
	interviewCount: number;
	surveyCount: number;
	themeCount: number;
	evidenceCount: number;
	peopleCount: number;
	topThemes?: Array<{ id: string; name: string; evidenceCount: number }>;
}

const deltaSchema = z.object({
	label: z.string(),
	current: z.union([z.string(), z.number()]),
	previous: z.union([z.string(), z.number()]).optional(),
	change: z.string().optional(),
	direction: z.enum(["up", "down", "flat"]).optional(),
});

export const fetchResearchPulseTool = createTool({
	id: "fetch-research-pulse",
	description: `Get weekly research pulse data — compares current project metrics against last week's snapshot.
Returns confidence tier, metric deltas, and suggested next step.
Use this when the user asks "what changed this week?" or "weekly review" or "research pulse".`,
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID. Falls back to runtime context."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		pulse: z
			.object({
				projectId: z.string(),
				periodLabel: z.string(),
				confidenceTier: z.enum(["early_signal", "growing_confidence", "decision_ready"]),
				confidenceLabel: z.string(),
				confidenceChange: z.enum(["improved", "stable", "declined"]).optional(),
				deltas: z.array(deltaSchema),
				nextStep: z.string(),
			})
			.optional(),
	}),
	// @ts-expect-error -- context optionality mismatch with Mastra tool types
	execute: async (input, context?) => {
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const projectId = input.projectId ?? runtimeProjectId;
		const accountId = context?.requestContext?.get?.("account_id");

		if (!projectId) {
			return { success: false, message: "Missing projectId." };
		}

		try {
			validateUUID(projectId, "projectId", "fetch-research-pulse");
		} catch {
			return { success: false, message: "Invalid projectId format." };
		}

		try {
			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- project_snapshots not in generated types yet
			const supabase: any = createSupabaseAdminClient();

			// Get current counts
			const [interviewResult, surveyResult, themeResult, evidenceResult, peopleResult] = await Promise.all([
				supabase.from("interviews").select("*", { count: "exact", head: true }).eq("project_id", projectId),
				supabase
					.from("research_links")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId)
					.eq("type", "survey"),
				supabase.from("themes").select("*", { count: "exact", head: true }).eq("project_id", projectId),
				supabase.from("evidence").select("*", { count: "exact", head: true }).eq("project_id", projectId),
				supabase.from("project_people").select("*", { count: "exact", head: true }).eq("project_id", projectId),
			]);

			const current: SnapshotData = {
				interviewCount: interviewResult.count ?? 0,
				surveyCount: surveyResult.count ?? 0,
				themeCount: themeResult.count ?? 0,
				evidenceCount: evidenceResult.count ?? 0,
				peopleCount: peopleResult.count ?? 0,
			};

			// Get snapshot from ~7 days ago
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			const weekAgoStr = weekAgo.toISOString().split("T")[0];

			const { data: snapshots } = await supabase
				.from("project_snapshots")
				.select("data, snapshot_date")
				.eq("project_id", projectId)
				.lte("snapshot_date", weekAgoStr)
				.order("snapshot_date", { ascending: false })
				.limit(1);

			const previous = (snapshots?.[0]?.data as SnapshotData | undefined) ?? null;

			// Also take a snapshot for today if we have accountId
			if (accountId) {
				supabase
					.from("project_snapshots")
					.upsert(
						{
							project_id: projectId,
							account_id: accountId,
							snapshot_date: new Date().toISOString().split("T")[0],
							data: current as unknown as Record<string, unknown>,
						},
						{ onConflict: "project_id,snapshot_date" }
					)
					.then(({ error }: { error: unknown }) => {
						if (error) consola.warn("[research-pulse] snapshot upsert failed", error);
					});
			}

			// Build deltas
			const deltas = buildDeltas(current, previous);

			// Determine confidence tier
			const tier = determineConfidenceTier(current);
			const previousTier = previous ? determineConfidenceTier(previous) : null;
			const TIER_ORDER = ["early_signal", "growing_confidence", "decision_ready"] as const;
			const tierIndex = TIER_ORDER.indexOf(tier);
			const prevTierIndex = previousTier ? TIER_ORDER.indexOf(previousTier) : tierIndex;

			let confidenceChange: "improved" | "stable" | "declined" | undefined;
			if (previous) {
				if (tierIndex > prevTierIndex) confidenceChange = "improved";
				else if (tierIndex < prevTierIndex) confidenceChange = "declined";
				else confidenceChange = "stable";
			}

			const TIER_LABELS = {
				early_signal: "Early Signal",
				growing_confidence: "Growing Confidence",
				decision_ready: "Decision Ready",
			};

			// Suggest next step
			const nextStep = suggestNextStep(current);

			const periodLabel = previous
				? `vs ${new Date(snapshots![0].snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
				: "This week";

			return {
				success: true,
				message: "Research pulse for project.",
				pulse: {
					projectId,
					periodLabel,
					confidenceTier: tier,
					confidenceLabel: TIER_LABELS[tier],
					confidenceChange,
					deltas,
					nextStep,
				},
			};
		} catch (error) {
			consola.error("[research-pulse] error", error);
			return { success: false, message: "Failed to compute research pulse." };
		}
	},
});

function buildDeltas(
	current: SnapshotData,
	previous: SnapshotData | null
): Array<{
	label: string;
	current: string | number;
	previous?: string | number;
	change?: string;
	direction?: "up" | "down" | "flat";
}> {
	const metrics: Array<{ label: string; key: keyof SnapshotData }> = [
		{ label: "Conversations", key: "interviewCount" },
		{ label: "Themes", key: "themeCount" },
		{ label: "Evidence", key: "evidenceCount" },
		{ label: "People", key: "peopleCount" },
		{ label: "Surveys", key: "surveyCount" },
	];

	return metrics
		.filter((m) => (current[m.key] as number) > 0 || (previous && (previous[m.key] as number) > 0))
		.map((m) => {
			const curr = current[m.key] as number;
			const prev = previous ? (previous[m.key] as number) : undefined;
			const diff = prev != null ? curr - prev : undefined;

			return {
				label: m.label,
				current: curr,
				previous: prev,
				change: diff != null ? (diff > 0 ? `+${diff}` : diff === 0 ? "—" : `${diff}`) : undefined,
				direction:
					diff != null ? (diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("flat" as const)) : undefined,
			};
		});
}

function determineConfidenceTier(data: SnapshotData): "early_signal" | "growing_confidence" | "decision_ready" {
	const { interviewCount, themeCount, evidenceCount } = data;

	if (interviewCount >= 8 && themeCount >= 5 && evidenceCount >= 30) {
		return "decision_ready";
	}
	if (interviewCount >= 3 && themeCount >= 2 && evidenceCount >= 10) {
		return "growing_confidence";
	}
	return "early_signal";
}

function suggestNextStep(data: SnapshotData): string {
	if (data.interviewCount === 0) {
		return "Upload your first conversation to start gathering signal.";
	}
	if (data.themeCount === 0) {
		return "Run analysis on your conversations to extract themes.";
	}
	if (data.evidenceCount < 10) {
		return "Collect more conversations to strengthen your evidence base.";
	}
	if (data.interviewCount < 5) {
		return "Talk to 2-3 more people to reach growing confidence.";
	}
	if (data.themeCount >= 5 && data.evidenceCount >= 30) {
		return "Your evidence is strong — ready to make decisions.";
	}
	return "Continue gathering signal and validating themes.";
}
