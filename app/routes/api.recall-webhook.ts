import * as crypto from "node:crypto"
import type { ActionFunctionArgs } from "react-router"
import { getServerEnv } from "~/env.server"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

const { RECALL_WEBHOOK_SECRET } = getServerEnv()

interface RecallWebhookPayload {
	event: string
	data: {
		id: string
		metadata?: {
			account_id?: string
			project_id?: string
			user_id?: string
		}
		media_shortcuts?: {
			video_mixed?: {
				status: { code: string }
				data?: { download_url: string }
			}
			transcript?: {
				status: { code: string }
				data?: { download_url: string }
			}
		}
		meeting?: {
			platform?: string
			title?: string
			start_time?: string
			end_time?: string
			participants?: Array<{
				id: number
				name: string
				email?: string
			}>
		}
	}
}

/**
 * Verify Svix webhook signature (used by Recall.ai)
 * Format: svix-signature: v1,{base64_signature}
 * Signed payload: "{svix-id}.{svix-timestamp}.{body}"
 */
function verifySvixSignature(
	payload: string,
	svixId: string | null,
	svixTimestamp: string | null,
	svixSignature: string | null,
	secret: string
): boolean {
	if (!svixId || !svixTimestamp || !svixSignature) return false

	// Extract the base64 signature (format: "v1,{signature}" or "v1,{sig1} v1,{sig2}")
	const signatures = svixSignature.split(" ").map((s) => s.replace("v1,", ""))
	if (signatures.length === 0) return false

	// The secret may have a "whsec_" prefix that needs to be removed and base64 decoded
	let secretBytes: Buffer
	if (secret.startsWith("whsec_")) {
		secretBytes = Buffer.from(secret.slice(6), "base64")
	} else {
		secretBytes = Buffer.from(secret, "base64")
	}

	// Compute expected signature: HMAC-SHA256("{svix-id}.{svix-timestamp}.{payload}")
	const signedPayload = `${svixId}.${svixTimestamp}.${payload}`
	const expectedSignature = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64")

	// Debug: Log signature comparison details
	console.log("Svix signature verification debug:", {
		signedPayloadPreview: signedPayload.substring(0, 100) + "...",
		expectedSignature,
		receivedSignatures: signatures,
		secretBytesLength: secretBytes.length,
	})

	// Check if any of the provided signatures match
	for (const sig of signatures) {
		try {
			if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(sig))) {
				return true
			}
		} catch {}
	}

	return false
}

/**
 * POST /api/recall-webhook
 * Receives webhook events from Recall.ai after recording upload completes.
 * This endpoint is public but verified via webhook signature.
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	// Get Svix headers (used by Recall.ai)
	const svixId = request.headers.get("svix-id")
	const svixTimestamp = request.headers.get("svix-timestamp")
	const svixSignature = request.headers.get("svix-signature")
	const payload = await request.text()

	// Verify webhook signature
	if (RECALL_WEBHOOK_SECRET) {
		const isValid = verifySvixSignature(payload, svixId, svixTimestamp, svixSignature, RECALL_WEBHOOK_SECRET)
		if (!isValid) {
			// Debug: Log more details to diagnose signature mismatch
			const secretPrefix = RECALL_WEBHOOK_SECRET.substring(0, 10)
			const secretLength = RECALL_WEBHOOK_SECRET.length
			console.error("Invalid Recall webhook signature", {
				svixId,
				svixTimestamp,
				hasSignature: !!svixSignature,
				signaturePreview: svixSignature?.substring(0, 30),
				secretPrefix: `${secretPrefix}...`,
				secretLength,
				hasWhsecPrefix: RECALL_WEBHOOK_SECRET.startsWith("whsec_"),
			})
			return Response.json({ error: "Invalid signature" }, { status: 401 })
		}
	}

	let webhook: RecallWebhookPayload
	try {
		webhook = JSON.parse(payload)
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 })
	}

	console.log(`Recall webhook received: ${webhook.event}`, webhook.data?.id)

	// Handle sdk_upload.complete event
	if (webhook.event === "sdk_upload.complete") {
		const { id: recordingId, metadata, media_shortcuts, meeting } = webhook.data
		const { account_id, project_id, user_id } = metadata || {}

		if (!account_id || !project_id) {
			console.error("Missing account_id or project_id in webhook metadata")
			return Response.json({ error: "Missing required metadata" }, { status: 400 })
		}

		const supabase = createSupabaseAdminClient()

		// Check for duplicate (idempotency)
		// Note: recall_recording_id column will be added by pending migration
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: existing } = await (supabase as any)
			.from("interviews")
			.select("id")
			.eq("recall_recording_id", recordingId)
			.maybeSingle()

		if (existing) {
			const existingId = (existing as unknown as { id: string }).id
			console.log(`Duplicate webhook for recording ${recordingId}, interview ${existingId}`)
			return Response.json({ received: true, interview_id: existingId })
		}

		// Get video and transcript URLs (allow minor payload shape variations)
		const videoUrl =
			media_shortcuts?.video_mixed?.data?.download_url ??
			media_shortcuts?.video_mixed?.data?.url ??
			media_shortcuts?.video_mixed?.download_url ??
			null
		const transcriptUrl =
			media_shortcuts?.transcript?.data?.download_url ??
			media_shortcuts?.transcript?.data?.url ??
			media_shortcuts?.transcript?.download_url ??
			(webhook.data as { transcript?: { download_url?: string } })?.transcript?.download_url ??
			null

		if (!transcriptUrl) {
			console.warn("Recall webhook missing transcript URL", {
				recordingId,
				event: webhook.event,
				media_shortcuts: media_shortcuts?.transcript?.status?.code,
			})
		}

		// Create interview record
		// Note: Some columns will be added by pending migration - using type assertion
		const insertData = {
			account_id,
			project_id,
			created_by: user_id || null,
			recall_recording_id: recordingId,
			title: meeting?.title || "Recorded Meeting",
			status: "processing",
			source_type: "recall",
			meeting_platform: meeting?.platform || null,
			// Store URLs temporarily - will be moved to R2 by Trigger task
			media_url: videoUrl || null,
			transcript_url: transcriptUrl || null,
		} as Record<string, unknown>

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: interviewData, error: createError } = await (supabase as any)
			.from("interviews")
			.insert(insertData)
			.select("id")
			.single()

		if (createError || !interviewData) {
			console.error("Failed to create interview:", createError)
			return Response.json({ error: "Failed to create interview" }, { status: 500 })
		}

		const interviewId = (interviewData as unknown as { id: string }).id
		console.log(`Created interview ${interviewId} for recording ${recordingId}`)

		// Trigger background processing task
		try {
			const { processRecallMeetingTask } = await import("~/../src/trigger/interview/processRecallMeeting")
			await processRecallMeetingTask.trigger({
				interviewId,
				recordingId,
				accountId: account_id,
				projectId: project_id,
				videoUrl: videoUrl ?? null,
				transcriptUrl: transcriptUrl ?? null,
			})
			console.log(`Triggered processRecallMeetingTask for interview ${interviewId}`)
		} catch (triggerError) {
			console.error("Failed to trigger processing task:", triggerError)
			// Don't fail the webhook - the interview is created
		}

		return Response.json({ received: true, interview_id: interviewId })
	}

	// Acknowledge other events
	return Response.json({ received: true })
}
