/**
 * Phase Detection for ProgressRail Widget
 *
 * Maps the existing ProjectStage from determineProjectStage() to the
 * 5-phase ProgressRail model used by the gen-ui widget.
 */

import type { ProgressRailData } from "~/features/generative-ui/components/ProgressRail";
import type { ProjectStage } from "~/features/research-links/utils/recommendation-rules";

const PHASE_IDS = ["frame", "collect", "validate", "commit", "measure"] as const;
const PHASE_LABELS = ["Frame", "Collect", "Validate", "Commit", "Measure"] as const;

/**
 * Map ProjectStage → phase index.
 * setup       → 0 (Frame Decision)
 * discovery   → 1 (Choose Intake / Collect Signal)
 * gathering   → 2 (Collect Signal)
 * validation  → 3 (Ground Evidence + Find Patterns)
 * synthesis   → 4 (Decide + Act)
 */
const STAGE_TO_PHASE_INDEX: Record<ProjectStage, number> = {
	setup: 0,
	discovery: 1,
	gathering: 2,
	validation: 3,
	synthesis: 4,
};

interface ProjectStateInput {
	stage: ProjectStage;
	interviewCount: number;
	surveyCount: number;
	themeCount: number;
	hasGoals: boolean;
}

/**
 * Build ProgressRailData from project state returned by recommendNextActions.
 */
export function buildProgressRailData(projectState: ProjectStateInput): ProgressRailData {
	const activePhaseIndex = STAGE_TO_PHASE_INDEX[projectState.stage];

	const phases: ProgressRailData["phases"] = PHASE_IDS.map((id, idx) => {
		let status: "complete" | "active" | "upcoming" | "blocked";
		if (idx < activePhaseIndex) {
			status = "complete";
		} else if (idx === activePhaseIndex) {
			status = "active";
		} else {
			status = "upcoming";
		}

		return {
			id,
			label: PHASE_LABELS[idx],
			status,
			hint: idx === activePhaseIndex ? getPhaseHint(projectState) : undefined,
		};
	});

	return {
		phases,
		activeMoment: activePhaseIndex,
		statusLine: buildStatusLine(projectState),
	};
}

function getPhaseHint(state: ProjectStateInput): string | undefined {
	switch (state.stage) {
		case "setup":
			return state.hasGoals ? "Goals defined — ready to collect" : "Define your research goals to get started";
		case "discovery":
			return `${state.interviewCount} conversation${state.interviewCount !== 1 ? "s" : ""} — collect more signal`;
		case "gathering":
			return `${state.interviewCount} conversations, ${state.surveyCount} surveys — keep gathering`;
		case "validation":
			return `${state.themeCount} theme${state.themeCount !== 1 ? "s" : ""} emerging — validate with more data`;
		case "synthesis":
			return "Strong evidence base — ready to synthesize and decide";
		default:
			return undefined;
	}
}

function buildStatusLine(state: ProjectStateInput): string {
	const parts: string[] = [];
	if (state.interviewCount > 0) {
		parts.push(`${state.interviewCount} conversation${state.interviewCount !== 1 ? "s" : ""}`);
	}
	if (state.surveyCount > 0) {
		parts.push(`${state.surveyCount} survey${state.surveyCount !== 1 ? "s" : ""}`);
	}
	if (state.themeCount > 0) {
		parts.push(`${state.themeCount} theme${state.themeCount !== 1 ? "s" : ""}`);
	}

	if (parts.length === 0) {
		return "No data collected yet";
	}

	return parts.join(" · ");
}
