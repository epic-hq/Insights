/**
 * Hook for managing multi-file upload state and execution.
 *
 * Handles file validation, client-side media optimization, batch upload
 * to /api/upload-files, and per-file status tracking. Files are sent in
 * a single request; individual progress is tracked via the batch response.
 */

import { useCallback, useRef, useState } from "react";
import type { BatchUploadResponse, MultiFileItem, MultiFileStatus } from "~/features/upload/types";

/** Accepted MIME types and extensions for upload */
const ACCEPTED_TYPES: Record<string, string[]> = {
	"text/*": [".txt", ".md"],
	"application/pdf": [".pdf"],
	"audio/*": [".mp3", ".wav", ".m4a", ".webm"],
	"video/*": [".mp4", ".mov", ".avi"],
};

const MAX_FILES = 20;

interface PreparedBatchFile {
	uploadFile: File;
	originalFilename: string;
	originalContentType: string;
	originalFileSize: number;
}

interface UseMultiFileUploadOptions {
	projectId: string;
	accountId: string;
	onComplete?: (response: BatchUploadResponse) => void;
}

interface UseMultiFileUploadReturn {
	/** Current list of files with their statuses */
	files: MultiFileItem[];
	/** Whether an upload is in progress */
	isUploading: boolean;
	/** Global error message (e.g. quota exceeded) */
	error: string | null;
	/** Add files to the queue (from dropzone) */
	addFiles: (newFiles: File[]) => void;
	/** Remove a file from the queue before upload */
	removeFile: (id: string) => void;
	/** Clear all files and reset state */
	reset: () => void;
	/** Start uploading all queued files */
	upload: () => Promise<void>;
	/** Accepted file types for react-dropzone */
	acceptedTypes: Record<string, string[]>;
	/** Max files allowed */
	maxFiles: number;
}

function generateId(): string {
	return `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isAcceptedFile(file: File): boolean {
	const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
	const allExts = Object.values(ACCEPTED_TYPES).flat();
	if (allExts.includes(ext)) return true;

	// Check MIME type prefixes
	for (const mimePattern of Object.keys(ACCEPTED_TYPES)) {
		if (mimePattern.endsWith("/*")) {
			const prefix = mimePattern.replace("/*", "/");
			if (file.type.startsWith(prefix)) return true;
		} else if (file.type === mimePattern) {
			return true;
		}
	}
	return false;
}

function createAbortError(): DOMException {
	return new DOMException("Upload aborted", "AbortError");
}

export function useMultiFileUpload({
	projectId,
	accountId,
	onComplete,
}: UseMultiFileUploadOptions): UseMultiFileUploadReturn {
	const [files, setFiles] = useState<MultiFileItem[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const addFiles = useCallback((newFiles: File[]) => {
		setError(null);

		setFiles((prev) => {
			const remaining = MAX_FILES - prev.length;
			if (remaining <= 0) {
				setError(`Maximum ${MAX_FILES} files allowed`);
				return prev;
			}

			const toAdd = newFiles.slice(0, remaining);
			const rejected = newFiles.length - toAdd.length;

			// Filter invalid types
			const validFiles: MultiFileItem[] = [];
			for (const file of toAdd) {
				if (!isAcceptedFile(file)) {
					setError(`Unsupported file type: ${file.name}`);
					continue;
				}
				validFiles.push({
					id: generateId(),
					file,
					status: "pending",
					interviewId: null,
					error: null,
				});
			}

			if (rejected > 0) {
				setError(`Only ${MAX_FILES} files allowed. ${rejected} file${rejected > 1 ? "s" : ""} skipped.`);
			}

			return [...prev, ...validFiles];
		});
	}, []);

	const removeFile = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
		setError(null);
	}, []);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setFiles([]);
		setIsUploading(false);
		setError(null);
	}, []);

	const upload = useCallback(async () => {
		if (files.length === 0 || isUploading) return;

		setIsUploading(true);
		setError(null);

		// Mark all as uploading
		setFiles((prev) =>
			prev.map((f) => ({
				...f,
				status: "uploading" as MultiFileStatus,
				error: null,
			}))
		);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const { optimizeMediaFile, shouldOptimize } = await import("~/utils/media-optimizer.client");
			const preparedFiles: PreparedBatchFile[] = [];

			for (const item of files) {
				if (controller.signal.aborted) {
					throw createAbortError();
				}

				const needsOptimization = shouldOptimize(item.file);
				if (needsOptimization) {
					setFiles((prev) =>
						prev.map((current) =>
							current.id === item.id
								? {
										...current,
										status: "optimizing" as MultiFileStatus,
										error: null,
									}
								: current
						)
					);
				}

				const optimizationResult = needsOptimization
					? await optimizeMediaFile(item.file, {
							signal: controller.signal,
						})
					: {
							file: item.file,
						};

				preparedFiles.push({
					uploadFile: optimizationResult.file,
					originalFilename: item.file.name,
					originalContentType: item.file.type || "application/octet-stream",
					originalFileSize: item.file.size,
				});
			}

			setFiles((prev) =>
				prev.map((current) => ({
					...current,
					status: "uploading" as MultiFileStatus,
					error: null,
				}))
			);

			const formData = new FormData();
			formData.append("projectId", projectId);
			formData.append("accountId", accountId);
			for (const preparedFile of preparedFiles) {
				formData.append("files", preparedFile.uploadFile, preparedFile.uploadFile.name);
				formData.append("originalFilenames", preparedFile.originalFilename);
				formData.append("originalContentTypes", preparedFile.originalContentType);
				formData.append("originalFileSizes", String(preparedFile.originalFileSize));
			}

			const response = await fetch("/api/upload-files", {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
				throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
			}

			const result: BatchUploadResponse = await response.json();

			// Update individual file statuses from batch response
			setFiles((prev) =>
				prev.map((f, index) => {
					const fileResult = result.results.find((r) => r.index === index);
					if (!fileResult) return f;

					return {
						...f,
						status: fileResult.error ? "error" : "queued",
						interviewId: fileResult.interviewId,
						error: fileResult.error,
					};
				})
			);

			onComplete?.(result);
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				// Upload cancelled
				setFiles((prev) => prev.map((f) => ({ ...f, status: "pending" as MultiFileStatus })));
			} else {
				const message = err instanceof Error ? err.message : "Upload failed";
				setError(message);
				setFiles((prev) =>
					prev.map((f) => ({
						...f,
						status: "error" as MultiFileStatus,
						error: message,
					}))
				);
			}
		} finally {
			setIsUploading(false);
			abortRef.current = null;
		}
	}, [files, isUploading, projectId, accountId, onComplete]);

	return {
		files,
		isUploading,
		error,
		addFiles,
		removeFile,
		reset,
		upload,
		acceptedTypes: ACCEPTED_TYPES,
		maxFiles: MAX_FILES,
	};
}
