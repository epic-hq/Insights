// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitPosthogFeedbackTool } from "../submit-posthog-feedback";

type SubmitResult = {
	success: boolean;
	message: string;
	eventName?: string;
	feedbackType?: "general_feedback" | "bug_report" | "feature_request";
	distinctId?: string;
	slackNotified?: boolean;
};

const { captureMock, flushMock, getPostHogServerClientMock, sendFeedbackAlertToSlackMock } = vi.hoisted(() => ({
	captureMock: vi.fn(),
	flushMock: vi.fn(),
	getPostHogServerClientMock: vi.fn(),
	sendFeedbackAlertToSlackMock: vi.fn(),
}));

vi.mock("../../../lib/posthog.server", () => ({
	getPostHogServerClient: getPostHogServerClientMock,
}));

vi.mock("../../../lib/slack-feedback.server", () => ({
	sendFeedbackAlertToSlack: sendFeedbackAlertToSlackMock,
}));

describe("submitPosthogFeedbackTool", () => {
	beforeEach(() => {
		captureMock.mockReset();
		flushMock.mockReset();
		getPostHogServerClientMock.mockReset();
		sendFeedbackAlertToSlackMock.mockReset();

		captureMock.mockResolvedValue(undefined);
		flushMock.mockResolvedValue(undefined);
		sendFeedbackAlertToSlackMock.mockResolvedValue(true);
		getPostHogServerClientMock.mockReturnValue({
			capture: captureMock,
			flush: flushMock,
		});
	});

	it("classifies bug reports and submits to PostHog", async () => {
		const requestContext = new RequestContext();
		requestContext.set("user_id", "user-1");
		requestContext.set("account_id", "account-1");
		requestContext.set("project_id", "project-1");

		const result = (await submitPosthogFeedbackTool.execute(
			{
				message: "The app crashes with a 500 error when I save.",
				title: "Crash on save",
				source: "project_chat",
			},
			{ requestContext }
		)) as SubmitResult;

		expect(result.success).toBe(true);
		expect(result.feedbackType).toBe("bug_report");
		expect(result.eventName).toBe("user_feedback_submitted");
		expect(result.distinctId).toBe("user-1");
		expect(result.slackNotified).toBe(true);
		expect(captureMock).toHaveBeenCalledTimes(1);
		expect(captureMock).toHaveBeenCalledWith(
			expect.objectContaining({
				distinctId: "user-1",
				event: "user_feedback_submitted",
				properties: expect.objectContaining({
					feedback_type: "bug_report",
					account_id: "account-1",
					project_id: "project-1",
				}),
			})
		);
		expect(flushMock).toHaveBeenCalledTimes(1);
		expect(sendFeedbackAlertToSlackMock).toHaveBeenCalledTimes(1);
	});

	it("respects explicit feature_request type", async () => {
		const requestContext = new RequestContext();
		requestContext.set("user_id", "user-2");

		const result = (await submitPosthogFeedbackTool.execute(
			{
				message: "Please add SSO support for Azure AD",
				feedbackType: "feature_request",
			},
			{ requestContext }
		)) as SubmitResult;

		expect(result.success).toBe(true);
		expect(result.feedbackType).toBe("feature_request");
		expect(result.slackNotified).toBe(true);
		expect(captureMock).toHaveBeenCalledWith(
			expect.objectContaining({
				properties: expect.objectContaining({
					feedback_type: "feature_request",
				}),
			})
		);
		expect(sendFeedbackAlertToSlackMock).toHaveBeenCalledTimes(1);
	});

	it("does not send slack alert for general feedback", async () => {
		const result = (await submitPosthogFeedbackTool.execute({
			message: "Nice onboarding flow",
		})) as SubmitResult;

		expect(result.success).toBe(true);
		expect(result.feedbackType).toBe("general_feedback");
		expect(result.slackNotified).toBe(false);
		expect(sendFeedbackAlertToSlackMock).not.toHaveBeenCalled();
	});

	it("returns a clear error when PostHog is unavailable", async () => {
		getPostHogServerClientMock.mockReturnValue(null);

		const result = (await submitPosthogFeedbackTool.execute({
			message: "Great UX overall.",
		})) as SubmitResult;

		expect(result.success).toBe(false);
		expect(result.message).toContain("PostHog server client is not configured");
		expect(captureMock).not.toHaveBeenCalled();
		expect(sendFeedbackAlertToSlackMock).not.toHaveBeenCalled();
	});
});
