const DEFAULT_MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const DEFAULT_PART_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per part (R2/S3 requires >=5MB except last)
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;
const ESTIMATED_UPLOAD_BYTES_PER_SECOND = 24 * 1024; // ~192 kbps floor to avoid premature timeout
const TIMEOUT_BUFFER_MS = 30 * 1000;
const SINGLE_UPLOAD_MIN_TIMEOUT_MS = 2 * 60 * 1000;
const SINGLE_UPLOAD_MAX_TIMEOUT_MS = 20 * 60 * 1000;
const PART_UPLOAD_MIN_TIMEOUT_MS = 2 * 60 * 1000;
const PART_UPLOAD_MAX_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_PART_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export type UploadPhase = "uploading" | "completing" | "done";

export interface UploadProgress {
	bytesSent: number;
	totalBytes: number;
	percent: number;
	phase: UploadPhase;
	part?: {
		index: number;
		total: number;
		bytesSent: number;
		size: number;
	};
}

export interface CompletedPart {
	partNumber: number;
	etag: string;
	size: number;
}

export interface SinglePartUploadParams {
	file: Blob;
	url: string; // Presigned PUT URL
	contentType?: string;
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
}

export interface MultipartUploadHandlers {
	// Called once to start the multipart session. Return uploadId and optional per-part URLs (1-indexed).
	createMultipartUpload: (input: { totalParts: number }) => Promise<{
		uploadId: string;
		partUrls?: Record<number, string>;
	}>;
	// If partUrls is not provided in createMultipartUpload, this is called per part.
	getPartUrl?: (input: { uploadId: string; partNumber: number; partSize: number }) => Promise<string>;
	completeMultipartUpload: (input: { uploadId: string; parts: CompletedPart[] }) => Promise<void>;
	abortMultipartUpload?: (input: { uploadId: string }) => Promise<void>;
}

export interface MultipartUploadParams {
	file: Blob;
	handlers: MultipartUploadHandlers;
	partSizeBytes?: number;
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
}

export interface UploadToR2Params {
	file: Blob;
	singlePartUrl: string;
	contentType?: string;
	multipartHandlers?: MultipartUploadHandlers;
	multipartThresholdBytes?: number;
	partSizeBytes?: number;
	onProgress?: (progress: UploadProgress) => void;
	signal?: AbortSignal;
}

/**
 * Upload a small file (< multipartThresholdBytes) to R2 with client-side progress tracking.
 */
export async function uploadWithProgress({
	file,
	url,
	contentType,
	onProgress,
	signal,
}: SinglePartUploadParams): Promise<{ etag?: string }> {
	const totalBytes = file.size;
	const timeoutMs = calculateUploadTimeoutMs(totalBytes, {
		minMs: SINGLE_UPLOAD_MIN_TIMEOUT_MS,
		maxMs: SINGLE_UPLOAD_MAX_TIMEOUT_MS,
	});

	// Send Blob directly instead of streaming for cross-browser compatibility.
	// ReadableStream body + duplex:"half" only works in Chromium — Firefox/Safari
	// throw TypeError: Failed to fetch.
	onProgress?.({
		bytesSent: 0,
		totalBytes,
		percent: 0,
		phase: "uploading",
	});

	const response = await fetchWithTimeout(
		url,
		{
			method: "PUT",
			body: file,
			headers: contentType ? { "Content-Type": contentType } : undefined,
		},
		{
			signal,
			timeoutMs,
			timeoutError: `R2 upload timed out after ${Math.round(timeoutMs / 1000)}s`,
		}
	);

	if (!response.ok) {
		throw new Error(`R2 upload failed with status ${response.status}`);
	}

	onProgress?.({
		bytesSent: totalBytes,
		totalBytes,
		percent: 100,
		phase: "done",
	});

	return { etag: normalizeEtag(response.headers.get("etag")) };
}

/**
 * Upload a large file to R2 using multipart with client-side progress tracking.
 * Assumes your backend provides presigned part URLs + complete call wrappers.
 */
export async function uploadMultipartWithProgress({
	file,
	handlers,
	partSizeBytes = DEFAULT_PART_SIZE_BYTES,
	onProgress,
	signal,
}: MultipartUploadParams): Promise<{
	uploadId: string;
	parts: CompletedPart[];
}> {
	const totalBytes = file.size;
	const safePartSize = Math.max(partSizeBytes, MIN_PART_SIZE_BYTES);
	const totalParts = Math.max(1, Math.ceil(totalBytes / safePartSize));

	let bytesSent = 0;
	const completedParts: CompletedPart[] = [];

	const { uploadId, partUrls = {} } = await handlers.createMultipartUpload({
		totalParts,
	});

	try {
		for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
			const partNumber = partIndex + 1;
			const start = partIndex * safePartSize;
			const end = Math.min(start + safePartSize, totalBytes);
			const partBlob = file.slice(start, end);

			const partUrl =
				partUrls[partNumber] ??
				(await handlers.getPartUrl?.({
					uploadId,
					partNumber,
					partSize: partBlob.size,
				}));

			if (!partUrl) {
				throw new Error(`Missing presigned URL for part ${partNumber}`);
			}

			// Use Blob directly instead of streaming for better R2 compatibility
			// Progress is tracked per-part completion rather than per-chunk
			onProgress?.({
				bytesSent,
				totalBytes,
				percent: calcPercent(bytesSent, totalBytes, { capAt: 99 }),
				phase: "uploading",
				part: {
					index: partNumber,
					total: totalParts,
					bytesSent: 0,
					size: partBlob.size,
				},
			});

			const partTimeoutMs = calculateUploadTimeoutMs(partBlob.size, {
				minMs: PART_UPLOAD_MIN_TIMEOUT_MS,
				maxMs: PART_UPLOAD_MAX_TIMEOUT_MS,
			});

			// Retry per-part uploads with exponential backoff to handle transient network failures
			let etag: string | undefined;
			for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
				try {
					const response = await fetchWithTimeout(
						partUrl,
						{
							method: "PUT",
							body: partBlob, // Send Blob directly - more compatible than streaming
						},
						{
							signal,
							timeoutMs: partTimeoutMs,
							timeoutError: `R2 part ${partNumber}/${totalParts} timed out after ${Math.round(partTimeoutMs / 1000)}s`,
						}
					);

					if (!response.ok) {
						throw new Error(`R2 part ${partNumber} failed with status ${response.status}`);
					}

					etag = normalizeEtag(response.headers.get("etag")) ?? `part-${partNumber}`;
					if (attempt > 1) {
						console.log(`[Upload] Part ${partNumber}/${totalParts} succeeded on retry ${attempt}`);
					}
					break; // Success — exit retry loop
				} catch (partError) {
					// If the user cancelled, don't retry
					if (signal?.aborted) throw partError;

					const isLastAttempt = attempt === MAX_PART_RETRIES;
					if (isLastAttempt) {
						console.error(`[Upload] Part ${partNumber}/${totalParts} failed after ${MAX_PART_RETRIES} attempts`);
						throw partError;
					}

					const backoffMs = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
					console.warn(
						`[Upload] Part ${partNumber}/${totalParts} attempt ${attempt} failed, retrying in ${backoffMs}ms...`,
						partError instanceof Error ? partError.message : partError,
					);
					await new Promise((resolve) => setTimeout(resolve, backoffMs));
				}
			}

			if (!etag) {
				throw new Error(`R2 part ${partNumber} upload produced no ETag`);
			}
			completedParts.push({ partNumber, etag, size: partBlob.size });

			// Update bytesSent after successful part upload
			bytesSent += partBlob.size;

			onProgress?.({
				bytesSent,
				totalBytes,
				percent: calcPercent(bytesSent, totalBytes, { capAt: 99 }),
				phase: "uploading",
				part: {
					index: partNumber,
					total: totalParts,
					bytesSent: partBlob.size,
					size: partBlob.size,
				},
			});
		}

		onProgress?.({
			bytesSent,
			totalBytes,
			percent: Math.max(99, calcPercent(bytesSent, totalBytes, { capAt: 99 })),
			phase: "completing",
		});

		await handlers.completeMultipartUpload({ uploadId, parts: completedParts });

		onProgress?.({
			bytesSent: totalBytes,
			totalBytes,
			percent: 100,
			phase: "done",
		});

		return { uploadId, parts: completedParts };
	} catch (error) {
		if (handlers.abortMultipartUpload) {
			await handlers.abortMultipartUpload({ uploadId }).catch(() => {
				/* swallow abort errors */
			});
		}
		throw error;
	}
}

/**
 * Helper that picks single-part vs multipart based on file size.
 */
export async function uploadToR2WithProgress({
	file,
	singlePartUrl,
	contentType,
	multipartHandlers,
	multipartThresholdBytes = DEFAULT_MULTIPART_THRESHOLD,
	partSizeBytes,
	onProgress,
	signal,
}: UploadToR2Params) {
	if (file.size > multipartThresholdBytes) {
		if (!multipartHandlers) {
			throw new Error("Multipart handlers are required for files larger than the threshold");
		}

		return uploadMultipartWithProgress({
			file,
			handlers: multipartHandlers,
			partSizeBytes,
			onProgress,
			signal,
		});
	}

	return uploadWithProgress({
		file,
		url: singlePartUrl,
		contentType,
		onProgress,
		signal,
	});
}

function calcPercent(bytesSent: number, totalBytes: number, options?: { capAt?: number }) {
	if (!totalBytes) return 0;
	const raw = (bytesSent / totalBytes) * 100;
	if (options?.capAt !== undefined) {
		return Math.min(options.capAt, Math.round(raw * 10) / 10);
	}
	return Math.round(raw * 10) / 10;
}

function normalizeEtag(headerValue: string | null): string | undefined {
	if (!headerValue) return undefined;
	return headerValue.replaceAll('"', "");
}

function calculateUploadTimeoutMs(totalBytes: number, options: { minMs: number; maxMs: number }) {
	if (!totalBytes || totalBytes <= 0) return options.minMs;
	const estimatedDurationMs = Math.ceil((totalBytes / ESTIMATED_UPLOAD_BYTES_PER_SECOND) * 1000);
	const withBuffer = estimatedDurationMs + TIMEOUT_BUFFER_MS;
	return Math.max(options.minMs, Math.min(options.maxMs, withBuffer));
}

async function fetchWithTimeout(
	input: RequestInfo | URL,
	init: Omit<RequestInit, "signal">,
	options: {
		signal?: AbortSignal;
		timeoutMs: number;
		timeoutError: string;
	}
): Promise<Response> {
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	let didTimeout = false;

	if (options.signal?.aborted) {
		controller.abort();
	} else if (options.signal) {
		options.signal.addEventListener("abort", onAbort, { once: true });
	}

	const timeoutId = setTimeout(() => {
		didTimeout = true;
		controller.abort();
	}, options.timeoutMs);

	try {
		return await fetch(input, {
			...init,
			signal: controller.signal,
		});
	} catch (error) {
		if (didTimeout && !options.signal?.aborted) {
			throw new Error(options.timeoutError);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
		if (options.signal) {
			options.signal.removeEventListener("abort", onAbort);
		}
	}
}
