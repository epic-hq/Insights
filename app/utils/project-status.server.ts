import type { SupabaseClient } from "@supabase/supabase-js"
import { getProjectById } from "~/features/projects/db"
import type { Database } from "~/types"

// Shapes returned by BAML for richer mapping
interface BamlInsightMatch {
	question?: string
	insights_found?: string[]
	confidence?: number
	answer_summary?: string
	evidence?: string[]
}

interface BamlGapAnalysis {
	unanswered_questions?: string[]
	partially_answered_questions?: string[]
	follow_up_recommendations?: string[]
	suggested_interview_topics?: string[]
}

interface BamlProjectAnalysis {
	research_goal?: unknown
	question_answers?: BamlInsightMatch[]
	gap_analysis?: BamlGapAnalysis
	key_discoveries?: string[]
	confidence_score?: number
	next_steps?: string[]
}

export interface ProjectQaItem {
	question: string
	answer_summary?: string
	evidence?: string[]
	confidence?: number
	insights_found?: string[]
	related_insight_ids?: string[]
}

export interface ProjectStatusData {
	projectName: string
	icp: string
	totalInterviews: number
	totalInsights: number
	totalPersonas: number
	totalThemes: number
	totalEvidence: number
	answeredQuestions: string[]
	openQuestions: string[]
	keyInsights: string[]
	completionScore: number
	lastUpdated: Date
	analysisId?: string
	hasAnalysis: boolean
	// Enhanced analysis data
	nextSteps: string[]
	nextAction?: string
	keyDiscoveries: string[]
	confidenceScore?: number
	confidenceLevel?: number
	followUpRecommendations: string[]
	suggestedInterviewTopics: string[]
	// New BAML structure fields
	answeredInsights: string[]
	unanticipatedDiscoveries: string[]
	criticalUnknowns: string[]
	// Rich Q&A
	questionAnswers: ProjectQaItem[]
}

export async function getProjectStatusData(
	projectId: string,
	supabase: SupabaseClient<Database>
): Promise<ProjectStatusData | null> {
	try {
		// Get project with proper authentication
		const projectResult = await getProjectById({
			supabase,
			id: projectId,
		})

		if (!projectResult.data) {
			return null
		}

		const project = projectResult.data
		type ProjectRow = {
			name: string
			description?: string | null
			icp?: string | null
			updated_at?: string | null
			created_at?: string | null
		}
		const proj = project as unknown as ProjectRow

		// Fetch latest analysis annotation
		const { data: latestAnalysis } = await supabase
			.from("annotations")
			.select("*")
			.eq("project_id", projectId)
			.eq("entity_type", "project")
			.eq("annotation_type", "ai_suggestion")
			.eq("status", "active")
			.like("ai_model", "AnalyzeProjectStatus%")
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle()

		// Fetch basic counts
		const [interviewsResult, insightsResult, evidenceResult] = await Promise.all([
			supabase.from("interviews").select("id").eq("project_id", projectId),
			supabase.from("insights").select("id,name").eq("project_id", projectId),
			supabase.from("evidence").select("id").eq("project_id", projectId),
		])

		const totalInterviews = interviewsResult.data?.length || 0
		const totalInsights = insightsResult.data?.length || 0
		const totalEvidence = evidenceResult.data?.length || 0
		const totalPersonas = Math.min(Math.ceil(totalInterviews / 2), 5)
		const totalThemes = Math.min(Math.ceil(totalInsights / 2), 8)

		// Base data structure
		const baseData = {
			projectName: proj.name,
			icp: proj.icp || proj.description || "Unknown ICP",
			totalInterviews,
			totalInsights,
			totalPersonas,
			totalThemes,
			totalEvidence,
			lastUpdated: new Date(proj.updated_at || proj.created_at || new Date().toISOString()),
		}

		// If we have analysis results, use them
		if (latestAnalysis?.metadata) {
			const metadata = latestAnalysis.metadata as Record<string, unknown>
			const fullAnalysis = (metadata.full_analysis as Record<string, unknown>) || {}
			const quickInsights = (fullAnalysis.quick_insights as Record<string, unknown>) || {}
			const projectAnalysis = (fullAnalysis.project_analysis as BamlProjectAnalysis) || {}
			const gapAnalysis = (projectAnalysis.gap_analysis as BamlGapAnalysis) || {}
			const qaRaw = (projectAnalysis.question_answers as BamlInsightMatch[]) || []
			const allInsights = (insightsResult.data || []).map((i) => ({
				id: i.id as string,
				name: (i as any).name as string | undefined,
			}))

			const questionAnswers: ProjectQaItem[] = qaRaw.map((qa) => {
				const insights_found = Array.isArray(qa?.insights_found) ? qa.insights_found : []
				// Fuzzy match insight names to ids
				const related_insight_ids: string[] = []
				const targets = insights_found.map((s) => (s || "").toLowerCase())
				for (const ins of allInsights) {
					const nm = (ins.name || "").toLowerCase()
					if (!nm) continue
					if (targets.some((t) => t && (nm.includes(t) || t.includes(nm)))) {
						related_insight_ids.push(ins.id)
					}
				}
				return {
					question: qa?.question || "",
					answer_summary: qa?.answer_summary,
					evidence: Array.isArray(qa?.evidence) ? qa.evidence : [],
					confidence: typeof qa?.confidence === "number" ? qa.confidence : undefined,
					insights_found,
					related_insight_ids,
				}
			})

			return {
				...baseData,
				answeredQuestions: (metadata.answered_questions as string[]) || [],
				openQuestions: (metadata.open_questions as string[]) || [],
				keyInsights: (metadata.key_insights as string[]) || [],
				completionScore: (metadata.completion_score as number) || 0,
				analysisId: latestAnalysis.id,
				hasAnalysis: true,
				// Enhanced data from full BAML analysis
				nextSteps: (projectAnalysis.next_steps as string[]) || [],
				nextAction: quickInsights.next_action as string | undefined,
				keyDiscoveries: (projectAnalysis.key_discoveries as string[]) || [],
				confidenceScore: projectAnalysis.confidence_score as number | undefined,
				confidenceLevel: quickInsights.confidence as number | undefined,
				followUpRecommendations: (gapAnalysis.follow_up_recommendations as string[]) || [],
				suggestedInterviewTopics: (gapAnalysis.suggested_interview_topics as string[]) || [],
				// New structured insights from updated BAML
				answeredInsights: (metadata.key_insights as string[]) || (quickInsights.answered_insights as string[]) || [],
				unanticipatedDiscoveries:
					(metadata.unanticipated_discoveries as string[]) ||
					(quickInsights.unanticipated_discoveries as string[]) ||
					[],
				criticalUnknowns:
					(metadata.critical_unknowns as string[]) || (quickInsights.critical_unknowns as string[]) || [],
				// Rich Q&A
				questionAnswers,
			}
		}

		// Fallback data when no analysis exists
		return {
			...baseData,
			answeredQuestions: [],
			openQuestions: [],
			keyInsights: [],
			completionScore: Math.min(totalInterviews * 25, 100),
			hasAnalysis: false,
			nextSteps: [],
			keyDiscoveries: [],
			followUpRecommendations: [],
			suggestedInterviewTopics: [],
			answeredInsights: [],
			unanticipatedDiscoveries: [],
			criticalUnknowns: [],
			questionAnswers: [],
		}
	} catch {
		// Error fetching project status - logged for debugging
		return null
	}
}
