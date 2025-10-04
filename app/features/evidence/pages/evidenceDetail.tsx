import { ChevronLeft } from "lucide-react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { userContext } from "~/server/user-context"
import EvidenceCard from "../components/EvidenceCard"

function isValidUuid(value: string): boolean {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params
	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 })
	if (!isValidUuid(evidenceId)) {
		throw new Response("Invalid evidence identifier", { status: 400 })
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
					{interview && <p className="text-muted-foreground text-sm">From interview: {interview.title}</p>}
				</div>
			</div>

			{/* Full Evidence Card - Centered with max width */}
			<div className="mx-auto max-w-2xl">
				<EvidenceCard
					evidence={evidence}
					people={evidence.people || []}
					interview={interview}
					variant="expanded"
					showInterviewLink={true}
				/>
			</div>
		</div>
	)
}
