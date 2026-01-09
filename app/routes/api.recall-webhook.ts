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

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
	if (!signature) return false

	const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex")

	try {
		return crypto.timingSafeEqual(Buffer.from(`sha256=${expectedSignature}`), Buffer.from(signature))
	} catch {
		return false
	}
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

	const signature = request.headers.get("X-Recall-Signature")
	const payload = await request.text()

	// Verify webhook signature
	if (RECALL_WEBHOOK_SECRET && !verifyWebhookSignature(payload, signature, RECALL_WEBHOOK_SECRET)) {
		console.error("Invalid Recall webhook signature")
		return Response.json({ error: "Invalid signature" }, { status: 401 })
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
		const { data: existing } = await supabase
			.from("interviews")
			.select("id")
			.eq("recall_recording_id", recordingId)
			.maybeSingle()

		if (existing) {
			console.log(`Duplicate webhook for recording ${recordingId}, interview ${existing.id}`)
			return Response.json({ received: true, interview_id: existing.id })
		}

		// Get video and transcript URLs
		const videoUrl = media_shortcuts?.video_mixed?.data?.download_url
		const transcriptUrl = media_shortcuts?.transcript?.data?.download_url

		// Create interview record
		const { data: interview, error: createError } = await supabase
			.from("interviews")
			.insert({
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
			})
			.select("id")
			.single()

		if (createError) {
			console.error("Failed to create interview:", createError)
			return Response.json({ error: "Failed to create interview" }, { status: 500 })
		}

		console.log(`Created interview ${interview.id} for recording ${recordingId}`)

		// Trigger background processing task
		try {
			const { processRecallMeetingTask } = await import("~/../src/trigger/interview/processRecallMeeting")
			await processRecallMeetingTask.trigger({
				interviewId: interview.id,
				recordingId,
				accountId: account_id,
				projectId: project_id,
				videoUrl,
				transcriptUrl,
			})
			console.log(`Triggered processRecallMeetingTask for interview ${interview.id}`)
		} catch (triggerError) {
			console.error("Failed to trigger processing task:", triggerError)
			// Don't fail the webhook - the interview is created
		}

		return Response.json({ received: true, interview_id: interview.id })
	}

	// Acknowledge other events
	return Response.json({ received: true })
}
