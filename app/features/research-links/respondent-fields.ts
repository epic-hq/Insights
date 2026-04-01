export type RespondentFieldInputType = "text" | "select";
export type RespondentFieldOptionValueMode = "label" | "slug";

export const RESPONDENT_FIELD_DEFINITIONS = [
	{ key: "first_name", label: "First name", inputType: "text" },
	{ key: "last_name", label: "Last name", inputType: "text" },
	{ key: "company", label: "Company", inputType: "text" },
	{ key: "title", label: "Job title", inputType: "text" },
	{
		key: "job_function",
		label: "Job function",
		inputType: "select",
		facetKindSlug: "job_function",
		optionValueMode: "label",
	},
	{
		key: "industry",
		label: "Industry",
		inputType: "select",
		facetKindSlug: "company_industry",
		optionValueMode: "label",
	},
	{
		key: "company_size",
		label: "Company size",
		inputType: "select",
		facetKindSlug: "company_size",
		optionValueMode: "label",
	},
	{ key: "phone", label: "Phone number", inputType: "text" },
] as const;

export type RespondentFieldKey = (typeof RESPONDENT_FIELD_DEFINITIONS)[number]["key"];
export type RespondentFieldDefinition = (typeof RESPONDENT_FIELD_DEFINITIONS)[number];
export type RespondentFieldSelectDefinition = Extract<RespondentFieldDefinition, { inputType: "select" }>;

export interface RespondentFieldOption {
	value: string;
	label: string;
}

/** Config for a single respondent field, including whether it's required. */
export interface RespondentFieldConfig {
	key: string;
	required: boolean;
}

/**
 * Parse respondent_fields from DB.
 * Handles both legacy format (string[]) and new format ({key, required}[]).
 * Returns a normalized array of RespondentFieldConfig.
 */
export function parseRespondentFields(raw: unknown): RespondentFieldConfig[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((item) => {
		if (typeof item === "string") {
			// Legacy format: string key, default to not required (except first_name)
			return { key: item, required: item === "first_name" };
		}
		if (typeof item === "object" && item !== null && "key" in item) {
			return { key: String(item.key), required: Boolean(item.required) };
		}
		return { key: String(item), required: false };
	});
}

/** Serialize RespondentFieldConfig[] back to the DB JSONB format. */
export function serializeRespondentFields(configs: RespondentFieldConfig[] | undefined): RespondentFieldConfig[] {
	if (!configs) return [];
	return configs.map(({ key, required }) => ({ key, required }));
}

/** Extract just the field keys from configs (for backwards-compatible checks). */
export function getFieldKeys(configs: RespondentFieldConfig[]): string[] {
	return configs.map((c) => c.key);
}

/** Check if a specific field is required. */
export function isFieldRequired(configs: RespondentFieldConfig[], key: string): boolean {
	return configs.some((c) => c.key === key && c.required);
}

export const RESPONDENT_FIELD_LABELS: Record<RespondentFieldKey, string> = RESPONDENT_FIELD_DEFINITIONS.reduce(
	(acc, field) => {
		acc[field.key] = field.label;
		return acc;
	},
	{} as Record<RespondentFieldKey, string>
);

export const RESPONDENT_FIELD_DEFINITION_MAP: Record<RespondentFieldKey, RespondentFieldDefinition> =
	Object.fromEntries(RESPONDENT_FIELD_DEFINITIONS.map((field) => [field.key, field])) as Record<
		RespondentFieldKey,
		RespondentFieldDefinition
	>;
