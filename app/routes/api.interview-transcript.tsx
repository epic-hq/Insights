import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const interviewId = url.searchParams.get("interviewId");
	const projectId = url.searchParams.get("projectId");

	if (!interviewId) {
		throw new Response("Interview ID is required", { status: 400 });
	}

	const { client: supabase } = getServerClient(request);

	try {
		consola.info("Fetching transcript for interview:", { interviewId, projectId });

		// Build query - only filter by projectId if provided
		let query = supabase.from("interviews").select("transcript, transcript_formatted").eq("id", interviewId);

		if (projectId) {
			query = query.eq("project_id", projectId);
		}

		const { data: transcriptData, error } = await query.single();

		consola.info("Transcript query result:", {
			error: error?.message,
			hasData: !!transcriptData,
			transcriptLength: transcriptData?.transcript?.length || 0,
			hasFormattedTranscript: !!transcriptData?.transcript_formatted,
		});

		if (error) {
			consola.error("Database error fetching transcript:", error);
			throw new Response(`Error fetching transcript: ${error.message}`, { status: 500 });
		}

		if (!transcriptData) {
			consola.warn("No transcript data found for interview:", interviewId);
			throw new Response("Interview not found", { status: 404 });
		}

		const sanitizedFormatted = transcriptData.transcript_formatted
			? safeSanitizeTranscriptPayload(transcriptData.transcript_formatted, { omitFullTranscript: true })
			: safeSanitizeTranscriptPayload(null, { omitFullTranscript: true });

		// Return only transcript data to minimize payload
		const response = {
			transcript: transcriptData.transcript,
			transcript_formatted: sanitizedFormatted,
		};

		consola.info("Returning transcript response:", {
			transcriptLength: response.transcript?.length || 0,
			hasFormattedTranscript: !!response.transcript_formatted,
		});

		return response;
	} catch (error) {
		consola.error("Unexpected error in transcript API:", error);

		// Handle different error types
		if (error instanceof Response) {
			throw error; // Re-throw Response errors as-is
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Response(`Failed to load transcript: ${errorMessage}`, { status: 500 });
	}
}
