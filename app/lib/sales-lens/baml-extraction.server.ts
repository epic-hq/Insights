/**
 * BAML-Based Sales Lens Extraction
 *
 * Extracts BANT (Budget, Authority, Need, Timeline) framework data from interview evidence
 * using semantic search + AI extraction for high-quality, traceable insights.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { b } from "../../../baml_client"
import type { Database } from "../../../supabase/types"
import type { SalesConversationExtraction } from "./schema"

type DbClient = SupabaseClient<Database>

/**
 * Build a sales lens extraction from interview evidence using BAML + semantic search
 */
export async function buildSalesLensFromEvidence(
	db: DbClient,
	interviewId: string
): Promise<SalesConversationExtraction> {
	consola.info(`[buildSalesLensFromEvidence] Starting extraction for interview ${interviewId}`)

	// 1. Get interview context
	const { data: interview, error: interviewError } = await db
		.from("interviews")
		.select("id, account_id, project_id, title, interview_date, observations_and_notes")
		.eq("id", interviewId)
		.single()

	if (interviewError || !interview) {
		throw new Error(`Failed to load interview ${interviewId}: ${interviewError?.message}`)
	}

	// 2. Get ALL evidence from the interview (let BAML figure out what's relevant)
	consola.info("[buildSalesLensFromEvidence] Loading all evidence from interview")
	const { data: evidenceRows, error: evidenceError } = await db
		.from("evidence")
		.select("id, verbatim, chunk, gist, anchors, pains, gains, thinks, feels")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: true })

	if (evidenceError) {
		throw new Error(`Failed to load evidence for interview ${interviewId}: ${evidenceError.message}`)
	}

	if (!evidenceRows || evidenceRows.length === 0) {
		throw new Error(`No evidence found for interview ${interviewId}. Extract evidence first.`)
	}

	const allEvidence = evidenceRows
	consola.info(`[buildSalesLensFromEvidence] Loaded ${allEvidence.length} evidence pieces`)

	// 4. Prepare evidence for BAML (as JSON string)
	const evidenceForBAML = allEvidence.map((e) => ({
		id: e.id,
		verbatim: e.verbatim,
		gist: e.gist,
		pains: e.pains || [],
		gains: e.gains || [],
		thinks: e.thinks || [],
		feels: e.feels || [],
	}))

	const evidenceJson = JSON.stringify(evidenceForBAML, null, 2)

	// 5. Prepare interview context
	const interviewContext = `
Interview: ${interview.title || "Untitled"}
Date: ${interview.interview_date || "Unknown"}
Notes: ${interview.observations_and_notes || "None"}
`.trim()

	// 6. Call BAML to extract BANT information
	consola.info("[buildSalesLensFromEvidence] Calling BAML extraction")
	const extraction = await b.ExtractSalesLensBant(evidenceJson, interviewContext)

	consola.info("[buildSalesLensFromEvidence] BAML extraction complete", {
		stakeholders: extraction.stakeholders.length,
		next_steps: extraction.next_steps.length,
		budget_discussed: extraction.budget.has_budget_discussion,
		decision_maker_identified: extraction.authority.decision_maker_identified,
		qualification: extraction.deal_qualification.overall_qualification,
	})

	// 7. Get interview participants for stakeholder matching
	const { data: participants } = await db
		.from("interview_people")
		.select("person_id, role, display_name")
		.eq("interview_id", interviewId)

	// 8. Convert BAML extraction to SalesConversationExtraction format
	const salesExtraction: SalesConversationExtraction = {
		meetingId: interview.id,
		accountId: interview.account_id,
		projectId: interview.project_id,
		frameworks: [
			{
				name: "BANT_GPCT",
				hygiene: extraction.deal_qualification.warning_flags.map((flag) => ({
					code: "warning_flag",
					severity: "warning" as const,
					message: flag,
					slot: null,
				})),
				slots: [
					// Budget slot
					{
						slot: "budget",
						label: "Budget",
						description:
							`${extraction.budget.amount_mentioned || "Not discussed"}. ${extraction.budget.pricing_sensitivity ? `Sensitivity: ${extraction.budget.pricing_sensitivity}` : ""}`.trim(),
						summary: extraction.budget.amount_mentioned || "Not discussed",
						textValue: extraction.budget.supporting_quote || null,
						numericValue: null,
						dateValue: null,
						status: extraction.budget.budget_status || null,
						confidence: extraction.budget.confidence,
						ownerPersonId: null,
						ownerPersonKey: null,
						relatedPersonIds: [],
						relatedOrganizationIds: [],
						evidence: extraction.budget.evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
						hygiene: [],
					},
					// Authority slot
					{
						slot: "authority",
						label: "Authority",
						description: extraction.authority.decision_maker_identified
							? `${extraction.authority.decision_maker_name} (${extraction.authority.decision_maker_role || "role unclear"}). ${extraction.authority.approval_process || ""}`
							: `Decision maker not identified. ${extraction.authority.approval_process || "Approval process unclear."}`,
						summary: extraction.authority.decision_maker_name || "Decision maker not identified",
						textValue: extraction.authority.approval_process || null,
						numericValue: null,
						dateValue: null,
						status: extraction.authority.decision_maker_identified ? "identified" : "unclear",
						confidence: extraction.authority.confidence,
						ownerPersonId: null,
						ownerPersonKey: null,
						relatedPersonIds: [],
						relatedOrganizationIds: [],
						evidence: extraction.authority.evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
						hygiene: extraction.authority.blockers.map((blocker) => ({
							code: "blocker",
							severity: "critical" as const,
							message: blocker,
							slot: "authority",
						})),
					},
					// Need slot
					{
						slot: "need",
						label: "Need",
						description:
							`Pain severity: ${extraction.need.pain_severity}. ${extraction.need.impact_on_business || ""}`.trim(),
						summary: extraction.need.primary_pain_points.join(", ") || "No clear need identified",
						textValue: extraction.need.impact_on_business || null,
						numericValue: null,
						dateValue: null,
						status: extraction.need.pain_severity,
						confidence: extraction.need.confidence,
						ownerPersonId: null,
						ownerPersonKey: null,
						relatedPersonIds: [],
						relatedOrganizationIds: [],
						evidence: extraction.need.evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
						hygiene: [],
					},
					// Timeline slot
					{
						slot: "timeline",
						label: "Timeline",
						description:
							`Urgency: ${extraction.timeline.urgency_level}. ${extraction.timeline.target_date ? `Target: ${extraction.timeline.target_date}` : ""}. ${extraction.timeline.external_drivers.length > 0 ? `Drivers: ${extraction.timeline.external_drivers.join(", ")}` : ""}`.trim(),
						summary: extraction.timeline.target_date || `Urgency: ${extraction.timeline.urgency_level}`,
						textValue: extraction.timeline.implementation_timeline || null,
						numericValue: null,
						dateValue: extraction.timeline.target_date?.match(/^\d{4}-\d{2}-\d{2}$/)
							? extraction.timeline.target_date
							: null,
						status: extraction.timeline.deadline_type || null,
						confidence: extraction.timeline.confidence,
						ownerPersonId: null,
						ownerPersonKey: null,
						relatedPersonIds: [],
						relatedOrganizationIds: [],
						evidence: extraction.timeline.evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
						hygiene: [],
					},
					// Next steps slots
					...extraction.next_steps.map((step, idx) => ({
						slot: `next_step_${idx + 1}`,
						label: `Next Step ${idx + 1}`,
						description: step.action_item,
						summary: step.action_item,
						textValue: step.owner || null,
						numericValue: null,
						dateValue: step.due_date || null,
						status: step.commitment_level,
						confidence: 0.8,
						ownerPersonId: null,
						ownerPersonKey: null,
						relatedPersonIds: [],
						relatedOrganizationIds: [],
						evidence: step.evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
						hygiene: [],
					})),
				],
			},
		],
		entities: {
			stakeholders: extraction.stakeholders.map((stakeholder, idx) => {
				// Try to match to interview participants
				const participant = (participants || []).find(
					(p) =>
						p.display_name?.toLowerCase().includes(stakeholder.person_name.toLowerCase()) ||
						stakeholder.person_name.toLowerCase().includes(p.display_name?.toLowerCase() || "")
				)

				// Validate role_type matches enum: "economic_buyer" | "influencer" | "champion" | "blocker" | "decision_maker"
				const validRoles = ["economic_buyer", "influencer", "champion", "blocker", "decision_maker"]
				const roleType = validRoles.includes(stakeholder.role_type) ? stakeholder.role_type : "influencer"

				return {
					personId: participant?.person_id || null,
					personKey: `stakeholder-${idx}`,
					candidatePersonKey: participant?.person_id ? null : stakeholder.person_name,
					displayName: stakeholder.person_name,
					role: stakeholder.person_role || null,
					influence: stakeholder.influence_level as "low" | "medium" | "high",
					labels: [roleType as "economic_buyer" | "influencer" | "champion" | "blocker" | "decision_maker"],
					organizationId: null,
					email: null,
					confidence: 0.7,
					evidence: stakeholder.evidence_ids.map((id) => {
						const ev = allEvidence.find((e) => e.id === id)
						return {
							evidenceId: id,
							startMs: ev?.anchors[0]?.start_ms || null,
							endMs: ev?.anchors[0]?.end_ms || null,
							transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
						}
					}),
				}
			}),
		},
		nextStep:
			extraction.next_steps.length > 0
				? {
						description: extraction.next_steps[0].action_item,
						ownerPersonId: null,
						ownerPersonKey: extraction.next_steps[0].owner || null,
						dueDate: extraction.next_steps[0].due_date?.match(/^\d{4}-\d{2}-\d{2}$/)
							? extraction.next_steps[0].due_date
							: null,
						confidence: 0.8,
						evidence: extraction.next_steps[0].evidence_ids.map((id) => {
							const ev = allEvidence.find((e) => e.id === id)
							return {
								evidenceId: id,
								startMs: ev?.anchors[0]?.start_ms || null,
								endMs: ev?.anchors[0]?.end_ms || null,
								transcriptSnippet: ev?.verbatim?.slice(0, 240) || null,
							}
						}),
					}
				: {
						description: "No clear next steps identified",
						ownerPersonId: null,
						ownerPersonKey: null,
						dueDate: null,
						confidence: 0.3,
						evidence: [],
					},
		insights: extraction.key_insights.map((insight) => ({
			text: insight,
			category: "strategic",
		})),
		risks: extraction.risks_and_concerns.map((risk) => ({
			description: risk,
			severity: "medium",
		})),
		metadata: {
			extractedAt: new Date().toISOString(),
			evidenceCount: allEvidence.length,
			qualificationScore: extraction.deal_qualification.overall_qualification,
		},
	}

	return salesExtraction
}
