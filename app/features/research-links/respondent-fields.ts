export const RESPONDENT_FIELD_DEFINITIONS = [
	{ key: "first_name", label: "First name" },
	{ key: "last_name", label: "Last name" },
	{ key: "company", label: "Company" },
	{ key: "title", label: "Job title" },
	{ key: "job_function", label: "Job function" },
	{ key: "industry", label: "Industry" },
	{ key: "company_size", label: "Company size" },
	{ key: "phone", label: "Phone number" },
] as const;

export type RespondentFieldKey = (typeof RESPONDENT_FIELD_DEFINITIONS)[number]["key"];

export const RESPONDENT_FIELD_LABELS: Record<RespondentFieldKey, string> = RESPONDENT_FIELD_DEFINITIONS.reduce(
	(acc, field) => {
		acc[field.key] = field.label;
		return acc;
	},
	{} as Record<RespondentFieldKey, string>
);

export const COMPANY_SIZE_OPTIONS = [
	{ value: "1-10", label: "Startup (1-10)" },
	{ value: "11-50", label: "Small Business (11-50)" },
	{ value: "51-200", label: "SMB (51-200)" },
	{ value: "201-500", label: "Mid-Market (201-500)" },
	{ value: "501-1000", label: "Mid-Market (501-1000)" },
	{ value: "1001-5000", label: "Enterprise (1001-5000)" },
	{ value: "5001-10000", label: "Large Enterprise (5001-10000)" },
	{ value: "10000+", label: "Large Enterprise (10000+)" },
] as const;
