import { task } from "@trigger.dev/sdk"

import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { upsertSalesLensFromExtraction } from "~/lib/sales-lens/storage.server"
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
                }
        },
})
