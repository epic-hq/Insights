/**
 * Research Analysis Utils - BAML-driven analysis of insights against research goals
 */

import { b } from "baml_client"
import consola from "consola"
import type { Database } from "~/types/supabase"

type ProjectSection = Database["public"]["Tables"]["project_sections"]["Row"]
type Insight = Database["public"]["Tables"]["insights"]["Row"]
type Person = Database["public"]["Tables"]["people"]["Row"]
type Persona = Database["public"]["Tables"]["personas"]["Row"]

interface ResearchGoalData {
	icp: string
	role: string
	goal: string
	questions: string[]
}

/**
 * Extract research goal from project sections (stored during onboarding)
 */
function extractResearchGoal(sections: ProjectSection[]): ResearchGoalData {
	const goalSection = sections.find(s => s.name === 'goal')
	const icpSection = sections.find(s => s.name === 'icp')
	const roleSection = sections.find(s => s.name === 'role')
	const questionsSection = sections.find(s => s.name === 'questions')

	return {
		icp: icpSection?.content || 'Unknown target customer',
		role: roleSection?.content || 'Unknown role',
		goal: goalSection?.content || 'Research user needs',
		questions: questionsSection?.content ? JSON.parse(questionsSection.content) : []
	}
}

/**
 * Generate comprehensive project analysis matching insights to research questions
 */
export async function analyzeProjectInsights(
	projectSections: ProjectSection[],
	insights: Insight[],
	_people: Person[],
	_personas: Persona[],
	interviewSummary?: string
) {
	try {
		const researchGoal = extractResearchGoal(projectSections)

		// Format insights for BAML analysis
		const insightsData = insights.map(insight => ({
			name: insight.name,
			pain: insight.pain,
			details: insight.details,
			evidence: insight.evidence,
			category: insight.category,
			journey_stage: insight.journey_stage,
			confidence: insight.confidence,
			emotional_response: insight.emotional_response
		}))

		// Convert to BAML format
		const bamlResearchGoal = {
			goal: researchGoal.goal,
			icp: researchGoal.icp,
			role: researchGoal.role,
			questions: researchGoal.questions.map(q => ({
				question: q,
				priority: "high" as const // Default to high priority for now
			}))
		}

		consola.log('Analyzing project insights with BAML...')

		const analysis = await b.AnalyzeProjectInsights(
			bamlResearchGoal,
			JSON.stringify(insightsData, null, 2),
			interviewSummary || 'No interview summary available'
		)

		consola.log('Project analysis completed successfully')
		return analysis

	} catch (error) {
		consola.error('Failed to analyze project insights:', error)
		throw error
	}
}

/**
 * Generate quick insights summary for project status screens
 */
export async function generateQuickInsights(
	projectSections: ProjectSection[],
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
			questions: researchGoal.questions.map(q => ({
				question: q,
				priority: "high" as const
			}))
		}

		const insightsData = insights.map(insight => ({
			name: insight.name,
			pain: insight.pain,
			category: insight.category,
			confidence: insight.confidence
		}))

		consola.log('Generating quick insights summary...')

		const quickInsights = await b.GenerateQuickInsights(
			bamlResearchGoal,
			JSON.stringify(insightsData),
			people.length,
			personas.map(p => p.name)
		)

		consola.log('Quick insights generated successfully')
		return quickInsights

	} catch (error) {
		consola.error('Failed to generate quick insights:', error)
		// Return fallback data instead of throwing
		return {
			questions_answered: insights.length > 0 ? Math.min(3, insights.length) : 0,
			total_questions: extractResearchGoal(projectSections).questions.length,
			key_finding: insights.length > 0 ? "Key insights discovered from interview analysis" : "No insights available yet",
			confidence: "medium" as const,
			people_identified: people.length,
			personas_discovered: personas.map(p => p.name),
			top_pain_points: insights.slice(0, 3).map(i => i.pain || i.name),
			next_action: insights.length > 0 ? "Review detailed insights and plan next interviews" : "Upload more interviews to generate insights"
		}
	}
}

/**
 * Get project data for analysis from Supabase
 */
export async function getProjectAnalysisData(
	supabase: any,
	projectId: string,
	accountId: string
) {
	const [sectionsResult, insightsResult, peopleResult, personasResult] = await Promise.all([
		supabase
			.from('project_sections')
			.select('*')
			.eq('project_id', projectId),

		supabase
			.from('insights')
			.select('*')
			.eq('project_id', projectId)
			.eq('account_id', accountId),

		supabase
			.from('people')
			.select('*')
			.eq('project_id', projectId)
			.eq('account_id', accountId),

		supabase
			.from('personas')
			.select('*')
			.eq('project_id', projectId)
			.eq('account_id', accountId)
	])

	return {
		sections: sectionsResult.data || [],
		insights: insightsResult.data || [],
		people: peopleResult.data || [],
		personas: personasResult.data || []
	}
}

/**
 * Generate smart research questions for onboarding
 */
export async function generateResearchQuestions(
	icp: string,
	role: string,
	researchGoal: string,
	customInstructions: string
) {
	try {
		consola.log('Generating smart research questions for:', { icp, role, researchGoal, customInstructions })

		const suggestions = await b.GenerateResearchQuestions(icp, role, researchGoal, customInstructions)

		consola.log('Research questions generated successfully:', suggestions)
		return suggestions

	} catch (error) {
		consola.error('Failed to generate research questions:', error)
		consola.error('Error details:', error instanceof Error ? error.message : String(error))

		// Fallback to basic questions if BAML fails
		return {
			core_questions: [
				{
					question: `What challenges do ${role} face when working with ${icp}?`,
					rationale: "Understanding core challenges helps identify opportunities",
					interview_type: "user_interview" as const,
					priority: 1
				},
				{
					question: `Walk me through how you currently handle [relevant process] - what works and what doesn't?`,
					rationale: "Process understanding reveals pain points and gaps",
					interview_type: "user_interview" as const,
					priority: 1
				}
			],
			behavioral_questions: [],
			pain_point_questions: [],
			solution_questions: [],
			context_questions: []
		}
	}
}