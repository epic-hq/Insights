import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "supabase/types"
import { salesConversationExtractionSchema } from "./schema"

type DbClient = SupabaseClient<Database>

type UpsertArgs = {
	db: DbClient
	payload: unknown
	sourceKind?: string
	computedBy?: string | null
}

/**
 * Persists a validated sales lens extraction into Supabase, replacing any prior
 * summaries, slot details, stakeholders, and hygiene markers for the same interview.
 */
export async function upsertSalesLensFromExtraction({
	db,
	payload,
	sourceKind = "interview",
	computedBy = null,
}: UpsertArgs) {
	const parsed = salesConversationExtractionSchema.parse(payload)

	const { data: existingSummaries, error: existingError } = await db
		.from("sales_lens_summaries")
		.select("id")
		.eq("interview_id", parsed.meetingId)

	if (existingError) {
		throw new Error(`Failed to inspect existing sales lens summaries: ${existingError.message}`)
	}

	const existingIds = (existingSummaries ?? []).map((row) => row.id)
	if (existingIds.length > 0) {
		await db.from("sales_lens_hygiene_events").delete().in("summary_id", existingIds)
		await db.from("sales_lens_stakeholders").delete().in("summary_id", existingIds)
		await db.from("sales_lens_slots").delete().in("summary_id", existingIds)
		await db.from("sales_lens_summaries").delete().in("id", existingIds)
	}

	const attendeeUnlinked = parsed.entities.stakeholders
		.filter((stakeholder) => !stakeholder.personId)
		.map((stakeholder) => ({
			displayName: stakeholder.displayName,
			personKey: stakeholder.personKey ?? null,
			candidatePersonKey: stakeholder.candidatePersonKey ?? null,
			role: stakeholder.role ?? null,
		}))

	for (const framework of parsed.frameworks) {
		const summaryId = randomUUID()
		const summaryRow = {
			id: summaryId,
			account_id: parsed.accountId,
			project_id: parsed.projectId,
			opportunity_id: parsed.opportunityId ?? null,
			interview_id: parsed.meetingId,
			framework: framework.name,
			source_kind: sourceKind,
			attendee_person_ids: parsed.attendeePersonIds,
			attendee_person_keys: parsed.attendeePersonKeys,
			attendee_unlinked: attendeeUnlinked,
			hygiene_summary: framework.hygiene,
			metadata: {
				slotCount: framework.slots.length,
			},
			computed_at: new Date().toISOString(),
			computed_by: computedBy,
		}

		const { error: summaryError } = await db.from("sales_lens_summaries").insert(summaryRow)
		if (summaryError) {
			throw new Error(`Failed to insert sales lens summary (${framework.name}): ${summaryError.message}`)
		}

		const slotIdByKey = new Map<string, string[]>()
		const slotRows = framework.slots.map((slot, index) => {
			const slotId = randomUUID()
			const key = slot.slot.toLowerCase()
			const list = slotIdByKey.get(key) ?? []
			list.push(slotId)
			slotIdByKey.set(key, list)

			return {
				id: slotId,
				summary_id: summaryId,
				slot: slot.slot,
				label: slot.label ?? null,
				description: slot.summary ?? null,
				text_value: slot.textValue ?? null,
				numeric_value: slot.numericValue ?? null,
				date_value: slot.dateValue ?? null,
				status: slot.status ?? null,
				confidence: slot.confidence ?? null,
				owner_person_id: slot.ownerPersonId ?? null,
				owner_person_key: slot.ownerPersonKey ?? null,
				related_person_ids: slot.relatedPersonIds ?? [],
				related_organization_ids: slot.relatedOrganizationIds ?? [],
				evidence_refs: slot.evidence.map((item) => ({
					evidence_id: item.evidenceId,
					start_ms: item.startMs ?? null,
					end_ms: item.endMs ?? null,
					transcript_snippet: item.transcriptSnippet ?? null,
				})),
				hygiene: slot.hygiene ?? [],
				position: index,
			}
		})

		if (slotRows.length > 0) {
			const { error: slotError } = await db.from("sales_lens_slots").insert(slotRows)
			if (slotError) {
				throw new Error(`Failed to insert sales lens slots (${framework.name}): ${slotError.message}`)
			}
		}

		const stakeholderRows = parsed.entities.stakeholders.map((stakeholder) => ({
			id: randomUUID(),
			summary_id: summaryId,
			account_id: parsed.accountId,
			project_id: parsed.projectId,
			person_id: stakeholder.personId ?? null,
			person_key: stakeholder.personKey ?? null,
			candidate_person_key: stakeholder.candidatePersonKey ?? null,
			display_name: stakeholder.displayName,
			role: stakeholder.role ?? null,
			influence: stakeholder.influence ?? "low",
			labels: stakeholder.labels ?? [],
			organization_id: stakeholder.organizationId ?? null,
			email: stakeholder.email ?? null,
			confidence: stakeholder.confidence ?? null,
			evidence_refs: stakeholder.evidence.map((item) => ({
				evidence_id: item.evidenceId,
				start_ms: item.startMs ?? null,
				end_ms: item.endMs ?? null,
				transcript_snippet: item.transcriptSnippet ?? null,
			})),
		}))

		if (stakeholderRows.length > 0) {
			const { error: stakeholderError } = await db.from("sales_lens_stakeholders").insert(stakeholderRows)
			if (stakeholderError) {
				throw new Error(`Failed to insert sales lens stakeholders (${framework.name}): ${stakeholderError.message}`)
			}
		}

		if (framework.hygiene.length > 0) {
			const hygieneRows = framework.hygiene.map((issue) => {
				const slotKey = issue.slot?.toLowerCase()
				let slotId: string | null = null
				if (slotKey && slotIdByKey.has(slotKey)) {
					const ids = slotIdByKey.get(slotKey) ?? []
					slotId = ids.shift() ?? null
					if (ids.length > 0) {
						slotIdByKey.set(slotKey, ids)
					} else {
						slotIdByKey.delete(slotKey)
					}
				}

				return {
					id: randomUUID(),
					summary_id: summaryId,
					slot_id: slotId,
					code: issue.code,
					severity: issue.severity,
					message: issue.message ?? null,
				}
			})

			const { error: hygieneError } = await db.from("sales_lens_hygiene_events").insert(hygieneRows)
			if (hygieneError) {
				throw new Error(`Failed to insert hygiene events (${framework.name}): ${hygieneError.message}`)
			}
		}
	}

	return { interviewId: parsed.meetingId, frameworks: parsed.frameworks.length }
}
