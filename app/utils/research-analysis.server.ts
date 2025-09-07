/**
 * Research Analysis Utils - BAML-driven analysis of insights against research goals
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { b } from "baml_client"
import consola from "consola"
import type { Insight, Person, Persona, Project_Section } from "~/types"

interface ResearchGoalData {
	icp: string
	role: string
	goal: string
	questions: string[]
	assumptions: string[]
	unknowns: string[]
}

/**
 * Extract research goal from project sections (stored during onboarding)
 */
function extractResearchGoal(sections: Project_Section[]): ResearchGoalData {
	const goalSection = sections.find((s) => s.kind === "goal")
	const icpSection = sections.find((s) => s.kind === "target_market")
	const roleSection = sections.find((s) => s.kind === "role")
	const questionsSection = sections.find((s) => s.kind === "questions")
	const assumptionsSection = sections.find((s) => s.kind === "assumptions")
	const unknownsSection = sections.find((s) => s.kind === "unknowns")

	return {
		icp: icpSection?.content_md || "Unknown target customer",
		role: roleSection?.content_md || "Unknown role",
		goal: goalSection?.content_md || "Research user needs",
		questions: questionsSection?.content_md ? JSON.parse(questionsSection.content_md) : [],
		assumptions: assumptionsSection?.content_md ? JSON.parse(assumptionsSection.content_md) : [],
		unknowns: unknownsSection?.content_md ? JSON.parse(unknownsSection.content_md) : [],
	}
}

/**
 * Canonical: Generate QuestionSet directly from BAML
 */
export async function generateQuestionSetCanonical(params: {
	target_orgs: string
	target_roles: string
	research_goal: string
	research_goal_details: string
	assumptions: string
	unknowns: string
	custom_instructions?: string
	session_id?: string
	round?: number
	total_per_round?: number
	per_category_min?: number
	per_category_max?: number
	interview_time_limit?: number
}) {
	const {
		target_orgs,
		target_roles,
		research_goal,
		research_goal_details,
		assumptions,
		unknowns,
		custom_instructions,
		session_id,
		round,
		total_per_round,
		per_category_min,
		per_category_max,
		interview_time_limit,
	} = params

	consola.log("[generateQuestionSetCanonical] Calling BAML GenerateQuestionSet with canonical params")

	// Guardrails to force required fields the parser expects.
	// We append these to any caller-provided instructions so the LLM reliably
	// includes top-level sessionId, policy, and round with exact values.
	const enforcedShapeNote = `\n\nSTRUCTURE REQUIREMENTS (non-negotiable):\n- Always return valid JSON matching QuestionSet.\n- You MUST include top-level keys: sessionId, policy, categories, questions, history, round.\n- Set sessionId exactly to: ${session_id || ""}\n- Set round exactly to: ${round ?? 1}\n- policy object MUST be present with EXACT keys and values:\n  {\n    "totalPerRound": ${total_per_round ?? 10},\n    "perCategoryMin": ${per_category_min ?? 1},\n    "perCategoryMax": ${per_category_max ?? 3},\n    "dedupeWindowRounds": 2,\n    "balanceBy": ["category","novelty"]\n  }\nReturn only the JSON object — no prose.`

	const questionSet = await b.GenerateQuestionSet({
		inputs: {
			target_org: target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			custom_instructions: [custom_instructions || "", enforcedShapeNote].filter(Boolean).join("\n\n"),
			session_id: session_id || `session_${Date.now()}`,
			round: round ?? 1,
			total_per_round: total_per_round ?? 10,
			per_category_min: per_category_min ?? 1,
			per_category_max: per_category_max ?? 3,
			interview_time_limit: interview_time_limit ?? 60,
		}
	})

	return questionSet
}

/**
 * Generate follow-up questions for diving deeper into a specific question
 */
export async function generateFollowUpQuestions(
	originalQuestion: string,
	researchContext: string,
	targetRoles: string,
	customInstructions?: string
) {
	try {
		consola.log("Generating follow-up questions for:", originalQuestion)
		
		const followUpSet = await b.GenerateFollowUpQuestions(
			originalQuestion,
			researchContext,
			targetRoles,
			customInstructions || "Generate thoughtful, conversational follow-up questions that dive deeper into the topic."
		)
		
		consola.log("Follow-up questions generated:", followUpSet)
		return followUpSet
	} catch (error) {
		consola.error("Failed to generate follow-up questions:", error)
		throw error
	}
}

/**
 * Generate comprehensive project analysis matching insights to research questions
 */
export async function analyzeProjectInsights(
	projectSections: Project_Section[],
	insights: Insight[],
	_people: Person[],
	_personas: Persona[],
	interviewSummary?: string
) {
	try {
		const researchGoal = extractResearchGoal(projectSections)

		// Format insights for BAML analysis
		const insightsData = insights.map((insight) => ({
			name: insight.name,
			pain: insight.pain,
			details: insight.details,
			evidence: insight.evidence,
			category: insight.category,
			journey_stage: insight.journey_stage,
			confidence: insight.confidence,
			emotional_response: insight.emotional_response,
		}))

		// Convert to BAML format
		const bamlResearchGoal = {
			goal: researchGoal.goal,
			icp: researchGoal.icp,
			role: researchGoal.role,
			questions: researchGoal.questions.map((q) => ({
				question: q,
				priority: "high" as const, // Default to high priority for now
			})),
		}

		consola.log("Analyzing project insights with BAML...")

		const analysis = await b.AnalyzeProjectInsights(
			bamlResearchGoal,
			JSON.stringify(insightsData, null, 2),
			interviewSummary || "No interview summary available"
		)

		consola.log("Project analysis completed successfully")
		return analysis
	} catch (error) {
		consola.error("Failed to analyze project insights:", error)
		throw error
	}
}

/**
 * Generate executive summary for project status screens
 */
export async function generateExecutiveSummary(
	projectSections: Project_Section[],
	insights: Insight[],
	people: Person[],
	personas: Persona[]
) {
	try {
		const researchGoal = extractResearchGoal(projectSections)

		// Format for BAML
		const bamlResearchGoal = {
			goal: researchGoal.goal,
			icp: researchGoal.icp,
			role: researchGoal.role,
			questions: researchGoal.questions.map((q) => ({
				question: q,
				priority: 1,
			})),
		}

		const insightsData = insights.map((insight) => ({
			name: insight.name,
			pain: insight.pain,
			category: insight.category,
			confidence: insight.confidence,
		}))

		consola.log("Generating executive summary...")

		const quickInsights = await b.GenerateExecutiveSummary(
			bamlResearchGoal,
			JSON.stringify(insightsData),
			people.length,
			personas.map((p) => p.name)
		)

		consola.log("Quick insights generated successfully")
		return quickInsights
	} catch (error) {
		consola.error("Failed to generate quick insights:", error)
		// Return fallback data instead of throwing
		return {
			questions_answered: insights.length > 0 ? Math.min(3, insights.length) : 0,
			total_questions: extractResearchGoal(projectSections).questions.length,
			key_finding:
				insights.length > 0 ? "Key insights discovered from interview analysis" : "No insights available yet",
			confidence: "medium" as const,
			people_identified: people.length,
			personas_discovered: personas.map((p) => p.name),
			top_pain_points: insights.slice(0, 3).map((i) => i.pain || i.name),
			next_action:
				insights.length > 0
					? "Review detailed insights and plan next interviews"
					: "Upload more interviews to generate insights",
		}
	}
}

/**
 * Get project data for analysis from Supabase
 */
export async function getProjectAnalysisData(supabase: SupabaseClient, projectId: string, _accountId: string) {
	const [sectionsResult, insightsResult, peopleResult, personasResult] = await Promise.all([
		supabase.from("project_sections").select("*").eq("project_id", projectId),

		supabase.from("insights").select("*").eq("project_id", projectId),

		supabase.from("people").select("*").eq("project_id", projectId),

		supabase.from("personas").select("*").eq("project_id", projectId),
	])

	return {
		sections: sectionsResult.data || [],
		insights: insightsResult.data || [],
		people: peopleResult.data || [],
		personas: personasResult.data || [],
	}
}

/**
 * Generate smart research questions for onboarding
 */
export async function generateResearchQuestions(
    target_orgs: string,
    target_roles: string,
    research_goal: string,
    research_goal_details: string,
    assumptions: string,
    unknowns: string,
    custom_instructions: string
) {
	try {
		consola.log("Generating smart research questions for:", {
			target_orgs,
			target_roles,
			research_goal,
			research_goal_details,
			assumptions,
			unknowns,
			custom_instructions,
		})

        const ensure = (v: unknown, fallback = "unspecified") => {
            const s = typeof v === "string" ? v : String(v ?? "")
            return s.trim().length > 0 ? s : fallback
        }
        const questionSet = await b.GenerateQuestionSet({
            inputs: {
                target_org: ensure(target_orgs),
                target_roles: ensure(target_roles),
                research_goal: ensure(research_goal, "General research goal"),
                research_goal_details: ensure(research_goal_details, ""),
                assumptions: ensure(assumptions, ""),
                unknowns: ensure(unknowns, ""),
                custom_instructions: ensure(custom_instructions, ""),
                session_id: `session_${Date.now()}`,
                round: 1,
                total_per_round: 10,
                per_category_min: 1,
                per_category_max: 3,
                interview_time_limit: 60,
            }
        })

		// Convert new QuestionSet format to legacy format for backward compatibility
		const suggestions = {
			core_questions: questionSet.questions
				.filter((q) => q.categoryId === "goals" || q.categoryId === "core")
				.map((q) => ({
					question: q.text,
					rationale: q.rationale || "Core question for research goals",
					interview_type: "user_interview" as const,
					priority: Math.round(q.scores.importance * 3) || 1,
				})),
			behavioral_questions: questionSet.questions
				.filter((q) => q.categoryId === "workflow" || q.categoryId === "behavior")
				.map((q) => ({
					question: q.text,
					rationale: q.rationale || "Understanding user behavior",
					interview_type: "user_interview" as const,
					priority: Math.round(q.scores.importance * 3) || 2,
				})),
			pain_point_questions: questionSet.questions
				.filter((q) => q.categoryId === "pain" || q.categoryId === "challenges")
				.map((q) => ({
					question: q.text,
					rationale: q.rationale || "Identifying pain points",
					interview_type: "user_interview" as const,
					priority: Math.round(q.scores.importance * 3) || 2,
				})),
			solution_questions: questionSet.questions
				.filter((q) => q.categoryId === "willingness" || q.categoryId === "solutions")
				.map((q) => ({
					question: q.text,
					rationale: q.rationale || "Validating solutions",
					interview_type: "user_interview" as const,
					priority: Math.round(q.scores.importance * 3) || 2,
				})),
			context_questions: questionSet.questions
				.filter((q) => q.categoryId === "context" || q.categoryId === "constraints")
				.map((q) => ({
					question: q.text,
					rationale: q.rationale || "Understanding context",
					interview_type: "user_interview" as const,
					priority: Math.round(q.scores.importance * 3) || 3,
				})),
		}

		consola.log("Research questions generated successfully:", suggestions)
		return suggestions
	} catch (error) {
		consola.error("Failed to generate research questions:", error)
		consola.error("Error details:", error instanceof Error ? error.message : String(error))

		// Fallback to basic questions if BAML fails
		return {
			core_questions: [
				{
					question: `What challenges do ${target_roles} face when working with ${target_orgs}?`,
					rationale: "Understanding core challenges helps identify opportunities",
					interview_type: "user_interview" as const,
					priority: 1,
				},
				{
					question: `Walk me through how you currently handle [relevant process] - what works and what doesn't?`,
					rationale: "Process understanding reveals pain points and gaps",
					interview_type: "user_interview" as const,
					priority: 1,
				},
			],
			behavioral_questions: [],
			pain_point_questions: [],
			solution_questions: [],
			context_questions: [],
		}
	}
}
