import { Buffer } from "node:buffer"
import { createHash, createHmac } from "node:crypto"
import consola from "consola"

type UploadResult = { success: true } | { success: false; error?: string }

interface R2UploadParams {
	key: string
	body: Uint8Array
	contentType?: string
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

export function getR2PublicUrl(key: string): string | null {
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

		const remainder = withoutQuery.slice(normalizedBase.length).replace(/^\/+/, "")
		return remainder ? decodeURIComponent(remainder) : null
	} catch {
		return null
	}
}

export async function uploadToR2({ key, body, contentType }: R2UploadParams): Promise<UploadResult> {
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
		})

		if (!response.ok) {
			const errorText = await safeRead(response)
			consola.error("R2 upload failed", response.status, response.statusText, errorText ? errorText.slice(0, 200) : "")
			return { success: false, error: `R2 upload failed with status ${response.status}` }
		}

		return { success: true }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Unexpected error uploading to R2:", error)
		return { success: false, error: message }
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
