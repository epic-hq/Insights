/**
 * Langfuse Model Middleware
 *
 * Vercel AI SDK LanguageModelMiddleware that logs every LLM call
 * (both streaming and non-streaming) to Langfuse as generation observations.
 * Applied at the provider level so all agents are instrumented automatically.
 */

import type { LanguageModelMiddleware } from "ai";
import consola from "consola";
import { getLangfuseClient } from "./langfuse.server";

export function createLangfuseModelMiddleware(): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const langfuse = getLangfuseClient();
      const modelId = model.modelId || "unknown";
      const startTime = new Date();

      const trace = (langfuse as any).trace?.({
        name: `agent.${modelId}`,
        metadata: { source: "mastra-agent" },
      });

      const generation = trace?.generation?.({
        name: `agent.${modelId}`,
        model: modelId,
        startTime,
      });

      try {
        const result = await doGenerate();

        const usage = result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens:
                (result.usage.promptTokens ?? 0) +
                (result.usage.completionTokens ?? 0),
            }
          : undefined;

        generation?.end?.({
          output: result.text ?? result.toolCalls,
          usage,
          model: result.response?.modelId ?? modelId,
          endTime: new Date(),
        });

        trace?.end?.();

        (langfuse as any)?.flushAsync?.().catch((err: unknown) => {
          consola.debug("[langfuse-middleware] flush error:", err);
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        generation?.end?.({
          level: "ERROR",
          statusMessage: message,
          model: modelId,
          endTime: new Date(),
        });
        trace?.end?.();
        (langfuse as any)?.flushAsync?.().catch(() => {});
        throw error;
      }
    },

    wrapStream: async ({ doStream, params, model }) => {
      const langfuse = getLangfuseClient();
      const modelId = model.modelId || "unknown";
      const startTime = new Date();

      const trace = (langfuse as any).trace?.({
        name: `agent.${modelId}`,
        metadata: { source: "mastra-agent", streaming: true },
      });

      const generation = trace?.generation?.({
        name: `agent.${modelId}`,
        model: modelId,
        startTime,
      });

      const result = await doStream();

      // Wrap the stream to intercept the finish event with usage data
      const originalStream = result.stream;
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Pass through all chunks
          controller.enqueue(chunk);

          // Intercept finish chunks to extract usage
          if (chunk.type === "finish" && chunk.usage) {
            const usage = {
              promptTokens: chunk.usage.promptTokens,
              completionTokens: chunk.usage.completionTokens,
              totalTokens:
                (chunk.usage.promptTokens ?? 0) +
                (chunk.usage.completionTokens ?? 0),
            };

            generation?.end?.({
              usage,
              model: modelId,
              endTime: new Date(),
            });

            trace?.end?.();

            (langfuse as any)?.flushAsync?.().catch((err: unknown) => {
              consola.debug("[langfuse-middleware] flush error:", err);
            });
          }
        },
      });

      return {
        ...result,
        stream: originalStream.pipeThrough(transformStream),
      };
    },
  };
}
