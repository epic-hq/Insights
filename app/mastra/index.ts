import type { RuntimeContext } from "@mastra/core/di"
import { Mastra } from "@mastra/core/mastra"
import { LibSQLStore } from "@mastra/libsql"
import { PinoLogger } from "@mastra/loggers"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { insightsAgent } from "./agents/insights-agent"
import { mainAgent } from "./agents/main-agent"
import { weatherAgent } from "./agents/weather-agent"
import { dailyBriefWorkflow } from "./workflows/daily-brief"
import { weatherWorkflow } from "./workflows/weather-workflow"

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
	workflows: { dailyBriefWorkflow, weatherWorkflow },
	agents: { mainAgent, weatherAgent, insightsAgent },
	storage: new LibSQLStore({
		// stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
		url: ":memory:",
	}),
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 4111,
		middleware: [
			async (c, next) => {
				const user_id = c.req.header("x-userid")
				const account_id = c.req.header("x-accountid")
				const project_id = c.req.header("x-projectid")
				const jwt = c.req.header("authorization")?.replace("Bearer ", "") // Extract JWT from Authorization header

				const runtimeContext = c.get("runtimeContext") as RuntimeContext<UserContext>
				consola.log("mastra_user_id", user_id)
				consola.log("mastra_account_id", account_id)
				consola.log("mastra_project_id", project_id)
				consola.log("mastra_jwt", jwt ? "present" : "missing")

				runtimeContext.set("user_id", user_id || "FAKE_USER_ID")
				runtimeContext.set("account_id", account_id || "")
				runtimeContext.set("project_id", project_id || "")
				runtimeContext.set("jwt", jwt || "") // Add JWT to runtime context

				consola.log("mastra runtimeContext", runtimeContext)
				await next()
			},
		],
	},
})
