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

// Re-export registry for convenience
export { componentRegistry } from "./component-registry";
