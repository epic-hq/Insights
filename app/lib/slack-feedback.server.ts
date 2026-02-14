import consola from "consola";
import { getServerEnv } from "~/env.server";

type SlackFeedbackAlertInput = {
	feedbackType: "bug_report" | "feature_request";
	message: string;
	title?: string | null;
	distinctId: string;
	accountId?: string | null;
	projectId?: string | null;
	source?: string | null;
	url?: string | null;
};

function formatTypeLabel(feedbackType: SlackFeedbackAlertInput["feedbackType"]): string {
	return feedbackType === "bug_report" ? "Bug Report" : "Feature Request";
}

export async function sendFeedbackAlertToSlack(input: SlackFeedbackAlertInput): Promise<boolean> {
	const { SLACK_FEEDBACK_WEBHOOK_URL, SLACK_FEEDBACK_MENTION } = getServerEnv();
	if (!SLACK_FEEDBACK_WEBHOOK_URL) {
		return false;
	}

	try {
		const typeLabel = formatTypeLabel(input.feedbackType);
		const mentionPrefix = SLACK_FEEDBACK_MENTION ? `${SLACK_FEEDBACK_MENTION}\n` : "";
		const title = input.title?.trim() || "(no title)";
		const body = input.message.trim();
		const lines = [
			`${mentionPrefix}*${typeLabel}*`,
			`*Title:* ${title}`,
			`*Message:* ${body}`,
			`*Distinct ID:* \`${input.distinctId}\``,
			input.accountId ? `*Account:* \`${input.accountId}\`` : null,
			input.projectId ? `*Project:* \`${input.projectId}\`` : null,
			input.source ? `*Source:* ${input.source}` : null,
			input.url ? `*URL:* ${input.url}` : null,
		].filter(Boolean);

		const response = await fetch(SLACK_FEEDBACK_WEBHOOK_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: lines.join("\n"),
			}),
		});

		if (!response.ok) {
			consola.warn("sendFeedbackAlertToSlack: webhook returned non-200", {
				status: response.status,
			});
			return false;
		}

		return true;
	} catch (error) {
		consola.warn("sendFeedbackAlertToSlack: failed", error);
		return false;
	}
}
