import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server"

type MediaIntent = "playback" | "download"

interface PresignRequestBody {
	mediaUrl?: string
	key?: string
	expiresInSeconds?: number
	intent?: MediaIntent
	contentType?: string
	filename?: string
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const user = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	let body: PresignRequestBody
	try {
		body = (await request.json()) as PresignRequestBody
	} catch (error) {
		consola.warn("Invalid JSON in media presign request", error)
		return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
	}

	const intent: MediaIntent = body.intent === "download" ? "download" : "playback"
	let key = typeof body.key === "string" && body.key.trim().length ? body.key.trim() : null

	if (!key && typeof body.mediaUrl === "string" && body.mediaUrl.trim().length) {
		key = getR2KeyFromPublicUrl(body.mediaUrl.trim())
	}

	if (!key) {
		return Response.json({ error: "Unable to resolve media key" }, { status: 400 })
	}

	const expiresInSeconds =
		typeof body.expiresInSeconds === "number" && Number.isFinite(body.expiresInSeconds)
			? body.expiresInSeconds
			: intent === "download"
				? 120
				: 900

	const responseContentDisposition =
		intent === "download" ? buildContentDisposition(sanitizeFilename(body.filename ?? key)) : "inline"

	const presigned = createR2PresignedUrl({
		key,
		expiresInSeconds,
		responseContentType: body.contentType,
		responseContentDisposition,
	})

	if (!presigned) {
		consola.error("Cloudflare R2 signing failed", { key, intent })
		return Response.json({ error: "Cloudflare R2 signing is not available" }, { status: 500 })
	}

	return Response.json(
		{
			signedUrl: presigned.url,
			expiresAt: presigned.expiresAt,
			key,
			intent,
		},
		{
			headers: {
				"Cache-Control": "no-store",
			},
		}
	)
}

function sanitizeFilename(filename: string): string {
	const trimmed = filename.trim()
	const base = trimmed.split("/").pop()?.split("\\").pop() || trimmed
	const cleaned = base.replace(/[^\w.\-() ]+/g, "_").replace(/_{2,}/g, "_")
	const normalized = cleaned.replace(/^_+|_+$/g, "")
	return normalized.length ? normalized.slice(0, 120) : "download"
}

function buildContentDisposition(filename: string): string {
	const safe = filename.replace(/["]/g, "")
	return `attachment; filename="${safe}"`
}
