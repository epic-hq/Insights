/**
 * Realtime Transcription & Evidence Extraction Demo Page.
 * Showcases live audio transcription with incremental evidence extraction.
 * Supports live recording via microphone and simulated conversation mode.
 */
import type { LoaderFunctionArgs } from "react-router"
import { RealtimeSession } from "../components/RealtimeSession"

export async function loader({ request }: LoaderFunctionArgs) {
	// No auth required for prototype demo access
	return {}
}

export default function RealtimeDemo() {
	return <RealtimeSession />
}
