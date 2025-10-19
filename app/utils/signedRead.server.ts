import { createHmac } from "node:crypto"

function invariant(value: string | undefined, name: string): asserts value is string {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`)
	}
}

function toBase64Url(buffer: Buffer) {
	return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "")
}

export function hmacB64url(secret: string, message: string) {
	return toBase64Url(createHmac("sha256", secret).update(message).digest())
}

export function makeReadUrl(key: string, ttlSec = 900) {
	const { FILE_GATEWAY_URL, SHARED_SIGNING_SECRET } = process.env
	invariant(FILE_GATEWAY_URL, "FILE_GATEWAY_URL")
	invariant(SHARED_SIGNING_SECRET, "SHARED_SIGNING_SECRET")

	const expiresAt = Math.floor(Date.now() / 1000) + ttlSec
	const payload = `${key}.${expiresAt}`
	const signature = hmacB64url(SHARED_SIGNING_SECRET, payload)
	const base = FILE_GATEWAY_URL.replace(/\/$/u, "")
	return `${base}/r/${encodeURIComponent(key)}?exp=${expiresAt}&sig=${signature}`
}
