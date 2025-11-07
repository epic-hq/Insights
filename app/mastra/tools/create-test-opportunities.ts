import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import { buildInitialSalesLensExtraction } from "~/utils/salesLens.server"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestOpportunities() {
	consola.info("Creating test opportunities for BANT matrix...")

	// Get first project
	const { data: projects } = await supabase.from("projects").select("id, account_id").limit(1).single()

	if (!projects) {
		consola.error("No projects found")
		return
	}

	const projectId = projects.id
	const accountId = projects.account_id

	consola.info(`Using project: ${projectId}`)

	// Get some interviews to link
	const { data: interviews } = await supabase
		.from("interviews")
		.select("id, title")
		.eq("project_id", projectId)
		.limit(5)

	if (!interviews || interviews.length === 0) {
		consola.error("No interviews found in project")
		return
	}

	consola.info(`Found ${interviews.length} interviews`)

	// Create diverse test opportunities
	const testOpportunities = [
		{
			title: "Enterprise Deal - Acme Corp",
			amount: 500000,
			stage: "negotiation",
			close_date: "2025-12-31",
			interview_id: interviews[0]?.id,
		},
		{
			title: "Mid-Market - TechStart Inc",
			amount: 75000,
			stage: "proposal",
			close_date: "2025-11-30",
			interview_id: interviews[1]?.id,
		},
		{
			title: "SMB - Local Business",
			amount: 15000,
			stage: "discovery",
			close_date: "2025-10-15",
			interview_id: interviews[2]?.id,
		},
		{
			title: "Startup - Innovation Labs",
			amount: 8000,
			stage: "qualification",
			close_date: "2025-09-30",
			interview_id: interviews[3]?.id,
		},
		{
			title: "Large Enterprise - Global Systems",
			amount: 1200000,
			stage: "discovery",
			close_date: "2026-03-31",
			interview_id: interviews[4]?.id,
		},
	]

	const createdOpportunities = []

	for (const opp of testOpportunities) {
		consola.start(`Creating opportunity: ${opp.title}`)

		const { data: opportunity, error } = await supabase
			.from("opportunities")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title: opp.title,
				amount: opp.amount,
				stage: opp.stage,
				close_date: opp.close_date,
				source: "manual",
			})
			.select()
			.single()

		if (error) {
			consola.error(`Failed to create ${opp.title}:`, error)
			continue
		}

		consola.success(`Created opportunity: ${opp.title} ($${opp.amount / 1000}K)`)
		createdOpportunities.push({ ...opportunity, interview_id: opp.interview_id })

		// Generate BANT sales lens for the linked interview
		if (opp.interview_id) {
			try {
				consola.start(`Generating sales lens for interview ${opp.interview_id}`)

				const extraction = await buildInitialSalesLensExtraction(supabase, opp.interview_id)
				const bantFramework = extraction.frameworks.find((f) => f.name === "BANT_GPCT")

				if (!bantFramework) {
					consola.warn("No BANT framework found")
					continue
				}

				// Create sales_lens_summary
				const { data: summary, error: summaryError } = await supabase
					.from("sales_lens_summaries")
					.insert({
						account_id: accountId,
						project_id: projectId,
						interview_id: opp.interview_id,
						opportunity_id: opportunity.id,
						framework: "BANT_GPCT",
						hygiene_summary: {},
						metadata: {},
						attendee_person_ids: extraction.entities.attendee_person_ids,
						attendee_person_keys: extraction.entities.attendee_person_keys,
						attendee_unlinked: [],
					})
					.select()
					.single()

				if (summaryError) {
					consola.error("Failed to create summary:", summaryError)
					continue
				}

				consola.success(`Created sales lens summary for ${opp.title}`)

				// Create slots
				for (const slot of bantFramework.slots) {
					await supabase.from("sales_lens_slots").insert({
						account_id: accountId,
						project_id: projectId,
						summary_id: summary.id,
						slot: slot.slot,
						summary: slot.summary,
						text_value: slot.textValue,
						numeric_value: slot.numericValue,
						date_value: slot.dateValue,
						status: slot.status,
						confidence: slot.confidence,
						owner_person_id: slot.ownerPersonId,
						owner_person_key: slot.ownerPersonKey,
						related_person_ids: slot.relatedPersonIds,
						related_organization_ids: slot.relatedOrganizationIds,
						evidence_refs: slot.evidence,
						hygiene: slot.hygiene,
					})
				}

				consola.success(`Created ${bantFramework.slots.length} BANT slots`)

				// Create stakeholders
				for (const stakeholder of extraction.entities.stakeholders) {
					await supabase.from("sales_lens_stakeholders").insert({
						account_id: accountId,
						project_id: projectId,
						summary_id: summary.id,
						person_id: stakeholder.personId,
						person_key: stakeholder.personKey,
						candidate_person_key: stakeholder.candidatePersonKey,
						display_name: stakeholder.displayName,
						role: stakeholder.role,
						influence: stakeholder.influence,
						labels: stakeholder.labels,
						organization_id: stakeholder.organizationId,
						email: stakeholder.email,
						confidence: stakeholder.confidence,
						evidence_refs: stakeholder.evidence,
					})
				}

				consola.success(`Created ${extraction.entities.stakeholders.length} stakeholders`)
			} catch (err) {
				consola.error(`Failed to generate sales lens:`, err)
			}
		}
	}

	consola.box(`
✅ Created ${createdOpportunities.length} test opportunities with BANT data!

Visit your BANT Lens at:
/projects/${projectId}/bant-lens

The matrix should now show opportunities distributed across:
- Budget ranges (from $8K to $1.2M)
- Authority levels (based on stakeholder influence)
	`)
}

createTestOpportunities()
