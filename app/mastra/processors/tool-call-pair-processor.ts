/**
 * Custom memory processor that ensures tool call/result message pairs are never separated.
 *
 * The "No tool call found for function call output" error occurs when:
 * 1. TokenLimiter trims an assistant message with tool_calls but leaves orphaned tool results
 * 2. Tool results exist without their corresponding tool_calls in the message history
 *
 * This processor runs BEFORE TokenLimiter to ensure pair integrity is maintained
 * during any subsequent trimming operations.
 *
 * @see https://github.com/mastra-ai/mastra/issues/3735
 * @see https://github.com/mastra-ai/mastra/issues/6489
 * @see https://github.com/vercel/ai/issues/8216
 */

import type { CoreMessage } from "@mastra/core/llm";
import { MemoryProcessor, type MemoryProcessorOpts } from "@mastra/core/memory";
import consola from "consola";

type MessageRole = "user" | "assistant" | "system" | "tool";

interface ToolCallPart {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args?: Record<string, unknown>;
}

interface ToolResultPart {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	result?: unknown;
}

// CoreMessage content can be string or array of parts
type MessageContent = string | Array<{ type: string; [key: string]: unknown }>;

/**
 * Type guard for ToolCallPart
 */
function isToolCallPart(part: unknown): part is ToolCallPart {
	return (
		part !== null &&
		typeof part === "object" &&
		"type" in part &&
		(part as { type: unknown }).type === "tool-call" &&
		"toolCallId" in part &&
		typeof (part as { toolCallId: unknown }).toolCallId === "string"
	);
}

/**
 * Type guard for ToolResultPart
 */
function isToolResultPart(part: unknown): part is ToolResultPart {
	return (
		part !== null &&
		typeof part === "object" &&
		"type" in part &&
		(part as { type: unknown }).type === "tool-result" &&
		"toolCallId" in part &&
		typeof (part as { toolCallId: unknown }).toolCallId === "string"
	);
}

/**
 * Extracts tool call IDs from a message's content parts
 */
function getToolCallIds(message: CoreMessage): string[] {
	const content = message.content as MessageContent;
	if (!content || typeof content === "string" || !Array.isArray(content)) return [];

	const ids: string[] = [];
	for (const part of content) {
		if (isToolCallPart(part) && part.toolCallId) {
			ids.push(part.toolCallId);
		}
	}
	return ids;
}

/**
 * Extracts tool result IDs from a message's content parts
 */
function getToolResultIds(message: CoreMessage): string[] {
	const content = message.content as MessageContent;
	if (!content || typeof content === "string" || !Array.isArray(content)) return [];

	const ids: string[] = [];
	for (const part of content) {
		if (isToolResultPart(part) && part.toolCallId) {
			ids.push(part.toolCallId);
		}
	}
	return ids;
}

/**
 * ToolCallPairProcessor ensures that tool call/result message pairs remain intact.
 *
 * When messages are trimmed or filtered, this processor:
 * 1. Identifies all tool_call IDs in assistant messages
 * 2. Identifies all tool_result IDs in tool messages
 * 3. Removes any orphaned tool results (results without matching calls)
 * 4. Removes any orphaned tool calls (calls without matching results)
 *
 * This prevents the OpenAI API error:
 * "No tool call found for function call output with call_id ..."
 */
export class ToolCallPairProcessor extends MemoryProcessor {
	constructor() {
		super({ name: "ToolCallPairProcessor" });
	}

	process(messages: CoreMessage[], _opts: MemoryProcessorOpts): CoreMessage[] {
		if (!messages || messages.length === 0) return messages;

		// Collect all tool call IDs from assistant messages
		const toolCallIds = new Set<string>();
		// Collect all tool result IDs from tool messages
		const toolResultIds = new Set<string>();

		for (const message of messages) {
			const role = message.role as MessageRole;
			if (role === "assistant") {
				for (const id of getToolCallIds(message)) {
					toolCallIds.add(id);
				}
			} else if (role === "tool") {
				for (const id of getToolResultIds(message)) {
					toolResultIds.add(id);
				}
			}
		}

		// Find orphaned IDs
		const orphanedResults = Array.from(toolResultIds).filter((id) => !toolCallIds.has(id));
		const orphanedCalls = Array.from(toolCallIds).filter((id) => !toolResultIds.has(id));

		if (orphanedResults.length > 0 || orphanedCalls.length > 0) {
			consola.warn("[ToolCallPairProcessor] Found orphaned tool messages", {
				orphanedResults: orphanedResults.length,
				orphanedCalls: orphanedCalls.length,
			});
		}

		// Filter messages to remove orphaned content
		const filteredMessages: CoreMessage[] = [];

		for (const message of messages) {
			const role = message.role as MessageRole;
			const content = message.content;

			// For tool messages, remove orphaned results
			if (role === "tool" && Array.isArray(content)) {
				const filteredContent = content.filter((part) => {
					if (isToolResultPart(part)) {
						return toolCallIds.has(part.toolCallId);
					}
					return true;
				});

				// If all content was removed, skip this message entirely
				if (filteredContent.length === 0) {
					continue;
				}

				filteredMessages.push({ ...message, content: filteredContent } as unknown as CoreMessage);
				continue;
			}

			// For assistant messages, remove orphaned tool calls
			if (role === "assistant" && Array.isArray(content)) {
				const filteredContent = content.filter((part) => {
					if (isToolCallPart(part)) {
						return toolResultIds.has(part.toolCallId);
					}
					return true;
				});

				// Keep the message even if tool calls were removed (it may have text content)
				filteredMessages.push({ ...message, content: filteredContent } as unknown as CoreMessage);
				continue;
			}

			filteredMessages.push(message);
		}

		return filteredMessages;
	}
}

/**
 * Creates a ToolCallPairProcessor instance
 */
export function createToolCallPairProcessor(): ToolCallPairProcessor {
	return new ToolCallPairProcessor();
}
