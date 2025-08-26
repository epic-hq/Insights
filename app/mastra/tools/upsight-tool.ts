import { createTool } from "@mastra/core/tools"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { getInsights } from "~/features/insights/db"
import { getInterviews } from "~/features/interviews/db"
import { getOpportunities } from "~/features/opportunities/db"
import { getPeople } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { getProjectById, getProjects } from "~/features/projects/db"
import type { Database, Insight, Interview, Opportunity, Person, Persona } from "~/types"

// Project search and analysis tool for Upsight
export const upsightTool = createTool({
	id: "upsight_search",
	description:
		"Search and analyze project data including insights, interviews, opportunities, people, and personas. Provides comprehensive project status information including key findings and next steps.",
	inputSchema: z.object({
		accountId: z
			.string()
			.optional()
			.describe("The account ID to search within (will use runtime context if not provided)"),
		projectId: z.string().optional().describe("Specific project ID to analyze (optional)"),
		searchQuery: z.string().optional().describe("Text to search for across project data"),
		includeInsights: z.boolean().default(true).describe("Include insights in the search"),
		includeInterviews: z.boolean().default(true).describe("Include interviews in the search"),
		includeOpportunities: z.boolean().default(true).describe("Include opportunities in the search"),
		includePeople: z.boolean().default(true).describe("Include people in the search"),
		includePersonas: z.boolean().default(true).describe("Include personas in the search"),
		limit: z.number().default(50).describe("Maximum number of results per category"),
	}),
	outputSchema: z.object({
		projects: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				description: z.string().nullable(),
				status: z.string().nullable(),
				created_at: z.string(),
				updated_at: z.string(),
			})
		),
		insights: z.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				details: z.string().nullable(),
				category: z.string().nullable(),
				impact: z.number().nullable(),
				pain: z.string().nullable(),
				desired_outcome: z.string().nullable(),
			})
		),
		interviews: z.array(
			z.object({
				id: z.string(),
				title: z.string().nullable(),
				interview_date: z.string().nullable(),
				status: z.string().nullable(),
			})
		),
		opportunities: z.array(
			z.object({
				id: z.string(),
				title: z.string().nullable(),
				description: z.string().nullable(),
				status: z.string().nullable(),
				impact: z.string().nullable(),
			})
		),
		people: z.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				segment: z.string().nullable(),
				role: z.string().nullable(),
			})
		),
		personas: z.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				description: z.string().nullable(),
				percentage: z.number().nullable(),
			})
		),
		projectStatus: z.object({
			keyFindings: z.array(z.string()),
			nextSteps: z.array(z.string()),
			totalInsights: z.number(),
			totalInterviews: z.number(),
			totalOpportunities: z.number(),
			totalPeople: z.number(),
			totalPersonas: z.number(),
			lastUpdated: z.string(),
		}),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			consola.log("Upsight tool executing with context:", context)
			consola.log("Runtime context:", runtimeContext)

			// Get accountId and projectId from runtime context or input
			const runtimeAccountId = runtimeContext?.get("account_id") || runtimeContext?.get("accountId")
			const runtimeProjectId = runtimeContext?.get("project_id") || runtimeContext?.get("projectId")
			const runtimeUserId = runtimeContext?.get("user_id") || runtimeContext?.get("userId")

			// Use runtime context values if available, otherwise fall back to input parameters
			const finalAccountId = runtimeAccountId || context.accountId
			const finalProjectId = runtimeProjectId || context.projectId

			consola.log("Using accountId:", finalAccountId, "projectId:", finalProjectId, "userId:", runtimeUserId)

			if (!finalAccountId) {
				throw new Error("accountId is required - must be provided either in context or runtime headers")
			}

			// Create service role Supabase client (doesn't need cookies/sessions)
			const supabaseUrl = process.env.SUPABASE_URL
			const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

			if (!supabaseUrl || !supabaseServiceKey) {
				throw new Error("Supabase configuration missing - need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
			}

			// Create service role client
			const supabase: SupabaseClient<Database> = createClient(supabaseUrl, supabaseServiceKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			})

			const {
				searchQuery,
				includeInsights,
				includeInterviews,
				includeOpportunities,
				includePeople,
				includePersonas,
				limit,
			} = context

			// Initialize result arrays
			let projects: any[] = []
			const insights: Array<Insight> = []
			const interviews: Array<Interview> = []
			const opportunities: Array<Opportunity> = []
			const people: Array<Person> = []
			const personas: Array<Persona> = []

			// Get projects data
			if (finalProjectId) {
				// Get specific project
				const { data: projectData, error: projectError } = await getProjectById({ supabase, id: finalProjectId })
				if (projectData && !projectError) {
					projects = [projectData]
				}
			} else {
				// Get all projects for account
				const { data: projectsData, error: projectsError } = await getProjects({ supabase, accountId: finalAccountId })
				if (projectsData && !projectsError) {
					projects = projectsData.slice(0, limit)
				}
			}

			// For each project, get detailed data
			for (const project of projects) {
				const currentProjectId = project.id

				// Get insights
				if (includeInsights) {
					try {
						const { data: insightsData, error: insightsError } = await getInsights({
							supabase,
							accountId: finalAccountId,
							projectId: currentProjectId,
						})
						if (insightsData && !insightsError) {
							let filteredInsights = insightsData

							// Apply search filter if provided
							if (searchQuery) {
								filteredInsights = insightsData.filter(
									(insight) =>
										insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										insight.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										insight.pain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										insight.desired_outcome?.toLowerCase().includes(searchQuery.toLowerCase())
								)
							}

							insights.push(...filteredInsights.slice(0, limit))
						}
					} catch (error) {
						consola.warn("Error fetching insights:", error)
					}
				}

				// Get interviews
				if (includeInterviews) {
					try {
						const { data: interviewsData, error: interviewsError } = await getInterviews({
							supabase,
							accountId: finalAccountId,
							projectId: currentProjectId,
						})
						if (interviewsData && !interviewsError) {
							let filteredInterviews = interviewsData

							// Apply search filter if provided
							if (searchQuery) {
								filteredInterviews = interviewsData.filter((interview) =>
									interview.title?.toLowerCase().includes(searchQuery.toLowerCase())
								)
							}

							interviews.push(...filteredInterviews.slice(0, limit))
						}
					} catch (error) {
						consola.warn("Error fetching interviews:", error)
					}
				}

				// Get opportunities
				if (includeOpportunities) {
					try {
						const { data: opportunitiesData, error: opportunitiesError } = await getOpportunities({
							supabase,
							accountId: finalAccountId,
							projectId: currentProjectId,
						})
						if (opportunitiesData && !opportunitiesError) {
							let filteredOpportunities = opportunitiesData

							// Apply search filter if provided
							if (searchQuery) {
								filteredOpportunities = opportunitiesData.filter(
									(opportunity) =>
										opportunity.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										opportunity.description?.toLowerCase().includes(searchQuery.toLowerCase())
								)
							}

							opportunities.push(...filteredOpportunities.slice(0, limit))
						}
					} catch (error) {
						consola.warn("Error fetching opportunities:", error)
					}
				}

				// Get people
				if (includePeople) {
					try {
						const { data: peopleData, error: peopleError } = await getPeople({
							supabase,
							accountId: finalAccountId,
							projectId: currentProjectId,
						})
						if (peopleData && !peopleError) {
							let filteredPeople = peopleData

							// Apply search filter if provided
							if (searchQuery) {
								filteredPeople = peopleData.filter(
									(person) =>
										person.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										person.segment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										person.role?.toLowerCase().includes(searchQuery.toLowerCase())
								)
							}

							people.push(...filteredPeople.slice(0, limit))
						}
					} catch (error) {
						consola.warn("Error fetching people:", error)
					}
				}

				// Get personas
				if (includePersonas) {
					try {
						const { data: personasData, error: personasError } = await getPersonas({
							supabase,
							accountId: finalAccountId,
						})
						if (personasData && !personasError) {
							let filteredPersonas = personasData

							// Apply search filter if provided
							if (searchQuery) {
								filteredPersonas = personasData.filter(
									(persona) =>
										persona.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
										persona.description?.toLowerCase().includes(searchQuery.toLowerCase())
								)
							}

							personas.push(...filteredPersonas.slice(0, limit))
						}
					} catch (error) {
						consola.warn("Error fetching personas:", error)
					}
				}
			}

			// Generate project status and key findings
			const keyFindings = generateKeyFindings(insights, interviews, opportunities)
			const nextSteps = generateNextSteps(insights, opportunities, interviews)

			const projectStatus = {
				keyFindings,
				nextSteps,
				totalInsights: insights.length,
				totalInterviews: interviews.length,
				totalOpportunities: opportunities.length,
				totalPeople: people.length,
				totalPersonas: personas.length,
				lastUpdated: new Date().toISOString(),
			}

			return {
				projects: projects.map((p) => ({
					id: p.id,
					name: p.name || "Untitled Project",
					description: p.description,
					status: p.status,
					created_at: p.created_at,
					updated_at: p.updated_at,
				})),
				insights: insights.map((i) => ({
					id: i.id,
					name: i.name,
					details: i.details,
					category: i.category,
					impact: i.impact,
					pain: i.pain,
					desired_outcome: i.desired_outcome,
				})),
				interviews: interviews.map((i) => ({
					id: i.id,
					title: i.title,
					interview_date: i.interview_date,
					status: i.status,
				})),
				opportunities: opportunities.map((o) => ({
					id: o.id,
					title: o.title,
					description: o.description,
					status: o.status,
					impact: o.impact,
				})),
				people: people.map((p) => ({
					id: p.id,
					name: p.name,
					segment: p.segment,
					role: p.role,
				})),
				personas: personas.map((p) => ({
					id: p.id,
					name: p.name,
					description: p.description,
					percentage: p.percentage,
				})),
				projectStatus,
			}
		} catch (error) {
			consola.error("Error in upsight tool:", error)
			throw new Error(`Failed to search project data: ${error}`)
		}
	},
})

// Helper function to generate key findings from data
function generateKeyFindings(insights: any[], interviews: any[], opportunities: any[]): string[] {
	const findings: string[] = []

	// Analyze insights for patterns
	if (insights.length > 0) {
		const highImpactInsights = insights.filter((i) => i.impact && i.impact >= 8)
		if (highImpactInsights.length > 0) {
			findings.push(`${highImpactInsights.length} high-impact insights identified (impact score ≥ 8)`)
		}

		const categories = insights.map((i) => i.category).filter(Boolean)
		const categoryCount = categories.reduce(
			(acc, cat) => {
				acc[cat] = (acc[cat] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		const topCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0]
		if (topCategory) {
			findings.push(`Most common insight category: ${topCategory[0]} (${topCategory[1]} insights)`)
		}
	}

	// Analyze interview patterns
	if (interviews.length > 0) {
		findings.push(`${interviews.length} interviews conducted`)

		const recentInterviews = interviews.filter((i) => {
			if (!i.interview_date) return false
			const interviewDate = new Date(i.interview_date)
			const thirtyDaysAgo = new Date()
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
			return interviewDate > thirtyDaysAgo
		})

		if (recentInterviews.length > 0) {
			findings.push(`${recentInterviews.length} interviews conducted in the last 30 days`)
		}
	}

	// Analyze opportunities
	if (opportunities.length > 0) {
		findings.push(`${opportunities.length} opportunities identified`)

		const highImpactOpportunities = opportunities.filter((o) => o.impact === "high")
		if (highImpactOpportunities.length > 0) {
			findings.push(`${highImpactOpportunities.length} high-impact opportunities available`)
		}
	}

	return findings
}

// Helper function to generate next steps
function generateNextSteps(insights: any[], opportunities: any[], interviews: any[]): string[] {
	const steps: string[] = []

	// Suggest actions based on data patterns
	if (insights.length === 0 && interviews.length > 0) {
		steps.push("Process existing interviews to extract insights")
	}

	if (opportunities.length === 0 && insights.length > 0) {
		steps.push("Review insights to identify potential opportunities")
	}

	const highImpactInsights = insights.filter((i) => i.impact && i.impact >= 8)
	if (highImpactInsights.length > 0) {
		steps.push(`Prioritize action on ${highImpactInsights.length} high-impact insights`)
	}

	const recentInterviews = interviews.filter((i) => {
		if (!i.interview_date) return false
		const interviewDate = new Date(i.interview_date)
		const sevenDaysAgo = new Date()
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
		return interviewDate > sevenDaysAgo
	})

	if (recentInterviews.length === 0 && interviews.length < 5) {
		steps.push("Schedule additional user interviews to gather more insights")
	}

	const pendingOpportunities = opportunities.filter((o) => o.status === "pending" || o.status === "open")
	if (pendingOpportunities.length > 0) {
		steps.push(`Review and prioritize ${pendingOpportunities.length} pending opportunities`)
	}

	// Default steps if no specific patterns found
	if (steps.length === 0) {
		steps.push("Continue gathering user feedback through interviews")
		steps.push("Analyze existing data for actionable insights")
		steps.push("Identify and prioritize improvement opportunities")
	}

	return steps
}
