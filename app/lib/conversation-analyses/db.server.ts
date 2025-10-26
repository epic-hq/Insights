import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { Database } from "~/types"
import { conversationAnalysisRecordSchema } from "./schema"

const updatePayloadSchema = z.object({
	transcript: z.string().nullable().optional(),
	summary: z.string().nullable().optional(),
	detected_questions: z.any().nullable().optional(),
	participant_goals: z.any().nullable().optional(),
	key_takeaways: z.any().nullable().optional(),
	open_questions: z.any().nullable().optional(),
	recommendations: z.any().nullable().optional(),
	duration_seconds: z.number().nullable().optional(),
	status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
	error_message: z.string().nullable().optional(),
})

/**
 * Inserts a new conversation analysis shell so we have an ID to track processing status.
 */
export async function insertConversationAnalysis({
	db,
	id,
	accountId,
	createdBy,
	recordingUrl,
	status = "pending",
}: {
	db: SupabaseClient<Database>
	id: string
	accountId: string
	createdBy: string | null
	recordingUrl: string
	status?: "pending" | "processing" | "completed" | "failed"
}) {
	const { data, error } = await db
		.from("conversation_analyses")
		.insert({
			id,
			account_id: accountId,
			created_by: createdBy,
			recording_url: recordingUrl,
			status,
		})
		.select()
		.single()

	if (error) throw error

	return conversationAnalysisRecordSchema.parse(data)
}

/**
 * Updates a conversation analysis row with fresh model output and metadata.
 */
export async function updateConversationAnalysis({
	db,
	id,
	payload,
}: {
	db: SupabaseClient<Database>
	id: string
	payload: z.infer<typeof updatePayloadSchema>
}) {
	const validated = updatePayloadSchema.parse(payload)

	const { data, error } = await db
		.from("conversation_analyses")
		.update({
			...validated,
			updated_at: new Date().toISOString(),
		})
		.eq("id", id)
		.select()
		.single()

	if (error) throw error

	return conversationAnalysisRecordSchema.parse(data)
}

/**
 * Fetches a single conversation analysis scoped to an account (RLS friendly for loaders).
 */
export async function getConversationAnalysisById({ db, id }: { db: SupabaseClient<Database>; id: string }) {
	const { data, error } = await db.from("conversation_analyses").select("*").eq("id", id).single()

	if (error) throw error

	return conversationAnalysisRecordSchema.parse(data)
}

/**
 * Returns the most recent analyses for quick history views.
 */
export async function listConversationAnalyses({
	db,
	accountId,
	limit = 10,
}: {
	db: SupabaseClient<Database>
	accountId: string
	limit?: number
}) {
	const { data, error } = await db
		.from("conversation_analyses")
		.select("*")
		.eq("account_id", accountId)
		.order("created_at", { ascending: false })
		.limit(limit)

	if (error) throw error

	return z.array(conversationAnalysisRecordSchema).parse(data)
}
