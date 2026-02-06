/**
 * Realtime Transcription & Evidence Extraction Demo Page.
 * Showcases live audio transcription with incremental evidence extraction.
 * Supports live recording via microphone and simulated conversation mode.
 *
 * URL params:
 * - participants: Comma-separated participant names (e.g., "Alice,Bob")
 * - projectId: Optional project ID for saving evidence
 * - interviewId: Optional interview ID for linking evidence
 */
import type { LoaderFunctionArgs } from "react-router"
import { useSearchParams } from "react-router"
import { RealtimeSession } from "../components/RealtimeSession"

export async function loader({ request }: LoaderFunctionArgs) {
	// No auth required for prototype demo access
	return {}
}

export default function RealtimeDemo() {
	const [searchParams] = useSearchParams()

	// Parse participant names from URL (comma-separated)
	const participantsParam = searchParams.get("participants")
	const participantNames = participantsParam
		? participantsParam
				.split(",")
				.map((name) => name.trim())
				.filter(Boolean)
		: []

	// Optional IDs for database integration
	const projectId = searchParams.get("projectId") ?? undefined
	const interviewId = searchParams.get("interviewId") ?? undefined

	return <RealtimeSession participantNames={participantNames} projectId={projectId} interviewId={interviewId} />
}
