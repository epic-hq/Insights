// @vitest-environment node

import { convertMessages } from "@mastra/core/agent";
import type { LoaderFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectStatusThreads } from "~/features/project-chat/project-status-threads.server";
import { memory } from "~/mastra/memory";
import { loader } from "./api.chat.project-status.history";

vi.mock("@mastra/core/agent", () => ({
	convertMessages: vi.fn(),
}));

vi.mock("~/features/project-chat/project-status-threads.server", () => ({
	listProjectStatusThreads: vi.fn(),
}));

vi.mock("~/mastra/memory", () => ({
	memory: {
		recall: vi.fn(),
	},
}));

vi.mock("~/server/user-context", () => ({
	userContext: Symbol("userContext"),
}));

const mockedConvertMessages = vi.mocked(convertMessages);
const mockedListProjectStatusThreads = vi.mocked(listProjectStatusThreads);
const mockedMemory = memory as unknown as { recall: ReturnType<typeof vi.fn> };

function buildArgs(options?: { projectId?: string; accountId?: string; userId?: string }) {
	const context = {
		get: vi.fn().mockReturnValue({
			claims: { sub: options?.userId ?? "user-1" },
		}),
	};

	return {
		context,
		params: {
			projectId: options?.projectId ?? "project-1",
			accountId: options?.accountId ?? "acct-1",
		},
	} as unknown as LoaderFunctionArgs;
}

describe("api.chat.project-status.history", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedListProjectStatusThreads.mockResolvedValue([{ id: "thread-1" }] as any);
		mockedMemory.recall.mockResolvedValue({ messages: [{ id: "raw-1" }] });
	});

	it("normalizes legacy data parts from recalled messages to typed data-* parts", async () => {
		mockedConvertMessages.mockReturnValue({
			to: () => [
				{
					id: "msg-1",
					role: "assistant",
					parts: [
						{
							type: "data",
							data: [{ type: "navigate", path: "/a/acct-1/project-1/ask/survey-1/edit" }],
						},
					],
				},
			],
		} as any);

		const response = await loader(buildArgs());
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.threadId).toBe("thread-1");
		expect(Array.isArray(body.messages)).toBe(true);
		const parts = body.messages[0]?.parts ?? [];
		expect(parts.some((part: { type?: string }) => part.type === "data")).toBe(false);
		expect(
			parts.some(
				(part: { type?: string; data?: { path?: string } }) =>
					part.type === "data-navigate" && part.data?.path === "/a/acct-1/project-1/ask/survey-1/edit"
			)
		).toBe(true);
	});
});
