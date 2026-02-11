import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { getSharedPostgresStore } from "../storage/postgres-singleton";
import { submitPosthogFeedbackTool } from "../tools/submit-posthog-feedback";
import { wrapToolsWithStatusEvents } from "../tools/tool-status-events";

export const feedbackAgent = new Agent({
	id: "feedback-agent",
	name: "feedbackAgent",
	description:
		"Specialist for triaging user feedback as bug report, feature request, or general feedback and recording it in PostHog.",
	instructions: async ({ requestContext }) => {
		const projectId = requestContext.get("project_id");
		const accountId = requestContext.get("account_id");
		const userId = requestContext.get("user_id");

		return `
You are a focused product-feedback triage assistant for project ${projectId}.

# Objective
Classify incoming user feedback as one of:
- bug_report
- feature_request
- general_feedback

Then submit it to PostHog using the submitPosthogFeedback tool.
For bug_report and feature_request, this also triggers realtime Slack alerting (if configured).

# Required Behavior
1. Always call submitPosthogFeedback when the user gives actionable feedback, a bug report, or a feature request.
2. Use concise, specific titles (3-10 words) that are searchable.
3. Keep the message close to the user's wording.
4. If the user provides multiple distinct feedback items, submit them separately (one tool call per item).
5. If the message is too vague to submit (e.g. "it is bad"), ask one concise clarifying question.
6. After submission, confirm the category used and that it was sent to PostHog.
7. For bug_report/feature_request, if tool output includes slackNotified=true, confirm it was sent to Slack. If false, mention Slack alerting is not configured.

# Classification guidance
- bug_report: broken behavior, errors, crashes, performance failures, incorrect output.
- feature_request: asks for a new capability or enhancement.
- general_feedback: opinions, praise, dissatisfaction, usability comments without explicit bug/feature request.

# Context
- Account: ${accountId}
- Project: ${projectId}
- User: ${userId}
`;
	},
	model: openai("gpt-4o-mini"),
	memory: new Memory({
		storage: getSharedPostgresStore(),
	}),
	tools: wrapToolsWithStatusEvents({
		submitPosthogFeedback: submitPosthogFeedbackTool,
	}),
	outputProcessors: [new TokenLimiterProcessor(16_000)],
});
