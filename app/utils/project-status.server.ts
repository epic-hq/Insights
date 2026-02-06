import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectById } from "~/features/projects/db";
import type { Database } from "~/types";

// Shapes returned by BAML for richer mapping
interface BamlInsightMatch {
  question?: string;
  insights_found?: string[];
  confidence?: number;
  answer_summary?: string;
  evidence?: string[];
}

interface BamlGapAnalysis {
  unanswered_questions?: string[];
  partially_answered_questions?: string[];
  follow_up_recommendations?: string[];
  suggested_interview_topics?: string[];
}

interface BamlProjectAnalysis {
  research_goal?: unknown;
  question_answers?: BamlInsightMatch[];
  gap_analysis?: BamlGapAnalysis;
  key_discoveries?: string[];
  confidence_score?: number;
  next_steps?: string[];
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function normalizeStep(step: string): string | null {
  if (typeof step !== "string") return null;
  const cleaned = step
    .replace(/^\s*(?:[\u2022*-]|\d+\.?|\(\d+\))\s*/, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function addSteps(target: Set<string>, values: string[] | undefined) {
  if (!values) return;
  for (const value of values) {
    const normalized = normalizeStep(value);
    if (normalized) {
      target.add(normalized);
    }
  }
}

interface ProjectQaItem {
  question: string;
  answer_summary?: string;
  evidence?: string[];
  confidence?: number;
  insights_found?: string[];
  related_insight_ids?: string[];
}

export interface ProjectStatusData {
  projectName: string;
  icp: string;
  totalInterviews: number;
  totalInsights: number;
  totalPersonas: number;
  totalThemes: number;
  totalEvidence: number;
  answeredQuestions: string[];
  openQuestions: string[];
  keyInsights: string[];
  completionScore: number;
  lastUpdated: Date;
  analysisId?: string;
  hasAnalysis: boolean;
  // Enhanced analysis data
  nextSteps: string[];
  nextAction?: string;
  keyDiscoveries: string[];
  confidenceScore?: number;
  confidenceLevel?: number;
  followUpRecommendations: string[];
  suggestedInterviewTopics: string[];
  // New BAML structure fields
  answeredInsights: string[];
  unanticipatedDiscoveries: string[];
  criticalUnknowns: string[];
  // Rich Q&A
  questionAnswers: ProjectQaItem[];
}

export async function getProjectStatusData(
  projectId: string,
  supabase: SupabaseClient<Database>,
): Promise<ProjectStatusData | null> {
  try {
    // Get project with proper authentication
    const projectResult = await getProjectById({
      supabase,
      id: projectId,
    });

    if (!projectResult.data) {
      return null;
    }

    const project = projectResult.data;
    type ProjectRow = {
      name: string;
      description?: string | null;
      icp?: string | null;
      updated_at?: string | null;
      created_at?: string | null;
    };
    const proj = project as unknown as ProjectRow;

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
      .maybeSingle();

    // Fetch basic counts and related research data
    const [
      interviewsResult,
      insightsResult,
      evidenceResult,
      personasResult,
      researchQuestionsResult,
      decisionQuestionsResult,
      analysisRunResult,
    ] = await Promise.all([
      supabase.from("interviews").select("id").eq("project_id", projectId),
      supabase.from("themes").select("id,name").eq("project_id", projectId),
      supabase.from("evidence").select("id").eq("project_id", projectId),
      supabase.from("personas").select("id").eq("project_id", projectId),
      supabase
        .from("research_questions")
        .select("id")
        .eq("project_id", projectId)
        .limit(1),
      supabase
        .from("decision_questions")
        .select("id")
        .eq("project_id", projectId)
        .limit(1),
      supabase
        .from("project_research_analysis_runs")
        .select("recommended_actions")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const totalInterviews = interviewsResult.data?.length || 0;
    const totalInsights = insightsResult.data?.length || 0;
    const totalEvidence = evidenceResult.data?.length || 0;
    const totalPersonas = personasResult.data?.length || 0;
    const totalThemes = totalInsights;

    if (researchQuestionsResult.error) throw researchQuestionsResult.error;
    if (decisionQuestionsResult.error) throw decisionQuestionsResult.error;
    if (analysisRunResult.error) throw analysisRunResult.error;

    const hasResearchStructure =
      (researchQuestionsResult.data?.length || 0) > 0 ||
      (decisionQuestionsResult.data?.length || 0) > 0;

    // Base data structure
    const baseData = {
      projectName: proj.name,
      icp: proj.icp || proj.description || "Unknown ICP",
      totalInterviews,
      totalInsights,
      totalPersonas,
      totalThemes,
      totalEvidence,
      lastUpdated: new Date(
        proj.updated_at || proj.created_at || new Date().toISOString(),
      ),
    };

    const latestRun = analysisRunResult.data;
    let answeredQuestions: string[] = [];
    let openQuestions: string[] = [];
    let keyInsights: string[] = [];
    let keyDiscoveries: string[] = [];
    let answeredInsights: string[] = [];
    let unanticipatedDiscoveries: string[] = [];
    let criticalUnknowns: string[] = [];
    let questionAnswers: ProjectQaItem[] = [];
    let followUpRecommendations: string[] = [];
    let suggestedInterviewTopics: string[] = [];
    let nextAction: string | undefined;
    let confidenceScore: number | undefined;
    let confidenceLevel: number | undefined;
    let analysisId: string | undefined;
    let hasAnalysis = false;
    let completionScore = Math.min(totalInterviews * 25, 100);
    let analysisDerivedNextSteps: string[] = [];

    const stepSet = new Set<string>();

    if (latestAnalysis?.metadata) {
      hasAnalysis = true;
      analysisId = latestAnalysis.id;
      const metadata = latestAnalysis.metadata as Record<string, unknown>;
      const fullAnalysis =
        (metadata.full_analysis as Record<string, unknown>) || {};
      const quickInsights =
        (fullAnalysis.quick_insights as Record<string, unknown>) || {};
      const projectAnalysis =
        (fullAnalysis.project_analysis as BamlProjectAnalysis) || {};
      const gapAnalysis =
        (projectAnalysis.gap_analysis as BamlGapAnalysis) || {};
      const qaRaw =
        (projectAnalysis.question_answers as BamlInsightMatch[]) || [];
      const allInsights = (insightsResult.data || []).map((i) => ({
        id: i.id as string,
        name: (i as any).name as string | undefined,
      }));

      answeredQuestions = toStringArray(metadata.answered_questions);
      openQuestions = toStringArray(metadata.open_questions);
      keyInsights = toStringArray(metadata.key_insights);
      keyDiscoveries = toStringArray(projectAnalysis.key_discoveries);
      analysisDerivedNextSteps = toStringArray(projectAnalysis.next_steps);
      followUpRecommendations = toStringArray(
        gapAnalysis.follow_up_recommendations,
      );
      suggestedInterviewTopics = toStringArray(
        gapAnalysis.suggested_interview_topics,
      );
      confidenceScore =
        typeof projectAnalysis.confidence_score === "number"
          ? projectAnalysis.confidence_score
          : undefined;
      nextAction =
        typeof quickInsights.next_action === "string"
          ? quickInsights.next_action
          : undefined;
      confidenceLevel =
        typeof quickInsights.confidence === "number"
          ? quickInsights.confidence
          : undefined;
      completionScore =
        typeof metadata.completion_score === "number"
          ? metadata.completion_score
          : completionScore;
      answeredInsights =
        toStringArray(metadata.key_insights) ||
        toStringArray(quickInsights.answered_insights);
      unanticipatedDiscoveries =
        toStringArray(metadata.unanticipated_discoveries) ||
        toStringArray(quickInsights.unanticipated_discoveries);
      criticalUnknowns =
        toStringArray(metadata.critical_unknowns) ||
        toStringArray(quickInsights.critical_unknowns);

      const insightsByName = allInsights;
      questionAnswers = qaRaw.map((qa) => {
        const insights_found = Array.isArray(qa?.insights_found)
          ? qa.insights_found
          : [];
        const related_insight_ids: string[] = [];
        const targets = insights_found.map((s) => (s || "").toLowerCase());
        for (const ins of insightsByName) {
          const nm = (ins.name || "").toLowerCase();
          if (!nm) continue;
          if (targets.some((t) => t && (nm.includes(t) || t.includes(nm)))) {
            related_insight_ids.push(ins.id);
          }
        }
        return {
          question: qa?.question || "",
          answer_summary: qa?.answer_summary,
          evidence: Array.isArray(qa?.evidence) ? qa.evidence : [],
          confidence:
            typeof qa?.confidence === "number" ? qa.confidence : undefined,
          insights_found,
          related_insight_ids,
        };
      });
    }

    const recommendedActions = toStringArray(latestRun?.recommended_actions);
    addSteps(stepSet, analysisDerivedNextSteps);
    addSteps(stepSet, followUpRecommendations);
    addSteps(stepSet, recommendedActions);

    if (stepSet.size === 0) {
      if (!hasResearchStructure) {
        stepSet.add(
          "Generate your research plan to create decision and research questions.",
        );
      }
      if (totalInterviews === 0) {
        stepSet.add(
          "Schedule and run your first interviews to start collecting evidence.",
        );
      } else if (totalEvidence === 0) {
        stepSet.add(
          "Upload transcripts or tag interview evidence so the AI can analyze it.",
        );
      }
      if (stepSet.size === 0) {
        stepSet.add(
          "Run the AI evidence analysis to synthesize findings and surface next steps.",
        );
      }
    }

    const nextSteps = Array.from(stepSet);

    return {
      ...baseData,
      answeredQuestions,
      openQuestions,
      keyInsights,
      completionScore,
      analysisId,
      hasAnalysis,
      nextSteps,
      nextAction,
      keyDiscoveries,
      confidenceScore,
      confidenceLevel,
      followUpRecommendations,
      suggestedInterviewTopics,
      answeredInsights,
      unanticipatedDiscoveries,
      criticalUnknowns,
      questionAnswers,
    };
  } catch {
    // Error fetching project status - logged for debugging
    return null;
  }
}
