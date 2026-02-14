import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { openai } from "../../lib/billing/instrumented-openai.server";
// ToolCallPairProcessor is deprecated in v1 - tool call pairing is handled internally now
// import { ToolCallPairProcessor } from "../processors/tool-call-pair-processor"
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { fetchInterviewContextTool } from "../tools/fetch-interview-context";
import { semanticSearchEvidenceTool } from "../tools/semantic-search-evidence";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

const InterviewMemoryState = z.object({
	lastInterviewId: z.string().optional(),
	lastSummary: z.string().optional(),
});

export const interviewStatusAgent = new Agent({
	id: "interview-status-agent",
	name: "interviewStatusAgent",
	instructions: async ({ requestContext }) => {
		const interviewId = requestContext.get("interview_id");
		const projectId = requestContext.get("project_id");
		return `
You are an interview insight copilot that helps product teams digest a single conversation.

Goals:
- Provide concise, actionable answers (1-4 short sentences or bullet points).
- Highlight key takeaways, notable evidence, and personal facets (personas, segments, roles) from the interview when asked.

Workflow:
1. Always call the "fetchInterviewContext" tool before answering. Use interview_id=${interviewId || "<unknown>"} and project_id=${projectId || "<unknown>"} from the runtime context. Include evidence unless the user clearly requests high-level insights only.
2. For specific topic searches (e.g., "What did they say about pricing?", "Did they mention any concerns about security?"), use the "semanticSearchEvidence" tool with the interview_id to find relevant evidence using natural language search.
3. If the interview cannot be found or data is missing, explain what is unavailable and suggest how to capture it (e.g., upload transcripts, link participants).
4. When sharing takeaways, mention supporting evidence and personal facets when they strengthen the insight.
Cite specifics, and give statistics when possible; e.g. The most frequently cited pain point was "difficulty with onboarding" (30% of comments).
5. Ask clarifying questions when the user's request is ambiguous or requires additional detail.

Tone:
- Direct, empathetic, and focused on research momentum and prioritize goals and decisions.
- Favor bullet lists for multi-part answers.

`;
	},
	model: openai("gpt-5-mini"),
	tools: wrapToolsWithStatusEvents({
		fetchInterviewContext: fetchInterviewContextTool,
		semanticSearchEvidence: semanticSearchEvidenceTool,
	}),
	memory: new Memory({
		storage: getSharedPostgresStore(),
		options: {
			workingMemory: { enabled: true, schema: InterviewMemoryState },
		},
		generateTitle: false,
	}),
	// Note: Using number format for Zod v4 compatibility
	outputProcessors: [new TokenLimiterProcessor(100_000)],
});
