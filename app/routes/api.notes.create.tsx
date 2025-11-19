import type { ActionFunctionArgs } from "react-router"
import consola from "consola"
import { getServerClient } from "~/lib/supabase/client.server"
import { upsertProjectSection } from "~/features/projects/db"
import type { Database } from "~/types"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const { client: supabase } = getServerClient(request)
		const body = await request.json()

		const { projectId, title, content, noteType, associations, tags } = body

		if (!projectId || !content) {
			return Response.json({ error: "projectId and content are required" }, { status: 400 })
		}

		// Generate a unique kind for this note
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const kind = `note_${noteType}_${timestamp}`

		// Build metadata
		const metadata = {
			title: title || `${noteType.replace(/_/g, " ")} - ${new Date().toLocaleDateString()}`,
			note_type: noteType,
			associations: associations || {},
			tags: tags || [],
			created_at: new Date().toISOString(),
		}

		// Save the note
		const result = await upsertProjectSection({
			supabase: supabase as any,
			data: {
				project_id: projectId,
				kind,
				content_md: content,
				meta: metadata as any,
			},
		})

		if (result?.error) {
			throw new Error(result.error.message || "Failed to save note")
		}

		consola.info("Note created successfully", {
			projectId,
			kind,
			noteType,
			hasAssociations: Object.keys(associations || {}).length > 0,
		})

		return Response.json({
			success: true,
			kind,
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
