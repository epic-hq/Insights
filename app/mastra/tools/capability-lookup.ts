import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

const CAPABILITIES = [
	{
		name: "documents",
		description:
			"Create, update, read, and list project documents via manage-documents (positioning, competitive_analysis, meeting notes, etc.).",
		examples: ["competitive_analysis", "positioning_statement", "meeting_notes"],
	},
	{
		name: "evidence",
		description:
			"Search internal evidence, themes, and pain matrices; fetch interview context and lenses to cite quotes and sources.",
		examples: ["semanticSearchEvidence", "fetchInterviewContext", "fetchConversationLenses"],
	},
	{
		name: "people & orgs",
		description: "Look up and update people, personas, organizations, and opportunities; import from tables when needed.",
		examples: ["fetchPeopleDetails", "importPeopleFromTable", "managePersonOrganizations"],
	},
	{
		name: "tasks",
		description: "Create, update, and list tasks for follow-ups and execution tracking.",
		examples: ["createTask", "updateTask", "fetchTasks"],
	},
	{
		name: "web content",
		description: "Fetch content from URLs or run targeted web research when internal data is empty or user requests it explicitly.",
		examples: ["fetchWebContent", "webResearch", "importVideoFromUrl"],
	},
]

const GUARDRAILS = [
	"Do not claim a document is saved unless manage-documents returns success and the follow-up read confirms it exists.",
	"Prefer internal evidence search before web research; only use web research if requested or nothing is found internally.",
	"Keep responses concise and in plain language; avoid filler and overpromising.",
	"Cite sources (people/interviews/evidence) when making claims.",
]

export const capabilityLookupTool = createTool({
	id: "capability-lookup",
	description: "Return a concise list of this agent's capabilities and guardrails. Use when the user asks 'what can you do' or when clarifying scope.",
	inputSchema: z.object({
		query: z.string().optional().describe("Optional filter string to narrow the capability list."),
	}),
	outputSchema: z.object({
		capabilities: z.array(
			z.object({
				name: z.string(),
				description: z.string(),
				examples: z.array(z.string()),
			})
		),
		guardrails: z.array(z.string()),
	}),
	execute: async ({ context }) => {
		const { query } = context
		const normalized = query?.toLowerCase().trim()
		const capabilities = CAPABILITIES.filter((cap) =>
			!normalized ? true : cap.name.toLowerCase().includes(normalized) || cap.description.toLowerCase().includes(normalized)
		)

		consola.debug("capability-lookup", { query, resultCount: capabilities.length })

		return { capabilities, guardrails: GUARDRAILS }
	},
})
