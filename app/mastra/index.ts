import type { RuntimeContext } from "@mastra/core/di"
import { Mastra } from "@mastra/core/mastra"
import { LibSQLStore } from "@mastra/libsql"
import { PinoLogger } from "@mastra/loggers"
import consola from "consola"
import { weatherAgent } from "./agents/weather-agent"
import { weatherWorkflow } from "./workflows/weather-workflow"

type UserContext = {
	user_id: string
	account_id: string
	project_id: string
}

export const mastra = new Mastra({
	workflows: { weatherWorkflow },
	agents: { weatherAgent },
	storage: new LibSQLStore({
		// stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
		url: ":memory:",
	}),
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		middleware: [
			async (c, next) => {
				const user_id = c.req.header("x-userid")
				const account_id = c.req.header("x-accountid")
				const project_id = c.req.header("x-projectid")
				// const runtimeContext = c.get<UserContext>("runtimeContext");
				const runtimeContext = c.get("runtimeContext") as RuntimeContext<UserContext>
				consola.log("mastra_header", c.req.header)
				consola.log("mastra_json: ", c.req.json)
				consola.log("mastra_parseBody: ", c.req.parseBody)
				consola.log("mastra_user_id", user_id)
				consola.log("mastra_account_id", account_id)
				consola.log("mastra_project_id", project_id)

				// Set temperature scale based on country
				runtimeContext.set("user_id", user_id || "FAKE_USER_ID")

				runtimeContext.set("account_id", account_id || "")

				runtimeContext.set("project_id", project_id || "")
				consola.log("mastra runtimeContext", runtimeContext)
				await next() // Don't forget to call next()
			},
		],
	},
})
