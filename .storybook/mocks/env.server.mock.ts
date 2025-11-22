// Mock environment variables for Storybook
export type ServerEnv = {
	NODE_ENV: "development" | "production" | "test"
	APP_ENV: "development" | "staging" | "production"
	SUPABASE_URL: string
	SUPABASE_ANON_KEY: string
	SUPABASE_SERVICE_ROLE_KEY?: string
	SUPABASE_DB_URL?: string
	SUPABASE_FUNCTIONS_URL?: string
	OPENAI_API_KEY?: string
	ASSEMBLYAI_API_KEY?: string
	ELEVEN_API_KEY?: string
	POSTHOG_KEY?: string
	POSTHOG_HOST?: string
	SIGNUP_CHAT_REQUIRED?: string
	LANGFUSE_PUBLIC_KEY?: string
	LANGFUSE_SECRET_KEY?: string
	LANGFUSE_HOST?: string
	RESEND_API_KEY?: string
	ENGAGE_API_KEY?: string
	ENGAGE_API_SECRET?: string
	DEFAULT_FROM_EMAIL?: string
	DEFAULT_FROM_EMAIL_NAME?: string
	R2_ACCOUNT_ID?: string
	R2_ACCESS_KEY_ID?: string
	R2_SECRET_ACCESS_KEY?: string
	R2_BUCKET_NAME?: string
	R2_PUBLIC_BASE_URL?: string
	R2_ENDPOINT?: string
	R2_REGION?: string
	TRIGGER_SECRET_KEY?: string
	PAYLOAD_CMS_URL: string
	HELLO?: string
	DEV_FAKE_AUTH?: string
}

const mockEnv: ServerEnv = {
	NODE_ENV: "development",
	APP_ENV: "development",
	SUPABASE_URL: "https://mock.supabase.co",
	SUPABASE_ANON_KEY: "mock-anon-key",
	PAYLOAD_CMS_URL: "https://upsight-cms.vercel.app",
}

export function getServerEnv(): ServerEnv {
	return mockEnv
}
