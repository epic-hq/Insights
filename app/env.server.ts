import { z } from "zod/v4";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  HELLO: z.string().optional(),
  DEV_FAKE_AUTH: z.string().optional(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // TODO: remove
  SUPABASE_DB_URL: z.string().optional(), // For Mastra PostgresStore
  SUPABASE_FUNCTIONS_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  ELEVEN_API_KEY: z.string().optional(),
  // PostHog runtime vars (used as fallback when VITE_ vars are not inlined)
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional(),
  SIGNUP_CHAT_REQUIRED: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ENGAGE_API_KEY: z.string().optional(),
  ENGAGE_API_SECRET: z.string().optional(),
  DEFAULT_FROM_EMAIL: z.email().optional(),
  DEFAULT_FROM_EMAIL_NAME: z.string().optional(),

  // LiveKit
  LIVEKIT_SFU_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_TTL_SECONDS: z.string().optional(),

  // Voice pipelines
  DEEPGRAM_API_KEY: z.string().optional(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_REGION: z.string().optional(),

  TRIGGER_SECRET_KEY: z.string().optional(),

  // Recall.ai Desktop SDK
  RECALL_API_KEY: z.string().optional(),
  RECALL_API_URL: z.string().optional(),
  RECALL_WEBHOOK_SECRET: z.string().optional(),

  // Payload CMS
  PAYLOAD_CMS_URL: z.string().default("https://upsight-cms.vercel.app"),

  // Polar.sh billing
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_ACCESS_TOKEN: z.string().optional(),
  // Polar product IDs (hardcoded defaults from Polar dashboard)
  POLAR_PRODUCT_STARTER_MONTHLY: z
    .string()
    .default("43cd1bf3-1b5b-45e9-9c87-fbd21fa82954"),
  POLAR_PRODUCT_STARTER_ANNUAL: z
    .string()
    .default("e0fc0ce2-c0fd-43c9-bc8b-abb2c1df76ad"),
  POLAR_PRODUCT_PRO_MONTHLY: z
    .string()
    .default("c09e11de-1ab6-4f0f-86ca-799ad512be5b"),
  POLAR_PRODUCT_PRO_ANNUAL: z
    .string()
    .default("95c62fc0-e26a-4b33-8e5c-fcaf76972a9e"),
  POLAR_PRODUCT_TEAM_MONTHLY: z
    .string()
    .default("f69fb092-eab5-46e0-820a-d15fafef8a1d"),
  POLAR_PRODUCT_TEAM_ANNUAL: z
    .string()
    .default("1e2c65e8-907e-4be3-be4d-8d78613ce66a"),

  // Sales/Demo scheduling
  SALES_SCHEDULER_URL: z.string().default("https://cal.com/rickmoy"),
});

export type ServerEnv = z.infer<typeof envSchema>;
let env: ServerEnv;

/**
 * Initializes and parses given environment variables using zod
 * @returns Initialized env vars
 */
function initEnv() {
  // Return mock env for Storybook/browser environments
  if (typeof window !== "undefined") {
    return {
      NODE_ENV: "development" as const,
      APP_ENV: "development" as const,
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_ANON_KEY: "mock-anon-key",
      PAYLOAD_CMS_URL: "https://upsight-cms.vercel.app",
    } as ServerEnv;
  }

  // This should be the only place to use process.env directly
  const rawEnv = {
    ...process.env,
    // Backward-compatibility: allow either DEFAULT_FROM_EMAIL / DEFAULT_FROM_EMAIL_NAME
    // or the previously used DEFAULT_EMAIL_FROM / DEFAULT_EMAIL_FROM_NAME
    DEFAULT_FROM_EMAIL:
      process.env.DEFAULT_FROM_EMAIL ?? process.env.DEFAULT_EMAIL_FROM,
    DEFAULT_FROM_EMAIL_NAME:
      process.env.DEFAULT_FROM_EMAIL_NAME ??
      process.env.DEFAULT_EMAIL_FROM_NAME,
    // Backward-compatibility: allow legacy RECALLAI_API_KEY
    RECALL_API_KEY: process.env.RECALL_API_KEY ?? process.env.RECALLAI_API_KEY,
  };

  const envData = envSchema.safeParse(rawEnv);

  if (!envData.success) {
    throw new Error("Invalid environment variables");
  }

  env = envData.data;
  Object.freeze(env);

  // Do not log the message when running tests
  if (env.NODE_ENV !== "test") {
  }
  return env;
}

export function getServerEnv() {
  if (env) return env;
  return initEnv();
}

/**
 * Helper function which returns a subset of the environment vars which are safe expose to the client.
 * Dont expose any secrets or sensitive data here.
 * Otherwise you would expose your server vars to the client if you returned them from here as this is
 * directly sent in the root to the client and set on the window.env
 * @returns Subset of the whole process.env to be passed to the client and used there
 */
export function getClientEnv() {
  const serverEnv = getServerEnv();
  return {
    NODE_ENV: serverEnv.NODE_ENV,
    HELLO: serverEnv.HELLO,
    DEV_FAKE_AUTH: serverEnv.DEV_FAKE_AUTH,
    SUPABASE_URL: serverEnv.SUPABASE_URL,
    SUPABASE_ANON_KEY: serverEnv.SUPABASE_ANON_KEY,
    // PostHog (client-side consumption)
    POSTHOG_KEY: serverEnv.POSTHOG_KEY,
    POSTHOG_HOST: serverEnv.POSTHOG_HOST,
    SIGNUP_CHAT_REQUIRED: serverEnv.SIGNUP_CHAT_REQUIRED,
    // Sales/Demo scheduling
    SALES_SCHEDULER_URL: serverEnv.SALES_SCHEDULER_URL,
  };
}

export type ClientEnvVars = ReturnType<typeof getClientEnv>;

declare global {
  interface Window {
    env: ClientEnvVars;
  }
}
