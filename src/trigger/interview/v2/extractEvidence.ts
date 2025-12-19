/**
 * V2 Extract Evidence Task (inlined)
 *
 * Extracts evidence and people from transcript_data, maps BAML person_key to person_id,
 * normalizes speaker labels, and links interview_people with transcript_key.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { ExtractEvidencePayload, ExtractEvidenceResult } from "./types"
import {
	isPlaceholderPerson,
	normalizeSpeakerLabel,
	upsertPersonWithCompanyAwareConflict,
} from "~/features/interviews/peopleNormalization.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"
import { mapRawPeopleToInterviewLinks } from "./personMapping"
import type { Database } from "~/../supabase/types"

export const extractEvidenceTaskV2 = task({
	id: "interview.v2.extract-evidence",
	retry: {
		maxAttempts: 3,
		factor: 1.8,
		minTimeoutInMs: 500,
		maxTimeoutInMs: 30_000,
		randomize: false,
	},
	run: async (payload: ExtractEvidencePayload, { ctx }): Promise<ExtractEvidenceResult> => {
		const { interviewId, fullTranscript, language, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		if (!interviewId || interviewId === "undefined") {
			throw new Error(`Invalid interviewId: ${interviewId}`)
		}

		try {
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "evidence",
				progress: 40,
				statusDetail: "Extracting evidence from transcript",
			})

			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "evidence",
						progress: 40,
						status_detail: "Extracting evidence from transcript",
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			const { data: interview, error: interviewError } = await client
				.from("interviews")
				.select("*")
				.eq("id", interviewId)
				.single()
			if (interviewError || !interview) {
				throw new Error(`Interview ${interviewId} not found: ${interviewError?.message}`)
			}

			// Clean transcript data
			const transcriptData = safeSanitizeTranscriptPayload(interview.transcript_formatted as any)
			// Call legacy core but with people hooks; rawPeople returned for mapping
			const { extractEvidenceAndPeopleCore } = await import("~/utils/processInterview.server")
			const extraction = await extractEvidenceAndPeopleCore({
				db: client as any,
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id || undefined,
				},
				interviewRecord: interview as any,
				transcriptData: transcriptData as any,
				language,
				fullTranscript,
				peopleHooks: {
					normalizeSpeakerLabel,
					isPlaceholderPerson,
					upsertPerson: async (payload) =>
						upsertPersonWithCompanyAwareConflict(client as any, payload, payload.person_type ?? undefined),
				},
			})

			// Map raw people to people table and set transcript_key on interview_people
			const rawPeople = Array.isArray((extraction as any)?.rawPeople)
				? ((extraction as any).rawPeople as any[])
				: []
			if (rawPeople.length) {
				const { speakerLabelByPersonId } = await mapRawPeopleToInterviewLinks({
					db: client as unknown as SupabaseClient<Database>,
					rawPeople,
					accountId: interview.account_id,
					projectId: interview.project_id,
				})

				for (const [personId, transcriptKey] of speakerLabelByPersonId.entries()) {
					await client
						.from("interview_people")
						.upsert(
							{
								interview_id: interviewId,
								person_id: personId,
								project_id: interview.project_id,
								transcript_key: transcriptKey,
							},
							{ onConflict: "interview_id,person_id" },
						)
				}
			}

			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					evidenceIds: extraction.insertedEvidenceIds,
					evidenceUnits: extraction.evidenceUnits,
					personId: extraction.personData?.id || null,
					completedSteps: ["upload", "evidence"],
					currentStep: "evidence",
					interviewId,
				})

				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 55,
					statusDetail: `Extracted ${extraction.insertedEvidenceIds.length} evidence units`,
				})
			}

			return {
				evidenceIds: extraction.insertedEvidenceIds,
				evidenceUnits: extraction.evidenceUnits,
				personId: extraction.personData?.id || null,
			}
		} catch (error) {
			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "evidence",
						progress: 40,
						failed_at: new Date().toISOString(),
						error: errorMessage(error),
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "evidence",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
