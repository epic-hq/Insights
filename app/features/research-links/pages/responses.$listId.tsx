import consola from "consola";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ListTodo,
  Loader2,
  Mail,
  Maximize2,
  Play,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  getSurveySendStats,
  getSurveySends,
} from "~/lib/integrations/gmail.server";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { getServerClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { ResearchLinkResponsesDataTable } from "../components/ResearchLinkResponsesDataTable";
import { getResearchLinkWithResponses } from "../db";
import type { ResearchLinkQuestion } from "../schemas";
import { ResearchLinkQuestionSchema } from "../schemas";
import { buildResponsesCsv, extractAnswer } from "../utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Ask link responses" },
    {
      name: "description",
      content: "Review and export responses from your Ask link.",
    },
  ];
};

/** Statistics for a single question */
interface QuestionStats {
  questionId: string;
  questionText: string;
  questionType: string;
  /** Inferred type used for display (handles "auto" → actual type) */
  effectiveType: "likert" | "single_select" | "multi_select" | "text";
  responseCount: number;
  totalResponses: number;
  /** For numeric/likert questions */
  numeric?: {
    average: number;
    min: number;
    max: number;
    scale: number; // The max scale value (e.g., 5 for 1-5)
    distribution: Record<number, number>; // value -> count
  };
  /** For single/multi select questions */
  choices?: {
    options: Array<{
      value: string;
      count: number;
      percentage: number;
    }>;
  };
  /** For text questions - show sample responses */
  text?: {
    sampleResponses: string[];
    totalAnswered: number;
  };
}

/** Pre-computed statistics stored in research_links.statistics JSONB */
interface PrecomputedStats {
  computedAt: string;
  responseCount: number;
  completedCount: number;
  questions: Array<{
    questionId: string;
    prompt: string;
    type: string;
    responseCount: number;
    stats?: {
      average?: number;
      distribution?: Record<string, number>;
      percentages?: Record<string, number>;
    };
    topResponses?: Array<{ answer: string; personId: string | null }>;
  }>;
}

/** Saved AI analysis stored in research_links.ai_analysis JSONB */
interface SavedAiAnalysis {
  mode: "quick" | "detailed";
  updatedAt: string;
  customInstructions?: string | null;
  result: AnalysisResult | DetailedAnalysisResult;
}

/** Map question type string to effective display type */
function mapQuestionType(
  type: string,
): "likert" | "single_select" | "multi_select" | "text" {
  if (type === "likert") return "likert";
  if (type === "single_select" || type === "image_select")
    return "single_select";
  if (type === "multi_select") return "multi_select";
  return "text";
}

/**
 * Infer the effective type from question config and actual responses.
 * Handles "auto" type by looking at response data.
 */
function inferEffectiveType(
  question: ResearchLinkQuestion,
  answers: unknown[],
): "likert" | "single_select" | "multi_select" | "text" {
  // Explicit types map directly
  if (question.type === "likert") return "likert";
  if (question.type === "single_select" || question.type === "image_select")
    return "single_select";
  if (question.type === "multi_select") return "multi_select";
  if (question.type === "short_text" || question.type === "long_text")
    return "text";

  // For "auto" type, infer from question config and response data
  // If question has options defined, it's a select
  if (question.options && question.options.length > 0) {
    const hasArrayResponses = answers.some((a) => Array.isArray(a));
    return hasArrayResponses ? "multi_select" : "single_select";
  }

  // If question has likert config, it's likert
  if (question.likertScale) return "likert";

  // Check if all non-empty responses are numeric
  const nonEmptyAnswers = answers.filter(
    (a) => a !== undefined && a !== null && a !== "",
  );
  if (nonEmptyAnswers.length > 0) {
    const allNumeric = nonEmptyAnswers.every((a) => {
      if (typeof a === "number") return true;
      if (typeof a === "string") {
        const num = Number.parseFloat(a);
        return !Number.isNaN(num) && num >= 1 && num <= 10;
      }
      return false;
    });
    if (allNumeric) return "likert";
  }

  // Default to text
  return "text";
}

function computeQuestionStats(
  questions: ResearchLinkQuestion[],
  responses: Array<{ responses: Record<string, unknown> | null }>,
): QuestionStats[] {
  const totalResponses = responses.length;

  return questions.map((question) => {
    const questionId = question.id;
    const allAnswers = responses.map((r) => r.responses?.[questionId]);
    const nonEmptyAnswers = allAnswers.filter(
      (a) => a !== undefined && a !== null && a !== "",
    );

    const effectiveType = inferEffectiveType(question, nonEmptyAnswers);

    const base: QuestionStats = {
      questionId,
      questionText: question.prompt,
      questionType: question.type,
      effectiveType,
      responseCount: nonEmptyAnswers.length,
      totalResponses,
    };

    if (effectiveType === "likert") {
      const numericAnswers = nonEmptyAnswers
        .map((a) =>
          typeof a === "number"
            ? a
            : typeof a === "string"
              ? Number.parseFloat(a)
              : Number.NaN,
        )
        .filter((n) => !Number.isNaN(n));

      if (numericAnswers.length > 0) {
        const sum = numericAnswers.reduce((acc, n) => acc + n, 0);
        const distribution: Record<number, number> = {};
        for (const n of numericAnswers) {
          distribution[n] = (distribution[n] || 0) + 1;
        }
        const scale = question.likertScale || Math.max(...numericAnswers);
        base.numeric = {
          average: sum / numericAnswers.length,
          min: Math.min(...numericAnswers),
          max: Math.max(...numericAnswers),
          scale,
          distribution,
        };
      }
    } else if (
      effectiveType === "single_select" ||
      effectiveType === "multi_select"
    ) {
      const optionCounts: Record<string, number> = {};

      for (const answer of nonEmptyAnswers) {
        const selections = Array.isArray(answer) ? answer : [answer];
        for (const sel of selections) {
          if (typeof sel === "string" && sel.trim()) {
            optionCounts[sel] = (optionCounts[sel] || 0) + 1;
          }
        }
      }

      // Calculate percentage based on respondents (not total selections)
      const respondentCount = nonEmptyAnswers.length;
      const options = Object.entries(optionCounts)
        .map(([value, count]) => ({
          value,
          count,
          percentage:
            respondentCount > 0
              ? Math.round((count / respondentCount) * 100)
              : 0,
        }))
        .sort((a, b) => b.count - a.count);

      base.choices = { options };
    } else {
      // Text questions - collect sample responses
      const textAnswers = nonEmptyAnswers.filter(
        (a): a is string => typeof a === "string" && a.trim().length > 0,
      );

      // Get up to 5 sample responses, prioritizing variety (different lengths)
      const sortedByLength = [...textAnswers].sort(
        (a, b) => b.length - a.length,
      );
      const samples: string[] = [];
      // Take longest, shortest, and some from middle
      if (sortedByLength.length > 0) samples.push(sortedByLength[0]);
      if (sortedByLength.length > 1)
        samples.push(sortedByLength[sortedByLength.length - 1]);
      if (sortedByLength.length > 2)
        samples.push(sortedByLength[Math.floor(sortedByLength.length / 2)]);
      // Add more if we have them
      for (const text of sortedByLength) {
        if (samples.length >= 5) break;
        if (!samples.includes(text)) samples.push(text);
      }

      base.text = {
        sampleResponses: samples,
        totalAnswered: textAnswers.length,
      };
    }

    return base;
  });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { accountId, projectId, listId } = params;
  if (!accountId || !projectId || !listId) {
    throw new Response("Missing route parameters", { status: 400 });
  }
  const { client: supabase } = getServerClient(request);
  const { list, listError, responses, responsesError } =
    await getResearchLinkWithResponses({
      supabase,
      accountId,
      listId,
    });
  if (listError) {
    throw new Response(listError.message, { status: 500 });
  }
  if (responsesError) {
    throw new Response(responsesError.message, { status: 500 });
  }
  if (!list) {
    throw new Response("Ask link not found", { status: 404 });
  }
  const questionsResult = ResearchLinkQuestionSchema.array().safeParse(
    list.questions,
  );
  const questions = questionsResult.success ? questionsResult.data : [];
  const origin = new URL(request.url).origin;

  // Always use inline computation to include partial responses
  // Pre-computed stats from trigger task may be stale
  let questionStats: QuestionStats[];
  const precomputedStats = list.statistics as PrecomputedStats | null;
  const totalResponseCount = responses?.length ?? 0;

  // TODO: Re-enable pre-computed stats after trigger task is deployed with fix
  // For now, always compute inline to ensure partial responses are included
  const usePrecomputedStats = false;

  if (precomputedStats?.questions?.length && usePrecomputedStats) {
    // Convert pre-computed stats to the expected format
    questionStats = precomputedStats.questions.map((q) => {
      const question = questions.find((qDef) => qDef.id === q.questionId);
      const effectiveType = mapQuestionType(q.type);

      const base: QuestionStats = {
        questionId: q.questionId,
        questionText: q.prompt,
        questionType: q.type,
        effectiveType,
        responseCount: q.responseCount,
        totalResponses: precomputedStats.responseCount,
      };

      if (q.stats) {
        if (effectiveType === "likert" && q.stats.average !== undefined) {
          const scale = question?.likertScale ?? 5;
          base.numeric = {
            average: q.stats.average,
            min: 1,
            max: scale,
            scale,
            distribution: Object.fromEntries(
              Object.entries(q.stats.distribution ?? {}).map(([k, v]) => [
                Number(k),
                v,
              ]),
            ),
          };
        } else if (
          effectiveType === "single_select" ||
          effectiveType === "multi_select"
        ) {
          base.choices = {
            options: Object.entries(q.stats.distribution ?? {}).map(
              ([value, count]) => ({
                value,
                count,
                percentage: q.stats?.percentages?.[value] ?? 0,
              }),
            ),
          };
        }
      }

      if (q.topResponses?.length) {
        base.text = {
          sampleResponses: q.topResponses.map((r) => r.answer),
          totalAnswered: q.responseCount,
        };
      }

      return base;
    });
  } else {
    // Fall back to inline computation
    questionStats = computeQuestionStats(
      questions,
      (responses ?? []).map((r) => ({
        responses: r.responses as Record<string, unknown> | null,
      })),
    );
  }

  // Generate signed URLs for videos
  const responsesWithSignedVideos = (responses ?? []).map((response) => {
    if (!response.video_url) {
      return { ...response, signed_video_url: null };
    }
    // Extract the R2 key from the public URL
    const key = getR2KeyFromPublicUrl(response.video_url);
    if (!key) {
      consola.warn("Could not extract R2 key from video URL", {
        video_url: response.video_url,
      });
      return { ...response, signed_video_url: null };
    }
    const ext = key.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "mp4"
        ? "video/mp4"
        : ext === "mov"
          ? "video/quicktime"
          : "video/webm";
    const presigned = createR2PresignedUrl({
      key,
      expiresInSeconds: 3600, // 1 hour
      responseContentType: contentType,
    });
    return { ...response, signed_video_url: presigned?.url ?? null };
  });

  // Load saved AI analysis if available
  // Note: ai_analysis column may not exist until migration is applied
  const savedAnalysis = (list as { ai_analysis?: unknown }).ai_analysis as
    | SavedAiAnalysis
    | null
    | undefined;

  // Load email distribution stats (if any sends exist for this survey)
  const emailStats = await getSurveySendStats(supabase, listId);
  const surveySends = emailStats ? await getSurveySends(supabase, listId) : [];

  // Track survey_results_viewed event for PLG instrumentation
  try {
    const posthogServer = getPostHogServerClient();
    if (posthogServer) {
      // Get user from supabase auth session
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        posthogServer.capture({
          distinctId: user.id,
          event: "survey_results_viewed",
          properties: {
            survey_id: listId,
            project_id: projectId,
            account_id: accountId,
            response_count: responsesWithSignedVideos.length,
            question_count: questions.length,
            has_ai_analysis: !!savedAnalysis,
            $groups: { account: accountId },
          },
        });
      }
    }
  } catch (trackingError) {
    consola.warn("[SURVEY_RESULTS] PostHog tracking failed:", trackingError);
    // Don't throw - tracking failure shouldn't block user flow
  }

  return {
    accountId,
    projectId,
    list,
    responses: responsesWithSignedVideos,
    questions,
    questionStats,
    publicUrl: `${origin}/ask/${list.slug}`,
    savedAnalysis,
    emailStats,
    surveySends,
  };
}

// Type for analysis results (matches BAML QuickResponseSummary)
interface AnalysisResult {
  summary: string;
  quality_responses_count: number;
  total_responses_count: number;
  top_insights: string[];
  sentiment_overview: string;
  suggested_actions: string[];
  /** Plain English warning when data quality is poor (>50% junk responses) */
  data_quality_warning?: string;
}

// Type for detailed analysis (matches BAML AskLinkInsightsResponse)
interface QuestionInsight {
  question: string;
  summary: string;
  key_findings: string[];
  common_answers: string[];
  notable_outliers: string[];
}

interface ResponseTheme {
  theme: string;
  description: string;
  frequency: number;
  sentiment: string;
  example_quotes: string[];
}

interface DetailedAnalysisResult {
  executive_summary: string;
  total_responses: number;
  completion_rate: number;
  top_themes: ResponseTheme[];
  question_insights: QuestionInsight[];
  response_segments: Array<{
    segment_name: string;
    segment_description: string;
    respondent_count: number;
    key_characteristics: string[];
    recommended_actions: string[];
  }>;
  recommended_followups: string[];
  actionable_insights: string[];
  data_quality_notes: string[];
}

function QuestionBreakdown({
  stat,
  idx,
  compact = false,
  showDivider = true,
  onOpenFullScreen,
  showFullScreenTrigger = false,
  aiInsight,
  hideHeader = false,
}: {
  stat: QuestionStats;
  idx: number;
  compact?: boolean;
  showDivider?: boolean;
  onOpenFullScreen?: (index: number) => void;
  showFullScreenTrigger?: boolean;
  aiInsight?: QuestionInsight;
  hideHeader?: boolean;
}) {
  return (
    <div
      className={`space-y-3 ${showDivider ? "border-b pb-6 last:border-b-0 last:pb-0" : ""}`}
    >
      {!hideHeader && (
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h4 className="font-semibold text-base">
              {idx + 1}. {stat.questionText}
            </h4>
            <p className="text-muted-foreground text-xs">
              {stat.responseCount}/{stat.totalResponses} answered
            </p>
          </div>
          {showFullScreenTrigger && onOpenFullScreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenFullScreen(idx)}
              aria-label="Open full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Likert/Numeric stats - show average + distribution bars */}
      {stat.effectiveType === "likert" && stat.numeric && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="font-semibold text-3xl">
              {stat.numeric.average.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">
              / {stat.numeric.scale} average
            </span>
            <div className="ml-auto flex h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{
                  width: `${(stat.numeric.average / stat.numeric.scale) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            {Array.from(
              { length: stat.numeric.scale },
              (_, i) => stat.numeric!.scale - i,
            ).map((value) => {
              const count = stat.numeric!.distribution[value] || 0;
              const pct =
                stat.responseCount > 0
                  ? Math.round((count / stat.responseCount) * 100)
                  : 0;
              return (
                <div key={value} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-right font-medium">{value}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-muted-foreground text-xs">
                    {pct}% ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Select stats - show percentage bars */}
      {(stat.effectiveType === "single_select" ||
        stat.effectiveType === "multi_select") &&
        stat.choices &&
        stat.choices.options.length > 0 && (
          <div className="space-y-1.5">
            {stat.choices.options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="flex h-full items-center bg-primary/70 px-2 text-primary-foreground text-xs"
                    style={{
                      width: `${Math.max(option.percentage, 8)}%`,
                    }}
                  >
                    {option.percentage >= 15 && (
                      <span className="truncate">{option.value}</span>
                    )}
                  </div>
                </div>
                <span className="w-12 text-right font-semibold text-sm">
                  {option.percentage}%
                </span>
                {option.percentage < 15 && (
                  <span className="min-w-[100px] truncate text-muted-foreground text-sm">
                    {option.value}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">
                  ({option.count})
                </span>
              </div>
            ))}
          </div>
        )}

      {/* AI Insight for this question - shown above responses */}
      {aiInsight && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI Analysis</span>
          </div>
          <p className="text-sm">{aiInsight.summary}</p>
          {aiInsight.key_findings.length > 0 && (
            <div>
              <h5 className="mb-1 font-medium text-muted-foreground text-xs">
                Key Findings
              </h5>
              <ul className="space-y-1">
                {aiInsight.key_findings.map((finding, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary">•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Text responses - show actual sample responses */}
      {stat.effectiveType === "text" && stat.text && (
        <div className="space-y-2">
          <h5 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Responses
          </h5>
          {stat.text.sampleResponses.length > 0 ? (
            <div className="space-y-2">
              {stat.text.sampleResponses.map((response, i) => (
                <div
                  key={i}
                  className="rounded-lg border-muted-foreground/30 border-l-2 bg-muted/30 py-2 pr-2 pl-3"
                >
                  <p
                    className={`${compact ? "line-clamp-3" : "whitespace-pre-wrap"} text-sm`}
                  >
                    "{response}"
                  </p>
                </div>
              ))}
              {stat.text.totalAnswered > stat.text.sampleResponses.length && (
                <p className="text-muted-foreground text-xs">
                  + {stat.text.totalAnswered - stat.text.sampleResponses.length}{" "}
                  more responses
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No responses yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResearchLinkResponsesPage() {
  const {
    accountId,
    projectId,
    list,
    responses,
    questions,
    questionStats,
    publicUrl,
    savedAnalysis,
    emailStats,
    surveySends,
  } = useLoaderData<typeof loader>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);
  const basePath = `/a/${accountId}/${projectId}`;

  // Initialize state with saved analysis if available
  const initialQuickAnalysis =
    savedAnalysis?.mode === "quick"
      ? (savedAnalysis.result as AnalysisResult)
      : null;
  const initialDetailedAnalysis =
    savedAnalysis?.mode === "detailed"
      ? (savedAnalysis.result as DetailedAnalysisResult)
      : null;

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    initialQuickAnalysis,
  );
  const [detailedResult, setDetailedResult] =
    useState<DetailedAnalysisResult | null>(initialDetailedAnalysis);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [showCustomInstructionsDialog, setShowCustomInstructionsDialog] =
    useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  // AI Analysis modal: 0 = summary, 1-N = themes, N+1 = recommendations
  const [activeAnalysisCard, setActiveAnalysisCard] = useState(0);
  const [showVideoGallery, setShowVideoGallery] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const analyzeFetcher = useFetcher<
    | { mode: "quick"; result: AnalysisResult }
    | { mode: "detailed"; result: DetailedAnalysisResult }
    | { error: string }
  >();

  const isAnalyzing = analyzeFetcher.state !== "idle";

  // Handle analysis result based on mode
  if (analyzeFetcher.data && !("error" in analyzeFetcher.data)) {
    if (
      analyzeFetcher.data.mode === "quick" &&
      analyzeFetcher.data.result !== analysisResult
    ) {
      setAnalysisResult(analyzeFetcher.data.result as AnalysisResult);
    } else if (
      analyzeFetcher.data.mode === "detailed" &&
      analyzeFetcher.data.result !== detailedResult
    ) {
      setDetailedResult(analyzeFetcher.data.result as DetailedAnalysisResult);
    }
  }

  const handleAnalyze = (mode: "quick" | "detailed", instructions?: string) => {
    const payload: Record<string, string> = { listId: list.id, mode };
    if (instructions && instructions.trim()) {
      payload.customInstructions = instructions.trim();
    }
    analyzeFetcher.submit(payload, {
      method: "POST",
      action: routes.ask.index() + "/api/analyze-responses",
    });
    setShowCustomInstructions(false);
  };

  // Get AI insight for a specific question (by index, with text fallback)
  const getQuestionInsight = (
    questionText: string,
    questionIndex: number,
  ): QuestionInsight | undefined => {
    if (!detailedResult?.question_insights) return undefined;
    // Primary: match by index (BAML returns insights in question order)
    if (detailedResult.question_insights[questionIndex]) {
      return detailedResult.question_insights[questionIndex];
    }
    // Fallback: fuzzy text match
    return detailedResult.question_insights.find(
      (insight) =>
        insight.question.toLowerCase().includes(questionText.toLowerCase()) ||
        questionText.toLowerCase().includes(insight.question.toLowerCase()),
    );
  };

  // Analytics
  const totalResponses = responses.length;

  // Video responses - define early for modal card count
  const videoResponses = responses.filter((r) => r.signed_video_url);
  const activeVideoResponse = videoResponses[activeVideoIndex];
  const hasVideoCard = videoResponses.length > 0;
  const breakdownCardCount = questionStats.length + (hasVideoCard ? 1 : 0);

  const handleExport = () => {
    const csv = buildResponsesCsv(questions, responses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${list.slug || "research-link"}-responses.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openBreakdownModal = (startIndex = 0) => {
    setActiveQuestionIndex(startIndex);
    setShowBreakdownModal(true);
  };

  const goToQuestion = (direction: "prev" | "next") => {
    if (questionStats.length === 0) return;
    const maxIndex = hasVideoCard
      ? questionStats.length
      : questionStats.length - 1;
    setActiveQuestionIndex((prev) => {
      if (direction === "prev") return Math.max(prev - 1, 0);
      return Math.min(prev + 1, maxIndex);
    });
  };

  const activeBreakdown = questionStats[activeQuestionIndex];
  const isOnVideoCard =
    hasVideoCard && activeQuestionIndex >= questionStats.length;
  // AI Analysis card layout: 0=summary, 1 to N=themes, N+1=recommendations
  const analysisCardCount = detailedResult
    ? 1 +
      detailedResult.top_themes.length +
      (detailedResult.actionable_insights.length > 0 ? 1 : 0)
    : 0;
  const activeThemeForCard =
    activeAnalysisCard > 0 &&
    activeAnalysisCard <= (detailedResult?.top_themes.length ?? 0)
      ? detailedResult?.top_themes[activeAnalysisCard - 1]
      : null;

  // Arrow key navigation for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showBreakdownModal) {
        if (e.key === "ArrowLeft" && activeQuestionIndex > 0) {
          setActiveQuestionIndex((prev) => prev - 1);
        } else if (
          e.key === "ArrowRight" &&
          activeQuestionIndex < breakdownCardCount - 1
        ) {
          setActiveQuestionIndex((prev) => prev + 1);
        }
      }
      if (showAiAnalysisModal && analysisCardCount > 0) {
        if (e.key === "ArrowLeft" && activeAnalysisCard > 0) {
          setActiveAnalysisCard((prev) => prev - 1);
        } else if (
          e.key === "ArrowRight" &&
          activeAnalysisCard < analysisCardCount - 1
        ) {
          setActiveAnalysisCard((prev) => prev + 1);
        }
      }
      if (showVideoGallery && videoResponses.length > 0) {
        if (e.key === "ArrowLeft" && activeVideoIndex > 0) {
          setActiveVideoIndex((prev) => prev - 1);
        } else if (
          e.key === "ArrowRight" &&
          activeVideoIndex < videoResponses.length - 1
        ) {
          setActiveVideoIndex((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showBreakdownModal,
    showAiAnalysisModal,
    showVideoGallery,
    activeQuestionIndex,
    activeAnalysisCard,
    activeVideoIndex,
    breakdownCardCount,
    analysisCardCount,
    videoResponses.length,
  ]);

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-3xl">
              Survey responses
              {list.name ? ` - ${list.name}` : ""}
            </h1>
            <Badge variant={list.is_live ? "default" : "secondary"}>
              {list.is_live ? "Live" : "Draft"}
            </Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Review captured emails and context, then export to share with your
            team or seed outreach.
          </p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {publicUrl}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={routes.ask.edit(list.id)}>Edit</Link>
          </Button>
          <Button onClick={handleExport} disabled={responses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {responses.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle>No responses yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground text-sm">
            <p>Share your Ask link to start collecting responses.</p>
            <div className="flex items-center gap-2 text-xs">
              <ListTodo className="h-4 w-4" /> {publicUrl}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Row - Just total responses */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-lg">{totalResponses}</span>
              <span className="text-muted-foreground text-sm">
                {totalResponses === 1 ? "response" : "responses"}
              </span>
              <span className="text-muted-foreground text-sm">
                · {questions.length} questions
              </span>
            </div>
            {videoResponses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveVideoIndex(0);
                  setShowVideoGallery(true);
                }}
              >
                <Video className="mr-2 h-4 w-4" />
                {videoResponses.length} video
                {videoResponses.length !== 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {/* Email Distribution Stats */}
          {emailStats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" />
                  Email Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Funnel stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-md border p-3 text-center">
                    <div className="font-semibold text-lg">
                      {emailStats.total}
                    </div>
                    <div className="text-muted-foreground text-xs">Sent</div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="font-semibold text-lg">
                      {emailStats.opened}
                    </div>
                    <div className="text-muted-foreground text-xs">Opened</div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="font-semibold text-lg">
                      {emailStats.completed}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Completed
                    </div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="font-semibold text-lg">
                      {emailStats.pendingNudge}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Pending Nudge
                    </div>
                  </div>
                </div>

                {/* Completion rate bar */}
                {emailStats.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Completion rate</span>
                      <span>
                        {Math.round(
                          (emailStats.completed / emailStats.total) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${Math.round((emailStats.completed / emailStats.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Recipient table */}
                {surveySends.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2">Recipient</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveySends.map((send) => (
                          <tr key={send.id} className="border-t text-xs">
                            <td className="px-3 py-1.5">
                              {send.to_name ? (
                                <span>
                                  {send.to_name}{" "}
                                  <span className="text-muted-foreground">
                                    ({send.to_email})
                                  </span>
                                </span>
                              ) : (
                                send.to_email
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <Badge
                                variant={
                                  send.status === "completed"
                                    ? "default"
                                    : send.status === "opened"
                                      ? "secondary"
                                      : send.status === "bounced" ||
                                          send.status === "failed"
                                        ? "destructive"
                                        : "outline"
                                }
                                className="text-[10px]"
                              >
                                {send.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {new Date(send.sent_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Section */}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-lg">
              <Sparkles className="h-5 w-5" />
              AI Analysis
            </h2>
            <div className="flex items-center gap-2">
              {!analysisResult && !detailedResult && (
                <Button
                  size="sm"
                  onClick={() => handleAnalyze("detailed")}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Analyze
                </Button>
              )}
              {detailedResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveAnalysisCard(0);
                    setShowAiAnalysisModal(true);
                  }}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Full screen
                </Button>
              )}
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              {isAnalyzing && !analysisResult && !detailedResult && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing responses...
                </div>
              )}
              {analyzeFetcher.data &&
                "error" in analyzeFetcher.data &&
                !isAnalyzing && (
                  <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                    <strong>Error:</strong> {analyzeFetcher.data.error}
                  </div>
                )}
              {!analysisResult &&
                !detailedResult &&
                !isAnalyzing &&
                !(analyzeFetcher.data && "error" in analyzeFetcher.data) && (
                  <p className="text-muted-foreground text-sm">
                    Click Analyze to get AI insights including key themes,
                    per-question analysis, and actionable recommendations.
                  </p>
                )}
              {analysisResult && (
                <div className="space-y-4">
                  {/* Data quality warning - shown prominently if present */}
                  {analysisResult.data_quality_warning && (
                    <div className="rounded-md bg-amber-500/10 p-3 text-amber-700 text-sm dark:text-amber-400">
                      <strong>⚠️ Data quality:</strong>{" "}
                      {analysisResult.data_quality_warning}
                    </div>
                  )}

                  <p className="text-sm">{analysisResult.summary}</p>

                  {/* Only show insights/actions if we have them */}
                  {(analysisResult.top_insights.length > 0 ||
                    analysisResult.suggested_actions.length > 0) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {analysisResult.top_insights.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium text-sm">
                            Top Insights
                          </h4>
                          <ul className="space-y-1 text-muted-foreground text-sm">
                            {analysisResult.top_insights.map((insight, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-primary">•</span>
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysisResult.suggested_actions.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-medium text-sm">
                            Suggested Actions
                          </h4>
                          <ul className="space-y-1 text-muted-foreground text-sm">
                            {analysisResult.suggested_actions.map(
                              (action, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-primary">•</span>
                                  {action}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        Sentiment: {analysisResult.sentiment_overview}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowCustomInstructions(!showCustomInstructions)
                          }
                          className="text-xs"
                        >
                          {showCustomInstructions ? "Cancel" : "Custom prompt"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAnalyze("detailed")}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : null}
                          Regenerate
                        </Button>
                      </div>
                    </div>

                    {/* Custom instructions input */}
                    {showCustomInstructions && (
                      <div className="space-y-2">
                        <textarea
                          value={customInstructions}
                          onChange={(e) =>
                            setCustomInstructions(e.target.value)
                          }
                          placeholder="E.g., 'Focus on pricing feedback' or 'Compare responses by company size'"
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCustomInstructions(false);
                              setCustomInstructions("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleAnalyze("detailed", customInstructions)
                            }
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-3 w-3" />
                            )}
                            Analyze
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Detailed Analysis Results - Simplified View */}
              {detailedResult && (
                <div className="space-y-3">
                  <p className="text-sm">{detailedResult.executive_summary}</p>

                  {/* Top themes as simple bullet list */}
                  {detailedResult.top_themes.length > 0 && (
                    <ul className="space-y-1">
                      {detailedResult.top_themes
                        .slice(0, 5)
                        .map((theme, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <span className="text-primary">•</span>
                            <span className="font-medium">{theme.theme}</span>
                            <span className="text-muted-foreground">
                              — {theme.description.split(".")[0]}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-muted-foreground text-xs">
                      {detailedResult.total_responses} responses ·{" "}
                      {detailedResult.completion_rate}% completion
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCustomInstructionsDialog(true)}
                        className="text-xs"
                      >
                        Custom prompt
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAnalyze("detailed")}
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : null}
                        Regenerate
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-Question Statistics */}
          {questionStats.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Response Breakdown</h2>
                <div className="flex gap-2">
                  {!detailedResult && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnalyze("detailed")}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Add AI insights
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openBreakdownModal(0)}
                  >
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Full screen
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="space-y-6 pt-6">
                  {questionStats.map((stat, idx) => (
                    <QuestionBreakdown
                      key={stat.questionId}
                      stat={stat}
                      idx={idx}
                      compact
                      onOpenFullScreen={openBreakdownModal}
                      showFullScreenTrigger
                      aiInsight={getQuestionInsight(stat.questionText, idx)}
                    />
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          <Dialog
            open={showBreakdownModal}
            onOpenChange={(open) => {
              setShowBreakdownModal(open);
              if (!open) setActiveQuestionIndex(0);
            }}
          >
            <DialogContent
              className="max-h-[95vh] w-[95vw] max-w-[95vw] overflow-hidden p-4 sm:max-w-[95vw] sm:p-6"
              overlayClassName="bg-black/85"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Response Breakdown</DialogTitle>
                <DialogDescription>
                  View detailed statistics for each question
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Content area - either question or video card */}
                {isOnVideoCard ? (
                  <>
                    {/* Video Responses Card */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg leading-snug sm:text-xl">
                        <Video className="mr-2 inline-block h-5 w-5" />
                        Video Responses
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {videoResponses.length} video
                        {videoResponses.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="h-[70vh] overflow-y-auto pr-1 sm:pr-2">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {videoResponses.map((response, idx) => (
                          <div
                            key={response.id}
                            className="group relative overflow-hidden rounded-lg border bg-muted/30"
                          >
                            <div className="relative aspect-video bg-black">
                              <video
                                src={response.signed_video_url ?? undefined}
                                className="h-full w-full object-cover"
                                preload="metadata"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveVideoIndex(idx);
                                  setShowVideoGallery(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Play className="h-12 w-12 text-white" />
                              </button>
                            </div>
                            <div className="p-3">
                              <p className="font-medium text-sm">
                                {response.person?.name ||
                                  response.email ||
                                  "Anonymous"}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {response.completed
                                  ? "Completed"
                                  : "Partial response"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : activeBreakdown ? (
                  <>
                    {/* Question header with regenerate button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg leading-snug sm:text-xl">
                          {activeQuestionIndex + 1}.{" "}
                          {activeBreakdown.questionText}
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          {activeBreakdown.responseCount}/
                          {activeBreakdown.totalResponses} answered
                        </p>
                      </div>
                      {!detailedResult && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnalyze("detailed")}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-3 w-3" />
                          )}
                          Add AI insights
                        </Button>
                      )}
                      {detailedResult && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAnalyze("detailed")}
                          disabled={isAnalyzing}
                          title="Regenerate AI analysis"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Content - show ALL responses for text questions */}
                    <div className="h-[70vh] overflow-y-auto pr-1 sm:pr-2">
                      <QuestionBreakdown
                        stat={activeBreakdown}
                        idx={activeQuestionIndex}
                        compact={false}
                        showDivider={false}
                        hideHeader
                        aiInsight={getQuestionInsight(
                          activeBreakdown.questionText,
                          activeQuestionIndex,
                        )}
                      />

                      {/* Full text responses for text questions (show ALL, not just samples) */}
                      {activeBreakdown.effectiveType === "text" && (
                        <div className="mt-4 space-y-2">
                          <h5 className="font-medium text-muted-foreground text-sm">
                            All Responses ({activeBreakdown.responseCount})
                          </h5>
                          <div className="space-y-2">
                            {responses
                              .map((r) => {
                                const answer =
                                  r.responses?.[activeBreakdown.questionId];
                                if (
                                  typeof answer !== "string" ||
                                  !answer.trim()
                                )
                                  return null;
                                return {
                                  answer: answer.trim(),
                                  email: r.email,
                                  name: r.person?.name,
                                };
                              })
                              .filter(Boolean)
                              .map((item, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border-muted-foreground/30 border-l-2 bg-muted/30 py-2 pr-2 pl-3"
                                >
                                  <p className="whitespace-pre-wrap text-sm">
                                    "{item!.answer}"
                                  </p>
                                  <p className="mt-1 text-muted-foreground text-xs">
                                    — {item!.name || item!.email || "Anonymous"}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {/* Navigation in card footer */}
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1.5 sm:px-3 sm:py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToQuestion("prev")}
                    disabled={activeQuestionIndex === 0}
                    className="h-8 px-2 sm:px-3"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">Previous</span>
                  </Button>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {questionStats.map((_, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-all ${
                          idx === activeQuestionIndex
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                        }`}
                        aria-label={`Go to question ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    {/* Video card button at end */}
                    {hasVideoCard && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveQuestionIndex(questionStats.length)
                        }
                        className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-all ${
                          isOnVideoCard
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                        }`}
                        aria-label="Video responses"
                      >
                        <Video className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToQuestion("next")}
                    disabled={activeQuestionIndex >= breakdownCardCount - 1}
                    className="h-8 px-2 sm:px-3"
                  >
                    <span className="mr-1 hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* AI Analysis Full Modal */}
          <Dialog
            open={showAiAnalysisModal}
            onOpenChange={(open) => {
              setShowAiAnalysisModal(open);
              if (!open) setActiveAnalysisCard(0);
            }}
          >
            <DialogContent
              className="max-h-[95vh] w-[90vw] max-w-[90vw] overflow-hidden p-4 sm:max-w-[90vw] sm:p-6"
              overlayClassName="bg-black/85"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>AI Analysis</DialogTitle>
                <DialogDescription>
                  Full analysis with themes and recommendations
                </DialogDescription>
              </DialogHeader>

              {detailedResult && (
                <div className="flex flex-col gap-4">
                  {/* Card content based on activeAnalysisCard */}
                  <div className="h-[50vh] space-y-3 overflow-y-auto pr-1 sm:pr-2">
                    {/* Card 0: Summary */}
                    {activeAnalysisCard === 0 && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">Summary</h3>
                          <p className="text-sm">
                            {detailedResult.executive_summary}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {detailedResult.total_responses} responses ·{" "}
                            {detailedResult.completion_rate}% completion
                          </p>
                        </div>
                        {detailedResult.top_themes.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Key Themes</h4>
                            <ul className="space-y-1">
                              {detailedResult.top_themes.map((theme, idx) => (
                                <li key={idx} className="flex gap-2 text-sm">
                                  <span className="text-primary">•</span>
                                  <span className="font-medium">
                                    {theme.theme}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cards 1 to N: Individual themes */}
                    {activeThemeForCard && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">
                            {activeThemeForCard.theme}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {activeThemeForCard.description}
                          </p>
                        </div>
                        {activeThemeForCard.example_quotes.length > 0 && (
                          <div className="space-y-2">
                            {activeThemeForCard.example_quotes.map(
                              (quote, qIdx) => (
                                <div
                                  key={qIdx}
                                  className="rounded-lg border-muted-foreground/30 border-l-2 bg-muted/30 py-2 pr-2 pl-3"
                                >
                                  <p className="text-sm italic">"{quote}"</p>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Last card: Recommendations */}
                    {activeAnalysisCard ===
                      1 + detailedResult.top_themes.length &&
                      detailedResult.actionable_insights.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-lg">
                            Recommendations
                          </h3>
                          <ul className="space-y-2">
                            {detailedResult.actionable_insights.map(
                              (insight, idx) => (
                                <li key={idx} className="flex gap-2 text-sm">
                                  <span className="text-primary">•</span>
                                  {insight}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>

                  {/* Card navigation at bottom */}
                  {analysisCardCount > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1.5 sm:px-3 sm:py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActiveAnalysisCard((prev) => Math.max(prev - 1, 0))
                        }
                        disabled={activeAnalysisCard === 0}
                        className="h-8 px-2 sm:px-3"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Previous</span>
                      </Button>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: analysisCardCount }).map(
                          (_, idx) => (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => setActiveAnalysisCard(idx)}
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-all ${
                                idx === activeAnalysisCard
                                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                              }`}
                              aria-label={
                                idx === 0
                                  ? "Summary"
                                  : idx === analysisCardCount - 1 &&
                                      detailedResult.actionable_insights
                                        .length > 0
                                    ? "Recommendations"
                                    : `Theme ${idx}`
                              }
                            >
                              {idx + 1}
                            </button>
                          ),
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActiveAnalysisCard((prev) =>
                            Math.min(prev + 1, analysisCardCount - 1),
                          )
                        }
                        disabled={activeAnalysisCard >= analysisCardCount - 1}
                        className="h-8 px-2 sm:px-3"
                      >
                        <span className="mr-1 hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Custom Instructions Dialog */}
          <Dialog
            open={showCustomInstructionsDialog}
            onOpenChange={setShowCustomInstructionsDialog}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Custom Analysis Prompt</DialogTitle>
                <DialogDescription>
                  Add specific instructions to focus the AI analysis on what
                  matters most to you.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="E.g., 'Focus on pricing feedback' or 'Compare responses by company size' or 'Identify pain points with onboarding'"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCustomInstructionsDialog(false);
                      setCustomInstructions("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      handleAnalyze("detailed", customInstructions);
                      setShowCustomInstructionsDialog(false);
                    }}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Analyze
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Video Gallery Modal */}
          <Dialog
            open={showVideoGallery}
            onOpenChange={(open) => {
              setShowVideoGallery(open);
              if (!open) setActiveVideoIndex(0);
            }}
          >
            <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-hidden p-4 sm:max-w-4xl sm:p-6">
              <DialogHeader className="sr-only">
                <DialogTitle>Video Responses</DialogTitle>
                <DialogDescription>
                  Watch video responses from survey participants
                </DialogDescription>
              </DialogHeader>

              {videoResponses.length > 0 && activeVideoResponse && (
                <div className="flex flex-col gap-4">
                  {/* Video player */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                    <video
                      key={activeVideoResponse.id}
                      src={activeVideoResponse.signed_video_url ?? undefined}
                      controls
                      autoPlay
                      className="h-full w-full object-contain"
                    />
                  </div>

                  {/* Response info */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {activeVideoResponse.person?.name ||
                          activeVideoResponse.email ||
                          "Anonymous"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {activeVideoResponse.completed
                          ? "Completed"
                          : "Partial response"}
                      </p>
                    </div>
                    <Link
                      to={`${basePath}/ask/${list.id}/responses/${activeVideoResponse.id}`}
                      className="text-primary text-sm hover:underline"
                    >
                      View full response
                    </Link>
                  </div>

                  {/* Navigation */}
                  {videoResponses.length > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1.5 sm:px-3 sm:py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActiveVideoIndex((prev) => Math.max(prev - 1, 0))
                        }
                        disabled={activeVideoIndex === 0}
                        className="h-8 px-2 sm:px-3"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Previous</span>
                      </Button>
                      <div className="flex items-center gap-1.5">
                        {videoResponses.map((_, idx) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => setActiveVideoIndex(idx)}
                            className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs transition-all ${
                              idx === activeVideoIndex
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                            }`}
                            aria-label={`Video ${idx + 1}`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActiveVideoIndex((prev) =>
                            Math.min(prev + 1, videoResponses.length - 1),
                          )
                        }
                        disabled={activeVideoIndex >= videoResponses.length - 1}
                        className="h-8 px-2 sm:px-3"
                      >
                        <span className="mr-1 hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Data Table */}
          <ResearchLinkResponsesDataTable
            questions={questions}
            responses={responses}
            basePath={basePath}
            listId={list.id}
          />
        </>
      )}
    </PageContainer>
  );
}
