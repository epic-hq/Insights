import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

interface ProcessInterviewRequest {
	interview_id: string
	transcript_data: any
	custom_instructions: string
}

Deno.serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders })
	}

	if (req.method !== "POST") {
		return new Response("Method not allowed", {
			status: 405,
			headers: corsHeaders,
		})
	}

	try {
		const { interview_id, transcript_data, custom_instructions }: ProcessInterviewRequest = await req.json()

		if (!interview_id || !transcript_data) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			})
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey)

		// Get interview details
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("account_id, project_id, title, participant_pseudonym")
			.eq("id", interview_id)
			.single()

		if (interviewError || !interview) {
			throw new Error(`Interview not found: ${interviewError?.message}`)
		}

		// Call the Remix API endpoint for processing since it has all the BAML setup
		const processUrl = `${supabaseUrl.replace("/v1", "")}/api/process-interview-internal`

		const response = await fetch(processUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${supabaseServiceKey}`,
			},
			body: JSON.stringify({
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id,
					interviewTitle: interview.title,
					participantName: interview.participant_pseudonym,
					fileName: transcript_data.original_filename,
				},
				transcriptData: transcript_data,
				mediaUrl: "",
				userCustomInstructions: custom_instructions,
				interviewId: interview_id,
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Processing failed: ${response.status} ${errorText}`)
		}

		const result = await response.json()

		return new Response(JSON.stringify({ success: true, result }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		})
	} catch (error) {
		return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		})
	}
})
