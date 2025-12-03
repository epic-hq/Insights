import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { upsertSalesLensFromExtraction } from "~/lib/sales-lens/storage.server"
import { buildSalesLensFromEvidence } from "~/lib/sales-lens/baml-extraction.server"
import { buildInitialSalesLensExtraction } from "~/utils/salesLens.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"

type Payload = {
        interviewId: string
        computedBy?: string | null
}

/**
 * Helper function to generate and store conversation takeaways
 */
async function generateConversationTakeaways(
        client: ReturnType<typeof createSupabaseAdminClient>,
        interviewId: string,
        extraction: any
) {
        try {
                // Fetch interview data
                const { data: interview, error: interviewError } = await client
                        .from("interviews")
                        .select("transcript, transcript_formatted, duration_sec, evidence(count)")
                        .eq("id", interviewId)
                        .single()

                if (interviewError || !interview) {
                        consola.warn(`[generateConversationTakeaways] Interview not found: ${interviewId}`)
                        return
                }

                const transcript = interview.transcript_formatted || interview.transcript || ""
                const evidenceCount = (interview.evidence as any)?.[0]?.count || 0
                const durationMinutes = interview.duration_sec ? Math.round(interview.duration_sec / 60) : null

                // Build summaries from extraction
                const bantFramework = extraction.frameworks?.find((f: any) => f.name === "BANT_GPCT")
                const meddicFramework = extraction.frameworks?.find((f: any) => f.name === "MEDDIC")

                const bantSummary = bantFramework?.slots
                        ?.map((s: any) => `${s.label}: ${s.textValue || s.summary || "Not captured"}`)
                        .join("; ") || null

                const meddicSummary = meddicFramework?.slots
                        ?.map((s: any) => `${s.label}: ${s.textValue || s.summary || "Not captured"}`)
                        .join("; ") || null

                const stakeholdersSummary = extraction.entities?.stakeholders
                        ?.map((s: any) => `${s.displayName} (${s.role || "Unknown role"})`)
                        .join(", ") || null

                // Log input summary for debugging
                consola.info(`[generateConversationTakeaways] Input summary:`, {
                        interviewId,
                        transcriptLength: transcript.length,
                        evidenceCount,
                        durationMinutes,
                        hasBantSummary: !!bantSummary,
                        hasMeddicSummary: !!meddicSummary,
                        stakeholdersCount: extraction.entities?.stakeholders?.length || 0,
                })

                // Call BAML function
                const takeaways = await b.ExtractConversationTakeaways(
                        transcript,
                        bantSummary,
                        meddicSummary,
                        stakeholdersSummary,
                        null, // empathy_insights - could be added later
                        evidenceCount,
                        durationMinutes
                )

                // Combine into a single string
                const keyTakeaways = [
                        takeaways.value_synopsis,
                        takeaways.critical_next_step,
                        takeaways.future_improvement,
                ].join(" ")

                consola.info(`[generateConversationTakeaways] Generated takeaways (${keyTakeaways.length} chars):`, {
                        value_synopsis: takeaways.value_synopsis?.substring(0, 100) + "...",
                        critical_next_step: takeaways.critical_next_step?.substring(0, 100) + "...",
                        future_improvement: takeaways.future_improvement?.substring(0, 100) + "...",
                })

                // Store in interviews table
                const { error: updateError } = await client
                        .from("interviews")
                        .update({ key_takeaways: keyTakeaways })
                        .eq("id", interviewId)

                if (updateError) {
                        consola.error(`[generateConversationTakeaways] Failed to update interview ${interviewId}:`, updateError)
                } else {
                        consola.info(`[generateConversationTakeaways] Successfully stored takeaways for ${interviewId}`)
                }
        } catch (error) {
                consola.error(`[generateConversationTakeaways] Error generating takeaways for ${interviewId}:`, error)
                // Don't throw - let the main task succeed even if takeaways fail
        }
}

/**
 * Trigger.dev task that materializes a sales lens summary for an interview.
 * Safe to invoke from other tasks or the Remix action when an AE requests a refresh.
 */
export const generateSalesLensTask = task({
        id: "sales.generate-sales-lens",
        retry: workflowRetryConfig,
        run: async (payload: Payload) => {
                const client = createSupabaseAdminClient()

                let extraction: any
                let method: "baml" | "heuristic" = "baml"
                let fallback = false

                try {
                        // Try new BAML-based extraction first
                        consola.info(`[generateSalesLensTask] Using BAML-based extraction for ${payload.interviewId}`)
                        extraction = await buildSalesLensFromEvidence(client, payload.interviewId)

                        // Log detailed extraction results for troubleshooting
                        consola.info(`[generateSalesLensTask] BAML Extraction Summary:`, {
                                interviewId: payload.interviewId,
                                frameworkCount: extraction.frameworks?.length || 0,
                                frameworks: extraction.frameworks?.map((f: any) => ({
                                        name: f.name,
                                        slotCount: f.slots?.length || 0,
                                        hygiene: f.hygiene?.length || 0
                                })) || [],
                                stakeholderCount: extraction.entities?.stakeholders?.length || 0,
                                stakeholders: extraction.entities?.stakeholders?.map((s: any) => ({
                                        displayName: s.displayName,
                                        role: s.role,
                                        personId: s.personId,
                                        labels: s.labels
                                })) || [],
                                nextStepsCount: extraction.entities?.nextSteps?.length || 0,
                        })

                        // Store lens data FIRST - this is critical and should not be affected by takeaways failure
                        consola.info(`[generateSalesLensTask] Storing sales lens data for ${payload.interviewId}`)
                        await upsertSalesLensFromExtraction({
                                db: client,
                                payload: extraction,
                                sourceKind: "interview",
                                computedBy: payload.computedBy ?? null,
                        })
                        consola.info(`[generateSalesLensTask] Successfully stored sales lens data for ${payload.interviewId}`)

                } catch (error) {
                        // Fallback to heuristic extraction if BAML fails
                        consola.warn(`[generateSalesLensTask] BAML extraction failed, falling back to heuristics`, error)

                        extraction = await buildInitialSalesLensExtraction(client, payload.interviewId)
                        method = "heuristic"
                        fallback = true

                        // Log heuristic extraction results
                        consola.info(`[generateSalesLensTask] Heuristic Extraction Summary:`, {
                                interviewId: payload.interviewId,
                                frameworkCount: extraction.frameworks?.length || 0,
                                stakeholderCount: extraction.entities?.stakeholders?.length || 0,
                        })

                        // Store lens data FIRST - this is critical and should not be affected by takeaways failure
                        consola.info(`[generateSalesLensTask] Storing sales lens data (heuristic) for ${payload.interviewId}`)
                        await upsertSalesLensFromExtraction({
                                db: client,
                                payload: extraction,
                                sourceKind: "interview",
                                computedBy: payload.computedBy ?? null,
                        })
                        consola.info(`[generateSalesLensTask] Successfully stored sales lens data (heuristic) for ${payload.interviewId}`)
                }

                // Generate conversation takeaways AFTER all lens data is safely stored
                // This runs last so it can summarize everything, and failures here won't affect lens data
                consola.info(`[generateSalesLensTask] Generating conversation takeaways for ${payload.interviewId}`)
                await generateConversationTakeaways(client, payload.interviewId, extraction)

                // Build comprehensive result summary
                const result = {
                        interviewId: payload.interviewId,
                        method,
                        frameworks: extraction.frameworks?.length || 0,
                        frameworkNames: extraction.frameworks?.map((f: any) => f.name) || [],
                        stakeholders: extraction.entities?.stakeholders?.length || 0,
                        stakeholderDetails: extraction.entities?.stakeholders?.map((s: any) => ({
                                name: s.displayName,
                                role: s.role,
                                personId: s.personId,
                        })) || [],
                        nextSteps: extraction.entities?.nextSteps?.length || 0,
                        ...(fallback ? { fallback: true } : {}),
                }

                consola.info(`[generateSalesLensTask] ✓ Task completed successfully:`, result)
                return result
        },
})
