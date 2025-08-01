import type { LoaderFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/server"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const interviewId = url.searchParams.get("id")
	if (!interviewId) {
		return Response.json({ error: "No interview ID provided" }, { status: 400 })
	}
	const { client: db } = getServerClient(request)
	const { data, error } = await db.from("interviews").select("status").eq("id", interviewId).single()
	if (error) {
		return Response.json({ error: error.message }, { status: 500 })
	}
	const isProcessed = data.status === "ready"
	const progress = isProcessed ? 100 : 90
	return Response.json({ progress, is_processed: isProcessed })
}
