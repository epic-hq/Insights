import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import type { ActionFunctionArgs } from "react-router"
import type { analyzeThemesAndPersonaTask } from "~/../../src/trigger/interview/analyzeThemesAndPersona"
import { evidenceUnitsSchema, turnAnchorsSchema } from "~/lib/validation/baml-validation"
import { createSupabaseAdminClient, getServerClient } from "~/lib/supabase/client.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

const requestSchema = z.object({
	interview_id: z.string().uuid(),
})

type EvidenceUnitInput = z.infer<typeof evidenceUnitsSchema>[number]

function ensureArray(input: unknown): string[] | null {
	if (Array.isArray(input)) {
		const cleaned = input.map((value) => (typeof value === "string" ? value : String(value ?? ""))).filter((value) => value.trim().length > 0)
		return cleaned.length ? cleaned : []
	}
	return null
}

function fallbackPersonName(options: { fileName?: string | null; interviewTitle?: string | null; participantName?: string | null }): string {
	const { fileName, interviewTitle, participantName } = options
	if (participantName?.trim()) return participantName.trim()
	if (fileName) {
		const normalized = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim()
		if (normalized) return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
	}
	if (interviewTitle?.trim() && !interviewTitle.includes("Interview -")) return interviewTitle.trim()
	return new Date().toISOString().split("T")[0]
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const formData = await request.formData()
	const parseResult = requestSchema.safeParse(Object.fromEntries(formData))
	if (!parseResult.success) {
		return Response.json({ error: "interview_id is required" }, { status: 400 })
	}

	const interviewId = parseResult.data.interview_id

	const admin = createSupabaseAdminClient()
	let analysisJobId: string | null = null

	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { client: userDb } = getServerClient(request)

		const { data: interview, error: interviewErr } = await userDb
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewErr || !interview) {
			return Response.json({ error: "Interview not found" }, { status: 404 })
		}

		const transcriptFormatted = (interview.transcript_formatted as Record<string, unknown> | null) ?? {}
		const sanitizedTranscript = safeSanitizeTranscriptPayload(transcriptFormatted)
		const fullTranscript =
			typeof sanitizedTranscript.full_transcript === "string"
				? sanitizedTranscript.full_transcript
				: typeof interview.transcript === "string"
					? interview.transcript
					: ""

		const { data: latestJob } = await userDb
			.from("analysis_jobs")
			.select("custom_instructions")
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false })
			.limit(1)
		const customInstructions = latestJob?.[0]?.custom_instructions ?? undefined

		const { data: evidenceRows, error: evidenceErr } = await userDb
			.from("evidence")
			.select(
				"id, support, verbatim, chunk, gist, topic, personas, segments, journey_stage, anchors, context_summary, independence_key, confidence, says, does, thinks, feels, pains, gains"
			)
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: true })

		if (evidenceErr) {
			return Response.json({ error: evidenceErr.message }, { status: 500 })
		}

		if (!evidenceRows?.length) {
			return Response.json({ error: "No evidence found. Extract evidence before analyzing themes." }, { status: 400 })
		}

		const evidenceIds = evidenceRows.map((row) => row.id)

		const { data: facetRows } = await userDb
			.from("evidence_facet")
			.select("evidence_id, kind_slug")
			.in("evidence_id", evidenceIds.length ? evidenceIds : ["00000000-0000-0000-0000-000000000000"])

		const facetByEvidence = new Map<string, string[]>()
		for (const facet of facetRows ?? []) {
			if (!facet?.evidence_id || !facet?.kind_slug) continue
			const existing = facetByEvidence.get(facet.evidence_id) ?? []
			existing.push(facet.kind_slug)
			facetByEvidence.set(facet.evidence_id, existing)
		}

		const { data: evidencePeopleRows } = await userDb
			.from("evidence_people")
			.select("evidence_id, person_id, role")
			.in("evidence_id", evidenceIds.length ? evidenceIds : ["00000000-0000-0000-0000-000000000000"])

		const personIdByEvidence = new Map<string, string>()
		const personRoleByEvidence = new Map<string, string | null>()
		for (const row of evidencePeopleRows ?? []) {
			if (!row?.evidence_id || !row?.person_id) continue
			if (!personIdByEvidence.has(row.evidence_id)) {
				personIdByEvidence.set(row.evidence_id, row.person_id)
				personRoleByEvidence.set(row.evidence_id, row.role ?? null)
			}
		}

		const { data: interviewPeopleRows } = await userDb
			.from("interview_people")
			.select("person_id, role")
			.eq("interview_id", interviewId)

		const participantPersonId =
			interviewPeopleRows?.find((row) => row.role === "participant")?.person_id ??
			interviewPeopleRows?.[0]?.person_id ??
			null

		const personIds = Array.from(
			new Set([
				...(evidencePeopleRows?.map((row) => row.person_id).filter(Boolean) ?? []),
				...(interviewPeopleRows?.map((row) => row.person_id).filter(Boolean) ?? []),
				participantPersonId ?? undefined,
			].filter(Boolean) as string[])
		)

		const { data: peopleRows } = personIds.length
			? await userDb
				.from("people")
				.select("id, name, description, role, company, segment")
				.in("id", personIds)
			: { data: [] }

		let primaryPersonId = participantPersonId ?? peopleRows?.[0]?.id ?? null
		let primaryPerson = primaryPersonId ? peopleRows?.find((person) => person.id === primaryPersonId) ?? null : null

		if (!primaryPersonId) {
			const fallbackName = fallbackPersonName({
				fileName: (sanitizedTranscript?.original_filename as string | undefined) ?? null,
				interviewTitle: interview.title,
				participantName: interview.participant_pseudonym,
			})
			const { data: ensuredPerson, error: ensureErr } = await admin
				.from("people")
				.upsert(
					{
						account_id: interview.account_id,
						project_id: interview.project_id,
						name: fallbackName,
					},
					{ onConflict: "account_id,name_hash" }
				)
				.select("id, name, description, role, company, segment")
				.single()
			if (ensureErr || !ensuredPerson) {
				return Response.json({ error: "Failed to ensure participant record" }, { status: 500 })
			}
			primaryPersonId = ensuredPerson.id
			primaryPerson = ensuredPerson

		const { error: linkErr } = await admin
			.from("interview_people")
			.upsert(
				{
					interview_id: interviewId,
						person_id: ensuredPerson.id,
						project_id: interview.project_id,
						role: "participant",
					},
					{ onConflict: "interview_id,person_id" }
				)
			if (linkErr && !linkErr.message?.includes("duplicate")) {
				return Response.json({ error: "Failed to link participant to interview" }, { status: 500 })
			}
		}

		if (!primaryPersonId) {
			return Response.json({ error: "Unable to resolve interview participant" }, { status: 500 })
		}

		const participantRole =
			primaryPerson?.role ??
			interviewPeopleRows?.find((row) => row.person_id === primaryPersonId)?.role ??
			null

		const evidenceUnits: EvidenceUnitInput[] = evidenceRows.map((row) => {
			const evidenceId = row.id
			const personId = personIdByEvidence.get(evidenceId) ?? primaryPersonId
			const gist = row.gist && row.gist.trim().length > 0 ? row.gist : row.verbatim
			const chunk = row.chunk && row.chunk.trim().length > 0 ? row.chunk : row.verbatim
			const anchorsRaw = Array.isArray(row.anchors) ? row.anchors : []
			const firstAnchor = anchorsRaw[0] as Record<string, unknown> | undefined

			// Create anchor object that matches BAML TurnAnchors format
			const anchors: z.infer<typeof turnAnchorsSchema> = {
				start_ms: typeof firstAnchor?.start_ms === "number" ? firstAnchor.start_ms :
				         (typeof firstAnchor?.start === "string" ? Number.parseFloat(firstAnchor.start) * 1000 : undefined),
				end_ms: typeof firstAnchor?.end_ms === "number" ? firstAnchor.end_ms :
				       (typeof firstAnchor?.end === "string" ? Number.parseFloat(firstAnchor.end) * 1000 : undefined),
				chapter_title: typeof firstAnchor?.chapter_title === "string" ? firstAnchor.chapter_title : undefined,
				char_span: Array.isArray(firstAnchor?.char_span) ? firstAnchor.char_span : undefined,
			}

			const facetSlugs = facetByEvidence.get(evidenceId) ?? []

			// Convert facet mentions to BAML FacetMention format
			const facet_mentions = facetSlugs.length > 0 ? facetSlugs.map(slug => ({
				person_key: personId ?? primaryPersonId,
				kind_slug: slug,
				value: "extracted from evidence", // This is a fallback since we don't have the original value
				quote: null,
			})) : undefined

			return {
				person_key: personId ?? primaryPersonId,
				speaker_label: null, // Not stored in DB
				gist: gist ?? row.verbatim,
				chunk: chunk ?? row.verbatim,
				verbatim: row.verbatim ?? "",
				anchors,
				why_it_matters: row.context_summary ?? undefined,
				facet_mentions,
				isQuestion: false, // Not stored in DB
				says: ensureArray(row.says) || undefined,
				does: ensureArray(row.does) || undefined,
				thinks: ensureArray(row.thinks) || undefined,
				feels: ensureArray(row.feels) || undefined,
				pains: ensureArray(row.pains) || undefined,
				gains: ensureArray(row.gains) || undefined,
			}
		})

		const validatedEvidenceUnits = evidenceUnitsSchema.parse(evidenceUnits)
		const evidenceFacetKinds = evidenceIds.map((id) => facetByEvidence.get(id) ?? [])

		const analysisMetadata = {
			accountId: interview.account_id,
			userId: claims.sub ?? interview.updated_by ?? interview.created_by ?? undefined,
			projectId: interview.project_id || undefined,
			interviewTitle: interview.title || undefined,
			interviewDate: interview.interview_date || undefined,
			participantName: interview.participant_pseudonym || undefined,
			segment: interview.segment || undefined,
			durationMin: interview.duration_sec ? interview.duration_sec / 60 : undefined,
			fileName: (sanitizedTranscript?.original_filename as string | undefined) ?? undefined,
		}

		await admin.from("interviews").update({ status: "processing" }).eq("id", interviewId)

		const { data: analysisJob, error: jobError } = await admin
			.from("analysis_jobs")
			.insert({
				interview_id: interviewId,
				transcript_data: sanitizedTranscript,
				custom_instructions: customInstructions ?? null,
				status: "in_progress",
				status_detail: "Re-analyzing themes and personas",
				progress: 70,
			})
			.select("id")
			.single()

		if (jobError || !analysisJob) {
			return Response.json({ error: jobError?.message ?? "Failed to create analysis job" }, { status: 500 })
		}
		analysisJobId = analysisJob.id

		const evidenceResult = {
			personData: { id: primaryPersonId },
			primaryPersonName: primaryPerson?.name ?? interview.participant_pseudonym ?? null,
			primaryPersonRole: primaryPerson?.role ?? participantRole ?? null,
			primaryPersonDescription: primaryPerson?.description ?? null,
			primaryPersonOrganization: primaryPerson?.company ?? null,
			primaryPersonSegments: primaryPerson?.segment ? [primaryPerson.segment] : [],
			insertedEvidenceIds: evidenceIds,
			evidenceUnits: validatedEvidenceUnits,
			evidenceFacetKinds,
		}

		const payload = {
			metadata: analysisMetadata,
			interview,
			fullTranscript,
			userCustomInstructions: customInstructions ?? undefined,
			evidenceResult,
			analysisJobId: analysisJob.id,
		}

		const handle = await tasks.trigger<typeof analyzeThemesAndPersonaTask>("interview.analyze-themes-and-persona", payload)

		await admin
			.from("analysis_jobs")
			.update({
				trigger_run_id: handle.id,
				status_detail: "Analyzing themes and personas",
				progress: 75,
			})
			.eq("id", analysisJob.id)

		consola.info(`Re-analyze themes triggered for interview ${interviewId}: ${handle.id}`)
		return Response.json({ success: true, runId: handle.id })
	} catch (error) {
		consola.error("Re-analyze themes API error:", error)
		const message = error instanceof Error ? error.message : "Internal error"
		if (analysisJobId) {
			await admin
				.from("analysis_jobs")
				.update({
					status: "error",
					status_detail: "Re-analyze themes failed",
					last_error: message,
				})
				.eq("id", analysisJobId)
		}
		await admin.from("interviews").update({ status: "error" }).eq("id", interviewId)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
