/**
 * Feature Display Names
 *
 * Client-safe feature name mapping.
 * Can be imported in both client and server code.
 */

import type { FeatureKey } from "./types";

/**
 * Get a human-readable name for a feature.
 */
export function getFeatureDisplayName(feature: FeatureKey): string {
	const names: Record<FeatureKey, string> = {
		survey_ai_analysis: "Survey AI Analysis",
		team_workspace: "Team Workspace",
		sso: "Single Sign-On",
		interview_guide: "Interview Guide",
		smart_personas: "Smart Personas",
		ai_crm: "AI CRM",
	};
	return names[feature] ?? String(feature);
}
