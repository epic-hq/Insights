/**
 * Centralized configuration for project sections
 * This defines all section kinds and their data types in one place
 */

export type SectionType = "string" | "string[]" | "object"
export type ArrayFormatter = "numbered" | "spaced"

export interface SectionConfig {
	kind: string
	type: SectionType
	defaultValue: string | string[] | Record<string, unknown>
	/** For array types, specify how to format the content_md */
	arrayFormatter?: ArrayFormatter
	/** Allow empty values to be saved (for deletions) */
	allowEmpty?: boolean
}

/**
 * All project section kinds with their data types
 * Add new sections here to automatically handle them throughout the app
 */
export const PROJECT_SECTIONS: SectionConfig[] = [
	{ kind: "customer_problem", type: "string", defaultValue: "", allowEmpty: true },
	{ kind: "target_orgs", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "target_roles", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "offerings", type: "string", defaultValue: "", allowEmpty: true },
	{ kind: "competitors", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "research_goal", type: "object", defaultValue: { research_goal: "", research_goal_details: "" } },
	{ kind: "decision_questions", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "assumptions", type: "string[]", defaultValue: [], arrayFormatter: "spaced" },
	{ kind: "unknowns", type: "string[]", defaultValue: [], arrayFormatter: "spaced" },
	{ kind: "custom_instructions", type: "string", defaultValue: "" },
]

export const SECTION_KINDS = PROJECT_SECTIONS.map((s) => s.kind)

export function getSectionConfig(kind: string): SectionConfig | undefined {
	return PROJECT_SECTIONS.find((s) => s.kind === kind)
}

export function getSectionDefaultValue(kind: string): string | string[] | Record<string, unknown> {
	return getSectionConfig(kind)?.defaultValue ?? ""
}
