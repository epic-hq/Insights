import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

/**
 * Research Evidence Analysis API
 * POST /api/analyze-research-evidence
 * 
 * Analyzes evidence and links it to Decision Questions (DQs) and Research Questions (RQs)
 * Creates traceable connections between evidence and research structure
 */
export async function action({ request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	
	try {
		const body = await request.json()
		const { projectId, interviewId } = body

		if (!projectId) {
			return { error: "Project ID is required", status: 400 }
		}

		consola.info(`🔬 Starting research evidence analysis for project: ${projectId}`)

		// 1. Get all decision questions and research questions for the project
		const { data: decisionQuestions, error: dqError } = await supabase
			.from("decision_questions")
			.select("id, text, rationale")
			.eq("project_id", projectId)

		if (dqError) {
			consola.error("❌ Failed to fetch decision questions:", dqError)
			return { error: "Failed to fetch decision questions", status: 500 }
		}

		const { data: researchQuestions, error: rqError } = await supabase
			.from("research_questions")
			.select("id, text, rationale, decision_question_id")
			.eq("project_id", projectId)

		if (rqError) {
			consola.error("❌ Failed to fetch research questions:", rqError)
			return { error: "Failed to fetch research questions", status: 500 }
		}

		// 2. Get evidence that needs to be analyzed
		let evidenceQuery = supabase
			.from("evidence")
			.select(`
				id, 
				verbatim, 
				support, 
				anchors, 
				interview_id,
				interviews!inner(project_id)
			`)
			.eq("interviews.project_id", projectId)

		// If specific interview provided, filter to that interview
		if (interviewId) {
			evidenceQuery = evidenceQuery.eq("interview_id", interviewId)
		}

		const { data: evidence, error: evidenceError } = await evidenceQuery

		if (evidenceError) {
			consola.error("❌ Failed to fetch evidence:", evidenceError)
			return { error: "Failed to fetch evidence", status: 500 }
		}

		consola.info(`📊 Found ${evidence.length} evidence items to analyze`)

		// 3. For each piece of evidence, determine which RQs and DQs it relates to
		const analysisResults = []
		let linkedCount = 0

		for (const evidenceItem of evidence) {
			// Simple keyword matching for now - can be enhanced with AI later  
			const evidenceText = (evidenceItem.verbatim + " " + evidenceItem.support + " " + evidenceItem.anchors).toLowerCase()
			
			const linkedRQs = []
			const linkedDQs = []

			// Check which research questions this evidence relates to
			for (const rq of researchQuestions) {
				if (isEvidenceRelevantToQuestion(evidenceText, rq.text, rq.rationale)) {
					linkedRQs.push(rq.id)
				}
			}

			// Check which decision questions this evidence relates to
			for (const dq of decisionQuestions) {
				if (isEvidenceRelevantToQuestion(evidenceText, dq.text, dq.rationale)) {
					linkedDQs.push(dq.id)
				}
			}

			if (linkedRQs.length > 0 || linkedDQs.length > 0) {
				analysisResults.push({
					evidenceId: evidenceItem.id,
					linkedRQs,
					linkedDQs,
					evidenceText: evidenceItem.verbatim.slice(0, 100) + "..."
				})
				linkedCount++
			}
		}

		// 4. Create project_answers entries for linked evidence
		const answersToCreate = []

		for (const result of analysisResults) {
			// Create answers for linked research questions
			for (const rqId of result.linkedRQs) {
				const rq = researchQuestions.find(q => q.id === rqId)
				answersToCreate.push({
					project_id: projectId,
					interview_id: evidence.find(e => e.id === result.evidenceId)?.interview_id,
					research_question_id: rqId,
					decision_question_id: rq?.decision_question_id,
					answer_text: evidence.find(e => e.id === result.evidenceId)?.verbatim,
					confidence_level: 0.7, // Default confidence
					status: "answered",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				})
			}

			// Create answers for linked decision questions (if not already covered by RQ)
			for (const dqId of result.linkedDQs) {
				const existingAnswer = answersToCreate.find(a => a.decision_question_id === dqId)
				if (!existingAnswer) {
					answersToCreate.push({
						project_id: projectId,
						interview_id: evidence.find(e => e.id === result.evidenceId)?.interview_id,
						decision_question_id: dqId,
						answer_text: evidence.find(e => e.id === result.evidenceId)?.verbatim,
						confidence_level: 0.6, // Slightly lower confidence for direct DQ links
						status: "answered",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					})
				}
			}
		}

		// 5. Insert the project answers
		if (answersToCreate.length > 0) {
			const { error: insertError } = await supabase
				.from("project_answers")
				.insert(answersToCreate)

			if (insertError) {
				consola.error("❌ Failed to create project answers:", insertError)
				return { error: "Failed to create project answers", status: 500 }
			}

			consola.info(`✅ Created ${answersToCreate.length} project answers`)
		}

		// 6. Create evidence links to project answers
		const evidenceLinks = []
		for (const answer of answersToCreate) {
			const evidenceItem = analysisResults.find(r => 
				evidence.find(e => e.id === r.evidenceId)?.interview_id === answer.interview_id
			)
			if (evidenceItem) {
				evidenceLinks.push({
					evidence_id: evidenceItem.evidenceId,
					project_answer_id: answer.id // This would need to be the actual inserted ID
				})
			}
		}

		consola.info(`🎯 Research analysis complete:`)
		consola.info(`   - Analyzed ${evidence.length} evidence items`)
		consola.info(`   - Linked ${linkedCount} evidence items to questions`)
		consola.info(`   - Created ${answersToCreate.length} project answers`)

		return {
			success: true,
			summary: {
				evidenceAnalyzed: evidence.length,
				evidenceLinked: linkedCount,
				answersCreated: answersToCreate.length,
				decisionQuestions: decisionQuestions.length,
				researchQuestions: researchQuestions.length
			},
			analysisResults
		}

	} catch (error) {
		consola.error("❌ Research analysis failed:", error)
		return {
			error: "Research analysis failed",
			details: error instanceof Error ? error.message : "Unknown error",
			status: 500
		}
	}
}

/**
 * Simple keyword matching to determine if evidence is relevant to a question
 * Can be enhanced with AI/semantic matching later
 */
function isEvidenceRelevantToQuestion(evidenceText: string, questionText: string, rationale?: string): boolean {
	const questionKeywords = extractKeywords(questionText + " " + (rationale || ""))
	const evidenceKeywords = extractKeywords(evidenceText)
	
	// Check for keyword overlap
	const overlap = questionKeywords.filter(keyword => 
		evidenceKeywords.some(evidenceKeyword => 
			evidenceKeyword.includes(keyword) || keyword.includes(evidenceKeyword)
		)
	)
	
	// Require at least 2 keyword matches or 1 strong match
	return overlap.length >= 2 || overlap.some(word => word.length > 6)
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
	const stopWords = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
		'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
		'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'how', 'why', 'when', 'where'
	])
	
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 3 && !stopWords.has(word))
		.filter((word, index, arr) => arr.indexOf(word) === index) // dedupe
}
