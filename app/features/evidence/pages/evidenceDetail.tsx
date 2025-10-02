import { ChevronLeft } from "lucide-react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { userContext } from "~/server/user-context"
import EvidenceCard from "../components/EvidenceCard"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params
	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 })

	// Fetch evidence with interview data
	const { data: evidenceData, error: evidenceError } = await supabase
		.from("evidence")
		.select(`
			*,
			evidence_tag(tag_id, confidence),
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
	const transformedEvidence = {
		...data,
		people:
			data.people?.map((ep: any) => ({
				id: ep.person.id,
				name: ep.person.name,
				role: ep.person.role,
				personas: [], // No personas data needed for now
			})) || [],
	}

	return {
		evidence: transformedEvidence,
	}
}

export default function EvidenceDetail() {
	const { evidence } = useLoaderData<typeof loader>()
	const interview = evidence.interview

	return (
		<div className="space-y-4 p-4 sm:p-6">
			{/* Mobile-friendly header */}
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" onClick={() => window.history.back()} className="h-8 w-8 p-0">
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					<h1 className="font-semibold text-xl">Evidence Detail</h1>
					{interview && <p className="text-muted-foreground text-sm">From interview: {interview.title}</p>}
				</div>
			</div>

			{/* Full Evidence Card */}
			<EvidenceCard evidence={evidence} people={evidence.people || []} variant="expanded" showInterviewLink={true} />
		</div>
	)
}
