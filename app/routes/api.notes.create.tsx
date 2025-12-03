import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { client: supabase, user } = getServerClient(request)
		const body = await request.json()

		const { projectId, title, content, noteType, associations, tags } = body

		if (!projectId || !content) {
			return Response.json({ error: "projectId and content are required" }, { status: 400 })
		}

		// Get account_id from project
		const { data: project } = await supabase.from("projects").select("account_id").eq("id", projectId).single()

		if (!project) {
			return Response.json({ error: "Project not found" }, { status: 404 })
		}

		// Build metadata for conversation_analysis field
		const metadata = {
			note_type: noteType,
			associations: associations || {},
			tags: tags || [],
		}

		// Insert into interviews table
		const { data: interview, error } = await supabase
			.from("interviews")
			.insert({
				account_id: project.account_id,
				project_id: projectId,
				title: title || `${noteType.replace(/_/g, " ")} - ${new Date().toLocaleDateString()}`,
				observations_and_notes: content,
				source_type: "note",
				media_type: noteType, // meeting_notes, observation, insight, followup
				status: "ready",
				conversation_analysis: metadata as any,
				created_by: user?.id,
			})
			.select("id")
			.single()

		if (error) {
			throw new Error(error.message || "Failed to save note")
		}

		consola.info("Note created successfully", {
			projectId,
			noteId: interview?.id,
			noteType,
			hasAssociations: Object.keys(associations || {}).length > 0,
		})

		return Response.json({
			success: true,
			id: interview?.id,
			message: "Note saved successfully",
		})
	} catch (error) {
		consola.error("Failed to create note:", error)
		return Response.json(
			{
				error: "Failed to create note",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		)
	}
}
