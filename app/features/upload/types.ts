import type { InsightInsert, Interview } from "~/types";

export interface ProcessingResult {
	stored: InsightInsert[];
	interview: Interview;
}

/** Per-file status during multi-file upload */
export type MultiFileStatus = "pending" | "optimizing" | "uploading" | "queued" | "error";

/** Tracks a single file within a multi-file upload batch */
export interface MultiFileItem {
	id: string;
	file: File;
	status: MultiFileStatus;
	interviewId: string | null;
	error: string | null;
}

/** Response from /api/upload-files */
export interface BatchUploadResponse {
	success: boolean;
	total: number;
	queued: number;
	failed: number;
	interviewIds: string[];
	results: Array<{
		index: number;
		filename: string;
		interviewId: string | null;
		error: string | null;
	}>;
}
