import { z } from "zod/v4"

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
	HELLO: z.string().optional(),
	DEV_FAKE_AUTH: z.string().optional(),
	SUPABASE_URL: z.string(),
	SUPABASE_ANON_KEY: z.string(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // TODO: remove
	SUPABASE_FUNCTIONS_URL: z.string().optional(),
})

type ServerEnv = z.infer<typeof envSchema>
let env: ServerEnv

/**
 * Initializes and parses given environment variables using zod
 * @returns Initialized env vars
 */
function initEnv() {
	// This should be the only place to use process.env directly
	const envData = envSchema.safeParse(process.env)

	if (!envData.success) {
		throw new Error("Invalid environment variables")
	}

	env = envData.data
	Object.freeze(env)

	// Do not log the message when running tests
	if (env.NODE_ENV !== "test") {
	}
	return env
}

export function getServerEnv() {
	if (env) return env
	return initEnv()
}

/**
 * Helper function which returns a subset of the environment vars which are safe expose to the client.
 * Dont expose any secrets or sensitive data here.
 * Otherwise you would expose your server vars to the client if you returned them from here as this is
 * directly sent in the root to the client and set on the window.env
 * @returns Subset of the whole process.env to be passed to the client and used there
 */
export function getClientEnv() {
	const serverEnv = getServerEnv()
	return {
		NODE_ENV: serverEnv.NODE_ENV,
		HELLO: serverEnv.HELLO,
		DEV_FAKE_AUTH: serverEnv.DEV_FAKE_AUTH,
		SUPABASE_URL: serverEnv.SUPABASE_URL,
		SUPABASE_ANON_KEY: serverEnv.SUPABASE_ANON_KEY,
	}
}

type ClientEnvVars = ReturnType<typeof getClientEnv>

declare global {
	interface Window {
		env: ClientEnvVars
	}
}
