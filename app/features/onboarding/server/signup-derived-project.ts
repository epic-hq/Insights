import slugify from "@sindresorhus/slugify"
import type { SupabaseClient } from "@supabase/supabase-js"
import { b } from "baml_client"

type SignupData = {
	name?: string
	problem?: string
	need_to_learn?: string
	challenges?: string
	content_types?: string
	other_feedback?: string
}

export async function getSignupData({
	supabase,
	userId,
}: {
	supabase: SupabaseClient
	userId: string
}): Promise<SignupData | null> {
	const { data } = await supabase.from("user_settings").select("signup_data").eq("user_id", userId).maybeSingle()
	return (data?.signup_data as SignupData) || null
}

export async function deriveProjectNameDescription({
	supabase,
	userId,
}: {
	supabase: SupabaseClient
	userId: string
}): Promise<{ name: string; description: string; slug: string }> {
	const signup = (await getSignupData({ supabase, userId })) || {}

	// Deterministic fallback
	const baseName = (signup.need_to_learn?.trim() || signup.problem?.trim() || "Customer Research Project").replace(
		/\s+/g,
		" "
	)

	let name = baseName.length > 40 ? `${baseName.slice(0, 37)}...` : baseName
	let description = buildDeterministicDescription(signup)

	// Try BAML if available
	try {
		// @ts-expect-error b may not have the function if not generated yet
		if (b?.GenerateProjectNameDescription) {
			const out = await b.GenerateProjectNameDescription({
				inputs: { signup_data: JSON.stringify(signup) },
			})
			if (out?.name && typeof out.name === "string") name = out.name.trim()
			if (out?.description && typeof out.description === "string") description = out.description.trim()
		}
	} catch {}

	const slug = slugify(name || "project")
	return { name: name || "Customer Research Project", description, slug }
}

function buildDeterministicDescription(signup: SignupData): string {
	const need = (signup.need_to_learn || signup.problem || "Understand customer needs").trim()
	const audience = "for our target users"
	const channels = (signup.content_types || "recordings and notes").trim()
	const sentence1 = `${capitalize(need)} ${audience}.`
	const sentence2 = `Focus on ${channels}.`
	return `${sentence1} ${sentence2}`
}

function capitalize(s: string): string {
	if (!s) return s
	return s.charAt(0).toUpperCase() + s.slice(1)
}
