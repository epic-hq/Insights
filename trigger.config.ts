import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars, ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_lynprxsfeejgreudknxt",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    external: [
      "@boundaryml/baml",
      "@boundaryml/baml-*",
      "@aws-sdk/*",
      "@aws-sdk/client-s3",
      "execa",
      "ffmpeg-static",
    ],
    extensions: [
      // Install system ffmpeg for HLS stream processing (ffmpeg-static crashes with SIGSEGV on HLS)
      ffmpeg(),
      syncEnvVars(async (ctx) => {
        // Sync all required environment variables from process.env
        return [
          { name: "NODE_ENV", value: process.env.NODE_ENV || "production" },
          { name: "APP_ENV", value: process.env.APP_ENV || "production" },
          { name: "SUPABASE_URL", value: process.env.SUPABASE_URL! },
          { name: "SUPABASE_ANON_KEY", value: process.env.SUPABASE_ANON_KEY! },
          {
            name: "SUPABASE_SERVICE_ROLE_KEY",
            value: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          },
          { name: "OPENAI_API_KEY", value: process.env.OPENAI_API_KEY || "" },
          {
            name: "ASSEMBLYAI_API_KEY",
            value: process.env.ASSEMBLYAI_API_KEY || "",
          },
          { name: "ELEVEN_API_KEY", value: process.env.ELEVEN_API_KEY || "" },
          {
            name: "LANGFUSE_PUBLIC_KEY",
            value: process.env.LANGFUSE_PUBLIC_KEY || "",
          },
          {
            name: "LANGFUSE_SECRET_KEY",
            value: process.env.LANGFUSE_SECRET_KEY || "",
          },
          { name: "LANGFUSE_HOST", value: process.env.LANGFUSE_HOST || "" },
          { name: "RESEND_API_KEY", value: process.env.RESEND_API_KEY || "" },
          { name: "R2_ACCOUNT_ID", value: process.env.R2_ACCOUNT_ID || "" },
          {
            name: "R2_ACCESS_KEY_ID",
            value: process.env.R2_ACCESS_KEY_ID || "",
          },
          {
            name: "R2_SECRET_ACCESS_KEY",
            value: process.env.R2_SECRET_ACCESS_KEY || "",
          },
          { name: "R2_BUCKET_NAME", value: process.env.R2_BUCKET_NAME || "" },
          {
            name: "R2_BUCKET",
            value: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || "",
          },
          {
            name: "R2_PUBLIC_BASE_URL",
            value: process.env.R2_PUBLIC_BASE_URL || "",
          },
          { name: "R2_ENDPOINT", value: process.env.R2_ENDPOINT || "" },
          {
            name: "R2_S3_ENDPOINT",
            value: process.env.R2_S3_ENDPOINT || process.env.R2_ENDPOINT || "",
          },
          { name: "R2_REGION", value: process.env.R2_REGION || "" },
          {
            name: "SHARED_SIGNING_SECRET",
            value: process.env.SHARED_SIGNING_SECRET || "",
          },
          {
            name: "FILE_GATEWAY_URL",
            value: process.env.FILE_GATEWAY_URL || "",
          },
          {
            name: "TRIGGER_SECRET_KEY",
            value: process.env.TRIGGER_SECRET_KEY || "",
          },
          {
            name: "ENABLE_PERSONA_ANALYSIS",
            value: process.env.ENABLE_PERSONA_ANALYSIS || "",
          },
          {
            name: "POSTHOG_API_KEY",
            value: process.env.POSTHOG_API_KEY || "",
          },
          {
            name: "POSTHOG_HOST",
            value: process.env.POSTHOG_HOST || "",
          },
        ];
      }),
    ],
  },
});
