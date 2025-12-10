import type { ActionFunctionArgs } from "react-router"
import { extractSuggestions } from "~/utils/generate-suggestions"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const body = await request.json()
		const { assistantMessage } = body

		if (!assistantMessage || typeof assistantMessage !== "string") {
			return Response.json({ error: "assistantMessage is required" }, { status: 400 })
		}

		const suggestions = extractSuggestions({ assistantMessage })

		return Response.json({ suggestions })
	} catch (error) {
		console.error("Error extracting suggestions:", error)
		return Response.json({ error: "Failed to extract suggestions" }, { status: 500 })
	}
}
