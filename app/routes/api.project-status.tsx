import type { LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import { getProjectStatusData } from "~/utils/project-status.server"

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		// Get authenticated user
		const { user } = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		const url = new URL(request.url)
		const projectId = url.searchParams.get("projectId")

		if (!projectId) {
			return Response.json({ success: false, error: "Project ID is required" }, { status: 400 })
		}

		// Get supabase client with auth
		const { client: supabase } = getServerClient(request)

		// Use the updated server util that reads from annotations
		const statusData = await getProjectStatusData(projectId, supabase)

		if (!statusData) {
			return Response.json({ success: false, error: "Project not found" }, { status: 404 })
		}

		return Response.json({ success: true, data: statusData })
	} catch (_error) {
		return Response.json({ success: false, error: "Failed to fetch project status" }, { status: 500 })
	}
}
