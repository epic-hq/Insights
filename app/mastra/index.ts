import { chatRoute } from "@mastra/ai-sdk"
import type { RuntimeContext } from "@mastra/core/di"
import { Mastra } from "@mastra/core/mastra"
import { PinoLogger } from "@mastra/loggers"
import { createClient } from "@supabase/supabase-js"
import { LangfuseExporter } from "langfuse-vercel"
import { insightsAgent } from "./agents/insights-agent"
import { mainAgent } from "./agents/main-agent"
import { projectSetupAgent } from "./agents/project-setup-agent"
import { researchAssistantAgent } from "./agents/research-assistant-agent"
import { signupAgent } from "./agents/signup-agent"
import { weatherAgent } from "./agents/weather-agent"
import { webLeadAgent } from "./agents/weblead-agent"
import { getSharedPostgresStore } from "./storage/postgres-singleton"
import { dailyBriefWorkflow } from "./workflows/daily-brief"
import { signupOnboardingWorkflow } from "./workflows/signup-onboarding"
import { weatherWorkflow } from "./workflows/weather-workflow"
// import { getServerEnv } from "~/env.server"

// Create global SupabaseClient for workflows
export const supabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

const STREAM_RESULT_ALIASES_SYMBOL = Symbol("mastraStreamResultAliases")

type AISDKV5Stream = {
	toUIMessageStreamResponse?: (options?: unknown) => unknown
	toTextStreamResponse?: (options?: unknown) => unknown
}

type StreamResultLike = {
	aisdk?: { v5?: AISDKV5Stream }
	toDataStreamResponse?: (options?: unknown) => unknown
	toUIMessageStreamResponse?: (options?: unknown) => unknown
	toTextStreamResponse?: (options?: unknown) => unknown
	[key: string]: unknown
}

const ensureStreamResultAliases = <T extends StreamResultLike>(result: T): T => {
	const aiSdkV5 = result.aisdk?.v5
	if (!aiSdkV5) {
		return result
	}
	if (typeof result.toDataStreamResponse !== "function" && typeof aiSdkV5.toUIMessageStreamResponse === "function") {
		result.toDataStreamResponse = (options?: unknown) => aiSdkV5.toUIMessageStreamResponse?.(options)
	}
	if (
		typeof result.toUIMessageStreamResponse !== "function" &&
		typeof aiSdkV5.toUIMessageStreamResponse === "function"
	) {
		result.toUIMessageStreamResponse = (options?: unknown) => aiSdkV5.toUIMessageStreamResponse?.(options)
	}
	if (typeof result.toTextStreamResponse !== "function" && typeof aiSdkV5.toTextStreamResponse === "function") {
		result.toTextStreamResponse = (options?: unknown) => aiSdkV5.toTextStreamResponse?.(options)
	}
	return result
}

type StreamableAgent = {
	stream: (...args: unknown[]) => Promise<StreamResultLike>
	[key: string]: unknown
}

const attachStreamResultAliases = <T extends StreamableAgent>(agent: T): T => {
	const agentWithFlag = agent as Record<PropertyKey, unknown>
	if (agentWithFlag[STREAM_RESULT_ALIASES_SYMBOL]) {
		return agent
	}
	const originalStream = agent.stream.bind(agent) as (...args: unknown[]) => Promise<StreamResultLike>
	agent.stream = (async (...args: unknown[]) => {
		const streamResult = await originalStream(...args)
		return ensureStreamResultAliases(streamResult)
	}) as T["stream"]
	agentWithFlag[STREAM_RESULT_ALIASES_SYMBOL] = true
	return agent
}

export type UserContext = {
	user_id: string
	account_id: string
	project_id: string
	jwt: string
	supabase?: unknown // Allow supabase client injection
}

const agents = {
	mainAgent: attachStreamResultAliases(mainAgent),
	weatherAgent: attachStreamResultAliases(weatherAgent),
	insightsAgent: attachStreamResultAliases(insightsAgent),
	signupAgent: attachStreamResultAliases(signupAgent),
	projectSetupAgent: attachStreamResultAliases(projectSetupAgent),
	researchAssistantAgent: attachStreamResultAliases(researchAssistantAgent),
	webLeadAgent: attachStreamResultAliases(webLeadAgent),
}

export const mastra = new Mastra({
	workflows: { dailyBriefWorkflow, weatherWorkflow, signupOnboardingWorkflow },
	agents,
	storage: getSharedPostgresStore(),
	logger: new PinoLogger({
		name: "mastra",
		level: "info",
	}),
	telemetry: {
		enabled: true,
		// Works but doesn't have generations?
		// serviceName: "mastra",
		// export: {
		// 	type: 'otlp',
		// 	endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT, // or your preferred endpoint
		// 	headers: {
		// 		Authorization: `Basic ${process.env.LANGFUSE_AUTH_STRING}`, // Your base64-encoded auth string
		// 	},
		// },
		serviceName: "ai",
		export: {
			type: "custom",
			exporter: new LangfuseExporter({
				publicKey: process.env.LANGFUSE_PUBLIC_KEY,
				secretKey: process.env.LANGFUSE_SECRET_KEY,
				baseUrl: process.env.LANGFUSE_HOST,
			}),
		},
	},
	server: {
		cors: {
			origin: "*",
			allowMethods: ["*"],
			allowHeaders: ["*"],
		},
		port: 4111,
		middleware: [
			async (c, next) => {
				// Use lowercase header names (case-insensitive per spec; some adapters normalize to lowercase)
				const user_id = c.req.header("x-userid")
				// consola.log("mastra_middleware user_id", user_id)
				// consola.log("mastra_middleware headers", c.req.header())
				const account_id = c.req.header("x-accountid")
				const project_id = c.req.header("x-projectid")
				const jwt = c.req.header("authorization")?.replace("Bearer ", "") // Extract JWT from Authorization header

				const runtimeContext = c.get("runtimeContext") as RuntimeContext<UserContext>
				// consola.log("mastra_account_id", account_id)
				// consola.log("mastra_project_id", project_id)
				// consola.log("mastra_jwt", jwt ? "present" : "missing")

				runtimeContext.set("user_id", user_id || "FAKE_USER_ID")
				runtimeContext.set("account_id", account_id || "")
				runtimeContext.set("project_id", project_id || "")
				runtimeContext.set("jwt", jwt || "") // Add JWT to runtime context
				// consola.log("mastra_runtimeContext", runtimeContext.get("user_id"))
				// consola.log("server middleware - user_id", user_id)
				await next()
			},
		],
		apiRoutes: [
			chatRoute({
				path: "/chat/signup",
				agent: "signupAgent",
			}),
			chatRoute({
				path: "/chat/project-setup",
				agent: "projectSetupAgent",
			}),
			chatRoute({
				path: "/chat/research-assistant",
				agent: "researchAssistantAgent",
			}),
			chatRoute({
				path: "/chat/web-lead",
				agent: "webLeadAgent",
			}),
			// CopilotKit routes removed
		],
	},
})
