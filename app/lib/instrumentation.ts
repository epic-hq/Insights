// Minimal Langfuse client init without OTel to avoid dev ESM issues
// Silence Mastra dev warning about telemetry if present
;(globalThis as any).___MASTRA_TELEMETRY___ = true

import { getLangfuseClient } from "~/lib/langfuse"
getLangfuseClient()

// Optional: to also use the Langfuse client programmatically, import on-demand:
//   const { getLangfuseClient } = await import('~/lib/langfuse')
