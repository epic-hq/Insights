import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import { storeAudioFile } from "~/utils/storeAudioFile.server"

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const ctx = context.get(userContext)
		const supabase = ctx?.supabase
		const { projectId } = params

		if (!projectId) {
			return Response.json({ error: "Missing projectId in URL" }, { status: 400 })
		}

		if (!supabase) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const formData = await request.formData()
		const interviewId = formData.get("interviewId")
		const file = formData.get("file")
		const projectIdFromForm = formData.get("projectId")

		if (!interviewId || typeof interviewId !== "string") {
			return Response.json({ error: "interviewId is required" }, { status: 400 })
		}

		if (!(file instanceof File)) {
			return Response.json({ error: "file is required" }, { status: 400 })
		}

		if (typeof projectIdFromForm === "string" && projectIdFromForm && projectIdFromForm !== projectId) {
			return Response.json({ error: "Project mismatch" }, { status: 400 })
		}

		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.select("id, project_id")
			.eq("id", interviewId)
			.eq("project_id", projectId)
			.single()

		if (interviewError || !interview) {
			consola.warn("Realtime upload interview lookup failed", interviewError)
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		const { mediaUrl, error: storageError } = await storeAudioFile({
			projectId,
			interviewId,
			source: file,
			originalFilename: file.name,
			contentType: file.type,
		})

		if (!mediaUrl) {
			return Response.json({ error: storageError ?? "Failed to upload media" }, { status: 500 })
		}

		return Response.json({ mediaUrl })
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unexpected error"
		consola.error("Unexpected error in realtime-upload:", error)
		return Response.json({ error: message }, { status: 500 })
	}
}
