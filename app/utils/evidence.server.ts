export type EvidenceUnit = {
	person_key?: string
	verbatim: string
	support: "supports" | "refutes" | "neutral"
	chunk?: string
	gist?: string
	topic?: string
	personas?: string[]
	segments?: string[]
	journey_stage?: string
	anchors: any[]
	confidence: "low" | "medium" | "high"
}

// Note: This function is not currently used - evidence is inserted directly
// in processInterview.server.ts. Kept for potential future use.
export async function persistEvidence(
	supabase: any,
	account_id: string,
	project_id: string,
	interview_id: string | null,
	units: EvidenceUnit[]
) {
	if (!units?.length) return []
	const rows = units.map((u) => ({
		account_id,
		project_id,
		interview_id,
		chunk: u.chunk ?? u.verbatim,
		gist: u.gist ?? u.verbatim,
		topic: u.topic ?? null,
		verbatim: u.verbatim,
		support: u.support,
		personas: u.personas ?? [],
		segments: u.segments ?? [],
		journey_stage: u.journey_stage ?? null,
		anchors: u.anchors,
		confidence: u.confidence,
		// Note: Embeddings generated async via DB trigger → queue → edge function
	}))
	const { data, error } = await supabase.from("evidence").insert(rows).select("id")
	if (error) throw new Error(`persistEvidence insert failed: ${error.message}`)
	return data
}
