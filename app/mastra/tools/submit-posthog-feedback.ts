import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

const feedbackTypeSchema = z.enum(["general_feedback", "bug_report", "feature_request"]);

function classifyFeedbackType(params: {
	feedbackType?: z.infer<typeof feedbackTypeSchema> | null;
	message: string;
	title?: string | null;
}) {
	if (params.feedbackType) {
		return params.feedbackType;
	}

	const corpus = `${params.title ?? ""} ${params.message}`.toLowerCase();
	const hasAny = (...tokens: string[]) => tokens.some((token) => corpus.includes(token));

	if (
		hasAny(
			"bug",
			"broken",
			"error",
			"crash",
			"not working",
			"doesn't work",
			"does not work",
			"fails",
			"failure",
			"issue"
		)
	) {
		return "bug_report";
	}

	if (
		hasAny(
			"feature request",
			"feature",
			"would love",
			"it would be great",
			"please add",
			"can you add",
			"i wish",
			"request"
		)
	) {
		return "feature_request";
	}

	return "general_feedback";
}

export const submitPosthogFeedbackTool = createTool({
	id: "submit-posthog-feedback",
	description: "Submit product feedback to PostHog and tag it as general feedback, bug report, or feature request.",
	inputSchema: z.object({
		message: z.string().min(1).describe("The user's feedback text. Keep this as close to verbatim as possible."),
		title: z
			.string()
			.max(160)
			.nullish()
			.describe("Short summary title for the feedback item. Optional but recommended."),
		feedbackType: feedbackTypeSchema.nullish().describe("Use bug_report, feature_request, or general_feedback."),
		source: z
			.string()
			.max(100)
			.nullish()
			.describe("Where this feedback came from, e.g. project_chat, support_call, interview."),
		userId: z.string().max(120).nullish().describe("Optional explicit user id override for PostHog distinctId."),
		url: z.string().max(500).nullish().describe("Optional URL where the feedback was observed."),
		metadata: z.record(z.unknown()).nullish().describe("Optional extra metadata to attach to the event."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		eventName: z.string().optional(),
		feedbackType: feedbackTypeSchema.optional(),
		distinctId: z.string().optional(),
		slackNotified: z.boolean().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const { getPostHogServerClient } = await import("../../lib/posthog.server");
			const { sendFeedbackAlertToSlack } = await import("../../lib/slack-feedback.server");
			const posthog = getPostHogServerClient();

			if (!posthog) {
				return {
					success: false,
					message: "PostHog server client is not configured",
				};
			}

			const requestContext = context?.requestContext;
			const contextUserId = requestContext?.get?.("user_id");
			const accountId = requestContext?.get?.("account_id");
			const projectId = requestContext?.get?.("project_id");

			const feedbackType = classifyFeedbackType({
				feedbackType: input.feedbackType ?? undefined,
				message: input.message,
				title: input.title ?? undefined,
			});

			const distinctId =
				(input.userId && input.userId.trim()) ||
				(typeof contextUserId === "string" && contextUserId.trim()) ||
				"anonymous-feedback";

			const eventName = "user_feedback_submitted";
			await posthog.capture({
				distinctId,
				event: eventName,
				properties: {
					feedback_type: feedbackType,
					feedback_title: input.title?.trim() || null,
					feedback_message: input.message.trim(),
					source: input.source?.trim() || "mastra_feedback_agent",
					url: input.url?.trim() || null,
					account_id: typeof accountId === "string" ? accountId : null,
					project_id: typeof projectId === "string" ? projectId : null,
					metadata: input.metadata ?? null,
					submitted_at: new Date().toISOString(),
				},
			});
			await posthog.flush();

			const shouldNotifySlack = feedbackType === "bug_report" || feedbackType === "feature_request";
			const slackNotified = shouldNotifySlack
				? await sendFeedbackAlertToSlack({
						feedbackType,
						message: input.message,
						title: input.title,
						distinctId,
						accountId: typeof accountId === "string" ? accountId : null,
						projectId: typeof projectId === "string" ? projectId : null,
						source: input.source ?? null,
						url: input.url ?? null,
					})
				: false;

			return {
				success: true,
				message: "Feedback submitted to PostHog",
				eventName,
				feedbackType,
				distinctId,
				slackNotified,
			};
		} catch (error) {
			consola.error("submit-posthog-feedback: failed", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to submit feedback",
			};
		}
	},
});
