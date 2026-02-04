/**
 * API route to save user onboarding data
 *
 * Stores job function, use case, team size, and goals in user_settings.
 * This data is used to personalize AI recommendations.
 */

import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import type { Database } from "~/types"

export interface OnboardingData {
	jobFunction: string
	primaryUseCase: string
	teamSize: string
	goals: string
	completed: boolean
}

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const formData = await request.formData()
	const onboardingDataStr = formData.get("onboardingData") as string

	if (!onboardingDataStr) {
		return Response.json({ error: "onboardingData required" }, { status: 400 })
	}

	let onboardingData: OnboardingData
	try {
		onboardingData = JSON.parse(onboardingDataStr) as OnboardingData
	} catch {
		return Response.json({ error: "Invalid onboardingData JSON" }, { status: 400 })
	}

	// Get current settings
	const { data: settings } = await supabase
		.from("user_settings")
		.select("onboarding_steps, role, metadata")
		.eq("user_id", userId)
		.single()

	const steps = (settings?.onboarding_steps as Record<string, unknown>) || {}
	const metadata = (settings?.metadata as Record<string, unknown>) || {}

	// Update onboarding steps with the new data
	const nextSteps = {
		...steps,
		walkthrough: {
			completed: onboardingData.completed,
			completed_at: new Date().toISOString(),
			job_function: onboardingData.jobFunction,
			primary_use_case: onboardingData.primaryUseCase,
			team_size: onboardingData.teamSize,
			goals: onboardingData.goals,
		},
	}

	// Also store in metadata for easy AI context access
	const nextMetadata = {
		...metadata,
		onboarding: {
			job_function: onboardingData.jobFunction,
			primary_use_case: onboardingData.primaryUseCase,
			team_size: onboardingData.teamSize,
			goals: onboardingData.goals,
		},
	}

	// Update user_settings
	const { error: updateError } = await supabase
		.from("user_settings")
		.update({
			role: onboardingData.jobFunction || settings?.role,
			onboarding_steps: nextSteps as Database["public"]["Tables"]["user_settings"]["Update"]["onboarding_steps"],
			metadata: nextMetadata as Database["public"]["Tables"]["user_settings"]["Update"]["metadata"],
		})
		.eq("user_id", userId)

	if (updateError) {
		return Response.json({ error: updateError.message }, { status: 500 })
	}

	return Response.json({ success: true })
}

/**
 * Loader to get current onboarding data
 */
export async function loader({ context }: { context: Map<symbol, unknown> }) {
	const ctx = context.get(userContext) as {
		supabase: ReturnType<typeof import("~/lib/supabase/client.server").createSupabaseServerClient>
		claims?: { sub?: string }
	}
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { data: settings } = await supabase
		.from("user_settings")
		.select("onboarding_steps, metadata")
		.eq("user_id", userId)
		.single()

	const steps = (settings?.onboarding_steps as Record<string, { walkthrough?: OnboardingData }>) || {}
	const walkthrough = steps.walkthrough

	if (!walkthrough) {
		return Response.json({ completed: false })
	}

	return Response.json({
		completed: walkthrough.completed || false,
		jobFunction: walkthrough.job_function || "",
		primaryUseCase: walkthrough.primary_use_case || "",
		teamSize: walkthrough.team_size || "",
		goals: walkthrough.goals || "",
	})
}
