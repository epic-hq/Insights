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
