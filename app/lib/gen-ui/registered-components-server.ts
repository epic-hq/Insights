/**
 * Server-safe Gen-UI Component Registrations
 *
 * Registers component schemas and metadata WITHOUT importing React components.
 * Used by Mastra tools and agent-context on the server where React component
 * imports would fail or pull in unnecessary browser dependencies.
 *
 * The client-side `registered-components.tsx` re-registers with actual React
 * components for rendering. The registry deduplicates by type, so whichever
 * runs last wins (client version with real components).
 */

import {
  componentRegistry,
  // JTBD widget schemas
  decisionBriefDataSchema,
  decisionSupportDataSchema,
  evidenceWallDataSchema,
  intakeBatchStatusDataSchema,
  intakeHealthDataSchema,
  intakePathPickerDataSchema,
  patternSynthesisDataSchema,
  progressRailDataSchema,
  researchPulseDataSchema,
  stakeholderMapDataSchema,
  surveyOutreachDataSchema,
  // Existing widget schemas
  conversationLensInsightsDataSchema,
  interviewPromptsDataSchema,
  simpleBANTDataSchema,
  aiInsightCardDataSchema,
  statCardDataSchema,
  personaCardDataSchema,
  themeListDataSchema,
  surveyCreatedDataSchema,
} from "./component-registry";

// Null component placeholder — only schema/metadata is needed server-side
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NULL_COMPONENT = null as any;

// ── Existing widgets ──

componentRegistry.register({
  type: "InterviewPrompts",
  description:
    "An interactive checklist for interview questions with drag-to-reorder, edit, and completion tracking.",
  schema: interviewPromptsDataSchema,
  component: NULL_COMPONENT,
  useWhen:
    "User asks for interview questions, wants to prepare for an interview, or needs a question list.",
  triggerExamples: [
    "interview questions",
    "prepare for interview",
    "question list",
  ],
});

componentRegistry.register({
  type: "BANTScorecard",
  description: "A simple BANT analysis scorecard.",
  schema: simpleBANTDataSchema,
  component: NULL_COMPONENT,
  useWhen: "User asks for BANT analysis or sales qualification data.",
  triggerExamples: ["BANT analysis", "sales qualification"],
});

componentRegistry.register({
  type: "AiInsightCard",
  description: "A card displaying an AI-generated insight with key evidence.",
  schema: aiInsightCardDataSchema,
  component: NULL_COMPONENT,
  useWhen: "Presenting a focused AI insight with supporting quotes.",
  triggerExamples: ["key insight", "what does the data say"],
});

componentRegistry.register({
  type: "StatCard",
  description: "Stat display card with a label, value, and optional trend.",
  schema: statCardDataSchema,
  component: NULL_COMPONENT,
  useWhen: "Showing a single metric or KPI.",
  triggerExamples: ["how many", "show count"],
});

componentRegistry.register({
  type: "PersonaCard",
  description: "Persona card showing a target customer profile.",
  schema: personaCardDataSchema,
  component: NULL_COMPONENT,
  useWhen: "User asks about personas or target customer profiles.",
  triggerExamples: ["persona", "target customer"],
});

componentRegistry.register({
  type: "ThemeList",
  description: "A list of research themes with evidence counts.",
  schema: themeListDataSchema,
  component: NULL_COMPONENT,
  useWhen: "User asks for themes or recurring patterns.",
  triggerExamples: ["list themes", "recurring patterns"],
});

componentRegistry.register({
  type: "SurveyCreated",
  description: "Confirmation widget after creating a survey.",
  schema: surveyCreatedDataSchema,
  component: NULL_COMPONENT,
  useWhen: "After successfully creating a survey.",
  triggerExamples: [],
});

componentRegistry.register({
  type: "ConversationLensInsights",
  description:
    "Rich conversation lens analysis widget. For JTBD lenses: shows job statement, forces of progress quadrant, journey matrix, and recommendations. For other lenses: shows section cards with key/value fields. Accepts raw analysis_data from conversation_lens_analyses.",
  schema: conversationLensInsightsDataSchema,
  component: NULL_COMPONENT,
  actions: ["viewFullAnalysis", "filterByStep", "askAbout"],
  useWhen:
    "Showing JTBD analysis, conversation lens results, structured analysis frameworks (empathy maps, customer discovery, BANT lens), or when user asks to 'show me the analysis'.",
  triggerExamples: [
    "show me the JTBD analysis",
    "jobs to be done",
    "lens results",
    "conversation analysis",
    "show the analysis for this interview",
  ],
});

// ── JTBD Time-to-Aha widgets ──

componentRegistry.register({
  type: "ProgressRail",
  description:
    "Horizontal progress rail showing which phase of the research journey the user is in: Frame Decision, Collect Signal, Validate Pattern, Commit Actions, Measure.",
  schema: progressRailDataSchema,
  component: NULL_COMPONENT,
  useWhen:
    "At the start of any session with an active project, when user asks about progress, or when a phase transition occurs.",
  triggerExamples: [
    "where am I",
    "what's my progress",
    "show my status",
    "research progress",
  ],
});

componentRegistry.register({
  type: "DecisionBrief",
  description:
    "Decision framing card showing the core research question, target customer, deadline, success metric, and completeness checklist.",
  schema: decisionBriefDataSchema,
  component: NULL_COMPONENT,
  actions: ["editBrief", "completeBrief"],
  useWhen:
    "User asks about their decision frame, wants to set up research, or when a new project has no goals set.",
  triggerExamples: [
    "what decision am I making",
    "frame the problem",
    "set up my research",
    "decision brief",
  ],
});

componentRegistry.register({
  type: "IntakePathPicker",
  description:
    "Three-card picker for choosing an intake path: upload interviews, start live recording, or send surveys.",
  schema: intakePathPickerDataSchema,
  component: NULL_COMPONENT,
  actions: ["selectPath"],
  useWhen:
    "User wants to start collecting data, asks how to get started, or after the Decision Brief is complete.",
  triggerExamples: [
    "how do I get started",
    "collect data",
    "fastest way to get signal",
    "intake options",
  ],
});

componentRegistry.register({
  type: "IntakeBatchStatus",
  description:
    "Batch processing status showing all uploaded files with their processing state, signal gate, and next action.",
  schema: intakeBatchStatusDataSchema,
  component: NULL_COMPONENT,
  actions: ["uploadMore", "reviewEvidence"],
  useWhen:
    "User asks about upload processing status, or after multiple files have been uploaded.",
  triggerExamples: [
    "how are my uploads",
    "processing status",
    "are my interviews ready",
    "intake status",
  ],
});

componentRegistry.register({
  type: "SurveyOutreach",
  description:
    "Survey distribution widget with shareable link, recipient list, delivery funnel, and response tracking.",
  schema: surveyOutreachDataSchema,
  component: NULL_COMPONENT,
  actions: ["copyLink", "addRecipients"],
  useWhen:
    "User wants to share a survey, check survey responses, or after a survey is created.",
  triggerExamples: [
    "send surveys",
    "share survey link",
    "survey responses",
    "who responded",
  ],
});

componentRegistry.register({
  type: "IntakeHealth",
  description:
    "Research intake health dashboard showing confidence tier, coverage by persona/segment, source mix, gaps, and signal gate status. The key confidence gate widget.",
  schema: intakeHealthDataSchema,
  component: NULL_COMPONENT,
  actions: ["collectMore", "proceedToAnalysis"],
  useWhen:
    "User asks if they have enough data, wants a signal check, or is deciding whether to collect more or proceed to analysis.",
  triggerExamples: [
    "do I have enough data",
    "intake health",
    "signal check",
    "am I ready to analyze",
    "coverage check",
    "research gaps",
    "what are my gaps",
  ],
});

componentRegistry.register({
  type: "EvidenceWall",
  description:
    "Grouped evidence wall showing real customer quotes clustered by pain points and goals, with source attribution and traceability.",
  schema: evidenceWallDataSchema,
  component: NULL_COMPONENT,
  actions: ["viewAll", "groupByTheme"],
  useWhen:
    "User wants to see real customer quotes, evidence grouped by theme, or ground themselves in the data.",
  triggerExamples: [
    "show me the evidence",
    "what did people say",
    "customer voice",
    "real quotes",
    "top pain points",
  ],
});

componentRegistry.register({
  type: "PatternSynthesis",
  description:
    "Pattern synthesis view showing ranked themes with confidence tiers (strong/emerging/thin), mention counts, supporting quotes, and narrative summary.",
  schema: patternSynthesisDataSchema,
  component: NULL_COMPONENT,
  actions: ["planActions", "collectMore"],
  useWhen:
    "User asks what patterns are emerging, wants theme synthesis, or after intake health shows sufficient signal.",
  triggerExamples: [
    "what patterns emerged",
    "show themes",
    "synthesize findings",
    "what repeats",
    "strongest signal",
  ],
});

componentRegistry.register({
  type: "DecisionSupport",
  description:
    "Decision forcing widget showing recommended actions ranked by impact, with effort/impact assessment, tradeoffs, evidence links, and ability to commit with owners and dates.",
  schema: decisionSupportDataSchema,
  component: NULL_COMPONENT,
  actions: ["commitActions", "viewEvidence"],
  useWhen:
    "User asks what to do, wants recommendations, or is ready to commit to actions after reviewing patterns.",
  triggerExamples: [
    "what should we do",
    "recommend actions",
    "decision time",
    "prioritize actions",
    "what to do this week",
  ],
});

componentRegistry.register({
  type: "StakeholderMap",
  description:
    "Stakeholder map showing people connected to research themes, with ICP bands, linked evidence, top quotes, and profile links.",
  schema: stakeholderMapDataSchema,
  component: NULL_COMPONENT,
  actions: ["viewAll", "viewProfile"],
  useWhen:
    "User asks who the stakeholders are, who contributed to themes, or wants to link people to insights.",
  triggerExamples: [
    "who are the stakeholders",
    "show people",
    "who does this affect",
    "CRM context",
  ],
});

componentRegistry.register({
  type: "ResearchPulse",
  description:
    "Weekly research pulse showing confidence change, key metric deltas, action progress tracking, new signal summary, and next recommended step.",
  schema: researchPulseDataSchema,
  component: NULL_COMPONENT,
  actions: ["collectMore", "reviewPatterns", "markComplete"],
  useWhen:
    "User asks for a weekly update, wants to close the loop, or checks on progress of committed actions.",
  triggerExamples: [
    "weekly update",
    "research pulse",
    "how are we doing",
    "what changed this week",
    "close the loop",
  ],
});
