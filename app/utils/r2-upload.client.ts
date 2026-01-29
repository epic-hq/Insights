const DEFAULT_MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
const DEFAULT_PART_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per part (R2/S3 requires >=5MB except last)
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;

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
  getPartUrl?: (input: {
    uploadId: string;
    partNumber: number;
    partSize: number;
  }) => Promise<string>;
  completeMultipartUpload: (input: {
    uploadId: string;
    parts: CompletedPart[];
  }) => Promise<void>;
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
  let bytesSent = 0;

  const body = createProgressStream(file, (chunkBytes) => {
    bytesSent += chunkBytes;
    onProgress?.({
      bytesSent,
      totalBytes,
      percent: calcPercent(bytesSent, totalBytes, { capAt: 99 }),
      phase: "uploading",
    });
  });

  const response = await fetch(url, {
    method: "PUT",
    body,
    headers: contentType ? { "Content-Type": contentType } : undefined,
    signal,
    // @ts-expect-error - duplex is required for streaming bodies in modern browsers
    duplex: "half",
  });

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

      const response = await fetch(partUrl, {
        method: "PUT",
        body: partBlob, // Send Blob directly - more compatible than streaming
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `R2 part ${partNumber} failed with status ${response.status}`,
        );
      }

      const etag =
        normalizeEtag(response.headers.get("etag")) ?? `part-${partNumber}`;
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
      throw new Error(
        "Multipart handlers are required for files larger than the threshold",
      );
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

function calcPercent(
  bytesSent: number,
  totalBytes: number,
  options?: { capAt?: number },
) {
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

function createProgressStream(
  blob: Blob,
  onChunk: (bytes: number) => void,
): ReadableStream<Uint8Array> {
  const reader = blob.stream().getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value) {
        onChunk(value.byteLength);
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {
        /* ignore */
      });
    },
  });
}
