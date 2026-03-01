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
