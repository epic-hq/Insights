import type { ResearchLinkResponse } from "../../types";
import type { ResearchLinkQuestion } from "./schemas";

export function extractAnswer(response: ResearchLinkResponse, question: ResearchLinkQuestion): string {
	const value = (response.responses as Record<string, unknown> | null)?.[question.id];
	if (value == null) return "";
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	return String(value);
}

function escapeCsvValue(value: string): string {
	if (value.includes(",") || value.includes("\n") || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export function buildResponsesCsv(questions: ResearchLinkQuestion[], responses: ResearchLinkResponse[]): string {
	const headers = ["Email", ...questions.map((question) => question.prompt)];
	const rows = responses.map((response) => {
		const answerValues = questions.map((question) => extractAnswer(response, question));
		return [response.email, ...answerValues];
	});

	const csvLines = [headers, ...rows].map((line) => line.map((value) => escapeCsvValue(value ?? "")).join(","));
	return csvLines.join("\n");
}
