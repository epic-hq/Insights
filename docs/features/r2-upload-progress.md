# R2 Upload Progress (Client)

We now have a client-side helper for Cloudflare R2 uploads with progress, covering single PUTs and multipart (>100MB) flows. R2 itself does not emit progress; we count bytes locally while streaming.

## Helper

- File: `app/utils/r2-upload.client.ts`
- Exports:
  - `uploadWithProgress` (single PUT presigned URL)
  - `uploadMultipartWithProgress` (multipart with presigned part URLs + complete/abort callbacks)
  - `uploadToR2WithProgress` (auto-picks single vs multipart based on size)
- Emits `UploadProgress` with `bytesSent`, `totalBytes`, `percent`, `phase` (`uploading` | `completing` | `done`), and per-part info for multipart.

## Usage

```ts
import { uploadToR2WithProgress } from "~/utils/r2-upload.client"

await uploadToR2WithProgress({
  file, // Blob/File
  singlePartUrl, // presigned PUT for <100MB
  contentType: file.type,
  multipartThresholdBytes: 100 * 1024 * 1024,
  partSizeBytes: 10 * 1024 * 1024, // min 5MB
  multipartHandlers: {
    createMultipartUpload: async ({ totalParts }) => {
      // call backend to start upload and get presigned part URLs (optional per-part)
      return { uploadId, partUrls }
    },
    getPartUrl: async ({ uploadId, partNumber, partSize }) => {
      // if partUrls not returned above
      return partUrl
    },
    completeMultipartUpload: async ({ uploadId, parts }) => {
      // call backend complete
    },
    abortMultipartUpload: async ({ uploadId }) => {
      // optional cleanup
    },
  },
  onProgress: ({ percent, part, phase }) => {
    // update UI, debounce as needed
  },
  signal, // AbortController.signal for cancel
})
```

Notes:
- Percent is capped at 99% until final complete call returns; mark 100% on `phase: "done"`.
- For multipart, retries should not double-count; keep `bytesSent` from completed parts stable.
- The helper streams with a `ReadableStream`, so progress works in modern browsers; polyfill or guard for legacy.
