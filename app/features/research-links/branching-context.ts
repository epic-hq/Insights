import type { ResearchLinkQuestion } from "./schemas";

type MatrixResponseValue = Record<string, string | number | null | undefined>;

export type ResponseValue = string | string[] | boolean | MatrixResponseValue | null | undefined;
export type ResponseRecord = Record<string, ResponseValue>;
export type PersonAttributeRecord = Record<string, ResponseValue>;

export interface BranchingContext {
	responses: ResponseRecord;
	personAttributes: PersonAttributeRecord;
}

export const PERSON_ATTRIBUTE_KEYS = [
	{ key: "title", label: "Job Title" },
	{ key: "job_function", label: "Job Function" },
	{ key: "seniority_level", label: "Seniority Level" },
	{ key: "role", label: "Role Type" },
	{ key: "segment", label: "Segment" },
	{ key: "icp_band", label: "ICP Band" },
	{ key: "company", label: "Company" },
	{ key: "industry", label: "Industry" },
	{ key: "company_size", label: "Company Size" },
	{ key: "persona", label: "Persona" },
	{ key: "membership_status", label: "Membership Status" },
	{ key: "membership_year", label: "Membership Year" },
	{ key: "membership_expiration", label: "Membership Expiration" },
] as const;

export type PersonAttributeKey = (typeof PERSON_ATTRIBUTE_KEYS)[number]["key"];

const PERSON_ATTRIBUTE_LABELS: Record<PersonAttributeKey, string> = Object.fromEntries(
	PERSON_ATTRIBUTE_KEYS.map((entry) => [entry.key, entry.label])
) as Record<PersonAttributeKey, string>;

const PERSON_ATTRIBUTE_KEY_SET = new Set<string>(PERSON_ATTRIBUTE_KEYS.map((entry) => entry.key));

const TAXONOMY_TO_PERSON_ATTRIBUTE: Partial<Record<string, PersonAttributeKey>> = {
	role_type: "role",
	job_title: "title",
	job_function: "job_function",
	seniority_level: "seniority_level",
	tenure_in_role: "seniority_level",
	industry_vertical: "industry",
	team_size: "company_size",
	company_size: "company_size",
};

function normalizeKey(value: string | null | undefined): string | null {
	if (!value) return null;
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	return normalized.length > 0 ? normalized : null;
}

function isMatrixResponseValue(value: ResponseValue): value is MatrixResponseValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValue(value: ResponseValue): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") return value.trim().length > 0;
	if (typeof value === "boolean") return true;
	if (isMatrixResponseValue(value)) {
		return Object.values(value).some((entry) => entry != null && String(entry).trim().length > 0);
	}
	return false;
}

function normalizeSeniority(value: string): string {
	const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
	if (
		/\b(c-level|chief|ceo|cto|cfo|coo|cmo|cpo|president|vp|vice president|head of|founder|owner|partner)\b/i.test(
			normalized
		)
	) {
		return "Leadership";
	}
	if (/\b(director|principal|staff|lead)\b/i.test(normalized)) return "Senior";
	if (/\b(manager|mgr)\b/i.test(normalized)) return "Manager";
	if (/\b(junior|jr|entry|intern)\b/i.test(normalized)) return "Entry";
	if (/\b(less than 1|< ?1|0-1|0 to 1|under 1)\b/i.test(normalized)) return "Entry";
	if (/\b(1\s*(?:-|to)\s*3|1-3)\b/i.test(normalized)) return "Mid";
	if (/\b(3\s*(?:-|to)\s*5|3-5)\b/i.test(normalized)) return "Senior";
	if (/(^|\s)(5\+|6\+|7\+|8\+|9\+|10\+)(\s|$)/i.test(normalized)) return "Leadership";
	return value;
}

function pickSingleValue(value: ResponseValue): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			const trimmed = entry.trim();
			if (trimmed.length > 0) return trimmed;
		}
		return null;
	}
	if (typeof value === "boolean") return value ? "true" : "false";
	if (isMatrixResponseValue(value)) {
		for (const entry of Object.values(value)) {
			if (entry == null) continue;
			const trimmed = String(entry).trim();
			if (trimmed.length > 0) return trimmed;
		}
	}
	return null;
}

function normalizeAttributeValue(attributeKey: string, value: ResponseValue): ResponseValue {
	if (attributeKey === "seniority_level") {
		const single = pickSingleValue(value);
		return single ? normalizeSeniority(single) : value;
	}
	return value;
}

export function getPersonAttributeLabel(attributeKey: PersonAttributeKey): string {
	return PERSON_ATTRIBUTE_LABELS[attributeKey];
}

export function getQuestionPersonAttributeKey(question: ResearchLinkQuestion): PersonAttributeKey | null {
	const explicit = normalizeKey(question.personFieldKey ?? null);
	if (explicit && PERSON_ATTRIBUTE_KEY_SET.has(explicit)) {
		return explicit as PersonAttributeKey;
	}

	const taxonomy = normalizeKey(question.taxonomyKey ?? null);
	if (!taxonomy) return null;
	return TAXONOMY_TO_PERSON_ATTRIBUTE[taxonomy] ?? null;
}

export function responsesOnlyContext(responses: ResponseRecord): BranchingContext {
	return {
		responses,
		personAttributes: {},
	};
}

export function buildBranchingContext(
	responses: ResponseRecord,
	questions: ResearchLinkQuestion[],
	personAttributes?: PersonAttributeRecord
): BranchingContext {
	const mergedPersonAttributes: PersonAttributeRecord = { ...(personAttributes ?? {}) };

	for (const question of questions) {
		const attributeKey = getQuestionPersonAttributeKey(question);
		if (!attributeKey || !question.id) continue;
		const responseValue = responses[question.id];
		if (!hasValue(responseValue)) continue;
		mergedPersonAttributes[attributeKey] = normalizeAttributeValue(attributeKey, responseValue);
	}

	return {
		responses,
		personAttributes: mergedPersonAttributes,
	};
}
