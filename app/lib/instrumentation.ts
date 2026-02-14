// Force ws to skip optional native deps when bundled on Node (Fly)
// Prevents "bufferUtil.unmask is not a function" in production
if (!process.env.WS_NO_BUFFER_UTIL) process.env.WS_NO_BUFFER_UTIL = "1";
if (!process.env.WS_NO_UTF_8_VALIDATE) process.env.WS_NO_UTF_8_VALIDATE = "1";

// Silence Mastra dev warning about deprecated telemetry
(globalThis as any).___MASTRA_TELEMETRY___ = true;
