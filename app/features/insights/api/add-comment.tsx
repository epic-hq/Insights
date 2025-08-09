import consola from "consola"
import type { ActionFunction } from "react-router"
import { userContext } from "~/server/user-context"

interface CommentPayload {
	insightId: string
	comment: string
	projectId: string
}

export const action: ActionFunction = async ({ context, request }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id

	try {
		const payload = (await request.json()) as CommentPayload
		const { insightId, comment, projectId } = payload

		if (!insightId || !comment?.trim() || !projectId) {
			return Response.json({ error: "Missing required parameters" }, { status: 400 })
		}

		// Verify the insight exists and user has access
		const { data: insight, error: fetchError } = await supabase
			.from("insights")
			.select("id")
			.eq("id", insightId)
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.single()

		if (fetchError || !insight) {
			consola.error("Failed to verify insight for comment:", fetchError)
			return Response.json({ error: "Insight not found" }, { status: 404 })
		}

		// Create the comment using actual schema fields
		const { data: newComment, error: insertError } = await supabase
			.from("comments")
			.insert({
				insight_id: insightId,
				account_id: accountId,
				content: comment.trim(), // Use 'content' not 'text'
				user_id: ctx.claims?.sub || "anonymous" // Use 'user_id' not 'author'
				// created_at and updated_at are auto-generated
			})
			.select()
			.single()

		if (insertError) {
			consola.error("Failed to create comment:", insertError)
			return Response.json({ error: insertError.message }, { status: 500 })
		}

		consola.log(`Successfully added comment to insight ${insightId}`)
		return Response.json({ 
			success: true, 
			comment: newComment
		})

	} catch (err) {
		consola.error("Add comment API error:", err)
		return Response.json({ error: "Internal server error" }, { status: 500 })
	}
}
