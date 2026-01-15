import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ListTodo,
  Loader2,
  Maximize2,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
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
import { getServerClient } from "~/lib/supabase/client.server";
import { createR2PresignedUrl } from "~/utils/r2.server";
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
    const key = response.video_url;
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

  return {
    accountId,
    projectId,
    list,
    responses: responsesWithSignedVideos,
    questions,
    questionStats,
    publicUrl: `${origin}/ask/${list.slug}`,
    savedAnalysis,
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
          <h4 className="font-medium text-sm">
            {idx + 1}. {stat.questionText}
          </h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 text-xs">
              {stat.responseCount}/{stat.totalResponses} answered
            </Badge>
            {showFullScreenTrigger && onOpenFullScreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onOpenFullScreen(idx)}
                aria-label="Open full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
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

      {/* Text responses - show actual sample responses */}
      {stat.effectiveType === "text" && stat.text && (
        <div className="space-y-2">
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

      {/* AI Insight for this question */}
      {aiInsight && (
        <div className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
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
          {aiInsight.common_answers.length > 0 && !compact && (
            <div>
              <h5 className="mb-1 font-medium text-muted-foreground text-xs">
                Common Answers
              </h5>
              <ul className="space-y-1">
                {aiInsight.common_answers.map((answer, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary">•</span>
                    {answer}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aiInsight.notable_outliers.length > 0 && !compact && (
            <div>
              <h5 className="mb-1 font-medium text-muted-foreground text-xs">
                Notable Outliers
              </h5>
              <ul className="space-y-1">
                {aiInsight.notable_outliers.map((outlier, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    {outlier}
                  </li>
                ))}
              </ul>
            </div>
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
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
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

  // Get AI insight for a specific question (by matching question text)
  const getQuestionInsight = (
    questionText: string,
  ): QuestionInsight | undefined => {
    if (!detailedResult?.question_insights) return undefined;
    return detailedResult.question_insights.find(
      (insight) =>
        insight.question.toLowerCase().includes(questionText.toLowerCase()) ||
        questionText.toLowerCase().includes(insight.question.toLowerCase()),
    );
  };

  // Analytics
  const totalResponses = responses.length;

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
    setActiveQuestionIndex((prev) => {
      if (direction === "prev") return Math.max(prev - 1, 0);
      return Math.min(prev + 1, questionStats.length - 1);
    });
  };

  const activeBreakdown = questionStats[activeQuestionIndex];

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
            <Link to={routes.ask.edit(list.id)}>Edit link</Link>
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

          {/* AI Analysis Section */}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-lg">
              <Sparkles className="h-5 w-5" />
              AI Analysis
            </h2>
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
              {/* Detailed Analysis Results */}
              {detailedResult && (
                <div className="space-y-4">
                  <p className="text-sm">{detailedResult.executive_summary}</p>

                  {/* Themes */}
                  {detailedResult.top_themes.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-sm">Key Themes</h4>
                      <div className="space-y-3">
                        {detailedResult.top_themes.map((theme, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border bg-muted/30 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {theme.theme}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {theme.frequency} mentions
                                </Badge>
                                <Badge
                                  variant={
                                    theme.sentiment === "Positive"
                                      ? "default"
                                      : theme.sentiment === "Negative"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {theme.sentiment}
                                </Badge>
                              </div>
                            </div>
                            <p className="mt-1 text-muted-foreground text-sm">
                              {theme.description}
                            </p>
                            {theme.example_quotes.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {theme.example_quotes
                                  .slice(0, 2)
                                  .map((quote, qIdx) => (
                                    <p
                                      key={qIdx}
                                      className="border-primary/30 border-l-2 pl-2 text-muted-foreground text-xs italic"
                                    >
                                      "{quote}"
                                    </p>
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actionable Insights */}
                  {detailedResult.actionable_insights.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-medium text-sm">
                        Actionable Insights
                      </h4>
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        {detailedResult.actionable_insights.map(
                          (insight, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-primary">•</span>
                              {insight}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        {detailedResult.total_responses} responses ·{" "}
                        {detailedResult.completion_rate}% completion rate
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
                      aiInsight={getQuestionInsight(stat.questionText)}
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
            <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-hidden p-4 sm:max-w-6xl sm:p-6">
              <DialogHeader className="sr-only">
                <DialogTitle>Response Breakdown</DialogTitle>
                <DialogDescription>
                  View detailed statistics for each question
                </DialogDescription>
              </DialogHeader>

              {activeBreakdown && (
                <div className="flex flex-col gap-3 sm:gap-4">
                  {/* Question header - mobile-first layout */}
                  <div className="space-y-2">
                    <div className="font-semibold text-base leading-snug sm:text-lg">
                      {activeBreakdown.questionText}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                      <span>
                        Question {activeQuestionIndex + 1} of{" "}
                        {questionStats.length}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <Badge variant="outline" className="text-xs">
                        {activeBreakdown.responseCount}/
                        {activeBreakdown.totalResponses} answered
                      </Badge>
                    </div>
                  </div>

                  {/* Navigation - compact on mobile */}
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
                    <div className="flex gap-1">
                      {questionStats.map((_, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setActiveQuestionIndex(idx)}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            idx === activeQuestionIndex
                              ? "bg-primary"
                              : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                          }`}
                          aria-label={`Go to question ${idx + 1}`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => goToQuestion("next")}
                      disabled={activeQuestionIndex >= questionStats.length - 1}
                      className="h-8 px-2 sm:px-3"
                    >
                      <span className="mr-1 hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="h-[55vh] overflow-y-auto pr-1 sm:h-[60vh] sm:pr-2">
                    <QuestionBreakdown
                      stat={activeBreakdown}
                      idx={activeQuestionIndex}
                      compact={false}
                      showDivider={false}
                      hideHeader
                      aiInsight={getQuestionInsight(
                        activeBreakdown.questionText,
                      )}
                    />
                  </div>
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
