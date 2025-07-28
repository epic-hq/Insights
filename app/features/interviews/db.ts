import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types"

export const getInterviews = async ({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
}) => {
	return await supabase
		.from("interviews")
		.select(`
			*,
			interview_people (
				role,
				people (
					id,
					name,
					segment
				)
			)
		`)
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
}

export const getInterviewById = async ({
	supabase,
	accountId,
	id,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	id: string
}) => {
	// Fetch interview with related participants and insights (including tags)
	return await supabase
		.from("interviews")
		.select(`
			*,
			interview_people (
				role,
				people (
					id,
					name,
					segment
				)
			),
			insights (
				*,
				insight_tags (
					tags (
						tag
					)
				)
			)
		`)
		.eq("id", id)
		.eq("account_id", accountId)
		.single()
}

export const getInterviewParticipants = async ({
	supabase,
	interviewId,
}: {
	supabase: SupabaseClient<Database>
	interviewId: string
}) => {
	// Fetch participant data separately to avoid junction table query issues
	return await supabase
		.from("interview_people")
		.select(`
			role,
			people(
				id,
				name,
				segment,
				description,
				contact_info,
				persona
			)
		`)
		.eq("interview_id", interviewId)
}

export const getInterviewInsights = async ({
	supabase,
	interviewId,
}: {
	supabase: SupabaseClient<Database>
	interviewId: string
}) => {
	// Fetch insights related to this interview with junction table tags
	return await supabase
		.from("insights")
		.select(`
			*,
			insight_tags (
				tags (
					tag
				)
			)
		`)
		.eq("interview_id", interviewId)
}

export const getRelatedInterviews = async ({
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
		.select("*")
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
	data,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
	data: Database["public"]["Tables"]["interviews"]["Update"]
}) => {
	return await supabase
		.from("interviews")
		.update(data)
		.eq("id", id)
		.eq("account_id", accountId)
		.select()
		.single()
}

export const deleteInterview = async ({
	supabase,
	id,
	accountId,
}: {
	supabase: SupabaseClient<Database>
	id: string
	accountId: string
}) => {
	return await supabase
		.from("interviews")
		.delete()
		.eq("id", id)
		.eq("account_id", accountId)
}
