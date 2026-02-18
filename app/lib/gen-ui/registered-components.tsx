/**
 * Registered Gen-UI Components
 *
 * This file registers all available gen-ui components with their schemas.
 * Import this file at the app entry point to ensure components are registered.
 */

import type React from "react";
import {
  InterviewPrompts,
  type InterviewPromptsData,
} from "~/features/generative-ui/components/InterviewPrompts";
import {
  SimpleBANT,
  type SimpleBANTData,
} from "~/features/generative-ui/components/SimpleBANT";
import {
  aiInsightCardDataSchema,
  defineComponent,
  interviewPromptsDataSchema,
  personaCardDataSchema,
  simpleBANTDataSchema,
  statCardDataSchema,
  surveyCreatedDataSchema,
  themeListDataSchema,
} from "./component-registry";

/**
 * Interview Prompts - Interactive checklist for interview questions
 */
defineComponent<InterviewPromptsData>({
  type: "InterviewPrompts",
  description:
    "An interactive checklist for interview questions with drag-to-reorder, edit, and completion tracking.",
  schema: interviewPromptsDataSchema,
  component: InterviewPrompts as React.ComponentType<{
    data: InterviewPromptsData;
    isStreaming?: boolean;
  }>,
  actions: [
    "edit",
    "delete",
    "markDone",
    "unmark",
    "skip",
    "reorder",
    "add",
    "replace",
  ],
  useWhen:
    "User wants to prepare interview questions, create a checklist of prompts, or conduct a structured interview.",
  triggerExamples: [
    "help me prepare questions",
    "interview prompts",
    "create a checklist",
    "research questions",
  ],
});

/**
 * Simple BANT Scorecard - Deal qualification visualization
 */
defineComponent<SimpleBANTData>({
  type: "BANTScorecard",
  description:
    "A BANT (Budget, Authority, Need, Timeline) scorecard for deal qualification with visual progress indicators.",
  schema: simpleBANTDataSchema,
  component: SimpleBANT as React.ComponentType<{
    data: SimpleBANTData;
    isStreaming?: boolean;
  }>,
  actions: ["updateScore", "addNote"],
  useWhen:
    "User is qualifying a sales deal, discussing budget/authority/need/timeline, or wants to assess lead quality.",
  triggerExamples: [
    "qualify this deal",
    "BANT score",
    "sales qualification",
    "is this a good lead",
  ],
});

/**
 * AI Insight Card - AI-generated insight display
 */
interface AiInsightCardData {
  insight: string;
  source?: string;
  href?: string;
}

const AiInsightCard: React.FC<{
  data: AiInsightCardData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-primary/10 p-2">
        <span className="text-primary">✨</span>
      </div>
      <div>
        <span className="font-medium text-primary text-xs">AI Insight</span>
        {data.source && (
          <span className="ml-2 text-muted-foreground text-xs">
            from {data.source}
          </span>
        )}
        <p className="mt-1 text-sm">{data.insight}</p>
      </div>
    </div>
  </div>
);

defineComponent<AiInsightCardData>({
  type: "AiInsightCard",
  description:
    "AI-generated insight display with sparkle icon and optional source attribution.",
  schema: aiInsightCardDataSchema,
  component: AiInsightCard,
  useWhen:
    "Showing AI-generated recommendations, displaying proactive insights, or presenting analysis results.",
  triggerExamples: [
    "show insights",
    "what did you find",
    "recommendations",
    "analysis results",
  ],
});

/**
 * Stat Card - KPI/metric display
 */
interface StatCardData {
  label: string;
  value: string | number;
  change?: string;
  description?: string;
  icon?: string;
}

const StatCard: React.FC<{ data: StatCardData; isStreaming?: boolean }> = ({
  data,
}) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{data.label}</span>
      {data.icon && <span className="text-muted-foreground">{data.icon}</span>}
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="font-bold text-2xl">{data.value}</span>
      {data.change && (
        <span
          className={`text-sm ${data.change.startsWith("+") ? "text-green-600" : "text-red-600"}`}
        >
          {data.change}
        </span>
      )}
    </div>
    {data.description && (
      <p className="mt-1 text-muted-foreground text-xs">{data.description}</p>
    )}
  </div>
);

defineComponent<StatCardData>({
  type: "StatCard",
  description: "KPI/metric display card with optional trend indicator.",
  schema: statCardDataSchema,
  component: StatCard,
  useWhen:
    "Showing metrics or KPIs, displaying statistics, or summarizing counts and numbers.",
  triggerExamples: ["show stats", "how many", "metrics", "summary numbers"],
});

/**
 * Persona Card - Customer persona display
 */
interface PersonaData {
  id: string;
  name: string | null;
  description: string | null;
  color_hex: string | null;
  percentage: number | null;
}

interface PersonaCardData {
  persona: PersonaData;
}

const PersonaCard: React.FC<{
  data: PersonaCardData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const persona = data.persona;
  const name = persona.name || "Untitled Persona";
  const themeColor = persona.color_hex || "#6b7280";
  const percentage = persona.percentage || 0;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="overflow-hidden rounded-lg border bg-card"
      style={{ borderColor: themeColor }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: themeColor }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-medium text-white"
            style={{ backgroundColor: themeColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{name}</p>
            {persona.description && (
              <p className="line-clamp-1 text-muted-foreground text-sm">
                {persona.description}
              </p>
            )}
          </div>
          {percentage > 0 && (
            <span className="font-medium text-muted-foreground text-sm">
              {percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

defineComponent<PersonaCardData>({
  type: "PersonaCard",
  description:
    "Compact persona display with avatar, color theme, and percentage.",
  schema: personaCardDataSchema,
  component: PersonaCard,
  useWhen:
    "Showing a persona or user segment, displaying customer types, or presenting audience segments.",
  triggerExamples: [
    "show persona",
    "customer segments",
    "user types",
    "who are the users",
  ],
});

/**
 * Theme List - Research themes display
 */
interface ThemeItem {
  tag: string;
  text: string;
  impact: number;
  novelty: number;
}

interface ThemeListData {
  themes: ThemeItem[];
}

const ThemeList: React.FC<{ data: ThemeListData; isStreaming?: boolean }> = ({
  data,
}) => (
  <div className="space-y-2">
    {data.themes.map((theme, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 rounded-lg border bg-card p-3"
      >
        <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
          {theme.tag}
        </span>
        <span className="flex-1 text-sm">{theme.text}</span>
        <div className="flex gap-2 text-muted-foreground text-xs">
          <span>Impact: {theme.impact}/5</span>
          <span>Novelty: {theme.novelty}/5</span>
        </div>
      </div>
    ))}
  </div>
);

defineComponent<ThemeListData>({
  type: "ThemeList",
  description: "Display list of themes with impact and novelty scores.",
  schema: themeListDataSchema,
  component: ThemeList,
  useWhen:
    "Showing research themes, displaying insights by theme, or presenting patterns and findings.",
  triggerExamples: [
    "show themes",
    "what patterns",
    "key findings",
    "research themes",
  ],
});

/**
 * Project Context Status - Shows project goals, research questions, ICP
 */
import { projectContextStatusDataSchema } from "./component-registry";

interface ProjectContextStatusData {
  projectId: string;
  name: string;
  description?: string | null;
  goals?: string[];
  researchQuestions?: string[];
  icp?: {
    description?: string | null;
    characteristics?: string[];
  };
  progress?: {
    interviewCount?: number;
    insightCount?: number;
    themeCount?: number;
  };
  workflowType?: string;
  editUrl?: string;
}

const ProjectContextStatus: React.FC<{
  data: ProjectContextStatusData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const hasGoals = data.goals && data.goals.length > 0;
  const hasQuestions =
    data.researchQuestions && data.researchQuestions.length > 0;
  const hasIcp =
    data.icp?.description ||
    (data.icp?.characteristics && data.icp.characteristics.length > 0);
  const hasProgress =
    data.progress &&
    ((data.progress.interviewCount ?? 0) > 0 ||
      (data.progress.insightCount ?? 0) > 0 ||
      (data.progress.themeCount ?? 0) > 0);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{data.name}</h3>
          {data.description && (
            <p className="mt-1 text-muted-foreground text-sm">
              {data.description}
            </p>
          )}
          {data.workflowType && (
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
              {data.workflowType}
            </span>
          )}
        </div>
        {data.editUrl && (
          <a
            href={data.editUrl}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Edit
          </a>
        )}
      </div>

      {/* Progress Stats */}
      {hasProgress && (
        <div className="flex gap-4 border-t pt-3">
          {(data.progress?.interviewCount ?? 0) > 0 && (
            <div className="text-center">
              <div className="font-bold text-2xl">
                {data.progress?.interviewCount}
              </div>
              <div className="text-muted-foreground text-xs">Interviews</div>
            </div>
          )}
          {(data.progress?.insightCount ?? 0) > 0 && (
            <div className="text-center">
              <div className="font-bold text-2xl">
                {data.progress?.insightCount}
              </div>
              <div className="text-muted-foreground text-xs">Insights</div>
            </div>
          )}
          {(data.progress?.themeCount ?? 0) > 0 && (
            <div className="text-center">
              <div className="font-bold text-2xl">
                {data.progress?.themeCount}
              </div>
              <div className="text-muted-foreground text-xs">Themes</div>
            </div>
          )}
        </div>
      )}

      {/* Goals */}
      {hasGoals && (
        <div className="border-t pt-3">
          <h4 className="mb-2 font-medium text-sm">Goals</h4>
          <ul className="space-y-1">
            {data.goals?.map((goal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 text-primary">•</span>
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Research Questions */}
      {hasQuestions && (
        <div className="border-t pt-3">
          <h4 className="mb-2 font-medium text-sm">Research Questions</h4>
          <ul className="space-y-1">
            {data.researchQuestions?.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 font-mono text-muted-foreground text-xs">
                  Q{i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ICP */}
      {hasIcp && (
        <div className="border-t pt-3">
          <h4 className="mb-2 font-medium text-sm">Ideal Customer Profile</h4>
          {data.icp?.description && (
            <p className="mb-2 text-sm">{data.icp.description}</p>
          )}
          {data.icp?.characteristics && data.icp.characteristics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.icp.characteristics.map((c, i) => (
                <span
                  key={i}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasGoals && !hasQuestions && !hasIcp && !hasProgress && (
        <div className="border-t pt-3 text-center text-muted-foreground text-sm">
          No context set yet.{" "}
          {data.editUrl && (
            <a href={data.editUrl} className="text-primary hover:underline">
              Add project context
            </a>
          )}
        </div>
      )}
    </div>
  );
};

defineComponent<ProjectContextStatusData>({
  type: "ProjectContextStatus",
  description:
    "Shows project context including goals, research questions, ICP definition, and progress stats.",
  schema: projectContextStatusDataSchema,
  component: ProjectContextStatus,
  actions: ["editGoals", "editQuestions", "editIcp"],
  useWhen:
    "User asks about project context, goals, research questions, or wants to see project status.",
  triggerExamples: [
    "show project context",
    "what are my research goals",
    "project status",
    "what's the ICP",
  ],
});

import { CheckCircle, ExternalLink, Pencil } from "lucide-react";
/**
 * Survey Created - Confirmation widget after survey creation
 */
import { Link } from "react-router";

interface SurveyCreatedData {
  surveyId: string;
  name: string;
  questionCount: number;
  editUrl: string;
  publicUrl: string;
}

const SurveyCreated: React.FC<{
  data: SurveyCreatedData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
    <div className="flex items-start gap-3">
      <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
      <div className="flex-1">
        <h4 className="font-medium text-green-900 dark:text-green-100">
          Survey Created
        </h4>
        <p className="mt-1 text-green-700 text-sm dark:text-green-300">
          "{data.name}" with {data.questionCount} question
          {data.questionCount !== 1 ? "s" : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            to={data.editUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-green-700"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Survey
          </Link>
          <Link
            to={data.publicUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 py-1.5 font-medium text-green-700 text-sm hover:bg-green-50 dark:border-green-700 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </Link>
        </div>
      </div>
    </div>
  </div>
);

defineComponent<SurveyCreatedData>({
  type: "SurveyCreated",
  description:
    "Confirmation widget shown after a survey is created, with links to edit and preview.",
  schema: surveyCreatedDataSchema,
  component: SurveyCreated,
  actions: ["edit", "preview", "share"],
  useWhen: "A survey was just created and user needs to see confirmation.",
  triggerExamples: ["survey created", "new survey", "ask link created"],
});

/**
 * Insight Card - Simplified insight display for chat
 */
import { ArrowRight, Lightbulb, Minus, Plus, Quote, User } from "lucide-react";
import {
  evidenceCardDataSchema,
  insightCardDataSchema,
  surveyResponseCardDataSchema,
  surveyResponseListDataSchema,
} from "./component-registry";

interface InsightCardData {
  id: string;
  name: string;
  statement?: string | null;
  pain?: string | null;
  jtbd?: string | null;
  category?: string | null;
  evidenceCount?: number;
  detailUrl?: string;
}

const InsightCard: React.FC<{
  data: InsightCardData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="flex items-start gap-3 p-4">
      <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-foreground">{data.name}</h4>
          {data.evidenceCount && data.evidenceCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              <Quote className="h-3 w-3" />
              {data.evidenceCount}
            </span>
          )}
        </div>
        {data.category && (
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
            {data.category}
          </span>
        )}
        {data.statement && (
          <p className="mt-2 text-muted-foreground text-sm">{data.statement}</p>
        )}
        {data.pain && (
          <p className="mt-2 text-muted-foreground text-sm italic">
            <span className="font-medium">Pain:</span> {data.pain}
          </p>
        )}
        {data.jtbd && (
          <p className="mt-1 text-muted-foreground text-sm italic">
            <span className="font-medium">JTBD:</span> {data.jtbd}
          </p>
        )}
        {data.detailUrl && (
          <Link
            to={data.detailUrl}
            className="mt-3 inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            View details <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  </div>
);

defineComponent<InsightCardData>({
  type: "InsightCard",
  description:
    "Display an insight/theme with name, statement, pain point, and evidence count.",
  schema: insightCardDataSchema,
  component: InsightCard,
  actions: ["viewDetails", "addEvidence"],
  useWhen:
    "Showing a specific insight or theme from research, displaying findings, or presenting analysis results.",
  triggerExamples: [
    "show insight",
    "display theme",
    "what did we learn",
    "key finding",
  ],
});

/**
 * Evidence Card - Simplified evidence/quote display for chat
 */
interface EvidenceCardData {
  id: string;
  gist: string;
  verbatim?: string | null;
  topic?: string | null;
  journeyStage?: string | null;
  support?: "supports" | "opposes" | "neutral" | null;
  speakerName?: string | null;
  interviewTitle?: string | null;
  detailUrl?: string;
}

const getStageColor = (stage?: string | null) => {
  if (!stage) return "#3b82f6";
  switch (stage.toLowerCase()) {
    case "awareness":
      return "#f59e0b";
    case "consideration":
      return "#8b5cf6";
    case "decision":
      return "#10b981";
    case "onboarding":
      return "#06b6d4";
    case "retention":
      return "#6366f1";
    default:
      return "#3b82f6";
  }
};

const EvidenceCardGenUI: React.FC<{
  data: EvidenceCardData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const themeColor = getStageColor(data.journeyStage);

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 h-full w-1"
        style={{ backgroundColor: themeColor }}
      />

      <div className="p-4 pl-5">
        {/* Header with gist */}
        <h4 className="font-semibold text-foreground">{data.gist}</h4>

        {/* Speaker info */}
        {data.speakerName && (
          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-sm">
            <User className="h-3 w-3" />
            <span>{data.speakerName}</span>
            {data.interviewTitle && (
              <span className="text-xs">• {data.interviewTitle}</span>
            )}
          </div>
        )}

        {/* Verbatim quote */}
        {data.verbatim && (
          <blockquote
            className="mt-3 border-l-4 py-1 pl-3 text-muted-foreground text-sm italic"
            style={{ borderLeftColor: themeColor }}
          >
            "{data.verbatim}"
          </blockquote>
        )}

        {/* Metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {data.journeyStage && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {data.journeyStage}
            </span>
          )}
          {data.support === "supports" && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Plus className="h-3 w-3" /> Supports
            </span>
          )}
          {data.support === "opposes" && (
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-3 w-3" /> Opposes
            </span>
          )}
          {data.detailUrl && (
            <Link
              to={data.detailUrl}
              className="ml-auto text-primary hover:underline"
            >
              View source →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

defineComponent<EvidenceCardData>({
  type: "EvidenceCard",
  description:
    "Display a piece of evidence/quote with speaker, verbatim quote, and journey stage.",
  schema: evidenceCardDataSchema,
  component: EvidenceCardGenUI,
  actions: ["viewSource", "addToInsight"],
  useWhen: "Showing evidence, quotes, or receipts from interviews or surveys.",
  triggerExamples: [
    "show evidence",
    "display quote",
    "what did they say",
    "receipts",
  ],
});

/**
 * Survey Response Card - Individual survey response display
 */
interface SurveyResponseCardData {
  responseId: string;
  surveyName: string;
  respondentEmail?: string | null;
  respondentName?: string | null;
  completedAt?: string | null;
  answers: Array<{
    question: string;
    answer: string;
    type?: string;
  }>;
  detailUrl?: string;
}

const SurveyResponseCard: React.FC<{
  data: SurveyResponseCardData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{data.surveyName}</h4>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
            {data.respondentName && <span>{data.respondentName}</span>}
            {data.respondentEmail && !data.respondentName && (
              <span>{data.respondentEmail}</span>
            )}
            {data.completedAt && (
              <span className="text-xs">
                • {new Date(data.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {data.detailUrl && (
          <Link
            to={data.detailUrl}
            className="text-primary text-sm hover:underline"
          >
            View details
          </Link>
        )}
      </div>
    </div>
    <div className="divide-y">
      {data.answers.map((qa, idx) => (
        <div key={idx} className="px-4 py-3">
          <p className="font-medium text-muted-foreground text-sm">
            {qa.question}
          </p>
          <p className="mt-1 text-foreground">{qa.answer}</p>
        </div>
      ))}
    </div>
  </div>
);

defineComponent<SurveyResponseCardData>({
  type: "SurveyResponseCard",
  description:
    "Display a single survey response with all questions and answers.",
  schema: surveyResponseCardDataSchema,
  component: SurveyResponseCard,
  actions: ["viewDetails", "extractEvidence"],
  useWhen:
    "Showing a specific survey response, displaying feedback, or reviewing individual submissions.",
  triggerExamples: [
    "show response",
    "survey answer",
    "what did they submit",
    "feedback details",
  ],
});

/**
 * Survey Response List - Multiple responses summary
 */
interface SurveyResponseListData {
  surveyName: string;
  totalResponses: number;
  responses: Array<{
    id: string;
    respondentName?: string | null;
    completedAt?: string | null;
    highlightAnswer?: string;
  }>;
  viewAllUrl?: string;
}

const SurveyResponseList: React.FC<{
  data: SurveyResponseListData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{data.surveyName}</h4>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {data.totalResponses} response{data.totalResponses !== 1 ? "s" : ""}
          </p>
        </div>
        {data.viewAllUrl && (
          <Link
            to={data.viewAllUrl}
            className="text-primary text-sm hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
    </div>
    <div className="divide-y">
      {data.responses.map((response) => (
        <div
          key={response.id}
          className="flex items-center justify-between px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              {response.respondentName || "Anonymous"}
            </p>
            {response.highlightAnswer && (
              <p className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                "{response.highlightAnswer}"
              </p>
            )}
          </div>
          {response.completedAt && (
            <span className="shrink-0 text-muted-foreground text-xs">
              {new Date(response.completedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);

defineComponent<SurveyResponseListData>({
  type: "SurveyResponseList",
  description:
    "Display a list of survey responses with summary info and highlighted answers.",
  schema: surveyResponseListDataSchema,
  component: SurveyResponseList,
  actions: ["viewAll", "filterResponses", "exportResponses"],
  useWhen:
    "Showing multiple survey responses, listing feedback, or summarizing survey results.",
  triggerExamples: [
    "show responses",
    "list survey results",
    "who responded",
    "survey summary",
  ],
});

/**
 * People List - Scrollable list of contacts
 */
import {
  actionCardsDataSchema,
  orgContextStatusDataSchema,
  peopleListDataSchema,
  personCardDataSchema,
  taskListDataSchema,
} from "./component-registry";
import {
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink as ExternalLinkIcon,
  Mail,
  MessageSquare,
  Users,
} from "lucide-react";

interface PersonListItem {
  id: string;
  name: string;
  title: string | null;
  orgName: string | null;
  lastInteractionDate?: string | null;
  evidenceCount?: number;
  avatarUrl?: string | null;
  detailUrl?: string;
}

interface PeopleListData {
  people: PersonListItem[];
  totalCount?: number;
  viewAllUrl?: string;
}

const PeopleList: React.FC<{
  data: PeopleListData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const count = data.totalCount ?? data.people.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold">People</h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            {count}
          </span>
        </div>
        {data.viewAllUrl && (
          <Link
            to={data.viewAllUrl}
            className="text-primary text-sm hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
      <div className="max-h-80 divide-y overflow-y-auto">
        {data.people.map((person) => {
          const initials = person.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={person.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">
                  {person.detailUrl ? (
                    <Link
                      to={person.detailUrl}
                      className="hover:text-primary hover:underline"
                    >
                      {person.name}
                    </Link>
                  ) : (
                    person.name
                  )}
                </p>
                {(person.title || person.orgName) && (
                  <p className="truncate text-muted-foreground text-xs">
                    {person.title}
                    {person.title && person.orgName && " @ "}
                    {person.orgName}
                  </p>
                )}
              </div>
              {person.lastInteractionDate && (
                <span className="shrink-0 text-muted-foreground text-xs">
                  {new Date(person.lastInteractionDate).toLocaleDateString()}
                </span>
              )}
              {person.evidenceCount != null && person.evidenceCount > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                  <Quote className="h-3 w-3" />
                  {person.evidenceCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

defineComponent<PeopleListData>({
  type: "PeopleList",
  description:
    "Scrollable list of people/contacts with names, titles, organizations, and evidence counts.",
  schema: peopleListDataSchema,
  component: PeopleList,
  actions: ["viewAll", "filterPeople"],
  useWhen:
    "User wants to see a list of contacts, people they talked to, or participants in research.",
  triggerExamples: [
    "show contacts",
    "who did I talk to",
    "people list",
    "list participants",
    "show people",
  ],
});

/**
 * Person Card - Detailed person display
 */
interface PersonCardData {
  id: string;
  name: string;
  title: string | null;
  orgName: string | null;
  email: string | null;
  evidenceCount?: number;
  conversationCount?: number;
  surveyCount?: number;
  icpBand?: string | null;
  themes?: string[];
  detailUrl?: string;
}

const PersonCard: React.FC<{
  data: PersonCardData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const initials = data.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const themes = data.themes?.slice(0, 5) ?? [];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold">{data.name}</h4>
            {(data.title || data.orgName) && (
              <p className="text-muted-foreground text-sm">
                {data.title}
                {data.title && data.orgName && " @ "}
                {data.orgName}
              </p>
            )}
            {data.email && (
              <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                <Mail className="h-3 w-3" />
                {data.email}
              </p>
            )}
          </div>
          {data.icpBand && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
              {data.icpBand}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-4 border-t pt-3">
          {data.evidenceCount != null && data.evidenceCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Quote className="h-3.5 w-3.5" />
              <span>{data.evidenceCount} evidence</span>
            </div>
          )}
          {data.conversationCount != null && data.conversationCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{data.conversationCount} conversations</span>
            </div>
          )}
          {data.surveyCount != null && data.surveyCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <span className="text-xs">📋</span>
              <span>{data.surveyCount} surveys</span>
            </div>
          )}
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {themes.map((theme, i) => (
              <span
                key={i}
                className="rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {theme}
              </span>
            ))}
          </div>
        )}

        {/* Detail link */}
        {data.detailUrl && (
          <Link
            to={data.detailUrl}
            className="mt-3 inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            View profile <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
};

defineComponent<PersonCardData>({
  type: "PersonCard",
  description:
    "Detailed person card with name, title, org, contact info, stats, ICP band, and themes.",
  schema: personCardDataSchema,
  component: PersonCard,
  actions: ["viewProfile", "addNote"],
  useWhen: "Showing detailed information about a specific person or contact.",
  triggerExamples: [
    "show person details",
    "who is this contact",
    "person profile",
    "contact info",
  ],
});

/**
 * Task List - Checklist of tasks with priority
 */
interface TaskItem {
  id: string;
  text: string;
  status: "pending" | "done" | "dismissed";
  priority: number;
  source?: string;
  dueDate?: string;
}

interface TaskListData {
  tasks: TaskItem[];
  title?: string;
}

const priorityDotColor = (priority: number) => {
  switch (priority) {
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-amber-500";
    case 3:
      return "bg-blue-400";
    default:
      return "bg-gray-400";
  }
};

const TaskListComponent: React.FC<{
  data: TaskListData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    {data.title && (
      <div className="border-b bg-muted/50 px-4 py-3">
        <h4 className="font-semibold">{data.title}</h4>
      </div>
    )}
    <div className="divide-y">
      {data.tasks.map((task) => (
        <div
          key={task.id}
          className={`flex items-start gap-3 px-4 py-3 ${task.status === "done" ? "opacity-60" : ""} ${task.status === "dismissed" ? "opacity-40" : ""}`}
        >
          {task.status === "done" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${priorityDotColor(task.priority)}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm ${task.status === "done" ? "line-through" : ""}`}
            >
              {task.text}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {task.source && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                  {task.source}
                </span>
              )}
              {task.dueDate && (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Clock className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

defineComponent<TaskListData>({
  type: "TaskList",
  description:
    "Checklist of tasks with priority indicators, completion status, and optional source/due date.",
  schema: taskListDataSchema,
  component: TaskListComponent,
  actions: ["markDone", "dismiss", "addTask"],
  useWhen:
    "User wants to see tasks, action items, or a checklist of things to do.",
  triggerExamples: [
    "show tasks",
    "my to-do list",
    "action items",
    "what needs to be done",
  ],
});

/**
 * Action Cards - Prioritized recommended actions with reasoning
 */
interface ActionCardItem {
  id: string;
  action: string;
  reasoning: string;
  priority: number;
  personName?: string;
  evidenceLink?: string;
}

interface ActionCardsData {
  actions: ActionCardItem[];
  title?: string;
}

const priorityBadgeClass = (priority: number) => {
  switch (priority) {
    case 1:
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    case 2:
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case 3:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
};

const ActionCardsComponent: React.FC<{
  data: ActionCardsData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="space-y-3">
    {data.title && <h4 className="font-semibold">{data.title}</h4>}
    {data.actions.map((item, idx) => (
      <div
        key={item.id}
        className="overflow-hidden rounded-lg border bg-card p-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs ${priorityBadgeClass(item.priority)}`}
          >
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{item.action}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              {item.reasoning}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              {item.personName && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  {item.personName}
                </span>
              )}
              {item.evidenceLink && (
                <Link
                  to={item.evidenceLink}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Quote className="h-3 w-3" />
                  View evidence
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

defineComponent<ActionCardsData>({
  type: "ActionCards",
  description:
    "Prioritized recommended actions with numbered badges, reasoning, and optional person/evidence links.",
  schema: actionCardsDataSchema,
  component: ActionCardsComponent,
  actions: ["dismiss", "markDone", "snooze"],
  useWhen:
    "User wants recommendations, suggested next steps, or prioritized actions based on research.",
  triggerExamples: [
    "what should I do next",
    "recommendations",
    "suggested actions",
    "next steps",
  ],
});

/**
 * Organization Context Status - Company/org overview card
 */
interface OrgContextStatusData {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  stage: string | null;
  website: string | null;
  contactCount?: number;
  conversationCount?: number;
  evidenceCount?: number;
  detailUrl?: string;
}

const OrganizationContextStatus: React.FC<{
  data: OrgContextStatusData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const metadata = [
    { label: "Industry", value: data.industry },
    { label: "Size", value: data.size },
    { label: "Stage", value: data.stage },
  ].filter((m) => m.value);

  const hasStats =
    (data.contactCount ?? 0) > 0 ||
    (data.conversationCount ?? 0) > 0 ||
    (data.evidenceCount ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">{data.name}</h4>
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground text-sm hover:text-primary"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                  {data.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
          {data.detailUrl && (
            <Link
              to={data.detailUrl}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              View details
            </Link>
          )}
        </div>

        {/* Metadata grid */}
        {metadata.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {metadata.map((m) => (
              <div key={m.label}>
                <span className="text-muted-foreground text-xs">{m.label}</span>
                <p className="font-medium text-sm">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {hasStats && (
          <div className="mt-4 flex gap-4 border-t pt-3">
            {(data.contactCount ?? 0) > 0 && (
              <div className="text-center">
                <div className="font-bold text-xl">{data.contactCount}</div>
                <div className="text-muted-foreground text-xs">Contacts</div>
              </div>
            )}
            {(data.conversationCount ?? 0) > 0 && (
              <div className="text-center">
                <div className="font-bold text-xl">
                  {data.conversationCount}
                </div>
                <div className="text-muted-foreground text-xs">
                  Conversations
                </div>
              </div>
            )}
            {(data.evidenceCount ?? 0) > 0 && (
              <div className="text-center">
                <div className="font-bold text-xl">{data.evidenceCount}</div>
                <div className="text-muted-foreground text-xs">Evidence</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

defineComponent<OrgContextStatusData>({
  type: "OrganizationContextStatus",
  description:
    "Organization overview card with company name, metadata (industry, size, stage), website, and stats.",
  schema: orgContextStatusDataSchema,
  component: OrganizationContextStatus,
  actions: ["viewDetails", "editOrg"],
  useWhen:
    "User asks about an organization, company details, or wants to see what we know about a specific company.",
  triggerExamples: [
    "show org context",
    "organization details",
    "what do we know about this company",
    "company info",
  ],
});

/**
 * Conversation Lens Insights - Key takeaways from lens analysis
 */
import { BookOpen, BarChart3, ClipboardList } from "lucide-react";
import {
  conversationLensInsightsDataSchema,
  surveyResultsSummaryDataSchema,
} from "./component-registry";

interface ConversationLensInsight {
  label: string;
  summary: string;
  confidence?: number | null;
}

interface ConversationLensInsightsData {
  interviewTitle: string;
  frameworkName: string;
  insights: ConversationLensInsight[];
  overallSummary?: string;
  detailUrl?: string;
}

const ConversationLensInsights: React.FC<{
  data: ConversationLensInsightsData;
  isStreaming?: boolean;
}> = ({ data }) => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <div>
            <h4 className="font-semibold">{data.frameworkName}</h4>
            <p className="text-muted-foreground text-xs">
              {data.interviewTitle}
            </p>
          </div>
        </div>
        {data.detailUrl && (
          <Link
            to={data.detailUrl}
            className="text-primary text-sm hover:underline"
          >
            View full analysis →
          </Link>
        )}
      </div>
    </div>
    {data.overallSummary && (
      <div className="border-b bg-primary/5 px-4 py-2.5">
        <p className="text-sm">{data.overallSummary}</p>
      </div>
    )}
    <div className="divide-y">
      {data.insights.map((insight, idx) => (
        <div key={idx} className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm">{insight.label}</span>
            {insight.confidence != null && (
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {insight.confidence}%
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            {insight.summary}
          </p>
        </div>
      ))}
    </div>
  </div>
);

defineComponent<ConversationLensInsightsData>({
  type: "ConversationLensInsights",
  description:
    "Key insights from a conversation lens analysis showing framework name, per-facet summaries, and confidence scores.",
  schema: conversationLensInsightsDataSchema,
  component: ConversationLensInsights,
  actions: ["viewFullAnalysis", "rerunAnalysis"],
  useWhen:
    "Showing lens analysis results, BANT/MEDDIC/empathy map insights, or conversation analysis summaries.",
  triggerExamples: [
    "lens insights",
    "conversation analysis",
    "BANT results",
    "what did the lens find",
  ],
});

/**
 * Survey Results Summary - Aggregate survey results overview
 */
interface SurveyQuestionSummary {
  question: string;
  topAnswer: string;
  responseCount: number;
}

interface SurveyResultsSummaryData {
  surveyName: string;
  totalResponses: number;
  completionRate?: number;
  questionSummaries?: SurveyQuestionSummary[];
  topThemes?: string[];
  detailUrl?: string;
}

const SurveyResultsSummary: React.FC<{
  data: SurveyResultsSummaryData;
  isStreaming?: boolean;
}> = ({ data }) => {
  const summaries = data.questionSummaries?.slice(0, 5) ?? [];
  const themes = data.topThemes?.slice(0, 6) ?? [];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h4 className="font-semibold">{data.surveyName}</h4>
          </div>
          {data.detailUrl && (
            <Link
              to={data.detailUrl}
              className="text-primary text-sm hover:underline"
            >
              View details →
            </Link>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 border-b px-4 py-3">
        <div className="text-center">
          <div className="font-bold text-xl">{data.totalResponses}</div>
          <div className="text-muted-foreground text-xs">Responses</div>
        </div>
        {data.completionRate != null && (
          <div className="text-center">
            <div className="font-bold text-xl">{data.completionRate}%</div>
            <div className="text-muted-foreground text-xs">Completion</div>
          </div>
        )}
        {summaries.length > 0 && (
          <div className="text-center">
            <div className="font-bold text-xl">{summaries.length}</div>
            <div className="text-muted-foreground text-xs">Questions</div>
          </div>
        )}
      </div>

      {/* Top themes */}
      {themes.length > 0 && (
        <div className="border-b px-4 py-3">
          <p className="mb-2 font-medium text-muted-foreground text-xs">
            Top Themes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((theme, i) => (
              <span
                key={i}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Question summaries */}
      {summaries.length > 0 && (
        <div className="divide-y">
          {summaries.map((qs, idx) => (
            <div key={idx} className="px-4 py-3">
              <p className="font-medium text-muted-foreground text-sm">
                {qs.question}
              </p>
              <p className="mt-1 text-foreground text-sm">{qs.topAnswer}</p>
              <span className="mt-1 inline-block text-muted-foreground text-xs">
                {qs.responseCount} response{qs.responseCount !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

defineComponent<SurveyResultsSummaryData>({
  type: "SurveyResultsSummary",
  description:
    "Aggregate survey results with response count, completion rate, top themes, and per-question summaries.",
  schema: surveyResultsSummaryDataSchema,
  component: SurveyResultsSummary,
  actions: ["viewDetails", "exportResults", "analyzeThemes"],
  useWhen:
    "Showing overall survey results, aggregate response data, or survey performance metrics.",
  triggerExamples: [
    "survey results",
    "how did the survey do",
    "response summary",
    "survey performance",
  ],
});

/**
 * Upload Recording - Inline file upload for audio/video/text/PDF
 */
import {
  UploadRecording,
  type UploadRecordingData,
} from "~/features/generative-ui/components/UploadRecording";
import { uploadRecordingDataSchema } from "./component-registry";

defineComponent<UploadRecordingData>({
  type: "UploadRecording",
  description:
    "Inline file upload widget for adding recordings, transcripts, or documents. Supports drag-and-drop of audio, video, text, and PDF files.",
  schema: uploadRecordingDataSchema,
  component: UploadRecording as React.ComponentType<{
    data: UploadRecordingData;
    isStreaming?: boolean;
  }>,
  actions: ["upload", "cancel"],
  useWhen:
    "User wants to upload a recording, add a transcript, import an interview, or ingest a document into the project.",
  triggerExamples: [
    "upload a recording",
    "add an interview",
    "import a transcript",
    "upload audio",
    "add a document",
  ],
});

// Re-export registry for convenience
export { componentRegistry } from "./component-registry";
