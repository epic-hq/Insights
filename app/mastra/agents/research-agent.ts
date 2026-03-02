/**
 * ResearchAgent: specialist for interviews, surveys, and prompts.
 */
import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import consola from "consola";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { fetchInterviewContextTool } from "../tools/fetch-interview-context";
import { fetchWebContentTool } from "../tools/fetch-web-content";
import { generateProjectRoutesTool } from "../tools/generate-project-routes";
import { importPeopleFromTableTool } from "../tools/import-people-from-table";
import { importVideoFromUrlTool } from "../tools/import-video-from-url";
import { manageDocumentsTool } from "../tools/manage-documents";
import {
  createInterviewPromptTool,
  deleteInterviewPromptTool,
  fetchInterviewPromptsTool,
  updateInterviewPromptTool,
} from "../tools/manage-interview-prompts";
import { manageInterviewsTool } from "../tools/manage-interviews";
import { navigateToPageTool } from "../tools/navigate-to-page";
import { parseSpreadsheetTool } from "../tools/parse-spreadsheet";
import { findSimilarPagesTool, webResearchTool } from "../tools/research-web";
import { saveTableToAssetsTool } from "../tools/save-table-to-assets";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";
import { updateTableAssetTool } from "../tools/update-table-asset";

export const researchAgent = new Agent({
  id: "research-agent",
  name: "researchAgent",
  description:
    "Specialist for research operations: interviews, interview prompts, documents, and web research.",
  instructions: async ({ requestContext }) => {
    try {
      const projectId = requestContext.get("project_id");
      const accountId = requestContext.get("account_id");

      return `
You are a Research specialist that EXECUTES actions using tools. You do NOT describe what you would do - you DO it.

Project: ${projectId}, Account: ${accountId}

NOTE: Survey operations (editing, reviewing, settings, responses) are handled by the surveyAgent. I focus on interviews, documents, and web research. If a user asks about surveys, tell them to ask about surveys directly (the routing layer will handle it).

# CRITICAL: Deliverables-First Behavior

For informational requests like "list", "top N", "compare", "in csv", "in table", or "give me examples":

1. Produce the requested deliverable directly in chat (CSV/table/bullets), in the exact format requested.
2. If the user requests CSV with a specific count (for example, "top 8 ... in csv"), return exactly that many data rows.
3. When external data is needed, call webResearch with numResults >= requested count and use structured results to format the output.
4. Do NOT save notes/documents by default.
5. Only call manageDocuments when the user explicitly asks to save/store/document/persist the output.

# Operations

- Interview prompts: Use fetch/create/update/deleteInterviewPrompt tools
- Interviews: Use manageInterviews, fetchInterviewContext
- URL ingestion/research: fetchWebContent, importVideoFromUrl, webResearch, findSimilarPages
- Documents: manageDocuments for meeting notes/strategy docs
- Tables: parseSpreadsheet, saveTableToAssets, updateTableAsset
- CSV contacts: parseSpreadsheet, then importPeopleFromTable when the user asks to import contacts

# Interview-Specific Guidance (Critical)

When the user asks about interview prep, open questions, follow-ups, or "how do I address this interview":
1. ALWAYS call fetchInterviewContext first.
   - Use interviewId from runtime context when available.
2. Base your answer on interview-specific fields, especially:
   - open_questions_and_next_steps
   - high_impact_themes
   - participant/person context
3. Avoid generic advice. If context is missing, say exactly what is missing and ask one concise clarification.

# Linking & Navigation
- When referencing surveys, interviews, or people, format as \`[Name](url)\` markdown link.
- Tools may return \`url\` fields — use them directly.
- For entities without tool URLs, call generateProjectRoutes with entityType (survey, interview, person) and the entityId.
- Never fabricate URLs - only use URLs returned by tools or generateProjectRoutes.

# Rules
- ALWAYS use tools to take action. Never just describe what you would do.
- After creating anything, use navigateToPage to take the user there.
`;
    } catch (error) {
      consola.error("Error in research agent instructions:", error);
      return "You are a Research specialist for interviews and surveys.";
    }
  },
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: getSharedPostgresStore(),
  }),
  tools: wrapToolsWithStatusEvents({
    fetchInterviewContext: fetchInterviewContextTool,
    manageInterviews: manageInterviewsTool,
    fetchInterviewPrompts: fetchInterviewPromptsTool,
    createInterviewPrompt: createInterviewPromptTool,
    updateInterviewPrompt: updateInterviewPromptTool,
    deleteInterviewPrompt: deleteInterviewPromptTool,
    fetchWebContent: fetchWebContentTool,
    importVideoFromUrl: importVideoFromUrlTool,
    webResearch: webResearchTool,
    findSimilarPages: findSimilarPagesTool,
    manageDocuments: manageDocumentsTool,
    parseSpreadsheet: parseSpreadsheetTool,
    importPeopleFromTable: importPeopleFromTableTool,
    saveTableToAssets: saveTableToAssetsTool,
    updateTableAsset: updateTableAssetTool,
    navigateToPage: navigateToPageTool,
    generateProjectRoutes: generateProjectRoutesTool,
  }),
  outputProcessors: [new TokenLimiterProcessor(20_000)],
});
