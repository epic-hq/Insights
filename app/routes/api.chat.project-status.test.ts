// @vitest-environment node

import { handleChatStream, handleNetworkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, generateObject } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveBillingContext, userBillingContext } from "~/lib/billing/instrumented-openai.server";
import { recordUsageOnly } from "~/lib/billing/usage.server";
import { memory } from "~/mastra/memory";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { createSurveyTool } from "~/mastra/tools/create-survey";
import { fetchTopThemesWithPeopleTool } from "~/mastra/tools/fetch-top-themes-with-people";
import { action } from "./api.chat.project-status";

vi.mock("@mastra/ai-sdk", () => ({
	handleChatStream: vi.fn(),
	handleNetworkStream: vi.fn(),
}));

vi.mock("ai", () => ({
	generateObject: vi.fn(),
	createUIMessageStream: vi.fn(
		(options?: { execute?: (args: { writer: { write: (chunk: unknown) => void } }) => Promise<void> }) => ({
			kind: "cached-stream",
			options,
		})
	),
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

vi.mock("~/mastra/tools/create-survey", () => ({
	createSurveyTool: {
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
const mockedCreateSurveyToolExecute = vi.mocked(createSurveyTool.execute);

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

async function readStreamChunks(stream: any) {
	const chunks: Record<string, unknown>[] = [];

	if (stream && typeof stream.getReader === "function") {
		const reader = stream.getReader();
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
			}
		}
		return chunks;
	}

	const execute = stream?.options?.execute;
	if (typeof execute === "function") {
		await execute({
			writer: {
				write: (chunk: Record<string, unknown>) => chunks.push(chunk),
			},
		});
		return chunks;
	}

	return chunks;
}

function makeTextStream(options: { text?: string; toolName?: string; emitFinish?: boolean }) {
	return new ReadableStream<Record<string, unknown>>({
		start(controller) {
			controller.enqueue({ type: "start" });
			controller.enqueue({ type: "start-step" });
			if (options.toolName) {
				controller.enqueue({ type: "tool-input-available", toolName: options.toolName });
			}
			if (options.text) {
				controller.enqueue({ type: "text-start", id: "chunk-a" });
				controller.enqueue({ type: "text-delta", id: "chunk-a", delta: options.text });
				controller.enqueue({ type: "text-end", id: "chunk-a" });
			}
			if (options.emitFinish ?? true) {
				controller.enqueue({ type: "finish", finishReason: "stop" });
			}
			controller.close();
		},
	});
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
		mockedCreateSurveyToolExecute.mockResolvedValue({
			success: true,
			message: "Created survey",
			surveyId: "survey-1",
			editUrl: "/a/acct-1/project-1/ask/survey-1/edit",
			publicUrl: "/research/survey-1",
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

	it("routes people-comparison prompts through normal flow when classifier selects normal mode", async () => {
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "projectStatusAgent",
				confidence: 0.9,
				responseMode: "normal",
				rationale: "people comparison requires normal analysis",
			},
		} as any);

		const response = await action(buildArgs({ message: "what do john rubey and jered lish have in common" }));
		expect(response.status).toBe(200);
		expect(mockedFetchTopThemesWithPeopleToolExecute).not.toHaveBeenCalled();
		expect(mockedHandleNetworkStream).toHaveBeenCalledTimes(1);
		expect(mockedHandleChatStream).not.toHaveBeenCalled();
		const call = mockedHandleNetworkStream.mock.calls[0][0] as any;
		expect(call.agentId).toBe("projectStatusAgent");
		expect(call.params.requestContext.get("response_mode")).toBe("normal");
		const routingPrompt = (mockedGenerateObject.mock.calls.at(-1)?.[0] as any)?.prompt as string;
		expect(routingPrompt).toContain('Never set responseMode="theme_people_snapshot" for people-comparison prompts');
	});

	it("deterministically routes ICP lookup prompts to projectStatusAgent", async () => {
		const response = await action(buildArgs({ message: "what icp matches do i have?" }));
		expect(response.status).toBe(200);

		expect(mockedGenerateObject).not.toHaveBeenCalled();
		expect(mockedHandleNetworkStream).toHaveBeenCalledTimes(1);
		expect(mockedHandleChatStream).not.toHaveBeenCalled();
		const call = mockedHandleNetworkStream.mock.calls[0][0] as any;
		expect(call.agentId).toBe("projectStatusAgent");
	});

	it("injects a fallback message when stream finishes without assistant text", async () => {
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "chiefOfStaffAgent",
				confidence: 0.9,
				responseMode: "fast_standardized",
				rationale: "strategy guidance",
			},
		} as any);
		mockedHandleChatStream.mockResolvedValue(
			new ReadableStream({
				start(controller) {
					controller.enqueue({ type: "start" });
					controller.enqueue({ type: "start-step" });
					controller.enqueue({ type: "tool-input-available", toolName: "recommendNextActions" });
					controller.enqueue({ type: "finish", finishReason: "stop" });
					controller.close();
				},
			}) as any
		);

		const response = await action(buildArgs({ message: "help me prioritize" }));
		expect(response.status).toBe(200);

		const call = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const stream = call?.stream as ReadableStream<Record<string, unknown>>;
		expect(stream).toBeInstanceOf(ReadableStream);

		const chunks = await readStreamChunks(stream);
		const deltas = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""));
		expect(deltas.join("\n")).toContain("Sorry, I couldn't answer that just now. Please try again.");
	});

	it("supports /debug prefix, strips it from execution prompt, and appends a debug trace", async () => {
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "chiefOfStaffAgent",
				confidence: 0.9,
				responseMode: "fast_standardized",
				rationale: "strategy guidance",
			},
		} as any);
		mockedHandleChatStream.mockResolvedValue(
			new ReadableStream({
				start(controller) {
					controller.enqueue({ type: "start" });
					controller.enqueue({ type: "text-start", id: "chunk-a" });
					controller.enqueue({ type: "text-delta", id: "chunk-a", delta: "Prioritize ICP cleanup first." });
					controller.enqueue({ type: "text-end", id: "chunk-a" });
					controller.enqueue({ type: "tool-input-available", toolName: "recommendNextActions" });
					controller.enqueue({ type: "finish", finishReason: "stop" });
					controller.close();
				},
			}) as any
		);

		const response = await action(buildArgs({ message: "/debug help me prioritize this sprint" }));
		expect(response.status).toBe(200);
		expect(mockedHandleChatStream).toHaveBeenCalledTimes(1);

		const chatCall = mockedHandleChatStream.mock.calls[0][0] as any;
		expect(chatCall.params.messages[0].content).toBe("help me prioritize this sprint");

		const call = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const stream = call?.stream as ReadableStream<Record<string, unknown>>;
		const chunks = await readStreamChunks(stream);
		const deltas = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""));
		const merged = deltas.join("\n");
		expect(merged).toContain("Debug Trace:");
		expect(merged).toContain("- routed_to: chiefOfStaffAgent");
		expect(merged).toContain("- tool_calls: recommendNextActions");
	});

	it("handles survey creation prompts via deterministic quick-create path", async () => {
		const response = await action(buildArgs({ message: "create a waitlist survey for our beta launch" }));
		expect(response.status).toBe(200);
		expect(mockedGenerateObject).not.toHaveBeenCalled();
		expect(mockedCreateSurveyToolExecute).toHaveBeenCalledTimes(1);
		expect(mockedHandleChatStream).not.toHaveBeenCalled();
		expect(mockedHandleNetworkStream).not.toHaveBeenCalled();

		const createPayload = mockedCreateSurveyToolExecute.mock.calls[0][0] as any;
		expect(createPayload.projectId).toBe("project-1");
		expect(createPayload.name).toContain("Waitlist");
		expect(createPayload.questions?.length).toBeGreaterThan(0);

		const responseCall = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const chunks = await readStreamChunks(responseCall.stream as ReadableStream<Record<string, unknown>>);
		const text = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""))
			.join("\n");
		expect(text).toContain("Created **");
		expect(text).toContain("Open Survey");
	});

	it("returns usable fallback and debug trace when deterministic survey create fails", async () => {
		mockedCreateSurveyToolExecute.mockResolvedValueOnce({
			success: false,
			message: "validation failed: name is required",
		} as any);

		const response = await action(
			buildArgs({ message: "/debug create a survey to learn more from those people without data" })
		);
		expect(response.status).toBe(200);
		expect(mockedCreateSurveyToolExecute).toHaveBeenCalledTimes(1);

		const responseCall = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const chunks = await readStreamChunks(responseCall.stream as ReadableStream<Record<string, unknown>>);
		const text = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""))
			.join("\n");
		expect(text).toContain("I couldn't create the survey automatically right now.");
		expect(text).toContain("Debug Trace:");
		expect(text).toContain("deterministic_survey_quick_create");
	});

	it("routes setup prompts to projectSetupAgent and returns non-empty chat output", async () => {
		mockedHandleChatStream.mockResolvedValue(
			makeTextStream({
				text: "Let’s define your company context and research goals first.",
				toolName: "saveProjectSectionsData",
			}) as any
		);

		const response = await action(buildArgs({ message: "help me set up project and define research goals" }));
		expect(response.status).toBe(200);
		expect(mockedGenerateObject).not.toHaveBeenCalled();
		expect(mockedHandleChatStream).toHaveBeenCalledTimes(1);
		const call = mockedHandleChatStream.mock.calls[0][0] as any;
		expect(call.agentId).toBe("projectSetupAgent");

		const responseCall = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const chunks = await readStreamChunks(responseCall.stream as ReadableStream<Record<string, unknown>>);
		const text = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""))
			.join("\n")
			.trim();
		expect(text.length).toBeGreaterThan(0);
	});

	it("routes people and task operational prompts through projectStatusAgent network", async () => {
		mockedHandleNetworkStream.mockResolvedValue(
			makeTextStream({
				text: "Found 5 people missing title or company and queued 2 follow-up tasks.",
				toolName: "fetchProjectStatusContext",
			}) as any
		);

		const peopleResponse = await action(buildArgs({ message: "show people missing company and title" }));
		expect(peopleResponse.status).toBe(200);
		expect(mockedGenerateObject).not.toHaveBeenCalled();
		expect(mockedHandleNetworkStream).toHaveBeenCalledTimes(1);
		expect((mockedHandleNetworkStream.mock.calls[0][0] as any).agentId).toBe("projectStatusAgent");

		mockedHandleNetworkStream.mockResolvedValue(
			makeTextStream({
				text: "Created a follow-up task for Mona with due date tomorrow.",
				toolName: "taskAgent",
			}) as any
		);
		const taskResponse = await action(buildArgs({ message: "create a task to follow up with Mona tomorrow" }));
		expect(taskResponse.status).toBe(200);
		expect(mockedHandleNetworkStream).toHaveBeenCalledTimes(2);
		expect((mockedHandleNetworkStream.mock.calls[1][0] as any).agentId).toBe("projectStatusAgent");
	});

	it("injects fallback even when upstream stream closes without finish chunk", async () => {
		mockedHandleChatStream.mockResolvedValue(makeTextStream({ emitFinish: false }) as any);
		mockedGenerateObject.mockResolvedValue({
			object: {
				targetAgentId: "chiefOfStaffAgent",
				confidence: 0.91,
				responseMode: "fast_standardized",
				rationale: "strategy guidance",
			},
		} as any);

		const response = await action(buildArgs({ message: "help me prioritize" }));
		expect(response.status).toBe(200);
		const responseCall = mockedCreateUIMessageStreamResponse.mock.calls.at(-1)?.[0] as any;
		const chunks = await readStreamChunks(responseCall.stream as ReadableStream<Record<string, unknown>>);
		const text = chunks
			.filter((chunk) => chunk.type === "text-delta")
			.map((chunk) => String((chunk as { delta?: unknown }).delta ?? ""))
			.join("\n");
		expect(text).toContain("Sorry, I couldn't answer that just now. Please try again.");
		expect(chunks.some((chunk) => chunk.type === "finish")).toBe(true);
	});
});
