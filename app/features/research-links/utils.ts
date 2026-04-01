import type { ResearchLinkResponse } from "../../types";
import type { ResearchLinkQuestion } from "./schemas";

/** Detect media type from a URL or R2 key by file extension */
export function getMediaType(url: string): "image" | "video" | "audio" | "unknown" {
	const lower = url.toLowerCase();
	if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|$)/.test(lower)) return "image";
	if (/\.(mp4|webm|mov|avi|mkv|ogv)(\?|$)/.test(lower)) return "video";
	if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/.test(lower)) return "audio";
	return "unknown";
}

/** Check if a URL is an R2 storage key (not a full URL) */
export function isR2Key(url: string): boolean {
	return !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:");
}

function formatScaledValue(question: ResearchLinkQuestion, value: string | number): string {
	const numericValue = typeof value === "number" ? value : Number.parseFloat(String(value));
	if (Number.isNaN(numericValue)) return String(value);
	if (question.type === "likert" || question.type === "matrix" || question.likertScale) {
		return `${numericValue}/${question.likertScale ?? 5}`;
	}
	return String(value);
}

export function formatQuestionAnswerValue(question: ResearchLinkQuestion, value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	if (typeof value === "object") {
		const rowLabels = new Map((question.matrixRows ?? []).map((row) => [row.id, row.label] as const));
		return Object.entries(value as Record<string, unknown>)
			.flatMap(([rowId, rowValue]) => {
				if ((typeof rowValue !== "string" && typeof rowValue !== "number") || String(rowValue).trim().length === 0) {
					return [];
				}
				const label = rowLabels.get(rowId) ?? rowId;
				return [`${label}: ${formatScaledValue(question, rowValue)}`];
			})
			.join("; ");
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (typeof value === "number") {
		return formatScaledValue(question, value);
	}
	if (typeof value === "string" && (question.type === "likert" || question.type === "matrix")) {
		return formatScaledValue(question, value);
	}
	return String(value);
}

export function extractAnswer(response: ResearchLinkResponse, question: ResearchLinkQuestion): string {
	const value = (response.responses as Record<string, unknown> | null)?.[question.id];
	return formatQuestionAnswerValue(question, value);
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
