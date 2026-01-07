import {
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  ListTodo,
  Loader2,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { getServerClient } from "~/lib/supabase/client.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { ResearchLinkResponsesDataTable } from "../components/ResearchLinkResponsesDataTable";
import { getResearchLinkWithResponses } from "../db";
import { ResearchLinkQuestionSchema } from "../schemas";
import { buildResponsesCsv } from "../utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Ask link responses" },
    {
      name: "description",
      content: "Review and export responses from your Ask link.",
    },
  ];
};

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
  const origin = new URL(request.url).origin;
  return {
    accountId,
    projectId,
    list,
    responses: responses ?? [],
    questions: questionsResult.success ? questionsResult.data : [],
    publicUrl: `${origin}/ask/${list.slug}`,
  };
}

// Type for analysis results
interface QuickSummary {
  summary: string;
  top_insights: string[];
  sentiment_overview: string;
  suggested_actions: string[];
}

interface DetailedAnalysis {
  executive_summary: string;
  total_responses: number;
  completion_rate: number;
  top_themes: Array<{
    theme: string;
    description: string;
    frequency: number;
    sentiment: string;
    example_quotes: string[];
  }>;
  question_insights: Array<{
    question: string;
    summary: string;
    key_findings: string[];
    common_answers: string[];
    notable_outliers: string[];
  }>;
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

type AnalysisResult =
  | { mode: "quick"; result: QuickSummary }
  | { mode: "detailed"; result: DetailedAnalysis };

export default function ResearchLinkResponsesPage() {
  const { accountId, projectId, list, responses, questions, publicUrl } =
    useLoaderData<typeof loader>();
  const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);
  const basePath = `/a/${accountId}/${projectId}`;

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const analyzeFetcher = useFetcher<AnalysisResult | { error: string }>();

  const isAnalyzing = analyzeFetcher.state !== "idle";

  // Handle analysis result
  if (
    analyzeFetcher.data &&
    !("error" in analyzeFetcher.data) &&
    analyzeFetcher.data !== analysisResult
  ) {
    setAnalysisResult(analyzeFetcher.data);
    setAnalysisOpen(true);
  }

  const handleAnalyze = (mode: "quick" | "detailed") => {
    analyzeFetcher.submit(
      { listId: list.id, mode },
      { method: "POST", action: routes.ask.index() + "/api/analyze-responses" },
    );
  };

  // Analytics
  const totalResponses = responses.length;
  const completedResponses = responses.filter((r) => r.completed).length;
  const inProgressResponses = totalResponses - completedResponses;
  const completionRate =
    totalResponses > 0
      ? Math.round((completedResponses / totalResponses) * 100)
      : 0;

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

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-3xl">Ask link responses</h1>
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
          <Button
            variant="outline"
            onClick={() => handleAnalyze("quick")}
            disabled={responses.length === 0 || isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Analyze
          </Button>
          <Button onClick={handleExport} disabled={responses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      {totalResponses > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Responses</p>
                <p className="font-semibold text-2xl">{totalResponses}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Completed</p>
                <p className="font-semibold text-2xl">
                  {completedResponses}{" "}
                  <span className="font-normal text-muted-foreground text-sm">
                    ({completionRate}%)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">In Progress</p>
                <p className="font-semibold text-2xl">{inProgressResponses}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
        <ResearchLinkResponsesDataTable
          questions={questions}
          responses={responses}
          basePath={basePath}
          listId={list.id}
        />
      )}

      {/* Analysis Results Sheet */}
      <Sheet open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Response Analysis
            </SheetTitle>
            <SheetDescription>
              AI-generated insights from {totalResponses} responses
            </SheetDescription>
          </SheetHeader>

          {analysisResult && (
            <div className="mt-6 space-y-6">
              {analysisResult.mode === "quick" ? (
                // Quick summary display
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-medium text-sm">Summary</h3>
                    <p className="text-muted-foreground text-sm">
                      {analysisResult.result.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-medium text-sm">
                      Sentiment: {analysisResult.result.sentiment_overview}
                    </h3>
                  </div>

                  <div>
                    <h3 className="mb-2 font-medium text-sm">Top Insights</h3>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                      {analysisResult.result.top_insights.map(
                        (insight, idx) => (
                          <li key={idx}>{insight}</li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-2 font-medium text-sm">
                      Suggested Actions
                    </h3>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                      {analysisResult.result.suggested_actions.map(
                        (action, idx) => (
                          <li key={idx}>{action}</li>
                        ),
                      )}
                    </ul>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleAnalyze("detailed")}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Run Detailed Analysis
                  </Button>
                </div>
              ) : (
                // Detailed analysis display
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 font-medium">Executive Summary</h3>
                    <p className="text-muted-foreground text-sm">
                      {analysisResult.result.executive_summary}
                    </p>
                  </div>

                  {analysisResult.result.top_themes.length > 0 && (
                    <div>
                      <h3 className="mb-3 font-medium">Top Themes</h3>
                      <div className="space-y-3">
                        {analysisResult.result.top_themes.map((theme, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border bg-muted/30 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {theme.theme}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {theme.sentiment}
                              </Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground text-xs">
                              {theme.description}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                              Mentioned by {theme.frequency} respondents
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisResult.result.actionable_insights.length > 0 && (
                    <div>
                      <h3 className="mb-2 font-medium">Actionable Insights</h3>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                        {analysisResult.result.actionable_insights.map(
                          (insight, idx) => (
                            <li key={idx}>{insight}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {analysisResult.result.recommended_followups.length > 0 && (
                    <div>
                      <h3 className="mb-2 font-medium">
                        Recommended Follow-ups
                      </h3>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                        {analysisResult.result.recommended_followups.map(
                          (followup, idx) => (
                            <li key={idx}>{followup}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}
