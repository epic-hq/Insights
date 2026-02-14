import type { Tool as MastraTool } from "@mastra/core/tools";
import type { Tool as AITool, InferUITools } from "ai";
import type { z } from "zod";

/**
 * Infer a Zod schema to its TypeScript type, or fall back to unknown if not provided.
 */
type InferZodOrUnknown<S> = S extends z.ZodTypeAny ? z.infer<S> : unknown;

/**
 * Map a single Mastra tool (created via createTool) to an AI SDK Tool type (types only).
 * This is purely type-level and does not change runtime behavior.
 */
type MastraToAiTool<T> = T extends MastraTool<infer InSchema, infer OutSchema, any>
	? AITool<InferZodOrUnknown<InSchema>, InferZodOrUnknown<OutSchema>>
	: never;

/**
 * Map a record of Mastra tools to a record compatible with the AI SDK ToolSet (types only).
 */
type MastraToAiTools<TOOLS extends Record<string, unknown>> = {
	[K in keyof TOOLS]: MastraToAiTool<TOOLS[K]>;
};

/**
 * Convenience helper for UI typing: produce the AI SDK `InferUITools` from Mastra tools.
 */
export type InferMastraUITools<TOOLS extends Record<string, unknown>> = InferUITools<MastraToAiTools<TOOLS>>;
