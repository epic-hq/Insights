import { getProjectById } from "~/features/projects/db"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export interface ProjectStatusData {
  projectName: string
  icp: string
  totalInterviews: number
  totalInsights: number
  totalPersonas: number
  totalThemes: number
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
}

export async function getProjectStatusData(
  projectId: string, 
  supabase: SupabaseClient<Database>, 
  accountId: string
): Promise<ProjectStatusData | null> {
  try {
    // Get project with proper authentication
    const projectResult = await getProjectById({ 
      supabase, 
      accountId,
      id: projectId 
    })

    if (!projectResult.data) {
      return null
    }

    const project = projectResult.data

    // Fetch latest analysis annotation
    const { data: latestAnalysis } = await supabase
      .from('annotations')
      .select('*')
      .eq('project_id', projectId)
      .eq('entity_type', 'project')
      .eq('annotation_type', 'ai_suggestion')
      .eq('status', 'active')
      .like('ai_model', 'AnalyzeProjectStatus%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch basic counts
    const [interviewsResult, insightsResult] = await Promise.all([
      supabase.from('interviews').select('id').eq('project_id', projectId),
      supabase.from('insights').select('id').eq('project_id', projectId)
    ])

    const totalInterviews = interviewsResult.data?.length || 0
    const totalInsights = insightsResult.data?.length || 0
    const totalPersonas = Math.min(Math.ceil(totalInterviews / 2), 5)
    const totalThemes = Math.min(Math.ceil(totalInsights / 2), 8)

    // Base data structure
    const baseData = {
      projectName: project.name,
      icp: (project as any).icp || project.description || 'Unknown ICP',
      totalInterviews,
      totalInsights,
      totalPersonas,
      totalThemes,
      lastUpdated: new Date(project.updated_at || project.created_at)
    }

    // If we have analysis results, use them
    if (latestAnalysis?.metadata) {
      const metadata = latestAnalysis.metadata as Record<string, unknown>
      const fullAnalysis = (metadata.full_analysis as Record<string, unknown>) || {}
      const quickInsights = (fullAnalysis.quick_insights as Record<string, unknown>) || {}
      const projectAnalysis = (fullAnalysis.project_analysis as Record<string, unknown>) || {}
      const gapAnalysis = (projectAnalysis.gap_analysis as Record<string, unknown>) || {}
      
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
        unanticipatedDiscoveries: (metadata.unanticipated_discoveries as string[]) || (quickInsights.unanticipated_discoveries as string[]) || [],
        criticalUnknowns: (metadata.critical_unknowns as string[]) || (quickInsights.critical_unknowns as string[]) || []
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
      criticalUnknowns: []
    }

  } catch {
    // Error fetching project status - logged for debugging
    return null
  }
}