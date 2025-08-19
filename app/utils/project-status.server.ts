import { supabase } from "~/lib/supabase/client"
import { b } from "baml_client"

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
}

export async function getProjectStatusData(projectId: string): Promise<ProjectStatusData | null> {
  try {
    // Fetch project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return null
    }

    // Fetch interviews for this project
    const { data: interviews, error: interviewsError } = await supabase
      .from('interviews')
      .select('*')
      .eq('project_id', projectId)

    if (interviewsError) {
      console.error('Error fetching interviews:', interviewsError)
    }

    const totalInterviews = interviews?.length || 0

    // Fetch insights for this project
    const { data: insights, error: insightsError } = await supabase
      .from('insights')
      .select('*')
      .eq('project_id', projectId)

    if (insightsError) {
      console.error('Error fetching insights:', insightsError)
    }

    const totalInsights = insights?.length || 0

    // Get research questions for analysis
    const researchGoal = {
      primary_question: project.research_goal || "Understand user needs",
      secondary_questions: project.research_questions || [],
      success_criteria: []
    }

    // Combine all interview content
    const interviewContent = interviews?.map(i => i.content || '').join('\n\n') || ''
    const insightContent = insights?.map(i => i.content || '').join('\n\n') || ''

    // Use BAML to analyze project insights
    let answeredQuestions: string[] = []
    let openQuestions: string[] = []
    let keyInsights: string[] = []
    let completionScore = 0

    if (totalInterviews > 0 && totalInsights > 0) {
      try {
        // Generate quick insights for status display
        const quickInsights = await b.GenerateQuickInsights(
          researchGoal.primary_question,
          insightContent,
          interviewContent
        )

        keyInsights = quickInsights.key_findings
        completionScore = quickInsights.completion_percentage

        // Analyze what questions have been answered vs still open
        const projectAnalysis = await b.AnalyzeProjectInsights(
          researchGoal.primary_question,
          insightContent,
          interviewContent
        )

        answeredQuestions = projectAnalysis.question_answers?.map(qa => qa.question) || []
        openQuestions = projectAnalysis.gap_analysis?.unanswered_questions || []

      } catch (error) {
        console.error('BAML analysis failed:', error)
        // Fallback to basic data
        keyInsights = insights?.slice(0, 3).map(i => i.title || i.content?.substring(0, 100) + '...') || []
        completionScore = Math.min(totalInterviews * 25, 100) // Simple heuristic
      }
    }

    // Count personas (estimate from insights or manual count)
    const totalPersonas = Math.min(Math.ceil(totalInterviews / 2), 5) // Rough estimate

    // Count themes (estimate from insights)
    const totalThemes = Math.min(Math.ceil(totalInsights / 2), 8) // Rough estimate

    return {
      projectName: project.name,
      icp: project.icp || 'Unknown ICP',
      totalInterviews,
      totalInsights,
      totalPersonas,
      totalThemes,
      answeredQuestions,
      openQuestions,
      keyInsights,
      completionScore,
      lastUpdated: new Date(project.updated_at || project.created_at)
    }

  } catch (error) {
    console.error('Error fetching project status:', error)
    return null
  }
}