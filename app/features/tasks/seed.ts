/**
 * Task Seeding Script
 * Migrates mock feature data into the tasks table
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { TaskInsert } from "./types"

interface MockFeature {
	id: string
	feature: string
	benefit: string
	segments: string
	impact: number
	stage: "activation" | "onboarding" | "retention"
	priority: 1 | 2 | 3
	reason: string
	cluster: string
}

const MOCK_FEATURES: MockFeature[] = [
	{
		id: "stt",
		feature: "STT input until release or VAD",
		benefit: "Capture calls reliably without friction",
		segments: "Founders, sales reps, research leads",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Core to product promise; blocker to aha moment.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "call-workflow",
		feature: "Call workflow (contact options, survey link, meeting applet)",
		benefit: "Structure before/after call steps and follow-through",
		segments: "Sales reps, CS, founders",
		impact: 3,
		stage: "activation",
		priority: 2,
		reason: "Ties captured calls to outcomes; shows 'close the loop'.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "import-contacts",
		feature: "Import accounts & contacts list",
		benefit: "Fast setup using existing CRM data",
		segments: "New teams, admins, ops",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "Lowers setup pain; key to first project populated.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "task-list",
		feature: "Task list",
		benefit: "Turn insights into clear next steps",
		segments: "Founders, sales reps, CS",
		impact: 2,
		stage: "retention",
		priority: 2,
		reason: "Connects insights to action; can be simple v1.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "email-to-annotation",
		feature: "Email responses to meetings → annotation",
		benefit: "Automatic debrief + saved notes after calls",
		segments: "Sales reps, founders",
		impact: 2,
		stage: "activation",
		priority: 2,
		reason: "Strong wow moment right after calls; reinforces core value.",
		cluster: "Core product – capture & workflow",
	},
	{
		id: "voice-assistant",
		feature: "Voice chat assistant",
		benefit: "In-app conversational help and hands-free control",
		segments: "Power users, busy founders, sales reps",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Nice-to-have; improves depth, not initial value.",
		cluster: "Core product – intelligence",
	},
	{
		id: "docs-generator",
		feature: "Sales/marketing doc generator + folder system",
		benefit: "Reusable decks/emails and clearer library of outputs",
		segments: "Marketing, sales, founders",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Deeper value layer; build after core workflow is stable.",
		cluster: "Core product – intelligence",
	},
	{
		id: "persona-creation",
		feature: "Persona creation",
		benefit: "Clarify who you're learning from and targeting",
		segments: "Product, marketing, founders",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Strategic but not required for first wins.",
		cluster: "Core product – intelligence",
	},
	{
		id: "objection-handling",
		feature: "Sales objection handling",
		benefit: "Guided responses and playbook for common objections",
		segments: "Sales reps, founders doing sales",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Sales enablement layer; good once core adoption exists.",
		cluster: "Core product – intelligence",
	},
	{
		id: "icp-finder",
		feature: "ICP finder feature (bullseye customer)",
		benefit: "Help users focus on best-fit customers/accounts",
		segments: "Founders, Rev leaders, PMs",
		impact: 3,
		stage: "retention",
		priority: 2,
		reason: "Big differentiator; builds on existing data.",
		cluster: "Core product – intelligence",
	},
	{
		id: "oauth",
		feature: "OAuth login reliability",
		benefit: "Trustworthy, glitch-free sign-in",
		segments: "Everyone",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "Table-stakes; breaks everything if flaky.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "app-flow",
		feature: "App flow UX redesign / UI",
		benefit: "Make main journeys obvious and low-friction",
		segments: "All users, especially new signups",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Directly impacts aha moment and day-1 success.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "branding",
		feature: "Branding",
		benefit: "Credibility, memorability, and trust",
		segments: "Prospects, new users, investors",
		impact: 2,
		stage: "onboarding",
		priority: 2,
		reason: "Matters for trust; can iterate while fixing flows.",
		cluster: "Foundation – reliability & UX",
	},
	{
		id: "pricing",
		feature: "Pricing on credit system + take credit card",
		benefit: "Turn value into revenue and gate usage sanely",
		segments: "Paying customers, founder/finance",
		impact: 3,
		stage: "activation",
		priority: 1,
		reason: "Needed to charge, test WTP, and control usage.",
		cluster: "Monetization & pricing",
	},
	{
		id: "email-nudges",
		feature: "Email nudges + PostHog instrumentation",
		benefit: "Drive usage and learn what works",
		segments: "Admins, product team, active users",
		impact: 2,
		stage: "retention",
		priority: 2,
		reason: "Needed to keep users coming back and inform roadmap.",
		cluster: "Engagement & analytics",
	},
	{
		id: "webpage-messaging",
		feature: "Webpage messaging and CTA to try app",
		benefit: "Clear promise and path to start a trial",
		segments: "Prospects evaluating tools",
		impact: 3,
		stage: "onboarding",
		priority: 1,
		reason: "You can't test demand or learn without this.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "leadgen-content",
		feature: "Lead generation content and newsletter",
		benefit: "Attract and educate right-fit prospects",
		segments: "Founders, PMs, sales leaders",
		impact: 2,
		stage: "onboarding",
		priority: 2,
		reason: "Fuels top/mid funnel once core app experience is solid.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "paid-ads",
		feature: "Paid ads",
		benefit: "Scalable acquisition once funnel works",
		segments: "Growth/marketing, founders",
		impact: 2,
		stage: "onboarding",
		priority: 3,
		reason: "Dangerous before positioning + activation are dialed in.",
		cluster: "Acquisition & marketing",
	},
	{
		id: "deal-rooms",
		feature: "Deal rooms / Proposal builders",
		benefit: "Close deals faster with mutual action plan",
		segments: "Sales reps, AEs",
		impact: 2,
		stage: "retention",
		priority: 3,
		reason: "Helpful but not core; can use templates for now.",
		cluster: "Core product – capture & workflow",
	},
]

/**
 * Seed tasks for a specific project
 */
export async function seedTasks({
	supabase,
	accountId,
	projectId,
	userId,
}: {
	supabase: SupabaseClient
	accountId: string
	projectId: string
	userId: string
}): Promise<{ success: boolean; count: number; error?: string }> {
	try {
		consola.info("Starting task seeding...", { accountId, projectId })

		// Check if tasks already exist for this project AND account
		const { data: existing, error: checkError } = await supabase
			.from("tasks")
			.select("id")
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.limit(1)

		if (checkError) {
			consola.error("Error checking for existing tasks:", checkError)
			return { success: false, count: 0, error: checkError.message }
		}

		if (existing && existing.length > 0) {
			consola.info("Tasks already exist for this project, skipping seed")
			return { success: true, count: 0, error: "Tasks already exist" }
		}

		// Transform mock features into task inserts
		const tasksToInsert = MOCK_FEATURES.map((feature) => ({
			title: feature.feature,
			description: `${feature.benefit}\n\nTarget: ${feature.segments}\n\nReason: ${feature.reason}`,
			cluster: feature.cluster,
			status: feature.priority === 1 ? "todo" : "backlog",
			priority: feature.priority,
			impact: feature.impact,
			stage: feature.stage,
			benefit: feature.benefit,
			segments: feature.segments,
			reason: feature.reason,
			assigned_to: [],
			tags: [],
			depends_on_task_ids: [],
			blocks_task_ids: [],
			account_id: accountId,
			project_id: projectId,
			created_by: userId,
		}))

		// Insert all tasks
		const { data, error: insertError } = await supabase.from("tasks").insert(tasksToInsert).select()

		if (insertError) {
			consola.error("Error inserting tasks:", insertError)
			return { success: false, count: 0, error: insertError.message }
		}

		consola.success(`Successfully seeded ${data?.length || 0} tasks`)
		return { success: true, count: data?.length || 0 }
	} catch (error) {
		consola.error("Unexpected error during task seeding:", error)
		return { success: false, count: 0, error: String(error) }
	}
}

/**
 * Clear all tasks for a project (useful for re-seeding during development)
 */
export async function clearTasks({
	supabase,
	projectId,
}: {
	supabase: SupabaseClient
	projectId: string
}): Promise<{ success: boolean; error?: string }> {
	try {
		const { error } = await supabase.from("tasks").delete().eq("project_id", projectId)

		if (error) {
			consola.error("Error clearing tasks:", error)
			return { success: false, error: error.message }
		}

		consola.success("Successfully cleared tasks")
		return { success: true }
	} catch (error) {
		consola.error("Unexpected error clearing tasks:", error)
		return { success: false, error: String(error) }
	}
}
