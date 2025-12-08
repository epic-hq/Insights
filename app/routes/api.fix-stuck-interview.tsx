import consola from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Fix stuck interviews that have transcript but wrong status
 *
 * GET /api/fix-stuck-interview - Find all stuck interviews (dry run)
 * POST /api/fix-stuck-interview - Fix interviews
 *   Body: { interviewId: string } - Fix single interview
 *   Body: { fixAll: true } - Fix ALL stuck interviews
 */

export async function loader({ request }: LoaderFunctionArgs) {
	const supabase = createSupabaseAdminClient()

	// Find all stuck interviews
	const { data: stuck, error } = await supabase
		.from("interviews")
		.select("id, title, status, project_id")
		.in("status", ["uploading", "processing", "transcribing"])
		.not("transcript", "is", null)

	if (error) {
		consola.error("Error finding stuck interviews:", error)
		return Response.json({ error: "Failed to query interviews" }, { status: 500 })
	}

	return Response.json({
		found: stuck?.length || 0,
		interviews: stuck || [],
		message: "Use POST with { fixAll: true } to fix all, or { interviewId: 'xxx' } to fix one",
	})
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const body = await request.json()
		const { interviewId, fixAll, checkProject } = body

		const supabase = createSupabaseAdminClient()

		// Check project mode - show all interviews in a project
		if (checkProject) {
			const { data: interviews, error } = await supabase
				.from("interviews")
				.select("id, title, status, transcript")
				.eq("project_id", checkProject)
				.order("created_at", { ascending: false })

			if (error) {
				return Response.json({ error: "Failed to query project" }, { status: 500 })
			}

			const summary = {
				total: interviews?.length || 0,
				byStatus: {} as Record<string, number>,
				processing: interviews?.filter((i) => ["uploading", "processing", "transcribing"].includes(i.status || "")) || [],
			}

			for (const i of interviews || []) {
				summary.byStatus[i.status || "unknown"] = (summary.byStatus[i.status || "unknown"] || 0) + 1
			}

			return Response.json({
				project: checkProject,
				...summary,
				interviews: interviews?.map((i) => ({
					id: i.id,
					title: i.title,
					status: i.status,
					hasTranscript: !!i.transcript,
				})),
			})
		}

		// Mark failed interviews as error
		if (body.markAsError) {
			const ids = Array.isArray(body.markAsError) ? body.markAsError : [body.markAsError]
			const { error: updateError } = await supabase
				.from("interviews")
				.update({ status: "error" })
				.in("id", ids)

			if (updateError) {
				return Response.json({ error: "Failed to update" }, { status: 500 })
			}

			return Response.json({ success: true, marked: ids.length, message: `Marked ${ids.length} interviews as error` })
		}

		// Delete interviews
		if (body.deleteInterviews) {
			const ids = Array.isArray(body.deleteInterviews) ? body.deleteInterviews : [body.deleteInterviews]
			const { error: deleteError } = await supabase
				.from("interviews")
				.delete()
				.in("id", ids)

			if (deleteError) {
				return Response.json({ error: "Failed to delete" }, { status: 500 })
			}

			return Response.json({ success: true, deleted: ids.length, message: `Deleted ${ids.length} interviews` })
		}

		// Bulk fix mode
		if (fixAll) {
			consola.info("Bulk fixing all stuck interviews...")

			// Find all stuck interviews with transcripts
			const { data: stuck, error: findError } = await supabase
				.from("interviews")
				.select("id, title, status")
				.in("status", ["uploading", "processing", "transcribing"])
				.not("transcript", "is", null)

			if (findError) {
				consola.error("Error finding stuck interviews:", findError)
				return Response.json({ error: "Failed to query interviews" }, { status: 500 })
			}

			if (!stuck || stuck.length === 0) {
				return Response.json({ success: true, fixed: 0, message: "No stuck interviews found" })
			}

			consola.info(`Found ${stuck.length} stuck interviews to fix`)

			// Update all at once
			const ids = stuck.map((i) => i.id)
			const { error: updateError } = await supabase
				.from("interviews")
				.update({ status: "ready" })
				.in("id", ids)

			if (updateError) {
				consola.error("Failed to bulk update:", updateError)
				return Response.json({ error: "Failed to update interviews" }, { status: 500 })
			}

			consola.success(`Fixed ${stuck.length} stuck interviews`)
			return Response.json({
				success: true,
				fixed: stuck.length,
				interviews: stuck,
				message: `Fixed ${stuck.length} stuck interviews`,
			})
		}

		// Single interview mode
		if (!interviewId) {
			return Response.json({ error: "interviewId or fixAll required" }, { status: 400 })
		}

		// 1. Check current state
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			consola.error("Interview not found:", interviewError)
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		consola.info("Checking interview state:", {
			id: interview.id,
			status: interview.status,
			hasMedia: !!interview.media_url,
			hasTranscript: !!interview.transcript,
		})

		// 2. If interview has transcript but wrong status, fix it
		if (interview.transcript && interview.status !== "ready") {
			consola.info("Fixing interview status to 'ready'")

			// Get current conversation_analysis metadata
			const { data: currentInterview } = await supabase
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", interviewId)
				.single()

			const conversationAnalysis = (currentInterview?.conversation_analysis as any) || {}

			// Update status and mark workflow as complete in conversation_analysis
			const { error: updateError } = await supabase
				.from("interviews")
				.update({
					status: "ready",
					conversation_analysis: {
						...conversationAnalysis,
						status_detail: "Manually marked as complete",
						current_step: "complete",
						completed_steps: [...(conversationAnalysis.completed_steps || []), "transcription", "analysis"],
					},
				})
				.eq("id", interviewId)

			if (updateError) {
				consola.error("Failed to update interview:", updateError)
				return Response.json({ error: "Failed to update interview" }, { status: 500 })
			}
		}

		// 5. Return final state
		const { data: finalInterview } = await supabase
			.from("interviews")
			.select("id, title, status, media_url, transcript")
			.eq("id", interviewId)
			.single()

		consola.success("Interview fixed:", {
			id: finalInterview?.id,
			status: finalInterview?.status,
		})

		return Response.json({
			success: true,
			interview: finalInterview,
			message: "Interview status fixed",
		})
	} catch (error) {
		consola.error("Failed to fix interview:", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
