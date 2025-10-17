import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
        type UploadMediaAndTranscribePayload,
        type UploadMediaAndTranscribeResult,
        uploadMediaAndTranscribeCore,
        workflowRetryConfig,
} from "../../../app/utils/processInterview.server"

export const uploadMediaAndTranscribeTask = task({
        id: "interview.upload-media-and-transcribe",
        retry: workflowRetryConfig,
        run: async (payload: UploadMediaAndTranscribePayload) => {
                const client = createSupabaseAdminClient()
                return uploadMediaAndTranscribeCore({ ...payload, client })
        },
})
