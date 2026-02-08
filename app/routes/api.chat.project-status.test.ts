// @vitest-environment node

import { handleChatStream, handleNetworkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, generateObject } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveBillingContext, userBillingContext } from "~/lib/billing/instrumented-openai.server";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { memory } from "~/mastra/memory";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { fetchTopThemesWithPeopleTool } from "~/mastra/tools/fetch-top-themes-with-people";
import { action } from "./api.chat.project-status";

vi.mock("@mastra/ai-sdk", () => ({
	handleChatStream: vi.fn(),
	handleNetworkStream: vi.fn(),
}));

vi.mock("ai", () => ({
	generateObject: vi.fn(),
	createUIMessageStream: vi.fn(() => ({ kind: "cached-stream" })),
	createUIMessageStreamResponse: vi.fn(({ stream }) => {
		return new Response(JSON.stringify({ ok: true, stream }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}),
}));

vi.mock("~/lib/billing/instrumented-openai.server", () => ({
	clearActiveBillingContext: vi.fn(),
	estimateOpenAICost: vi.fn(() => 0.001),
	openai: vi.fn((model: string) => `mock:${model}`),
	setActiveBillingContext: vi.fn(),
	userBillingContext: vi.fn(() => ({ accountId: "acct-1" })),
}));

vi.mock("~/lib/billing/usage.server", () => ({
	recordUsageOnly: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/langfuse.server", () => ({
	getLangfuseClient: vi.fn(() => ({
		trace: () => ({
			generation: () => ({
				end: vi.fn(),
			}),
		}),
	})),
}));

vi.mock("~/mastra", () => ({
	mastra: {},
}));

vi.mock("~/mastra/memory", () => ({
	memory: {
		listThreadsByResourceId: vi.fn(),
		createThread: vi.fn(),
		deleteThread: vi.fn(),
	},
}));

vi.mock("~/mastra/tools/context-utils", () => ({
	resolveAccountIdFromProject: vi.fn(),
}));

vi.mock("~/mastra/tools/fetch-top-themes-with-people", () => ({
	fetchTopThemesWithPeopleTool: {
		execute: vi.fn(),
	},
}));

vi.mock("~/mastra/tools/navigate-to-page", () => ({
	navigateToPageTool: {},
}));

vi.mock("~/mastra/tools/switch-agent", () => ({
	switchAgentTool: {},
}));

vi.mock("~/server/user-context", () => ({
	userContext: Symbol("userContext"),
}));

const mockedHandleChatStream = vi.mocked(handleChatStream);
const mockedHandleNetworkStream = vi.mocked(handleNetworkStream);
const mockedGenerateObject = vi.mocked(generateObject);
const mockedCreateUIMessageStream = vi.mocked(createUIMessageStream);
const mockedCreateUIMessageStreamResponse = vi.mocked(createUIMessageStreamResponse);
const mockedRecordUsageOnly = vi.mocked(recordUsageOnly);
const mockedSetActiveBillingContext = vi.mocked(setActiveBillingContext);
const mockedUserBillingContext = vi.mocked(userBillingContext);
const mockedResolveAccountIdFromProject = vi.mocked(resolveAccountIdFromProject);
const mockedFetchTopThemesWithPeopleToolExecute = vi.mocked(fetchTopThemesWithPeopleTool.execute);

type MockedMemory = {
	listThreadsByResourceId: ReturnType<typeof vi.fn>;
	createThread: ReturnType<typeof vi.fn>;
	deleteThread: ReturnType<typeof vi.fn>;
};

const mockedMemory = memory as unknown as MockedMemory;

function buildArgs(options?: {
	projectId?: string;
	accountId?: string;
	userId?: string;
	message?: string;
	system?: string;
}) {
	const payload = {
		messages: [
			{
				role: "user",
				content: options?.message ?? "what should I do next?",
			},
		],
		system: options?.system,
	};

	const request = new Request("http://localhost/api/chat/project-status/project-1", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	const context = {
		get: vi.fn().mockReturnValue({
			account_id: options?.accountId ?? "acct-url",
			claims: { sub: options?.userId ?? "user-1" },
		}),
	};

	return {
		request,
		context,
		params: {
			projectId: options?.projectId ?? "project-1",
			accountId: options?.accountId ?? "acct-url",
		},
	} as unknown as ActionFunctionArgs;
}

describe("api.chat.project-status", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedResolveAccountIdFromProject.mockResolvedValue("acct-1");
		mockedMemory.listThreadsByResourceId.mockResolvedValue({
			total: 1,
			threads: [{ id: "thread-1" }],
		});
		mockedMemory.createThread.mockResolvedValue({ id: "thread-created" });
		mockedHandleChatStream.mockResolvedValue({ kind: "live-chat-stream" } as any);
		mockedHandleNetworkStream.mockResolvedValue({ kind: "network-stream" } as any);
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "chiefOfStaffAgent",
				confidence: 0.9,
				responseMode: "fast_standardized",
				rationale: "broad strategic guidance",
			},
		} as any);
		mockedFetchTopThemesWithPeopleToolExecute.mockResolvedValue({
			success: true,
			message: "ok",
			projectId: "project-1",
			totalThemes: 1,
			topThemes: [
				{
					themeId: "theme-1",
					name: "Automation Demand",
					statement: "Manual work is too high",
					evidenceCount: 12,
					peopleCount: 3,
					updatedAt: null,
					url: "https://getupsight.com/a/acct-1/project-1/themes/theme-1",
					people: [
						{ personId: "p1", name: "Alice", mentionCount: 3 },
						{ personId: "p2", name: "Bob", mentionCount: 2 },
					],
				},
			],
		} as any);
	});

	it("routes fast standardized prompts to Chief of Staff with reduced step/tool streaming budget", async () => {
		mockedHandleChatStream.mockImplementation(async ({ params }: any) => {
			await params.onFinish?.({
				text: "Status: You have interviews and themes.",
				usage: { inputTokens: 120, outputTokens: 24 },
				steps: [{}],
			});
			return { kind: "live-chat-stream" } as any;
		});

		const response = await action(
			buildArgs({
				system: "x".repeat(1200),
				message: "What should I do next at a high level?",
			})
		);
		expect(response.status).toBe(200);

		expect(mockedHandleChatStream).toHaveBeenCalledTimes(1);
		const call = mockedHandleChatStream.mock.calls[0][0] as any;
		expect(call.agentId).toBe("chiefOfStaffAgent");
		expect(call.params.maxSteps).toBe(2);
		expect(call.sendReasoning).toBe(false);
		expect(call.sendSources).toBe(false);
		expect(call.params.requestContext.get("response_mode")).toBe("fast_standardized");

		const contextText = call.params.context[0].content as string;
		const systemPart = contextText.replace("## Context from the client's UI:\n", "");
		expect(systemPart.length).toBe(800);

		expect(mockedRecordUsageOnly).toHaveBeenCalledTimes(1);
		expect(mockedSetActiveBillingContext).toHaveBeenCalledTimes(1);
		expect(mockedUserBillingContext).toHaveBeenCalledTimes(1);
	});

	it("serves repeated fast standardized prompts from short-lived cache", async () => {
		mockedHandleChatStream.mockImplementation(async ({ params }: any) => {
			await params.onFinish?.({
				text: "Status: 6 interviews completed. Next: validate top 2 themes.",
				usage: { inputTokens: 80, outputTokens: 14 },
			});
			return { kind: "live-chat-stream" } as any;
		});

		const first = await action(
			buildArgs({
				message: "Give me quick standardized project guidance",
				system: "overview",
			})
		);
		expect(first.status).toBe(200);
		expect(mockedHandleChatStream).toHaveBeenCalledTimes(1);

		const second = await action(
			buildArgs({
				message: "Give me quick standardized project guidance",
				system: "overview",
			})
		);
		expect(second.status).toBe(200);
		expect(mockedHandleChatStream).toHaveBeenCalledTimes(1);
		expect(mockedCreateUIMessageStream).toHaveBeenCalledTimes(1);

		const secondBody = await second.json();
		expect(secondBody.stream.kind).toBe("cached-stream");
		expect(mockedSetActiveBillingContext).toHaveBeenCalledTimes(1);
	});

	it("falls back to projectStatusAgent when routing confidence is below threshold", async () => {
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "chiefOfStaffAgent",
				confidence: 0.4,
				responseMode: "fast_standardized",
				rationale: "low confidence",
			},
		} as any);

		const response = await action(buildArgs({ message: "status update please" }));
		expect(response.status).toBe(200);

		expect(mockedHandleNetworkStream).toHaveBeenCalledTimes(1);
		expect(mockedHandleChatStream).not.toHaveBeenCalled();
		const call = mockedHandleNetworkStream.mock.calls[0][0] as any;
		expect(call.agentId).toBe("projectStatusAgent");
		expect(call.params.maxSteps).toBe(6);
		expect(mockedCreateUIMessageStreamResponse).toHaveBeenCalled();
	});

	it("uses deterministic theme snapshot mode without invoking agent streams", async () => {
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "projectStatusAgent",
				confidence: 0.95,
				responseMode: "theme_people_snapshot",
				rationale: "theme summary with attribution",
			},
		} as any);

		const response = await action(buildArgs({ message: "what are top 2 themes and who has them?" }));
		expect(response.status).toBe(200);
		expect(mockedFetchTopThemesWithPeopleToolExecute).toHaveBeenCalledTimes(1);
		expect(mockedHandleNetworkStream).not.toHaveBeenCalled();
		expect(mockedHandleChatStream).not.toHaveBeenCalled();
		expect(mockedCreateUIMessageStream).toHaveBeenCalledTimes(1);
	});
});
