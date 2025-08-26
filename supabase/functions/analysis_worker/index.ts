import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

interface AnalysisJob {
	id: string
	interview_id: string
	transcript_data: any
	custom_instructions: string
	attempts: number
	status: string
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders })
	}

	try {
		const supabase = createClient(supabaseUrl, supabaseServiceKey)

		// Get pending analysis jobs (max 5 attempts)
		const { data: jobs, error: fetchError } = await supabase
			.from("analysis_jobs")
			.select("*")
			.eq("status", "pending")
			.lt("attempts", 5)
			.order("created_at", { ascending: true })
			.limit(10)

		if (fetchError) {
			return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			})
		}

		if (!jobs || jobs.length === 0) {
			return new Response(JSON.stringify({ message: "No pending jobs", processed: 0 }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			})
		}
		let processed = 0
		let errors = 0

		for (const job of jobs as AnalysisJob[]) {
			try {
				// Mark job as in progress
				await supabase
					.from("analysis_jobs")
					.update({
						status: "in_progress",
						status_detail: "Processing with AI",
						attempts: job.attempts + 1,
					})
					.eq("id", job.id)

				// Update interview status to processing
				await supabase.from("interviews").update({ status: "processing" }).eq("id", job.interview_id)

				// Call the existing processInterview function via API
				// We need to reconstruct the metadata and call the processing function
				const response = await fetch(`${supabaseUrl.replace("/v1", "")}/functions/v1/process-interview`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${supabaseServiceKey}`,
					},
					body: JSON.stringify({
						interview_id: job.interview_id,
						transcript_data: job.transcript_data,
						custom_instructions: job.custom_instructions,
					}),
				})

				if (!response.ok) {
					throw new Error(`Processing failed: ${response.status} ${await response.text()}`)
				}

				const _result = await response.json()

				// Mark job as complete
				await supabase
					.from("analysis_jobs")
					.update({
						status: "done",
						status_detail: "Analysis completed",
						progress: 100,
					})
					.eq("id", job.id)

				// Update interview status to ready
				await supabase.from("interviews").update({ status: "ready" }).eq("id", job.interview_id)

				processed++
			} catch (error) {
				errors++

				// Mark job as error
				await supabase
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Processing failed",
						last_error: error instanceof Error ? error.message : "Unknown error",
					})
					.eq("id", job.id)

				// Update interview status to error
				await supabase.from("interviews").update({ status: "error" }).eq("id", job.interview_id)
			}
		}

		return new Response(
			JSON.stringify({
				message: `Processed ${processed} jobs with ${errors} errors`,
				processed,
				errors,
			}),
			{
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			}
		)
	} catch (error) {
		return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		})
	}
})
