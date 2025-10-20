import { ChevronLeft } from "lucide-react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import { userContext } from "~/server/user-context"
import EvidenceCard from "../components/EvidenceCard"

type EvidencePersonRow = {
	person: {
		id: string
		name: string | null
		role: string | null
	}
}

function isValidUuid(value: string): boolean {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params
	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 })
	if (!isValidUuid(evidenceId)) {
		throw new Response("Invalid evidence identifier", { status: 400 })
	}

	// Parse simple ?t=seconds parameter (like YouTube)
	const url = new URL(request.url)
	const timeParam = url.searchParams.get("t")
	
	let anchorOverride = null
	if (timeParam) {
		const seconds = Number.parseFloat(timeParam)
		if (!Number.isNaN(seconds) && seconds > 0) {
			// Create a simple anchor with the time
			// Use "media" type so EvidenceCard recognizes it as a playable timestamp
			anchorOverride = {
				type: "media",
				start: `${seconds * 1000}ms`, // Convert back to ms format for consistency
				end: null
			}
		}
	}

	// Fetch evidence with interview data (excluding evidence_tag to avoid multiple rows issue)
	const { data: evidenceData, error: evidenceError } = await supabase
		.from("evidence")
		.select(`
			*,
			interview:interview_id(
				id,
				title,
				media_url,
				transcript,
				transcript_formatted,
				duration_sec
			)
		`)
		.eq("id", evidenceId)
		.single()

	if (evidenceError) throw new Error(`Failed to load evidence: ${evidenceError.message}`)
	if (!evidenceData) throw new Error("Evidence not found")

	// Fetch people separately to avoid duplicate rows
	const { data: peopleData } = await supabase
		.from("evidence_people")
		.select(`
			person:person_id(
				id,
				name,
				role
			)
		`)
		.eq("evidence_id", evidenceId)

	const data = {
		...evidenceData,
		people: peopleData || [],
	}

	// Transform the data to match EvidenceCard expectations
	const peopleRows = (data.people ?? []) as EvidencePersonRow[]
	const transformedEvidence = {
		...data,
		// If anchor override is provided, use it instead of stored anchors
		anchors: anchorOverride
			? [anchorOverride, ...(Array.isArray(data.anchors) ? (data.anchors as any[]) : [])]
			: data.anchors,
		people: peopleRows.map((row) => ({
			id: row.person.id,
			name: row.person.name,
			role: row.person.role,
			personas: [], // No personas data needed for now
		})),
	}

	// Related evidence in the same scene/topic
	let relatedEvidence: Array<any> = []
	const topic = transformedEvidence.topic as string | null
	const interviewId = transformedEvidence.interview_id as string | null
	if (topic && interviewId) {
		const { data: related, error: relatedError } = await supabase
			.from("evidence")
			.select("id, verbatim, gist, chunk, topic, support, confidence, created_at, journey_stage, kind_tags, method, anchors, interview_id")
			.eq("interview_id", interviewId)
			.eq("topic", topic)
			.neq("id", evidenceId)
			.order("created_at", { ascending: true })
			.limit(20)
		if (!relatedError && Array.isArray(related)) relatedEvidence = related
	}

	return {
		evidence: transformedEvidence,
		relatedEvidence,
		anchorFromUrl: anchorOverride,
	}
}

export default function EvidenceDetail() {
	const { evidence, relatedEvidence } = useLoaderData<typeof loader>()
	const interview = evidence.interview

	return (
		<div className="space-y-4 p-4 sm:p-6">
			{/* Mobile-friendly header */}
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" onClick={() => window.history.back()} className="h-8 w-8 p-0">
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					{interview && <p className="text-muted-foreground text-sm">From interview: {interview.title}</p>}
				</div>
			</div>

			{/* Full Evidence Card - Centered with max width */}
			<PageContainer size="sm" padded={false} className="max-w-2xl">
				<EvidenceCard
					evidence={evidence}
					people={evidence.people || []}
					interview={interview}
					variant="expanded"
					showInterviewLink={true}
				/>
			</PageContainer>

			{/* Related evidence in this topic */}
			{Array.isArray(relatedEvidence) && relatedEvidence.length > 0 && (
				<PageContainer size="sm" padded={false} className="max-w-2xl">
					<div className="mt-2 space-y-3">
						<p className="text-muted-foreground text-sm">Related in this topic</p>
						<div className="space-y-2">
							{relatedEvidence.map((ev: any) => (
								<EvidenceCard key={ev.id} evidence={ev} variant="mini" />
							))}
						</div>
					</div>
				</PageContainer>
			)}
		</div>
	)
}
