import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/server"
import { getSharedPostgresStore } from "../storage/postgres-singleton"
import { getResearchAnswerRollup } from "~/lib/database/research-answers.server"

// Tools to retrieve and search project data
const fetchProjectRollupTool = createTool({
  id: "fetch-project-rollup",
  description: "Get a comprehensive rollup of decision questions, research questions, answers, and latest analysis for a project.",
  inputSchema: z.object({ project_id: z.string().min(1) }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const { project_id } = context as { project_id: string }
    const data = await getResearchAnswerRollup(supabaseAdmin as any, project_id)
    return data
  },
})

const searchEvidenceTool = createTool({
  id: "search-evidence",
  description: "Search evidence verbatims within a project by a free-text query.",
  inputSchema: z.object({ project_id: z.string().min(1), query: z.string().min(1), limit: z.number().min(1).max(200).optional() }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
  execute: async ({ context }) => {
    const { project_id, query, limit = 50 } = context as { project_id: string; query: string; limit?: number }
    const { data, error } = await supabaseAdmin
      .from("evidence")
      .select("id, verbatim, support, modality, topic, created_at, interview_id, project_answer_id")
      .eq("project_id", project_id)
      .ilike("verbatim", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return { rows: data ?? [] }
  },
})

const listInterviewsTool = createTool({
  id: "list-interviews",
  description: "List interviews for a project (id, title, interview_date).",
  inputSchema: z.object({ project_id: z.string().min(1) }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
  execute: async ({ context }) => {
    const { project_id } = context as { project_id: string }
    const { data, error } = await supabaseAdmin
      .from("interviews")
      .select("id, title, interview_date")
      .eq("project_id", project_id)
      .order("interview_date", { ascending: false })
    if (error) throw error
    return { rows: data ?? [] }
  },
})

const listPersonasTool = createTool({
  id: "list-personas",
  description: "List personas for a project (id, name, summary if available).",
  inputSchema: z.object({ project_id: z.string().min(1) }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
  execute: async ({ context }) => {
    const { project_id } = context as { project_id: string }
    const { data, error } = await supabaseAdmin
      .from("personas")
      .select("id, name, summary")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
    if (error) throw error
    return { rows: data ?? [] }
  },
})

const listDecisionQuestionsTool = createTool({
  id: "list-decision-questions",
  description: "List decision questions for a project (id, text, rationale).",
  inputSchema: z.object({ project_id: z.string().min(1) }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
  execute: async ({ context }) => {
    const { project_id } = context as { project_id: string }
    const { data, error } = await supabaseAdmin
      .from("decision_questions")
      .select("id, text, rationale, created_at")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
    if (error) throw error
    return { rows: data ?? [] }
  },
})

const listResearchQuestionsTool = createTool({
  id: "list-research-questions",
  description: "List research questions for a project (id, text, rationale).",
  inputSchema: z.object({ project_id: z.string().min(1) }),
  outputSchema: z.object({ rows: z.array(z.any()) }),
  execute: async ({ context }) => {
    const { project_id } = context as { project_id: string }
    const { data, error } = await supabaseAdmin
      .from("research_questions")
      .select("id, text, rationale, created_at, decision_question_id")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
    if (error) throw error
    return { rows: data ?? [] }
  },
})

export const analysisAgent = new Agent({
  name: "analysisAgent",
  instructions: async ({ runtimeContext }) => {
    const projectId = runtimeContext.get("project_id")
    return `You are the Analysis Agent. Your job is to help users explore and answer questions about their project data.

Available data domains: decision questions, research questions, answers, interviews, personas, and evidence.

Guidelines:
- Always ground your answers with data from tools. If you're unsure, call a tool to fetch specifics.
- Prefer using 'fetch-project-rollup' to understand overall structure, then zoom into details using list/search tools.
- Be concise. When citing details, include identifiers (ids) or counts to back up claims.
- If the user asks to "search" or "find examples", call 'search-evidence' with a clear query.
- If the user asks about trends or coverage, use the rollup's metrics.
- The current project is ${projectId}. Always operate within this project unless told otherwise.`
  },
  model: openai("gpt-4.1"),
  tools: {
    fetchProjectRollup: fetchProjectRollupTool,
    searchEvidence: searchEvidenceTool,
    listInterviews: listInterviewsTool,
    listPersonas: listPersonasTool,
    listDecisionQuestions: listDecisionQuestionsTool,
    listResearchQuestions: listResearchQuestionsTool,
  },
  memory: new Memory({
    storage: getSharedPostgresStore(),
    options: {
      workingMemory: { enabled: false },
      threads: { generateTitle: true },
    },
  }),
})
