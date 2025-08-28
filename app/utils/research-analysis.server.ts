/**
 * Research Analysis Utils - BAML-driven analysis of insights against research goals
 */

import { b } from "baml_client"
import consola from "consola"
import type { Project_Section, Insight, Person, Persona } from "~/types"


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
		unknowns: unknownsSection?.content_md ? JSON.parse(unknownsSection.content_md) : []
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
export async function getProjectAnalysisData(supabase: any, projectId: string, accountId: string) {
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
		consola.log("Generating smart research questions for:", { target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns, custom_instructions })

		const suggestions = await b.GenerateResearchQuestions(target_orgs, target_roles, research_goal, research_goal_details, assumptions, unknowns, custom_instructions)

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
