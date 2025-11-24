/**
 * Mastra Integration with LiveKit Voice Agent
 *
 * This creates LiveKit-compatible tool wrappers that use existing database functions.
 * The agent has access to all project data via context passed in room name.
 */

import { llm } from "@livekit/agents"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "../../app/lib/supabase/client.server"
import { getPeople } from "../../app/features/people/db"

/**
 * Fuzzy search scoring for people
 * Matches against name, title, company, role, and segment
 */
function computePeopleSearchScore({
	person,
	normalizedSearch,
	tokens,
}: {
	person: any
	normalizedSearch: string
	tokens: string[]
}): number {
	if (!normalizedSearch) return 0

	// Build searchable text from all relevant fields
	const searchableFields = [
		person.name,
		person.title,
		person.company,
		person.role,
		person.segment,
	]
		.filter(Boolean)
		.map((s) => String(s).toLowerCase().trim())
		.join(" ")

	if (!searchableFields) return 0

	let score = 0
	let matchedTokens = 0

	// Token matching (each word in search)
	for (const token of tokens) {
		if (token && searchableFields.includes(token)) {
			matchedTokens += 1
			score += 2
		}
	}

	// Bonus for matching all tokens
	if (matchedTokens === tokens.length && tokens.length > 0) {
		score += 3
	}

	// Bonus for exact phrase match
	if (searchableFields.includes(normalizedSearch)) {
		score += 2
	}

	// Name-specific matching (highest priority)
	const name = person.name?.toLowerCase().trim()
	if (name) {
		if (name === normalizedSearch) {
			score += 10 // Exact name match
		} else if (name.startsWith(normalizedSearch)) {
			score += 5 // Name starts with search
		} else if (name.includes(normalizedSearch)) {
			score += 3 // Name contains search
		}
	}

	return score
}

/**
 * Creates LiveKit tools using existing database functions
 */
export function createMastraTools(context: { projectId: string; accountId: string; userId: string }) {
	const { projectId, accountId } = context

	return {
		// Get people/contacts in the project
		getPeople: llm.tool({
			description: 'Get list of people, contacts, and customers in the project. Use this when the user asks about who is in the project, customer information, or specific people.',
			parameters: z.object({
				query: z.string().optional().describe('Optional search query to filter people by name, title, company, or role. Supports fuzzy matching.'),
			}),
			execute: async ({ query }: { query?: string }) => {
				try {
					consola.info("getPeople: fetching from database", { projectId, accountId, query })

					// Use existing getPeople function for proper joins and relations
					const { data: people, error } = await getPeople({
						supabase: supabaseAdmin as any,
						accountId,
						projectId,
						scope: "project",
					})

					if (error) {
						consola.error("Database error fetching people", error)
						return "Sorry, I had trouble fetching the people list."
					}

					if (!people || people.length === 0) {
						return "No people found in this project yet."
					}

					// Apply fuzzy search if query provided
					let filteredPeople = people
					if (query && query.trim()) {
						const searchLower = query.toLowerCase().trim()
						const tokens = searchLower.split(/\s+/).filter(Boolean)

						// Score and filter people
						const scoredPeople = people
							.map((person) => ({
								person,
								score: computePeopleSearchScore({
									person,
									normalizedSearch: searchLower,
									tokens,
								}),
							}))
							.filter(({ score }) => score > 0) // Only keep matches
							.sort((a, b) => b.score - a.score) // Highest score first

						filteredPeople = scoredPeople.map(({ person }) => person)

						consola.info("getPeople: search results", {
							query,
							totalPeople: people.length,
							matchedPeople: filteredPeople.length,
							topMatch: filteredPeople[0]?.name,
						})
					}

					if (filteredPeople.length === 0) {
						return `No people found matching "${query}". Try a different search or ask for all people in the project.`
					}

					// Limit to top 10 results for voice response
					const topPeople = filteredPeople.slice(0, 10)

					// Format detailed response with key information
					const peopleDetails = topPeople.map((p) => {
						const parts = [p.name]
						if (p.title) parts.push(p.title)
						if (p.company) parts.push(`at ${p.company}`)
						return parts.join(", ")
					})

					const response = query
						? `Found ${filteredPeople.length} people matching "${query}": ${peopleDetails.slice(0, 5).join("; ")}${filteredPeople.length > 5 ? `, and ${filteredPeople.length - 5} others` : ""}.`
						: `There are ${topPeople.length} people in the project: ${peopleDetails.slice(0, 5).join("; ")}${people.length > 5 ? `, and ${people.length - 5} others` : ""}.`

					return response
				} catch (error) {
					consola.error("Error fetching people", error)
					return `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
				}
			},
		}),
	}
}

// Export empty tools initially - will be populated with context at runtime
export const mastraTools = {}
