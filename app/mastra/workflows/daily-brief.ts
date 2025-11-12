import { createStep, createWorkflow } from "@mastra/core/workflows"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { getInsights } from "~/features/insights/db"
import { getLangfuseClient } from "~/lib/langfuse.server"
import type { SupabaseClient } from "~/types"
import { llmAgent } from "../agents/llmAgent"

// FLOW: get insights, analyze, recommend & get user choice

// setup types by entity
// schemas/entity/

// Schemas are runtime helpers, eg validation of IO
// TODO: account for all fields in types
const _InsightSchema = z.object({
	id: z.string(),
	name: z.string(),
	tag: z.string(),
	category: z.string(),
	journeyStage: z.string(),
	impact: z.number(),
	novelty: z.number(),
	description: z.string().optional().default("some descriptive stuff"),
})

// we get types from supabase dynamically (better)
// type Insight = z.infer<typeof InsightSchema> // TS static - unused for now
// type InsightInput = z.input<typeof InsightSchema> // unused for now

const getInsightsStep = createStep({
	id: "get-insights",
	description: "Get last 5 insights",
	inputSchema: z.object({
		account_id: z.string(),
		project_id: z.string(),
	}),
	outputSchema: z.object({
		value: z.array(z.any()),
	}),
	execute: async ({ inputData, runtimeContext }) => {
		const { account_id, project_id } = inputData

		// Get supabase from runtime context, fallback to creating one
		let supabase: SupabaseClient | null = runtimeContext?.get("supabase")
		if (!supabase) {
			supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
			consola.log("wf-daily: created fallback supabase client")
		} else {
			consola.log("wf-daily: using INJECTED supabase client")
		}

		const { data: insights } = await getInsights({
			supabase,
			accountId: account_id,
			projectId: project_id,
		})
		consola.log("wf-daily: account and project id", account_id, project_id)
		consola.log("wf-daily: insights result", { count: insights?.length })

		// const { data: test } = await supabase.from("themes").select("id,name,pain,details").eq("project_id", project_id)
		// consola.log("wf-daily: test", { count: test?.length, test })

		// Handle potential undefined return from getInsights
		return {
			value: insights || [],
		}
	},
})

const BriefingSummaryStep = createStep({
	id: "BriefingSummary",
	description: "Summarize insights",
	inputSchema: z.object({
		value: z.array(z.any()),
	}),
	outputSchema: z.object({
		value: z.string(),
	}),
	execute: async ({ inputData }) => {
		const { value } = inputData

		if (!value || value.length === 0) {
			return {
				value: "No insights found for this project.",
			}
		}

		// Prepare insights data for LLM
		const insightsText = value
			.map((insight: any) => {
				const name = insight?.name || "Unnamed insight"
				const pain = insight?.pain || ""
				const details = insight?.details || ""
				return `- ${name}${pain ? `: ${pain}` : ""}${details ? ` (${details})` : ""}`
			})
			.join("\n")
		consola.log("wf-daily: insights text", insightsText?.length)
		try {
			// Use Mastra agent to summarize insights
			const prompt = `You are a user research analyst. Summarize these insights into a concise daily brief that highlights key patterns, pain points, and actionable recommendations:
          ${insightsText}
          ----------------------------
          Format your response as a professional daily brief with:
          1. Key Themes (2-3 main patterns)
          2. 2 - 3 Critical Pain Points
          3. 2  Recommended Actions

          Keep it concise but actionable.`

			const langfuse = getLangfuseClient()
			const trace = (langfuse as any).trace?.({ name: "llm.daily-brief" })
			const gen = trace?.generation?.({ name: "llm.daily-brief" })
			const { text } = await llmAgent.generate([{ role: "user", content: prompt }])
			gen?.update?.({ input: { insights_count: value.length, prompt_len: prompt.length }, output: { text } })
			gen?.end?.()
			consola.log("LLM summary:", text)
			return { value: text }
		} catch (error) {
			consola.error("Error generating LLM summary:", error)
			// Fallback to simple summary
			const fallbackSummary = `Daily Brief: Found ${value.length} insights and encountered an error.`
			return {
				value: fallbackSummary,
			}
		}
	},
})

const dailyBriefWorkflow = createWorkflow({
	id: "dailyBriefWorkflow",
	description: "Generate daily brief of insights",
	inputSchema: z.object({
		account_id: z.string(),
		project_id: z.string(),
	}),
	outputSchema: z.object({
		value: z.string(),
	}),
})
	.then(getInsightsStep)
	.then(BriefingSummaryStep)

dailyBriefWorkflow.commit()

export { dailyBriefWorkflow }

// const run = await mastra.getWorkflow("workflow").createRunAsync();

// const result = await run.start({...});

// if (result.status === "suspended") {
//   const resumedResult = await run.resume({...});
// }
