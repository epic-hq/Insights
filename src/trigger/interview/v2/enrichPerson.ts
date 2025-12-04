/**
 * V2 Enrich Person Task
 *
 * Generates descriptions for people identified in interviews and links them to organizations.
 * Runs after evidence extraction, before insights generation.
 *
 * Uses existing generatePersonDescription service for consistency with UI-generated descriptions.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { generatePersonDescription } from "~/features/people/services/generatePersonDescription.server"
import { getPersonById } from "~/features/people/db"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"

export type EnrichPersonPayload = {
	interviewId: string
	projectId: string
	accountId: string
	personId: string | null // Primary person from interview
	analysisJobId?: string
}

export type EnrichPersonResult = {
	enrichedPeople: Array<{
		personId: string
		descriptionGenerated: boolean
		organizationLinked: boolean
		error?: string
	}>
}

export const enrichPersonTaskV2 = task({
	id: "interview.v2.enrich-person",
	retry: workflowRetryConfig,
	run: async (payload: EnrichPersonPayload, { ctx }): Promise<EnrichPersonResult> => {
		const { interviewId, projectId, accountId, personId, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		consola.info("[enrichPerson] Task started", {
			interviewId,
			projectId,
			personId,
			analysisJobId,
		})

		try {
			// Update progress
			if (analysisJobId) {
				await updateAnalysisJobProgress(client, analysisJobId, {
					currentStep: "enrich-person",
					progress: 60,
					statusDetail: "Enriching people profiles",
				})
			}

			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "enrich-person",
						progress: 60,
						status_detail: "Enriching people profiles",
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			// Get all people associated with this interview
			const { data: interviewPeople, error: linkError } = await client
				.from("interview_people")
				.select("person_id")
				.eq("interview_id", interviewId)

			if (linkError) {
				throw new Error(`Failed to load interview people: ${linkError.message}`)
			}

			const peopleIds = interviewPeople?.map((link) => link.person_id).filter(Boolean) ?? []

			if (peopleIds.length === 0) {
				consola.warn("[enrichPerson] No people found for interview", { interviewId })
				return { enrichedPeople: [] }
			}

			consola.info(`[enrichPerson] Found ${peopleIds.length} people to enrich`)

			const enrichedPeople: EnrichPersonResult["enrichedPeople"] = []

			// Enrich each person
			for (const pid of peopleIds) {
				try {
					// Load full person record
					const person = await getPersonById(client, pid)
					if (!person) {
						consola.warn(`[enrichPerson] Person ${pid} not found`)
						enrichedPeople.push({
							personId: pid,
							descriptionGenerated: false,
							organizationLinked: false,
							error: "Person not found",
						})
						continue
					}

					let descriptionGenerated = false
					let organizationLinked = false

					// Generate description if not already present
					if (!person.description) {
						try {
							const description = await generatePersonDescription({
								supabase: client,
								person,
								projectId,
								maxEvidenceHighlights: 6,
							})

							// Update person with generated description
							const { error: updateError } = await client
								.from("people")
								.update({ description })
								.eq("id", pid)

							if (updateError) {
								consola.error(`[enrichPerson] Failed to update person ${pid}:`, updateError)
							} else {
								descriptionGenerated = true
								consola.success(`[enrichPerson] Generated description for person ${pid}`)
							}
						} catch (descError) {
							consola.warn(`[enrichPerson] Could not generate description for person ${pid}:`, descError)
						}
					} else {
						consola.info(`[enrichPerson] Person ${pid} already has description, skipping`)
					}

					// Link to organization if company name is present but no organization link exists
					if (person.company && !person.default_organization_id) {
						try {
							// Search for existing organization by name
							const { data: orgs, error: orgSearchError } = await client
								.from("organizations")
								.select("id, name")
								.eq("account_id", accountId)
								.ilike("name", `%${person.company}%`)
								.limit(1)

							if (orgSearchError) {
								throw orgSearchError
							}

							let orgId: string | null = null

							if (orgs && orgs.length > 0) {
								// Found matching organization
								orgId = orgs[0].id
								consola.info(`[enrichPerson] Matched person ${pid} to existing org: ${orgs[0].name}`)
							} else {
								// Create new organization
								const { data: newOrg, error: createOrgError } = await client
									.from("organizations")
									.insert({
										account_id: accountId,
										name: person.company,
										description: `Auto-created from interview ${interviewId}`,
									})
									.select("id")
									.single()

								if (createOrgError) {
									throw createOrgError
								}

								if (newOrg) {
									orgId = newOrg.id
									consola.success(`[enrichPerson] Created new organization: ${person.company}`)
								}
							}

							// Link person to organization
							if (orgId) {
								const { error: linkOrgError } = await client
									.from("people")
									.update({ default_organization_id: orgId })
									.eq("id", pid)

								if (linkOrgError) {
									throw linkOrgError
								}

								organizationLinked = true
								consola.success(`[enrichPerson] Linked person ${pid} to organization ${orgId}`)
							}
						} catch (orgError) {
							consola.warn(`[enrichPerson] Could not link organization for person ${pid}:`, orgError)
						}
					}

					enrichedPeople.push({
						personId: pid,
						descriptionGenerated,
						organizationLinked,
					})
				} catch (personError) {
					consola.error(`[enrichPerson] Failed to enrich person ${pid}:`, personError)
					enrichedPeople.push({
						personId: pid,
						descriptionGenerated: false,
						organizationLinked: false,
						error: errorMessage(personError),
					})
				}
			}

			// Update workflow state
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					completedSteps: ["upload", "evidence", "enrich-person"],
					currentStep: "enrich-person",
					interviewId,
				})

				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 65,
					statusDetail: `Enriched ${enrichedPeople.length} people profiles`,
				})
			}

			consola.success(`[enrichPerson] Enriched ${enrichedPeople.length} people`)

			return { enrichedPeople }
		} catch (error) {
			// Update processing_metadata on error
			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "enrich-person",
						progress: 60,
						failed_at: new Date().toISOString(),
						error: errorMessage(error),
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			if (analysisJobId) {
				await updateAnalysisJobError(client, analysisJobId, {
					currentStep: "enrich-person",
					error: errorMessage(error),
				})
			}

			throw error
		}
	},
})
