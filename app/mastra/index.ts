import { chatRoute } from "@mastra/ai-sdk"
import type { RuntimeContext } from "@mastra/core/di"
import { Mastra } from "@mastra/core/mastra"
import { PinoLogger } from "@mastra/loggers"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { LangfuseExporter } from "langfuse-vercel"
import { analysisAgent } from "./agents/analysis-agent"
import { insightsAgent } from "./agents/insights-agent"
import { mainAgent } from "./agents/main-agent"
import { projectSetupAgent } from "./agents/project-setup-agent"
import { signupAgent } from "./agents/signup-agent"
import { weatherAgent } from "./agents/weather-agent"
import { getSharedPostgresStore } from "./storage/postgres-singleton"
import { dailyBriefWorkflow } from "./workflows/daily-brief"
import { signupOnboardingWorkflow } from "./workflows/signup-onboarding"
import { weatherWorkflow } from "./workflows/weather-workflow"
// import { getServerEnv } from "~/env.server"

// Create global SupabaseClient for workflows
export const supabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export type UserContext = {
	user_id: string
	account_id: string
	project_id: string
	jwt: string
	supabase?: any // Allow supabase client injection
}

export const mastra = new Mastra({
	workflows: { dailyBriefWorkflow, weatherWorkflow, signupOnboardingWorkflow },
	agents: { mainAgent, weatherAgent, insightsAgent, signupAgent, projectSetupAgent, analysisAgent },
	storage: getSharedPostgresStore(),
	logger: new PinoLogger({
		name: "mastra",
		level: "info",
	}),
	telemetry: {
		enabled: true,
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
				consola.log("server middleware - user_id", user_id)
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
				path: "/chat/analysis",
				agent: "analysisAgent",
			}),
			// CopilotKit routes removed
		],
	},
})
