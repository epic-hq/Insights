// Force ws to skip optional native deps when bundled on Node (Fly)
// Prevents "bufferUtil.unmask is not a function" in production
if (!process.env.WS_NO_BUFFER_UTIL) process.env.WS_NO_BUFFER_UTIL = "1"
if (!process.env.WS_NO_UTF_8_VALIDATE)
	process.env.WS_NO_UTF_8_VALIDATE = "1"

	// Minimal Langfuse client init without OTel to avoid dev ESM issues
	// Silence Mastra dev warning about telemetry if present
;(globalThis as any).___MASTRA_TELEMETRY___ = true

import { getLangfuseClient } from "~/lib/langfuse"

getLangfuseClient()

// Optional: to also use the Langfuse client programmatically, import on-demand:
//   const { getLangfuseClient } = await import('~/lib/langfuse')
