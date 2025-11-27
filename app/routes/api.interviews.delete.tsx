import type { ActionFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { deleteInterview } from "~/features/interviews/db"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const user = ctx.user

	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const formData = await request.formData()
	const interviewId = formData.get("interviewId") as string
	const projectId = formData.get("projectId") as string

	if (!interviewId || !projectId) {
		throw new Response("Interview ID and Project ID are required", { status: 400 })
	}

	// Get the project to verify access and get account_id
	const { data: project } = await supabase.from("projects").select("account_id").eq("id", projectId).single()

	if (!project) {
		throw new Response("Project not found", { status: 404 })
	}

	const { error } = await deleteInterview({
		supabase,
		id: interviewId,
		accountId: project.account_id,
		projectId,
	})

	if (error) {
		console.error("Error deleting interview:", error)
		throw new Response("Failed to delete interview", { status: 500 })
	}

	// Redirect back to interviews list
	return redirect(`/a/${project.account_id}/${projectId}/interviews`)
}
