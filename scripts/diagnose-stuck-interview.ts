#!/usr/bin/env tsx
/**
 * Diagnostic script to check the state of a stuck interview
 * Usage: npx tsx scripts/diagnose-stuck-interview.ts <interview-id>
 */

import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

async function diagnoseInterview(interviewId: string) {
	const supabase = createSupabaseAdminClient()

	consola.info(`🔍 Diagnosing interview: ${interviewId}`)

	// 1. Get interview details
	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.select("*")
		.eq("id", interviewId)
		.single()

	if (interviewError || !interview) {
		consola.error("❌ Interview not found:", interviewError)
		process.exit(1)
	}

	consola.box({
		title: "Interview Details",
		message: `
ID: ${interview.id}
Title: ${interview.title || "N/A"}
Status: ${interview.status}
Project: ${interview.project_id}
Account: ${interview.account_id}

Created: ${interview.created_at}
Updated: ${interview.updated_at}

File Info:
  - Original filename: ${interview.original_filename || "N/A"}
  - Source type: ${interview.source_type || "N/A"}
  - File extension: ${interview.file_extension || "N/A"}

Media:
  - Has media_url: ${!!interview.media_url}
  - Media type: ${interview.media_type || "N/A"}
  - Media URL: ${interview.media_url || "N/A"}

Transcript:
  - Has transcript: ${!!interview.transcript}
  - Transcript length: ${interview.transcript?.length || 0} chars
  - Has transcript_formatted: ${!!interview.transcript_formatted}

Analysis:
  - Duration: ${interview.duration_sec || 0} seconds
  - Participant: ${interview.participant_pseudonym || "N/A"}
		`.trim(),
	})

	// 2. Check upload_jobs
	const { data: uploadJobs } = await supabase
		.from("upload_jobs")
		.select("*")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: false })

	if (uploadJobs && uploadJobs.length > 0) {
		consola.info(`\n📤 Upload Jobs (${uploadJobs.length}):`)
		uploadJobs.forEach((job, i) => {
			consola.log(`
  ${i + 1}. Job ID: ${job.id}
     Status: ${job.status}
     Detail: ${job.status_detail || "N/A"}
     Current step: ${job.current_step || "N/A"}
     Created: ${job.created_at}
     Updated: ${job.updated_at}
		`)
		})
	} else {
		consola.warn("\n⚠️  No upload_jobs found")
	}

	// 3. Check analysis_jobs
	const { data: analysisJobs } = await supabase
		.from("analysis_jobs")
		.select("*")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: false })

	if (analysisJobs && analysisJobs.length > 0) {
		consola.info(`\n🧠 Analysis Jobs (${analysisJobs.length}):`)
		analysisJobs.forEach((job, i) => {
			consola.log(`
  ${i + 1}. Job ID: ${job.id}
     Status: ${job.status}
     Detail: ${job.status_detail || "N/A"}
     Current step: ${job.current_step || "N/A"}
     Progress: ${job.progress || 0}%
     Trigger run ID: ${job.trigger_run_id || "N/A"}
     Created: ${job.created_at}
     Updated: ${job.updated_at}
     Last error: ${job.last_error || "N/A"}
		`)
		})
	} else {
		consola.warn("\n⚠️  No analysis_jobs found")
	}

	// 4. Determine issue and recommend fix
	consola.info("\n🔧 Diagnosis:")

	const issues: string[] = []
	const recommendations: string[] = []

	// Check if interview has transcript
	if (!interview.transcript || interview.transcript.length === 0) {
		issues.push("❌ Interview has NO transcript")
		if (interview.media_url) {
			recommendations.push("1. Call POST /api/reprocess-interview to transcribe media + extract evidence")
		} else {
			recommendations.push("1. Interview has no media or transcript - cannot recover")
		}
	} else {
		issues.push("✅ Interview has transcript")

		// Check if status is correct
		if (interview.status !== "ready") {
			issues.push(`❌ Interview status is '${interview.status}' but should be 'ready'`)
			recommendations.push("1. Call POST /api/fix-stuck-interview to update status to 'ready'")
		} else {
			issues.push("✅ Interview status is 'ready'")
		}
	}

	// Check for stuck upload_jobs
	const stuckUploadJobs = uploadJobs?.filter((j) => j.status === "pending" || j.status === "in_progress")
	if (stuckUploadJobs && stuckUploadJobs.length > 0) {
		issues.push(`❌ ${stuckUploadJobs.length} upload_jobs stuck in '${stuckUploadJobs[0].status}'`)
		recommendations.push("2. Call POST /api/fix-stuck-interview to mark upload_jobs as 'done'")
	}

	// Check for stuck analysis_jobs
	const stuckAnalysisJobs = analysisJobs?.filter((j) => j.status === "pending" || j.status === "in_progress")
	if (stuckAnalysisJobs && stuckAnalysisJobs.length > 0) {
		issues.push(`❌ ${stuckAnalysisJobs.length} analysis_jobs stuck in '${stuckAnalysisJobs[0].status}'`)
		recommendations.push("3. Call POST /api/fix-stuck-interview to mark analysis_jobs as 'done'")

		// If there's a trigger_run_id, mention checking Trigger.dev
		const withTriggerRun = stuckAnalysisJobs.filter((j) => j.trigger_run_id)
		if (withTriggerRun.length > 0) {
			recommendations.push(`4. Check Trigger.dev dashboard for run: ${withTriggerRun[0].trigger_run_id}`)
		}
	}

	// Check for evidence
	const { data: evidence } = await supabase.from("evidence").select("id").eq("interview_id", interviewId).limit(1)

	if (evidence && evidence.length > 0) {
		issues.push("✅ Interview has evidence extracted")
	} else {
		issues.push("❌ Interview has NO evidence extracted")
		if (interview.transcript) {
			recommendations.push("5. Call POST /api/reprocess-interview to extract evidence from transcript")
		}
	}

	consola.box({
		title: "Issues Found",
		message: issues.join("\n"),
	})

	if (recommendations.length > 0) {
		consola.box({
			title: "Recommended Actions",
			message: recommendations.join("\n"),
		})

		consola.info("\n📝 Example API calls:")
		consola.log(`
# Fix stuck status and jobs:
curl -X POST http://localhost:4280/api/fix-stuck-interview \\
  -H "Content-Type: application/json" \\
  -d '{"interviewId": "${interviewId}"}'

# Reprocess interview (extract evidence + themes):
curl -X POST http://localhost:4280/api/reprocess-interview \\
  -H "Content-Type: application/json" \\
  -d '{"interviewId": "${interviewId}"}'
		`)
	} else {
		consola.success("\n✅ No issues found! Interview appears to be in good state.")
	}
}

const interviewId = process.argv[2]

if (!interviewId) {
	consola.error("❌ Usage: npx tsx scripts/diagnose-stuck-interview.ts <interview-id>")
	process.exit(1)
}

diagnoseInterview(interviewId)
	.then(() => {
		consola.success("\n✅ Diagnosis complete")
		process.exit(0)
	})
	.catch((error) => {
		consola.error("❌ Diagnosis failed:", error)
		process.exit(1)
	})
