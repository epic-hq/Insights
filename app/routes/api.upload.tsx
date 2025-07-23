import type { ActionFunctionArgs } from "react-router"
import { processInterviewTranscript } from "~/utils/processInterview.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		const file = formData.get("file") as File

		if (!file) {
			return Response.json({ error: "No file provided" }, { status: 400 })
		}

		// Extract text content from file
		const transcript = await file.text()

		// Mock metadata for now - in production this would come from user context
		// TODO: Replace with actual user/org context from session
		// For now, using placeholder values that match DB schema requirements
		const metadata = {
			accountId: "00000000-0000-0000-0000-000000000001", // Default org UUID
			projectId: "00000000-0000-0000-0000-000000000002", // Default project UUID
			interviewTitle: `Interview - ${file.name}`,
			interviewDate: new Date().toISOString().split("T")[0],
			participantName: "Anonymous Participant",
			segment: "Upload",
		}

		// Process the transcript using BAML
		const result = await processInterviewTranscript(metadata, transcript)

		// Log results for debugging - using structured logging
		if (process.env.NODE_ENV === "development") {
			// biome-ignore lint: Development logging
			console.log("Processing result:", result)
		}

		return Response.json({
			success: true,
			message: "File processed successfully",
			insights: result.stored,
		})
	} catch (error) {
		// biome-ignore lint: Error logging
		console.error("Upload processing error:", error)
		return Response.json(
			{
				error: "Failed to process file",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
