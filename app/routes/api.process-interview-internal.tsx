import type { ActionFunctionArgs } from "react-router";
import type { InterviewMetadata } from "~/utils/processInterview.server";
import { processInterviewTranscript } from "~/utils/processInterview.server";

interface ProcessInterviewInternalRequest {
	metadata: InterviewMetadata;
	transcriptData: Record<string, unknown>;
	mediaUrl: string;
	userCustomInstructions: string;
	interviewId: string;
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	// Verify this is an internal service call
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ") || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const token = authHeader.substring(7);
	if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return Response.json({ error: "Invalid service token" }, { status: 401 });
	}

	try {
		const body: ProcessInterviewInternalRequest = await request.json();
		const { metadata, transcriptData, mediaUrl, userCustomInstructions } = body;

		// Call the existing processing function
		const result = await processInterviewTranscript({
			metadata,
			transcriptData,
			mediaUrl,
			userCustomInstructions,
			request,
		});

		return Response.json({
			success: true,
			stored: result.stored,
			interview: result.interview,
		});
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Processing failed" }, { status: 500 });
	}
}
