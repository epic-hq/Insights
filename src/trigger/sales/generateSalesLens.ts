import { task } from "@trigger.dev/sdk"
import consola from "consola"

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
 * Trigger.dev task that materializes a sales lens summary for an interview.
 * Safe to invoke from other tasks or the Remix action when an AE requests a refresh.
 */
export const generateSalesLensTask = task({
        id: "sales.generate-sales-lens",
        retry: workflowRetryConfig,
        run: async (payload: Payload) => {
                const client = createSupabaseAdminClient()

                try {
                        // Try new BAML-based extraction first
                        consola.info(`[generateSalesLensTask] Using BAML-based extraction for ${payload.interviewId}`)
                        const extraction = await buildSalesLensFromEvidence(client, payload.interviewId)

                        await upsertSalesLensFromExtraction({
                                db: client,
                                payload: extraction,
                                sourceKind: "interview",
                                computedBy: payload.computedBy ?? null,
                        })

                        return {
                                interviewId: payload.interviewId,
                                frameworks: extraction.frameworks.length,
                                method: "baml",
                        }
                } catch (error) {
                        // Fallback to heuristic extraction if BAML fails
                        consola.warn(`[generateSalesLensTask] BAML extraction failed, falling back to heuristics`, error)

                        const extraction = await buildInitialSalesLensExtraction(client, payload.interviewId)
                        await upsertSalesLensFromExtraction({
                                db: client,
                                payload: extraction,
                                sourceKind: "interview",
                                computedBy: payload.computedBy ?? null,
                        })

                        return {
                                interviewId: payload.interviewId,
                                frameworks: extraction.frameworks.length,
                                method: "heuristic",
                                fallback: true,
                        }
                }
        },
})
