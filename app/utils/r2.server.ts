import { Buffer } from "node:buffer"
import { createHash, createHmac } from "node:crypto"
import consola from "consola"

type UploadResult = { success: true } | { success: false; error?: string }

interface R2UploadParams {
	key: string
	body: Uint8Array
	contentType?: string
	useMultipart?: boolean // Enable multipart for files > threshold
}

interface R2Config {
	accountId: string
	accessKeyId: string
	secretAccessKey: string
	bucket: string
	publicBaseUrl: string
	endpoint: string
	region: string
}

interface R2PresignOptions {
	key: string
	expiresInSeconds?: number
	responseContentType?: string
	responseContentDisposition?: string
}

interface R2PresignResult {
	url: string
	expiresAt: number
}

let cachedConfig: R2Config | null = null
let attemptedLoad = false

function _getR2PublicUrl(key: string): string | null {
	const config = getR2Config()
	if (!config) return null
	const base = config.publicBaseUrl.endsWith("/") ? config.publicBaseUrl.slice(0, -1) : config.publicBaseUrl
	const sanitizedKey = key.replace(/^\/+/, "")
	return `${base}/${sanitizedKey}`
}

export function getR2KeyFromPublicUrl(fullUrl: string): string | null {
	const config = getR2Config()
	if (!config) return null

	try {
		const normalizedBase = config.publicBaseUrl.replace(/\/+$/, "")
		const withoutQuery = fullUrl.split(/[?#]/)[0] ?? ""

		if (!withoutQuery.toLowerCase().startsWith(normalizedBase.toLowerCase())) {
			return null
		}

		let remainder = withoutQuery.slice(normalizedBase.length).replace(/^\/+/, "")

		// Strip bucket name prefix if present (e.g., "upsight-usermedia/interviews/..." → "interviews/...")
		// This handles cases where R2_PUBLIC_BASE_URL includes the bucket in the path
		const bucketPrefix = `${config.bucket}/`
		if (remainder.startsWith(bucketPrefix)) {
			remainder = remainder.slice(bucketPrefix.length)
		}

		return remainder ? decodeURIComponent(remainder) : null
	} catch {
		return null
	}
}

// Multipart upload constants
const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB - use multipart for files larger than this
const PART_SIZE = 10 * 1024 * 1024 // 10MB chunks
const MAX_CONCURRENT_PARTS = 2 // Upload 2 parts in parallel (reduced for stability)
const MAX_PART_RETRIES = 3 // Retry failed parts up to 3 times
const PART_UPLOAD_TIMEOUT = 60000 // 60 second timeout per part

export async function uploadToR2({ key, body, contentType, useMultipart }: R2UploadParams): Promise<UploadResult> {
	const config = getR2Config()
	if (!config) {
		return { success: false, error: "Cloudflare R2 is not configured" }
	}

	// Auto-enable multipart for files > threshold
	const shouldUseMultipart = useMultipart ?? body.length > MULTIPART_THRESHOLD

	if (shouldUseMultipart && body.length > PART_SIZE) {
		consola.log(`Using multipart upload for ${(body.length / 1024 / 1024).toFixed(2)}MB file`)
		return uploadToR2Multipart({ key, body, contentType, config })
	}

	// Fall back to single PUT for small files
	return uploadToR2Single({ key, body, contentType, config })
}

async function uploadToR2Single({
	key,
	body,
	contentType,
	config,
}: {
	key: string
	body: Uint8Array
	contentType?: string
	config: R2Config
}): Promise<UploadResult> {
	// Timeout for single uploads (2 minutes for files up to 100MB)
	const SINGLE_UPLOAD_TIMEOUT = 120000

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), SINGLE_UPLOAD_TIMEOUT)

	try {
		const { endpoint, accessKeyId, secretAccessKey, bucket, region } = config
		const encodedKey = encodeKey(key)
		const requestPath = `/${bucket}/${encodedKey}`
		const url = `${endpoint}/${bucket}/${encodedKey}`
		const host = new URL(endpoint).host

		const now = new Date()
		const amzDate = toAmzDate(now)
		const dateStamp = amzDate.slice(0, 8)

		const payloadHash = hashHex(body)

		const headers: Record<string, string> = {
			host,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
		}

		if (contentType) {
			headers["content-type"] = contentType
		}

		const canonicalHeaders = buildCanonicalHeaders(headers)
		const signedHeaders = Object.keys(headers)
			.map((name) => name.toLowerCase())
			.sort()
			.join(";")

		const canonicalRequest = ["PUT", requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
		const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
		const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

		const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
		const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

		headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: Buffer.from(body),
			signal: controller.signal,
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			const errorText = await safeRead(response)
			consola.error("R2 upload failed", response.status, response.statusText, errorText ? errorText.slice(0, 200) : "")
			return {
				success: false,
				error: `R2 upload failed with status ${response.status}`,
			}
		}

		return { success: true }
	} catch (error) {
		clearTimeout(timeoutId)

		if (error instanceof Error && error.name === "AbortError") {
			consola.error(
				`R2 upload timed out after ${SINGLE_UPLOAD_TIMEOUT}ms (${(body.length / 1024 / 1024).toFixed(2)}MB)`
			)
			return {
				success: false,
				error: `Upload timed out after ${SINGLE_UPLOAD_TIMEOUT / 1000}s`,
			}
		}

		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Unexpected error uploading to R2:", error)
		return { success: false, error: message }
	}
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<UploadResult> {
	const config = getR2Config()
	if (!config) {
		return { success: false, error: "Cloudflare R2 is not configured" }
	}

	try {
		const { endpoint, accessKeyId, secretAccessKey, bucket, region } = config
		const encodedKey = encodeKey(key)
		const requestPath = `/${bucket}/${encodedKey}`
		const url = `${endpoint}/${bucket}/${encodedKey}`
		const host = new URL(endpoint).host

		const now = new Date()
		const amzDate = toAmzDate(now)
		const dateStamp = amzDate.slice(0, 8)

		// Empty payload for DELETE
		const payloadHash = hashHex("")

		const headers: Record<string, string> = {
			host,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
		}

		const canonicalHeaders = buildCanonicalHeaders(headers)
		const signedHeaders = Object.keys(headers)
			.map((name) => name.toLowerCase())
			.sort()
			.join(";")

		const canonicalRequest = ["DELETE", requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
		const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
		const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

		const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
		const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

		headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

		const response = await fetch(url, {
			method: "DELETE",
			headers,
		})

		// S3/R2 returns 204 No Content on successful delete
		if (!response.ok && response.status !== 204) {
			const errorText = await safeRead(response)
			consola.error("R2 delete failed", response.status, response.statusText, errorText ? errorText.slice(0, 200) : "")
			return {
				success: false,
				error: `R2 delete failed with status ${response.status}`,
			}
		}

		consola.info("R2 file deleted", { key })
		return { success: true }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Unexpected error deleting from R2:", error)
		return { success: false, error: message }
	}
}

async function uploadToR2Multipart({
	key,
	body,
	contentType,
	config,
}: {
	key: string
	body: Uint8Array
	contentType?: string
	config: R2Config
}): Promise<UploadResult> {
	try {
		// Step 1: Initiate multipart upload
		const uploadId = await initiateMultipartUpload({
			key,
			contentType,
			config,
		})
		if (!uploadId) {
			return { success: false, error: "Failed to initiate multipart upload" }
		}

		consola.log(`Initiated multipart upload: ${uploadId}`)

		// Step 2: Split file into parts and upload
		const numParts = Math.ceil(body.length / PART_SIZE)
		const parts: Array<{ PartNumber: number; ETag: string }> = []

		consola.log(`Uploading ${numParts} parts (${PART_SIZE / 1024 / 1024}MB each)`)

		// Upload parts in batches to control concurrency
		for (let i = 0; i < numParts; i += MAX_CONCURRENT_PARTS) {
			const batch = []
			for (let j = 0; j < MAX_CONCURRENT_PARTS && i + j < numParts; j++) {
				const partNumber = i + j + 1
				const start = (i + j) * PART_SIZE
				const end = Math.min(start + PART_SIZE, body.length)
				const partBody = body.slice(start, end)

				batch.push(
					uploadPart({
						key,
						uploadId,
						partNumber,
						body: partBody,
						config,
					})
				)
			}

			const batchResults = await Promise.all(batch)
			for (const result of batchResults) {
				if (!result) {
					// Abort multipart upload on failure
					await abortMultipartUpload({ key, uploadId, config })
					return { success: false, error: "Failed to upload part" }
				}
				parts.push(result)
			}

			consola.log(`Uploaded ${parts.length}/${numParts} parts`)
		}

		// Step 3: Complete multipart upload
		const complete = await completeMultipartUpload({
			key,
			uploadId,
			parts,
			config,
		})

		if (!complete) {
			await abortMultipartUpload({ key, uploadId, config })
			return { success: false, error: "Failed to complete multipart upload" }
		}

		consola.log(`✅ Multipart upload complete: ${key}`)
		return { success: true }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Multipart upload failed:", error)
		return { success: false, error: message }
	}
}

async function initiateMultipartUpload({
	key,
	contentType,
	config,
}: {
	key: string
	contentType?: string
	config: R2Config
}): Promise<string | null> {
	const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
	const encodedKey = encodeKey(key)
	const requestPath = `/${bucket}/${encodedKey}`
	const url = `${endpoint}/${bucket}/${encodedKey}?uploads`
	const host = new URL(endpoint).host

	const now = new Date()
	const amzDate = toAmzDate(now)
	const dateStamp = amzDate.slice(0, 8)

	const headers: Record<string, string> = {
		host,
		"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
		"x-amz-date": amzDate,
	}

	if (contentType) {
		headers["content-type"] = contentType
	}

	const canonicalHeaders = buildCanonicalHeaders(headers)
	const signedHeaders = Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort()
		.join(";")

	const canonicalRequest = ["POST", requestPath, "uploads=", canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join(
		"\n"
	)
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

	headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
		})

		if (!response.ok) {
			const errorText = await safeRead(response)
			consola.error("Failed to initiate multipart upload", response.status, errorText?.slice(0, 200))
			return null
		}

		const text = await response.text()
		const uploadIdMatch = text.match(/<UploadId>([^<]+)<\/UploadId>/)
		return uploadIdMatch?.[1] ?? null
	} catch (error) {
		consola.error("Error initiating multipart upload:", error)
		return null
	}
}

async function uploadPart({
	key,
	uploadId,
	partNumber,
	body,
	config,
}: {
	key: string
	uploadId: string
	partNumber: number
	body: Uint8Array
	config: R2Config
}): Promise<{ PartNumber: number; ETag: string } | null> {
	// Retry logic with exponential backoff
	for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
		try {
			const result = await uploadPartAttempt({
				key,
				uploadId,
				partNumber,
				body,
				config,
			})
			if (result) {
				if (attempt > 1) {
					consola.log(`Part ${partNumber} succeeded on attempt ${attempt}`)
				}
				return result
			}
		} catch (error) {
			const isLastAttempt = attempt === MAX_PART_RETRIES
			consola.error(`Part ${partNumber} attempt ${attempt}/${MAX_PART_RETRIES} failed:`, error)

			if (!isLastAttempt) {
				// Exponential backoff: 1s, 2s, 4s
				const backoffMs = 2 ** (attempt - 1) * 1000
				consola.log(`Retrying part ${partNumber} in ${backoffMs}ms...`)
				await new Promise((resolve) => setTimeout(resolve, backoffMs))
			}
		}
	}

	consola.error(`Part ${partNumber} failed after ${MAX_PART_RETRIES} attempts`)
	return null
}

async function uploadPartAttempt({
	key,
	uploadId,
	partNumber,
	body,
	config,
}: {
	key: string
	uploadId: string
	partNumber: number
	body: Uint8Array
	config: R2Config
}): Promise<{ PartNumber: number; ETag: string } | null> {
	const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
	const encodedKey = encodeKey(key)
	const requestPath = `/${bucket}/${encodedKey}`
	const queryString = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`
	const url = `${endpoint}/${bucket}/${encodedKey}?${queryString}`
	const host = new URL(endpoint).host

	const now = new Date()
	const amzDate = toAmzDate(now)
	const dateStamp = amzDate.slice(0, 8)

	const payloadHash = hashHex(body)

	const headers: Record<string, string> = {
		host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date": amzDate,
	}

	const canonicalHeaders = buildCanonicalHeaders(headers)
	const signedHeaders = Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort()
		.join(";")

	const canonicalRequest = ["PUT", requestPath, queryString, canonicalHeaders, signedHeaders, payloadHash].join("\n")
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

	headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

	// Add timeout to detect stalled connections
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), PART_UPLOAD_TIMEOUT)

	try {
		const response = await fetch(url, {
			method: "PUT",
			headers,
			body: Buffer.from(body),
			signal: controller.signal,
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			const errorText = await safeRead(response)
			consola.error(`Part ${partNumber} upload failed`, response.status, errorText?.slice(0, 200))
			return null
		}

		const etag = response.headers.get("etag")
		if (!etag) {
			consola.error(`Part ${partNumber} missing ETag`)
			return null
		}

		return { PartNumber: partNumber, ETag: etag }
	} catch (error) {
		clearTimeout(timeoutId)

		if (error instanceof Error && error.name === "AbortError") {
			consola.error(`Part ${partNumber} timed out after ${PART_UPLOAD_TIMEOUT}ms`)
		}
		throw error
	}
}

async function completeMultipartUpload({
	key,
	uploadId,
	parts,
	config,
}: {
	key: string
	uploadId: string
	parts: Array<{ PartNumber: number; ETag: string }>
	config: R2Config
}): Promise<boolean> {
	const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
	const encodedKey = encodeKey(key)
	const requestPath = `/${bucket}/${encodedKey}`
	const queryString = `uploadId=${encodeURIComponent(uploadId)}`
	const url = `${endpoint}/${bucket}/${encodedKey}?${queryString}`
	const host = new URL(endpoint).host

	// Build XML body
	const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber)
	const xmlParts = sortedParts
		.map((p) => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
		.join("")
	const xmlBody = `<CompleteMultipartUpload>${xmlParts}</CompleteMultipartUpload>`

	const now = new Date()
	const amzDate = toAmzDate(now)
	const dateStamp = amzDate.slice(0, 8)

	const payloadHash = hashHex(xmlBody)

	const headers: Record<string, string> = {
		host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date": amzDate,
		"content-type": "application/xml",
	}

	const canonicalHeaders = buildCanonicalHeaders(headers)
	const signedHeaders = Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort()
		.join(";")

	const canonicalRequest = ["POST", requestPath, queryString, canonicalHeaders, signedHeaders, payloadHash].join("\n")
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

	headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: xmlBody,
		})

		if (!response.ok) {
			const errorText = await safeRead(response)
			consola.error("Failed to complete multipart upload", response.status, errorText?.slice(0, 200))
			return false
		}

		return true
	} catch (error) {
		consola.error("Error completing multipart upload:", error)
		return false
	}
}

async function abortMultipartUpload({
	key,
	uploadId,
	config,
}: {
	key: string
	uploadId: string
	config: R2Config
}): Promise<void> {
	const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
	const encodedKey = encodeKey(key)
	const requestPath = `/${bucket}/${encodedKey}`
	const queryString = `uploadId=${encodeURIComponent(uploadId)}`
	const url = `${endpoint}/${bucket}/${encodedKey}?${queryString}`
	const host = new URL(endpoint).host

	const now = new Date()
	const amzDate = toAmzDate(now)
	const dateStamp = amzDate.slice(0, 8)

	const headers: Record<string, string> = {
		host,
		"x-amz-content-sha256": "UNSIGNED-PAYLOAD",
		"x-amz-date": amzDate,
	}

	const canonicalHeaders = buildCanonicalHeaders(headers)
	const signedHeaders = Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort()
		.join(";")

	const canonicalRequest = [
		"DELETE",
		requestPath,
		queryString,
		canonicalHeaders,
		signedHeaders,
		"UNSIGNED-PAYLOAD",
	].join("\n")
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

	headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

	try {
		await fetch(url, {
			method: "DELETE",
			headers,
		})
		consola.log(`Aborted multipart upload: ${uploadId}`)
	} catch (error) {
		consola.error("Error aborting multipart upload:", error)
	}
}

export function createR2PresignedUrl(options: R2PresignOptions): R2PresignResult | null {
	const config = getR2Config()
	if (!config) return null

	const { key, expiresInSeconds = 900, responseContentType, responseContentDisposition } = options
	const expires = clamp(Math.floor(expiresInSeconds), 1, 60 * 60 * 24 * 7) // 1 second to 7 days

	try {
		const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
		const encodedKey = encodeKey(key)
		const requestPath = `/${bucket}/${encodedKey}`
		const urlBase = `${endpoint}/${bucket}/${encodedKey}`
		const host = new URL(endpoint).host

		const now = new Date()
		const amzDate = toAmzDate(now)
		const dateStamp = amzDate.slice(0, 8)
		const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

		const queryParams: Array<[string, string]> = [
			["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
			["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
			["X-Amz-Date", amzDate],
			["X-Amz-Expires", String(expires)],
			["X-Amz-SignedHeaders", "host"],
		]

		if (responseContentType) {
			queryParams.push(["response-content-type", responseContentType])
		}

		if (responseContentDisposition) {
			queryParams.push(["response-content-disposition", responseContentDisposition])
		}

		const canonicalQuery = buildCanonicalQuery(queryParams)
		const canonicalHeaders = `host:${host}\n`
		const signedHeaders = "host"
		const payloadHash = "UNSIGNED-PAYLOAD"

		const canonicalRequest = ["GET", requestPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join(
			"\n"
		)
		const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
		const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
		const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

		const signedQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`
		const url = `${urlBase}?${signedQuery}`
		const expiresAt = now.getTime() + expires * 1000

		return { url, expiresAt }
	} catch (error) {
		consola.error("Failed to generate R2 presigned URL:", error)
		return null
	}
}

/**
 * Convenience wrapper for createR2PresignedUrl with simpler signature
 * Returns just the URL string (or null) for read access
 */
export function createR2PresignedReadUrl(key: string, expiresInSeconds = 900): string | null {
	const result = createR2PresignedUrl({ key, expiresInSeconds })
	return result?.url ?? null
}

/**
 * Create a presigned URL for uploading (PUT) to R2
 * Client can upload directly to R2 without going through the server
 */
export interface R2PresignedUploadOptions {
	key: string
	contentType?: string
	expiresInSeconds?: number
}

export interface R2PresignedUploadResult {
	uploadUrl: string
	key: string
	expiresAt: number
}

export function createR2PresignedUploadUrl(options: R2PresignedUploadOptions): R2PresignedUploadResult | null {
	const config = getR2Config()
	if (!config) return null

	const { key, contentType, expiresInSeconds = 3600 } = options // Default 1 hour for uploads
	const expires = clamp(Math.floor(expiresInSeconds), 1, 60 * 60 * 24 * 7) // 1 second to 7 days

	try {
		const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
		const encodedKey = encodeKey(key)
		const requestPath = `/${bucket}/${encodedKey}`
		const urlBase = `${endpoint}/${bucket}/${encodedKey}`
		const host = new URL(endpoint).host

		const now = new Date()
		const amzDate = toAmzDate(now)
		const dateStamp = amzDate.slice(0, 8)
		const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

		// For PUT, we need to include content-type in signed headers if provided
		const signedHeadersList = contentType ? ["content-type", "host"] : ["host"]
		const signedHeaders = signedHeadersList.sort().join(";")

		const queryParams: Array<[string, string]> = [
			["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
			["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
			["X-Amz-Date", amzDate],
			["X-Amz-Expires", String(expires)],
			["X-Amz-SignedHeaders", signedHeaders],
		]

		const canonicalQuery = buildCanonicalQuery(queryParams)

		// Build canonical headers - must be sorted alphabetically
		let canonicalHeaders = ""
		if (contentType) {
			canonicalHeaders += `content-type:${contentType}\n`
		}
		canonicalHeaders += `host:${host}\n`

		const payloadHash = "UNSIGNED-PAYLOAD"

		const canonicalRequest = ["PUT", requestPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join(
			"\n"
		)
		const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
		const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
		const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

		const signedQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`
		const uploadUrl = `${urlBase}?${signedQuery}`
		const expiresAt = now.getTime() + expires * 1000

		return { uploadUrl, key, expiresAt }
	} catch (error) {
		consola.error("Failed to generate R2 presigned upload URL:", error)
		return null
	}
}

/**
 * Create presigned URLs for multipart upload (for files > 100MB)
 * Returns uploadId and presigned URLs for each part
 */
export interface R2MultipartUploadOptions {
	key: string
	contentType?: string
	totalParts: number
	expiresInSeconds?: number
}

export interface R2MultipartUploadResult {
	uploadId: string
	key: string
	partUrls: Record<number, string>
	completeUrl: string
	abortUrl: string
	expiresAt: number
}

export async function createR2MultipartUpload(
	options: R2MultipartUploadOptions
): Promise<R2MultipartUploadResult | null> {
	const config = getR2Config()
	if (!config) return null

	const { key, contentType, totalParts, expiresInSeconds = 3600 } = options
	const expires = clamp(Math.floor(expiresInSeconds), 1, 60 * 60 * 24 * 7)

	try {
		// Step 1: Initiate multipart upload to get uploadId
		const uploadId = await initiateMultipartUpload({
			key,
			contentType,
			config,
		})
		if (!uploadId) {
			consola.error("Failed to initiate multipart upload for presigned URLs")
			return null
		}

		const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
		const encodedKey = encodeKey(key)
		const host = new URL(endpoint).host
		const now = new Date()
		const expiresAt = now.getTime() + expires * 1000

		// Step 2: Generate presigned URLs for each part
		const partUrls: Record<number, string> = {}

		for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
			const amzDate = toAmzDate(now)
			const dateStamp = amzDate.slice(0, 8)
			const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
			const requestPath = `/${bucket}/${encodedKey}`

			const queryParams: Array<[string, string]> = [
				["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
				["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
				["X-Amz-Date", amzDate],
				["X-Amz-Expires", String(expires)],
				["X-Amz-SignedHeaders", "host"],
				["partNumber", String(partNumber)],
				["uploadId", uploadId],
			]

			const canonicalQuery = buildCanonicalQuery(queryParams)
			const canonicalHeaders = `host:${host}\n`
			const signedHeaders = "host"
			const payloadHash = "UNSIGNED-PAYLOAD"

			const canonicalRequest = ["PUT", requestPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join(
				"\n"
			)
			const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
			const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "s3")
			const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

			const signedQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`
			partUrls[partNumber] = `${endpoint}/${bucket}/${encodedKey}?${signedQuery}`
		}

		// Step 3: Generate complete and abort URLs (these will be called by server, not presigned)
		const completeUrl = `${endpoint}/${bucket}/${encodedKey}?uploadId=${encodeURIComponent(uploadId)}`
		const abortUrl = completeUrl

		return {
			uploadId,
			key,
			partUrls,
			completeUrl,
			abortUrl,
			expiresAt,
		}
	} catch (error) {
		consola.error("Failed to create multipart upload:", error)
		return null
	}
}

/**
 * Complete a multipart upload from the server
 * Called after client has uploaded all parts directly to R2
 */
export interface CompleteMultipartParams {
	key: string
	uploadId: string
	parts: Array<{ partNumber: number; etag: string }>
}

export async function completeMultipartUploadServer(
	params: CompleteMultipartParams
): Promise<{ success: true } | { success: false; error?: string }> {
	const config = getR2Config()
	if (!config) {
		return { success: false, error: "R2 not configured" }
	}

	const { key, uploadId, parts } = params

	// Transform parts to expected format
	const formattedParts = parts.map((p) => ({
		PartNumber: p.partNumber,
		ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
	}))

	const success = await completeMultipartUpload({
		key,
		uploadId,
		parts: formattedParts,
		config,
	})

	if (!success) {
		return { success: false, error: "Failed to complete multipart upload" }
	}

	consola.info("Multipart upload completed via server", { key, uploadId })
	return { success: true }
}

/**
 * Abort a multipart upload from the server
 */
export async function abortMultipartUploadServer(params: { key: string; uploadId: string }): Promise<void> {
	const config = getR2Config()
	if (!config) return

	await abortMultipartUpload({
		key: params.key,
		uploadId: params.uploadId,
		config,
	})
}

// Validate if a presigned R2 URL is still valid and accessible
export async function validateR2PresignedUrl(url: string): Promise<boolean> {
	try {
		// Extract query parameters to check expiry
		const urlObj = new URL(url)
		const expiresParam = urlObj.searchParams.get("X-Amz-Expires")
		const dateParam = urlObj.searchParams.get("X-Amz-Date")

		if (!expiresParam || !dateParam) {
			consola.warn("Presigned URL missing required parameters")
			return false
		}

		// Parse the AMZ date (format: YYYYMMDDTHHMMSSZ)
		const amzDate = dateParam
		const year = Number.parseInt(amzDate.slice(0, 4), 10)
		const month = Number.parseInt(amzDate.slice(4, 6), 10) - 1 // JS months are 0-based
		const day = Number.parseInt(amzDate.slice(6, 8), 10)
		const hour = Number.parseInt(amzDate.slice(9, 11), 10)
		const minute = Number.parseInt(amzDate.slice(11, 13), 10)
		const second = Number.parseInt(amzDate.slice(13, 15), 10)

		const signedAt = new Date(Date.UTC(year, month, day, hour, minute, second))
		const expiresIn = Number.parseInt(expiresParam, 10)
		const expiresAt = new Date(signedAt.getTime() + expiresIn * 1000)
		const now = new Date()

		// Check if expired (with 5-minute buffer for safety)
		const bufferMs = 5 * 60 * 1000
		if (expiresAt.getTime() - bufferMs < now.getTime()) {
			consola.warn("Presigned URL expired or expiring soon", {
				expiresAt: expiresAt.toISOString(),
				now: now.toISOString(),
				bufferMinutes: 5,
			})
			return false
		}

		// Try a HEAD request to verify the URL is accessible
		const response = await fetch(url, { method: "HEAD" })
		if (!response.ok) {
			consola.warn("Presigned URL validation failed with status:", response.status)
			return false
		}

		return true
	} catch (error) {
		consola.error("Error validating presigned URL:", error)
		return false
	}
}

// Extract R2 key from a presigned URL
export function extractR2KeyFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url)
		// Remove the endpoint and bucket from the path
		const config = getR2Config()
		if (!config) return null

		const pathWithoutBucket = urlObj.pathname.replace(`/${config.bucket}/`, "")
		return decodeURIComponent(pathWithoutBucket)
	} catch (error) {
		consola.error("Error extracting R2 key from URL:", error)
		return null
	}
}

function getR2Config(): R2Config | null {
	if (cachedConfig) return cachedConfig
	if (attemptedLoad) return null
	attemptedLoad = true

	const accountId = readEnv("R2_ACCOUNT_ID")
	const accessKeyId = readEnv("R2_ACCESS_KEY_ID")
	const secretAccessKey = readEnv("R2_SECRET_ACCESS_KEY")
	const bucket = readEnv("R2_BUCKET_NAME")
	const publicBaseUrl = readEnv("R2_PUBLIC_BASE_URL")
	const endpoint = (
		readEnv("R2_ENDPOINT") || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null)
	)?.replace(/\/$/, "")
	const region = readEnv("R2_REGION") || "auto"

	if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl || !endpoint) {
		consola.warn("Cloudflare R2 configuration is incomplete; uploads are disabled")
		return null
	}

	cachedConfig = {
		accountId,
		accessKeyId,
		secretAccessKey,
		bucket,
		publicBaseUrl,
		endpoint,
		region,
	}
	return cachedConfig
}

function readEnv(key: string): string | null {
	const value = process.env[key]
	if (!value || value.trim() === "") return null
	return value.trim()
}

function encodeKey(key: string): string {
	return key
		.split("/")
		.map((segment) =>
			encodeURIComponent(segment)
				.replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
				.replace(/%2F/g, "/")
		)
		.join("/")
}

function toAmzDate(date: Date): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

function hashHex(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex")
}

function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
	const kDate = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest()
	const kRegion = createHmac("sha256", kDate).update(region).digest()
	const kService = createHmac("sha256", kRegion).update(service).digest()
	return createHmac("sha256", kService).update("aws4_request").digest()
}

function buildCanonicalHeaders(headers: Record<string, string>): string {
	return Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort()
		.map((name) => `${name}:${headers[name]}`)
		.join("\n")
		.concat("\n")
}

function buildCanonicalQuery(params: Array<[string, string]>): string {
	return params
		.map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, value]) => `${key}=${value}`)
		.join("&")
}

async function safeRead(response: Response): Promise<string | null> {
	try {
		return await response.text()
	} catch {
		return null
	}
}

function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}
