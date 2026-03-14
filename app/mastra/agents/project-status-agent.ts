import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { buildGenUISystemContext } from "../../lib/gen-ui/agent-context";
// ToolCallPairProcessor is deprecated in v1 - tool call pairing is handled internally now
// import { ToolCallPairProcessor } from "../processors/tool-call-pair-processor"
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { capabilityLookupTool } from "../tools/capability-lookup";
import { displayComponentTool } from "../tools/display-component";
import { fetchConversationLensesTool } from "../tools/fetch-conversation-lenses";
import { fetchEvidenceTool } from "../tools/fetch-evidence";
import { fetchProjectStatusContextTool } from "../tools/fetch-project-status-context";
import { fetchResearchPulseTool } from "../tools/fetch-research-pulse";
import { fetchThemesTool } from "../tools/fetch-themes";
import { fetchTopThemesWithPeopleTool } from "../tools/fetch-top-themes-with-people";
import { generateDocumentLinkTool } from "../tools/generate-document-link";
import { generateProjectRoutesTool } from "../tools/generate-project-routes";
import { generateResearchRecommendationsTool } from "../tools/generate-research-recommendations";
import { getCurrentDateTool } from "../tools/get-current-date";
import { recommendNextActionsTool } from "../tools/recommend-next-actions";
import { requestUserInputTool } from "../tools/request-user-input";
import { semanticSearchAssetsTool } from "../tools/semantic-search-assets";
import { semanticSearchEvidenceTool } from "../tools/semantic-search-evidence";
import { showCelebrationTool } from "../tools/show-celebration-tool";
import { showProgressTool } from "../tools/show-progress-tool";
import { showWelcomeTool } from "../tools/show-welcome-tool";
import { suggestActionsTool } from "../tools/suggest-actions-tool";
import { suggestionTool } from "../tools/suggestion-tool";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";
import { chiefOfStaffAgent } from "./chief-of-staff-agent";
import { feedbackAgent } from "./feedback-agent";
import { howtoAgent } from "./howto-agent";
import { opsAgent } from "./ops-agent";
import { peopleAgent } from "./people-agent";
import { researchAgent } from "./research-agent";
import { surveyAgent } from "./survey-agent";
import { taskAgent } from "./task-agent";

function auditToolSchemas(agent_name: string, tools: Record<string, unknown>) {
  try {
    const tool_entries = Object.entries(tools);
    const issues: Array<{ tool: string; issue: string; ownProps?: string[] }> =
      [];

    for (const [tool_name, tool] of tool_entries) {
      if (!tool || typeof tool !== "object") {
        issues.push({
          tool: tool_name,
          issue: `tool is not an object (${typeof tool})`,
        });
        continue;
      }

      const own_props = Object.getOwnPropertyNames(tool);
      const has_input_schema = own_props.includes("inputSchema");
      const has_output_schema = own_props.includes("outputSchema");

      const input_schema = (tool as any).inputSchema;
      const output_schema = (tool as any).outputSchema;
      const input_is_zod =
        !!input_schema &&
        typeof input_schema === "object" &&
        typeof input_schema.safeParse === "function";
      const output_is_zod =
        !!output_schema &&
        typeof output_schema === "object" &&
        typeof output_schema.safeParse === "function";

      if (!has_input_schema || !input_is_zod) {
        issues.push({
          tool: tool_name,
          issue: `invalid inputSchema (hasProp=${has_input_schema}, isZod=${input_is_zod})`,
          ownProps: own_props,
        });
      }
      if (!has_output_schema || !output_is_zod) {
        issues.push({
          tool: tool_name,
          issue: `invalid outputSchema (hasProp=${has_output_schema}, isZod=${output_is_zod})`,
          ownProps: own_props,
        });
      }
    }

    if (issues.length > 0) {
      consola.warn("[mastra-schema-audit] tool schema issues", {
        agent: agent_name,
        issueCount: issues.length,
        issues,
      });
    } else {
      consola.info("[mastra-schema-audit] all tool schemas look valid", {
        agent: agent_name,
        toolCount: tool_entries.length,
      });
    }
  } catch (error) {
    consola.error("[mastra-schema-audit] failed", { agent: agent_name, error });
  }
}

// Coordinator tools: only tools the coordinator calls directly.
// Data-fetching tools that sub-agents also have are kept here only if
// the coordinator needs them for response-mode overrides or widget rendering.
const project_status_agent_tools = {
  // Core context & routing
  getCurrentDate: getCurrentDateTool,
  fetchProjectStatusContext: fetchProjectStatusContextTool,
  generateProjectRoutes: generateProjectRoutesTool,
  generateDocumentLink: generateDocumentLinkTool,
  capabilityLookup: capabilityLookupTool,

  // Evidence & themes — coordinator calls these directly for widget rendering
  fetchEvidence: fetchEvidenceTool,
  semanticSearchEvidence: semanticSearchEvidenceTool,
  semanticSearchAssets: semanticSearchAssetsTool,
  fetchThemes: fetchThemesTool,
  fetchTopThemesWithPeople: fetchTopThemesWithPeopleTool,
  fetchConversationLenses: fetchConversationLensesTool,

  // Gen-UI widgets & suggestions
  displayComponent: displayComponentTool,
  "display-component": displayComponentTool,
  requestUserInput: requestUserInputTool,
  "request-user-input": requestUserInputTool,
  suggestNextSteps: suggestionTool,
  suggestActions: suggestActionsTool,
  "suggest-actions": suggestActionsTool,
  showProgress: showProgressTool,
  "show-progress": showProgressTool,
  showWelcome: showWelcomeTool,
  "show-welcome": showWelcomeTool,
  showCelebration: showCelebrationTool,
  "show-celebration": showCelebrationTool,

  // Recommendations — coordinator renders DecisionSupport widget
  recommendNextActions: recommendNextActionsTool,
  "recommend-next-actions": recommendNextActionsTool,
  generateResearchRecommendations: generateResearchRecommendationsTool,
  "generate-research-recommendations": generateResearchRecommendationsTool,
  fetchResearchPulse: fetchResearchPulseTool,
  "fetch-research-pulse": fetchResearchPulseTool,
};

auditToolSchemas("projectStatusAgent", project_status_agent_tools);

export const projectStatusAgent = new Agent({
  id: "project-status-agent",
  name: "projectStatusAgent",
  instructions: async ({ requestContext }) => {
    try {
      const projectId = requestContext.get("project_id");
      const accountId = requestContext.get("account_id");
      const userId = requestContext.get("user_id");
      const responseMode = String(
        requestContext.get("response_mode") || "normal",
      );
      const userRole = requestContext.get("user_role") || "";
      const userUseCases = requestContext.get("user_use_cases") || "";
      const userCompanySize = requestContext.get("user_company_size") || "";
      const uiEvents = requestContext.get("ui_events");
      const uiEventsSummary =
        Array.isArray(uiEvents) && uiEvents.length > 0
          ? JSON.stringify(uiEvents)
          : "[]";
      const personaLines = [
        userRole ? `User role: ${userRole}` : null,
        userUseCases ? `Use cases: ${userUseCases}` : null,
        userCompanySize ? `Company size: ${userCompanySize}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return `
You are Uppy, a senior executive assistant and researcher. You synthesize customer evidence into actionable insights.

project_id=${projectId || "<unknown>"}, account_id=${accountId || "<unknown>"}, user_id=${userId || "<unknown>"}, response_mode=${responseMode}, typed_ui_events=${uiEventsSummary}
${personaLines}

## Response Mode: theme_people_snapshot
When active: call fetchTopThemesWithPeople(limit=3, peoplePerTheme=5), summarize concisely. If no themes, say so and suggest a data-collection action.

## Core Behavior
- **Interpret, don't just retrieve**: synthesize across sources, quantify confidence ("3/5 buyers mentioned X"), surface surprises, cite sources with links
- **Internal evidence first**: ALWAYS call semanticSearchEvidence before any web research. Delegate web research to ResearchAgent.
- **Setup check**: On first interaction call fetchProjectStatusContext(scopes=["sections","status"]). If empty project with no data → offer setup via switchAgent("project-setup"). If has data but no goals → acknowledge data first, then suggest setup.

## Delegation Table
| Sub-agent | Handles |
|---|---|
| peopleAgent | CRUD people, orgs, personas, ICP scoring, merge, people comparisons |
| taskAgent | create/update/complete/delete tasks |
| surveyAgent | edit/review/create surveys, question management, response analysis |
| researchAgent | interviews, prompts, documents, web research, imports, CSV/URL ingestion |
| chiefOfStaffAgent | "what should I do next?", strategic prioritization, task recommendations |
| howtoAgent | "how do I...", "best way to...", procedural guidance |
| feedbackAgent | bug reports, feature requests → PostHog |
| opsAgent | sales/pipeline, deals, organizations, annotations, project settings, BANT analysis |

## Visual Widgets (use displayComponent)
Render widgets for structured data instead of long text. Call data tool(s) first, then displayComponent. Keep chat to 1-2 sentence summary.

| Pattern | Widget | Data source |
|---|---|---|
| research gaps / coverage | IntakeHealth | fetchProjectStatusContext(["status","interviews"]) |
| evidence / quotes | EvidenceWall | fetchEvidence or semanticSearchEvidence |
| themes / patterns | PatternSynthesis | fetchTopThemesWithPeople |
| next actions / prioritize | DecisionSupport | generateResearchRecommendations |
| stakeholders / "who mentioned?" | StakeholderMap | delegate to peopleAgent |
| project progress | ProgressRail | recommendNextActions |
| weekly review / what changed | ResearchPulse | fetchResearchPulse |
| interview prep | InterviewPrompts | delegate to researchAgent |
| research goals | DecisionBrief | fetchProjectStatusContext(["sections"]) |
| get started / intake | IntakePathPicker | fetchProjectStatusContext(["status"]) |
| upload status | IntakeBatchStatus | fetchProjectStatusContext(["interviews"]) |
| personas / ICP | PersonaCard | delegate to peopleAgent |
| lens/JTBD analysis | ConversationLensInsights | fetchConversationLenses(mode="analyses") → pick latest completed → displayComponent with full analysisData |
| BANT / sales | BANTScorecard | delegate to opsAgent |
| single topic insight | AiInsightCard | semanticSearchEvidence(query=topic) |
| counts / metrics | StatCard | fetchProjectStatusContext(["status"]) |
| theme list | ThemeList | fetchThemes |
| segment breakdown | PatternSynthesis | delegate to peopleAgent or use fetchProjectStatusContext |

Never render widgets with empty data. If no data, explain what's missing.

## Canvas Events
When typed_ui_events is non-empty: treat as highest-priority intent. Acknowledge action, continue the triggering workflow, favor most recent typed event over free text.

## Evidence & Themes
- "top themes" → call fetchTopThemesWithPeople. If totalThemes > 0, never claim no themes.
- Person-specific themes: fetchTopThemesWithPeople(limit=10, peoplePerTheme=10), filter to person.
- ICP data is in fetchProjectStatusContext results (icpMatch per person, icpSummary distribution).
- Survey quotes: ALWAYS link to source using [personName](responseUrl) from tool output.
- Interview detail mode: if system context shows interview page, delegate to ResearchAgent for grounded answers. No generic coaching.

## Linking (CRITICAL)
ALWAYS link referenced records as [Name](url). Use tool-returned URLs first. Fallback: generateProjectRoutes(entityType, entityId). NEVER fabricate URLs.

## Response Style
- Default: ≤90 words, max 4 sentences or 3 bullets. Expand only when explicitly asked.
- Direct, analytical, speakable. Markdown bullets/bolds. No filler.
- After every response: call suggestNextSteps or suggestActions with 2-3 options. No "Next steps" text section.
- suggestActions for rich inline suggestions (badges + optional card). Icons: Search, Upload, Users, BarChart3, FileText, MessageSquare, Lightbulb, Target, TrendingUp, Zap, Eye, Plus, ArrowRight, RefreshCw, Settings.

## Returning Users
First message of session: call fetchResearchPulse, then showWelcome with changes + role-appropriate badges. Skip if no changes.
Milestones: showCelebration (max once/session) for first interview, first theme, first survey response, 10+ evidence.

## Persona-Aware Greetings
Tailor to role: sales→CRM/pipeline, product→themes/evidence, research→lenses/empathy, executive→decisions/ROI, CS→feedback/health.

${buildGenUISystemContext()}
`;
    } catch (error) {
      consola.error("Error in project status agent instructions:", error);
      return `
Sorry, I'm experiencing technical difficulties right now.

Please try:

1. Refreshing the page and trying again
2. Contacting support if the issue persists`;
    }
  },
  model: openai("gpt-4.1"),
  tools: wrapToolsWithStatusEvents(project_status_agent_tools),
  agents: {
    taskAgent,
    peopleAgent,
    researchAgent,
    surveyAgent,
    opsAgent,
    feedbackAgent,
    chiefOfStaffAgent,
    howtoAgent,
  },
  memory: new Memory({
    storage: getSharedPostgresStore(),
    options: {
      lastMessages: 20,
      observationalMemory: true,
    },
  }),
  // TokenLimiterProcessor prevents context window overflow
  // Note: Using number format for Zod v4 compatibility
  outputProcessors: [new TokenLimiterProcessor(45_000)],
});
