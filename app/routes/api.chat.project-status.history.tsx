import { convertMessages } from "@mastra/core/agent";
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { listProjectStatusThreads } from "~/features/project-chat/project-status-threads.server";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";

function normalizeLegacyDataPart(part: unknown): Array<Record<string, unknown>> {
	if (!part || typeof part !== "object") return [];
	const candidate = part as Record<string, unknown>;
	const partType = typeof candidate.type === "string" ? candidate.type : null;

	// Keep already-valid typed data parts.
	if (partType?.startsWith("data-")) return [candidate];
	if (partType !== "data") return [candidate];

	const payload = candidate.data;
	const toTyped = (type: string, data: unknown): Record<string, unknown> | null => {
		if (!type.startsWith("data-")) return null;
		return { type, data };
	};
	const fromObject = (value: Record<string, unknown>): Record<string, unknown>[] => {
		const nestedType = typeof value.type === "string" ? value.type : null;
		if (nestedType?.startsWith("data-")) {
			const normalized = toTyped(nestedType, "data" in value ? value.data : value);
			return normalized ? [normalized] : [];
		}
		if (nestedType === "navigate" && typeof value.path === "string") {
			const normalized = toTyped("data-navigate", { path: value.path });
			return normalized ? [normalized] : [];
		}
		if (nestedType === "a2ui" && Array.isArray(value.messages)) {
			const normalized = toTyped("data-a2ui", { messages: value.messages });
			return normalized ? [normalized] : [];
		}
		if ("tool" in value || "status" in value || "progress" in value || "message" in value) {
			const normalized = toTyped("data-tool-progress", value);
			return normalized ? [normalized] : [];
		}
		return [];
	};

	if (Array.isArray(payload)) {
		return payload.flatMap((entry) => {
			if (!entry || typeof entry !== "object") return [];
			return fromObject(entry as Record<string, unknown>);
		});
	}

	if (payload && typeof payload === "object") {
		return fromObject(payload as Record<string, unknown>);
	}

	return [];
}

function sanitizeLegacyMessageParts(messages: UpsightMessage[]): UpsightMessage[] {
	return messages.map((message) => {
		if (!Array.isArray(message.parts)) return message;
		const normalizedParts = message.parts.flatMap((part) => normalizeLegacyDataPart(part));
		return { ...message, parts: normalizedParts } as UpsightMessage;
	});
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	const _accountId = String(params.accountId || "");
	const userId = ctx?.claims?.sub || "";

	// consola.info("project-status history: params received", {
	// 	projectId,
	// 	accountId,
	// 	userId,
	// 	paramsKeys: Object.keys(params || {}),
	// 	allParams: params,
	// })

	if (!projectId) {
		consola.warn("project-status history: Missing projectId");
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	if (!userId) {
		consola.warn("project-status history: Missing userId");
		return Response.json({ error: "Missing userId" }, { status: 401 });
	}

	try {
		const threads = await listProjectStatusThreads({
			memory,
			userId,
			projectId,
			perPage: 100,
		});

		if (threads.length === 0) {
			return Response.json({ messages: [] });
		}

		const threadId = threads[0].id;

		// Query messages using Memory API (v1: query() renamed to recall(), messagesV2 renamed to messages)
		const { messages } = await memory.recall({
			threadId,
			perPage: 100,
		});

		// Convert messages to UI format
		let uiMessages: UpsightMessage[] = [];
		if (messages && messages.length > 0) {
			uiMessages = sanitizeLegacyMessageParts(convertMessages(messages).to("AIV5.UI") as UpsightMessage[]);
		}

		// consola.info("project-status history: converted to UI format", { uiMessageCount: uiMessages.length, })

		// Return messages in the format expected by the UI
		return Response.json({
			threadId,
			messages: uiMessages,
		});
	} catch (error) {
		consola.error("Error loading project status chat history:", error);
		return Response.json({ error: "Failed to load chat history" }, { status: 500 });
	}
}
