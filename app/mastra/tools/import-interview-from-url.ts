import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { format } from "date-fns"
import { z } from "zod"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { createAndProcessAnalysisJob } from "~/utils/processInterviewAnalysis.server"
import { storeAudioFile } from "~/utils/storeAudioFile.server"

const importInterviewFromUrlSchema = z.object({
        url: z.string().url({ message: "A valid video URL is required" }),
        title: z.string().optional(),
        participantName: z.string().optional(),
        customInstructions: z.string().optional(),
})

function requireContextValue(
        runtimeContext: Map<string, unknown> | undefined,
        key: string
): string {
        const value = runtimeContext?.get?.(key)
        if (!value || typeof value !== "string") {
                throw new Error(`Missing ${key} in runtime context`)
        }
        return value
}

export const importInterviewFromUrlTool = createTool({
        id: "importInterviewFromUrl",
        description:
                "Download a video from a URL and ingest it through the Trigger.dev interview pipeline for this project.",
        schema: importInterviewFromUrlSchema,
        execute: async ({ url, title, participantName, customInstructions }, { runtimeContext }) => {
                const accountId = requireContextValue(runtimeContext, "account_id")
                const projectId = requireContextValue(runtimeContext, "project_id")
                const userId = requireContextValue(runtimeContext, "user_id")

                const supabase = supabaseAdmin
                const interviewTitle =
                        title?.trim() || `Video Interview - ${format(new Date(), "yyyy-MM-dd")}`

                consola.info("[importInterviewFromUrl] Creating interview from URL", { projectId })

                const { data: interview, error: insertError } = await supabase
                        .from("interviews")
                        .insert({
                                account_id: accountId,
                                project_id: projectId,
                                title: interviewTitle,
                                participant_pseudonym: participantName?.trim() || null,
                                status: "uploading",
                                source_type: "video_url",
                                original_filename: url,
                        })
                        .select()
                        .single()

                if (insertError || !interview) {
                        throw new Error(insertError?.message || "Failed to create interview record")
                }

                await createPlannedAnswersForInterview(supabase, {
                        projectId,
                        interviewId: interview.id,
                })

                consola.info("[importInterviewFromUrl] Fetching and storing media from URL", { interviewId: interview.id })

                const { mediaUrl, error: storageError } = await storeAudioFile({
                        projectId,
                        interviewId: interview.id,
                        source: url,
                        originalFilename: url,
                })

                if (!mediaUrl) {
                        await supabase.from("interviews").update({ status: "error" }).eq("id", interview.id)
                        throw new Error(storageError || "Failed to download and store media from URL")
                }

                await supabase
                        .from("interviews")
                        .update({
                                media_url: mediaUrl,
                                status: "processing",
                        })
                        .eq("id", interview.id)

                const transcriptData = {
                        needs_transcription: true,
                        file_type: "media",
                        original_filename: url,
                }

                const runInfo = await createAndProcessAnalysisJob({
                        interviewId: interview.id,
                        transcriptData,
                        customInstructions: customInstructions ?? "",
                        adminClient: supabase,
                        mediaUrl,
                        initiatingUserId: userId,
                })

                return {
                        success: true,
                        interviewId: interview.id,
                        mediaUrl,
                        triggerRunId: runInfo.runId,
                        analysisJobId: runInfo.analysisJobId,
                        publicToken: runInfo.publicToken,
                }
        },
})
