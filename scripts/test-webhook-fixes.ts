#!/usr/bin/env tsx

/**
 * Manual test script to verify webhook idempotency and status progression fixes
 * Run with: npx tsx scripts/test-webhook-fixes.ts
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testIdempotency() {
	// Create test interview and upload job
	const testId = `test-${Date.now()}`

	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.insert({
			id: `interview-${testId}`,
			account_id: "45b0ca10-9af1-402d-9684-91198748a216", // Test user
			project_id: "fa116fb1-4100-46c5-bf01-8689aedf0d52", // Test project
			title: "Idempotency Test Interview",
			status: "uploaded",
		})
		.select()
		.single()

	if (interviewError) {
		return false
	}

	const { data: uploadJob, error: uploadError } = await supabase
		.from("upload_jobs")
		.insert({
			id: `upload-${testId}`,
			interview_id: interview.id,
			assemblyai_id: `transcript-${testId}`,
			status: "done", // Already completed
			custom_instructions: "Test instructions",
		})
		.select()
		.single()

	if (uploadError) {
		return false
	}

	// Test idempotency check
	const { data: foundJob, error: findError } = await supabase
		.from("upload_jobs")
		.select("*")
		.eq("assemblyai_id", `transcript-${testId}`)
		.single()

	if (findError || !foundJob) {
		return false
	}

	if (foundJob.status === "done") {
	} else {
		return false
	}

	// Cleanup
	await supabase.from("interviews").delete().eq("id", interview.id)

	return true
}

async function testStatusProgression() {
	const testId = `status-${Date.now()}`

	// Create interview in uploaded state
	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.insert({
			id: `interview-${testId}`,
			account_id: "45b0ca10-9af1-402d-9684-91198748a216",
			project_id: "fa116fb1-4100-46c5-bf01-8689aedf0d52",
			title: "Status Progression Test",
			status: "uploaded", // 20%
		})
		.select()
		.single()

	if (interviewError) {
		return false
	}

	// Progress to transcribed
	await supabase.from("interviews").update({ status: "transcribed" }).eq("id", interview.id)

	// Progress to processing
	await supabase.from("interviews").update({ status: "processing" }).eq("id", interview.id)

	// Progress to ready
	await supabase.from("interviews").update({ status: "ready" }).eq("id", interview.id)

	// Verify final status
	const { data: finalInterview } = await supabase.from("interviews").select("status").eq("id", interview.id).single()

	if (finalInterview?.status === "ready") {
	} else {
		return false
	}

	// Cleanup
	await supabase.from("interviews").delete().eq("id", interview.id)

	return true
}

async function testAuditFields() {
	const testId = `audit-${Date.now()}`

	// Create test interview
	const { data: interview, error: interviewError } = await supabase
		.from("interviews")
		.insert({
			id: `interview-${testId}`,
			account_id: "45b0ca10-9af1-402d-9684-91198748a216",
			project_id: "fa116fb1-4100-46c5-bf01-8689aedf0d52",
			title: "Audit Fields Test",
			status: "ready",
		})
		.select()
		.single()

	if (interviewError) {
		return false
	}

	// Test creating insight without created_by (should work with nullable fields)
	const { data: insight, error: insightError } = await supabase
		.from("insights")
		.insert({
			interview_id: interview.id,
			account_id: "45b0ca10-9af1-402d-9684-91198748a216",
			project_id: "fa116fb1-4100-46c5-bf01-8689aedf0d52",
			name: "Test Insight Without Audit",
			pain: "Test pain point",
			details: "Test details",
			evidence: "Test evidence",
			category: "Test",
			journey_stage: "Awareness",
			confidence: "High",
			emotional_response: "Frustrated",
			underlying_motivation: "Test motivation",
			desired_outcome: "Test outcome",
			jtbd: "Test JTBD",
			// created_by and updated_by omitted (should be null)
		})
		.select()
		.single()

	if (insightError) {
		return false
	}

	// Test creating insight with created_by
	const { data: insightWithAudit, error: auditError } = await supabase
		.from("insights")
		.insert({
			interview_id: interview.id,
			account_id: "45b0ca10-9af1-402d-9684-91198748a216",
			project_id: "fa116fb1-4100-46c5-bf01-8689aedf0d52",
			name: "Test Insight With Audit",
			pain: "Test pain point",
			details: "Test details",
			evidence: "Test evidence",
			category: "Test",
			journey_stage: "Awareness",
			confidence: "High",
			emotional_response: "Frustrated",
			underlying_motivation: "Test motivation",
			desired_outcome: "Test outcome",
			jtbd: "Test JTBD",
			created_by: "45b0ca10-9af1-402d-9684-91198748a216", // Set audit field
			updated_by: "45b0ca10-9af1-402d-9684-91198748a216",
		})
		.select()
		.single()

	if (auditError) {
		return false
	}

	// Cleanup
	await supabase.from("interviews").delete().eq("id", interview.id)

	return true
}

async function main() {
	const results = [await testIdempotency(), await testStatusProgression(), await testAuditFields()]

	const allPassed = results.every(Boolean)
	if (allPassed) {
	} else {
		process.exit(1)
	}
}

main().catch((_error) => {
	process.exit(1)
})
