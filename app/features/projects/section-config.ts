/**
 * Centralized configuration for project sections
 *
 * IMPORTANT: The project_sections table now supports DYNAMIC document types.
 * The `kind` field can be ANY text value - you don't need to add it here.
 *
 * This config is only for STRUCTURED FIELDS that need special handling in forms/UI.
 * Examples: research_goal, target_roles, customer_problem
 *
 * For freeform documents (positioning_statement, seo_strategy, meeting_notes, etc.),
 * use the `manageDocuments` tool or upsertProjectSection directly - no config needed!
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
	/** Display name for UI (optional) */
	displayName?: string
	/** Category for grouping in UI (optional) */
	category?: "setup" | "research" | "strategic" | "marketing" | "product" | "custom"
}

/**
 * STRUCTURED project sections that need special handling in forms/UI
 *
 * NOTE: This is NOT a complete list of allowed document types!
 * Any kind value can be used in project_sections - these are just the ones
 * that have special UI handling or formatting requirements.
 *
 * For ad-hoc documents, use manageDocuments tool without adding config here.
 */
export const PROJECT_SECTIONS: SectionConfig[] = [
	{ kind: "customer_problem", type: "string", defaultValue: "", allowEmpty: true },
	{ kind: "target_orgs", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "target_roles", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "offerings", type: "string", defaultValue: "", allowEmpty: true },
	{ kind: "competitors", type: "string[]", defaultValue: [], arrayFormatter: "numbered" },
	{ kind: "research_goal", type: "string", defaultValue: "", allowEmpty: true },
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

/**
 * Check if a section kind is a structured field (defined in PROJECT_SECTIONS)
 * or a dynamic document type (any other value)
 */
export function isStructuredSection(kind: string): boolean {
	return SECTION_KINDS.includes(kind)
}

/**
 * Check if a section kind is a dynamic document type (not in PROJECT_SECTIONS)
 */
export function isDynamicDocument(kind: string): boolean {
	return !isStructuredSection(kind)
}

/**
 * Common dynamic document types for reference
 * (These don't need config - just examples for documentation)
 */
export const COMMON_DYNAMIC_DOCUMENTS = {
	strategic: ["positioning_statement", "market_analysis", "competitive_analysis", "product_roadmap", "business_plan"],
	marketing: ["seo_strategy", "content_strategy", "brand_guidelines", "messaging_framework", "go_to_market"],
	product: ["feature_specs", "user_stories", "technical_specs", "design_docs", "product_requirements"],
	research: ["meeting_notes", "research_notes", "interview_notes", "user_feedback", "observation_log"],
	business: ["pricing_strategy", "sales_playbook", "partner_strategy", "budget_plan", "quarterly_goals"],
} as const
