/**
 * Mastra Integration with LiveKit Voice Agent
 *
 * This creates LiveKit-compatible tool wrappers that delegate to the Mastra projectStatusAgent.
 * The agent has access to all project data via runtime context.
 */

import { llm } from "@livekit/agents"
import { RuntimeContext } from "@mastra/core/di"
import consola from "consola"
import { z } from "zod"
// Import from the main app's Mastra instance
import { mastra } from "../../app/mastra"

/**
 * Creates LiveKit tools that call the Mastra projectStatusAgent
 * Each tool passes the project context via RuntimeContext
 */
export function createMastraTools(context: { projectId: string; accountId: string; userId: string }) {
	const { projectId, accountId, userId } = context

	return {
		// General project status and information queries
		getProjectStatus: llm.tool({
			description: 'Get project status, insights, themes, evidence, personas, and answer questions about the project',
			parameters: z.object({
				query: z.string().describe('The question or request about the project'),
			}),
			execute: async ({ query }: { query: string }) => {
				try {
					const agent = mastra.getAgent("projectStatusAgent")
					if (!agent) {
						throw new Error("projectStatusAgent not found")
					}

					// Create runtime context with project information
					const runtimeContext = new RuntimeContext()
					runtimeContext.set("project_id", projectId)
					runtimeContext.set("account_id", accountId)
					runtimeContext.set("user_id", userId)

					// Call the agent with the user's query
					const result = await agent.generate(
						[{ role: "user", content: query }],
						{
							resourceId: `voice-${projectId}-${Date.now()}`,
							threadId: `voice-thread-${projectId}`,
							runtimeContext,
						}
					)

					return result.text || "I couldn't process that request."
				} catch (error) {
					consola.error("Error calling Mastra projectStatusAgent", error)
					return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			},
		}),

		// People and contact management
		getPeopleDetails: llm.tool({
			description: 'Get detailed information about people, contacts, or customers in the project',
			parameters: z.object({
				query: z.string().describe('Search for people by name or ask about specific contacts'),
			}),
			execute: async ({ query }: { query: string }) => {
				try {
					const agent = mastra.getAgent("projectStatusAgent")
					if (!agent) {
						throw new Error("projectStatusAgent not found")
					}

					const runtimeContext = new RuntimeContext()
					runtimeContext.set("project_id", projectId)
					runtimeContext.set("account_id", accountId)
					runtimeContext.set("user_id", userId)

					const result = await agent.generate(
						[{ role: "user", content: `Get people details: ${query}` }],
						{
							resourceId: `voice-people-${projectId}-${Date.now()}`,
							threadId: `voice-thread-${projectId}`,
							runtimeContext,
						}
					)

					return result.text || "I couldn't find that information."
				} catch (error) {
					consola.error("Error fetching people details", error)
					return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			},
		}),

		// Opportunity and sales management
		manageOpportunities: llm.tool({
			description: 'Get, create, or update sales opportunities, deals, and pipeline information',
			parameters: z.object({
				action: z.string().describe('What to do with opportunities (e.g., "list opportunities", "create new deal", "update opportunity stage")'),
			}),
			execute: async ({ action }: { action: string }) => {
				try {
					const agent = mastra.getAgent("projectStatusAgent")
					if (!agent) {
						throw new Error("projectStatusAgent not found")
					}

					const runtimeContext = new RuntimeContext()
					runtimeContext.set("project_id", projectId)
					runtimeContext.set("account_id", accountId)
					runtimeContext.set("user_id", userId)

					const result = await agent.generate(
						[{ role: "user", content: action }],
						{
							resourceId: `voice-opps-${projectId}-${Date.now()}`,
							threadId: `voice-thread-${projectId}`,
							runtimeContext,
						}
					)

					return result.text || "I couldn't complete that action."
				} catch (error) {
					consola.error("Error managing opportunities", error)
					return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			},
		}),

		// Task management
		manageTasks: llm.tool({
			description: 'Create, update, or fetch tasks and roadmap items',
			parameters: z.object({
				action: z.string().describe('What to do with tasks (e.g., "list tasks", "create task", "mark task as done")'),
			}),
			execute: async ({ action }: { action: string }) => {
				try {
					const agent = mastra.getAgent("projectStatusAgent")
					if (!agent) {
						throw new Error("projectStatusAgent not found")
					}

					const runtimeContext = new RuntimeContext()
					runtimeContext.set("project_id", projectId)
					runtimeContext.set("account_id", accountId)
					runtimeContext.set("user_id", userId)

					const result = await agent.generate(
						[{ role: "user", content: action }],
						{
							resourceId: `voice-tasks-${projectId}-${Date.now()}`,
							threadId: `voice-thread-${projectId}`,
							runtimeContext,
						}
					)

					return result.text || "I couldn't complete that action."
				} catch (error) {
					consola.error("Error managing tasks", error)
					return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			},
		}),
	}
}

// Export empty tools initially - will be populated with context at runtime
export const mastraTools = {}
