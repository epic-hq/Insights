import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database, InterviewWithPeople } from "~/types"

export const getInterviews = async ({
	supabase,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	accountId?: string
	projectId: string
}): Promise<{ data: InterviewWithPeople[] | null; error: any }> => {
	// First get interviews
	const { data: interviews, error } = await supabase
		.from("interviews")
		.select(`
			title,
			id,
			interview_date,
			participant_pseudonym,
			segment,
			duration_sec,
			high_impact_themes,
			observations_and_notes,
			open_questions_and_next_steps,
			conversation_analysis,
			status,
			media_url,
			media_type,
			source_type,
			file_extension,
			created_at,
			updated_at,
			interview_people (
				role,
				people (
					id,
					name,
					segment,
					people_personas (
						persona_id,
						personas (
							id,
							name,
							color_hex
						)
					)
				)
			)
		`)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })

	if (error || !interviews) {
		return { data: null, error }
	}

	// Get evidence counts for all interviews in one query
	const { data: evidenceCounts } = await supabase
		.from("evidence")
		.select("interview_id")
		.eq("project_id", projectId)
		.in(
			"interview_id",
			interviews.map((i) => i.id)
		)

	// Build a map of interview_id -> evidence count
	const evidenceCountMap = new Map<string, number>()
	if (evidenceCounts) {
		evidenceCounts.forEach((e) => {
			if (e.interview_id) {
				evidenceCountMap.set(e.interview_id, (evidenceCountMap.get(e.interview_id) || 0) + 1)
			}
		})
	}

	// Attach evidence counts to interviews
	const interviewsWithCounts = interviews.map((interview) => ({
		...interview,
		evidence_count: evidenceCountMap.get(interview.id) || 0,
	}))

	return { data: interviewsWithCounts as any, error: null }
}

export const getInterviewById = async ({
	supabase,
	accountId,
	projectId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId?: string
	projectId: string
	id: string
}) => {
	// Fetch interview without nested relations (participants fetched separately)
	consola.log("getInterviewById", projectId, id)
	const { data, error } = await supabase
		.from("interviews")
		.select(`
			title,
			id,
			interview_date,
			participant_pseudonym,
			segment,
			duration_sec,
			high_impact_themes,
			observations_and_notes,
			open_questions_and_next_steps,
			status,
			media_url,
			media_type,
			source_type,
			file_extension,
			created_at,
			created_by,
			updated_at
		`)
		.eq("project_id", projectId)
		.eq("id", id)
		.single()

	if (error) {
		consola.error("getInterviewById: failed to load interview", { id, error })
		return { data: null, error }
	}

	if (!data) {
		return { data: null, error: { message: "Interview not found", code: "PGRST116" } }
	}

	return { data, error: null }
}

export const getInterviewParticipants = async ({
	supabase,
	projectId,
	interviewId,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
	interviewId: string
}) => {
	// Fetch participant data separately to avoid junction table query issues
	return await supabase
		.from("interview_people")
		.select(`
			role,
			id,
			transcript_key,
			display_name,
			people(
				project_id,
				id,
				name,
				segment,
				description,
				contact_info,
				people_personas (
					persona_id,
					personas (
						id,
						name,
						color_hex
					)
				)
			)
		`)
		.eq("project_id", projectId)
		.eq("interview_id", interviewId)
}

export const getInterviewInsights = async ({
	supabase,
	interviewId,
}: {
	supabase: SupabaseClient<Database>
	interviewId: string
}) => {
	// Fetch themes related to this interview via theme_evidence junction and evidence table
	// Note: Themes are now project-level entities, not directly linked to interviews
	const { data, error } = await supabase
		.from("theme_evidence")
		.select(`
			theme_id,
			themes (
				id,
				name,
				statement,
				inclusion_criteria,
				exclusion_criteria,
				project_id,
				updated_at
			),
			evidence!inner (
				interview_id
			)
		`)
		.eq("evidence.interview_id", interviewId)

	if (error) {
		return { data: null, error }
	}

	// Deduplicate themes (same theme can be linked to multiple evidence items)
	const themeMap = new Map()
	data?.forEach((row: any) => {
		if (row.themes && !themeMap.has(row.themes.id)) {
			themeMap.set(row.themes.id, {
				id: row.themes.id,
				name: row.themes.name,
				statement: row.themes.statement,
				inclusion_criteria: row.themes.inclusion_criteria,
				exclusion_criteria: row.themes.exclusion_criteria,
				project_id: row.themes.project_id,
				updated_at: row.themes.updated_at,
				category: null, // Removed in new schema, keeping for backwards compatibility
				insight_tags: [], // No tags support in new schema yet
			})
		}
	})

	const enriched = Array.from(themeMap.values())

	return { data: enriched, error: null }
}

const _getRelatedInterviews = async ({
	supabase,
	accountId,
	projectId,
	excludeId,
	limit = 5,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	excludeId: string
	limit?: number
}) => {
	// Get related interviews from the same project
	return await supabase
		.from("interviews")
		.select(`
			title,
			id,
			interview_date,
			participant_pseudonym,
			segment,
			duration_sec,
			high_impact_themes,
			observations_and_notes,
			open_questions_and_next_steps,
			status,
			media_url,
			media_type,
			source_type,
			file_extension,
			created_at,
			updated_at,
			interview_people (
				role,
				people (
					id,
					name,
					segment,
					people_personas (
						persona_id,
						personas (
							id,
							name,
							color_hex
						)
					)
				)
			)
		`)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.neq("id", excludeId)
		.limit(limit)
}

export const createInterview = async ({
	supabase,
	data,
}: {
	supabase: SupabaseClient<Database>
	data: Database["public"]["Tables"]["interviews"]["Insert"]
}) => {
	return await supabase.from("interviews").insert(data).select().single()
}

export const updateInterview = async ({
	supabase,
	id,
	accountId,
	projectId,
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	projectId: string
	data: Database["public"]["Tables"]["interviews"]["Update"]
}) => {
	return await supabase.from("interviews").update(data).eq("id", id).eq("project_id", projectId).select().single()
}

export const deleteInterview = async ({
	supabase,
	id,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	projectId: string
}) => {
	return await supabase.from("interviews").delete().eq("id", id).eq("project_id", projectId)
}
