import {
	getPersonAttributeLabel,
	getQuestionPersonAttributeKey,
	type PersonAttributeKey,
	type PersonAttributeRecord,
	type ResponseValue,
} from "./branching-context";
import type { ResearchLinkQuestion } from "./schemas";

export type KnownPersonResponseValue = string | string[] | boolean | null;

export interface KnownPersonValue {
	attributeKey: PersonAttributeKey;
	attributeLabel: string;
	responseValue: KnownPersonResponseValue;
	displayValue: string;
}

function toStringValues(value: ResponseValue): string[] {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? [trimmed] : [];
	}

	if (Array.isArray(value)) {
		return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
	}

	if (typeof value === "boolean") {
		return [value ? "Yes" : "No"];
	}

	return [];
}

function formatDisplayValue(value: ResponseValue): string {
	const values = toStringValues(value);
	return values.join(", ");
}

function coerceKnownValueForQuestion(question: ResearchLinkQuestion, value: ResponseValue): KnownPersonResponseValue {
	const values = toStringValues(value);
	if (values.length === 0) return null;

	const questionType = question.type;
	const options = question.options ?? [];
	const hasStructuredOptions = options.length > 0;
	const allowOther = question.allowOther ?? true;

	if (questionType === "likert" || questionType === "matrix" || questionType === "image_select") {
		return null;
	}

	if (questionType === "multi_select") {
		const matchedOptions = values.filter((entry) => options.includes(entry));
		const unmatchedOptions = values.filter((entry) => !options.includes(entry));
		if (!allowOther && unmatchedOptions.length > 0) {
			return matchedOptions.length > 0 ? matchedOptions : null;
		}
		const nextValues = allowOther ? [...matchedOptions, ...unmatchedOptions] : matchedOptions;
		return nextValues.length > 0 ? nextValues : null;
	}

	if (questionType === "single_select" || (questionType === "auto" && hasStructuredOptions)) {
		const [firstValue] = values;
		if (!firstValue) return null;
		if (options.includes(firstValue) || allowOther || !hasStructuredOptions) {
			return firstValue;
		}
		return null;
	}

	return values.join(", ");
}

export function getKnownPersonValueForQuestion(
	question: ResearchLinkQuestion,
	personAttributes: PersonAttributeRecord
): KnownPersonValue | null {
	const attributeKey = getQuestionPersonAttributeKey(question);
	if (!attributeKey) return null;

	const rawValue = personAttributes[attributeKey];
	const responseValue = coerceKnownValueForQuestion(question, rawValue);
	if (responseValue == null) return null;

	const displayValue = formatDisplayValue(responseValue);
	if (!displayValue) return null;

	return {
		attributeKey,
		attributeLabel: getPersonAttributeLabel(attributeKey),
		responseValue,
		displayValue,
	};
}
