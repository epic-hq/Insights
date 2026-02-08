/**
 * Shared Mastra Memory configuration for thread management.
 *
 * This memory instance is used by the chat API routes for:
 * - Creating and managing conversation threads
 * - Storing message history
 *
 * Note: In Mastra v1, output processors (TokenLimiterProcessor, ToolCallPairProcessor)
 * are now configured at the Agent level via `outputProcessors` property.
 *
 * @see https://github.com/mastra-ai/mastra/issues/3735
 * @see https://github.com/mastra-ai/mastra/issues/6489
 */

import { Memory } from "@mastra/memory";
import { getSharedPostgresStore } from "./storage/postgres-singleton";

export const memory = new Memory({
	storage: getSharedPostgresStore(),
});
