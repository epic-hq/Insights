export type OpportunityStageConfig = {
	id: string
	label: string
	description?: string
}

export type AccountSettingsMetadata = {
	opportunity_stages?: OpportunityStageConfig[] | null
	journey_stages?: OpportunityStageConfig[] | null
	priority_clusters?: OpportunityStageConfig[] | null
	[key: string]: unknown
}

export const DEFAULT_OPPORTUNITY_STAGES: OpportunityStageConfig[] = [
	{
		id: "prospect",
		label: "Prospect",
		description: "Inbound or outbound lead captured and acknowledged",
	},
	{
		id: "discovery",
		label: "Discovery",
		description: "Problem and fit validated with the champion",
	},
	{
		id: "evaluation",
		label: "Evaluation",
		description: "Stakeholders comparing solutions and defining success",
	},
	{
		id: "proposal",
		label: "Proposal",
		description: "Commercial terms and solution approach shared",
	},
	{
		id: "negotiation",
		label: "Negotiation",
		description: "Objections handled and decision criteria aligned",
	},
	{
		id: "commit",
		label: "Commit",
		description: "Verbal yes with paperwork in motion",
	},
	{ id: "closed-won", label: "Closed Won", description: "Signed and activated" },
	{ id: "closed-lost", label: "Closed Lost", description: "Exited pipeline" },
]

export function normalizeStageId(value: string | null | undefined) {
	return (
		value
			?.toString()
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || ""
	)
}

export function resolveOpportunityStages(settings?: AccountSettingsMetadata | null): OpportunityStageConfig[] {
	const rawStages = Array.isArray(settings?.opportunity_stages) ? settings?.opportunity_stages : []

	const cleaned = (rawStages || [])
		.map((stage, index) => {
			const labelCandidate =
				(typeof stage?.label === "string" && stage.label.trim()) ||
				(typeof stage?.id === "string" && stage.id.trim()) ||
				`Stage ${index + 1}`

			const id = normalizeStageId(stage?.id || labelCandidate)
			if (!id || !labelCandidate) return null

			const description =
				typeof stage?.description === "string" && stage.description.trim().length > 0
					? stage.description.trim()
					: undefined

			return {
				id,
				label: labelCandidate,
				description,
			}
		})
		.filter(Boolean) as OpportunityStageConfig[]

	return cleaned.length ? cleaned : DEFAULT_OPPORTUNITY_STAGES
}

export function stageLabelForValue(value: string | null | undefined, stages: OpportunityStageConfig[]) {
	if (!value) return null
	const normalizedValue = normalizeStageId(value)
	const match = stages.find((stage) => stage.id === normalizedValue)
	return match?.label || value
}

export function ensureStageValue(value: string | null | undefined, stages: OpportunityStageConfig[]) {
	const normalizedValue = normalizeStageId(value)
	if (normalizedValue && stages.some((stage) => stage.id === normalizedValue)) {
		return normalizedValue
	}
	return stages[0]?.id || ""
}
