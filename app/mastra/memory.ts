/**
 * Shared Mastra Memory configuration with processors to prevent tool call errors.
 *
 * This memory instance is used by the chat API route and includes:
 * - ToolCallPairProcessor: Ensures tool call/result pairs are never orphaned
 * - TokenLimiter: Prevents context window overflow (applied last)
 *
 * The ToolCallPairProcessor prevents the "No tool call found for function call output"
 * error that occurs when message trimming separates tool calls from their results.
 *
 * @see https://github.com/mastra-ai/mastra/issues/3735
 * @see https://github.com/mastra-ai/mastra/issues/6489
 */

import { Memory } from "@mastra/memory"
// @ts-expect-error - moduleResolution workaround for @mastra/memory/processors subpath export
import { TokenLimiter } from "@mastra/memory/processors"
import { ToolCallPairProcessor } from "./processors/tool-call-pair-processor"
import { getSharedPostgresStore } from "./storage/postgres-singleton"

// GPT-4.1 has 128k context, but we limit to 100k to leave room for system prompt and response
const TOKEN_LIMIT = 100_000

export const memory = new Memory({
	storage: getSharedPostgresStore(),
	// Processors run in order - ToolCallPairProcessor must come BEFORE TokenLimiter
	// to ensure tool call/result pairs are identified before any trimming occurs.
	// This prevents "No tool call found for function call output" errors.
	processors: [new ToolCallPairProcessor(), new TokenLimiter(TOKEN_LIMIT)],
})
