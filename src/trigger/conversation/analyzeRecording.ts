import { schemaTask } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"

import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { updateConversationAnalysis } from "~/lib/conversation-analyses/db.server"
import { conversationContextSchema, generateConversationAnalysis } from "~/utils/conversationAnalysis.server"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"

const payloadSchema = z.object({
        analysisId: z.string().uuid(),
        context: conversationContextSchema.optional(),
})

/**
 * Trigger.dev task that owns the end-to-end processing of a standalone conversation recording:
 *  - downloads/transcribes the audio using AssemblyAI
 *  - runs the BAML analysis to extract questions, goals, and recommendations
 *  - persists the structured output back to Supabase for the UI to display
 */
export const analyzeConversationRecordingTask = schemaTask({
        id: "conversation.analyze-recording",
        schema: payloadSchema,
        retry: workflowRetryConfig,
        run: async ({ analysisId, context }) => {
                const client = createSupabaseAdminClient()

                const { data, error } = await client
                        .from("conversation_analyses")
                        .select("recording_url")
                        .eq("id", analysisId)
                        .single()

                if (error || !data) {
                        consola.error("Conversation analysis row not found", { analysisId, error })
                        throw error ?? new Error("Conversation analysis not found")
                }

                await updateConversationAnalysis({
                        db: client,
                        id: analysisId,
                        payload: { status: "processing", error_message: null },
                })

                try {
                        const transcriptPayload = await transcribeAudioFromUrl(data.recording_url)
                        const sanitized = safeSanitizeTranscriptPayload(transcriptPayload)
                        const transcriptText = String(sanitized.full_transcript ?? "").trim()

                        if (!transcriptText) {
                                throw new Error("Transcript was empty after transcription")
                        }

                        const analysis = await generateConversationAnalysis({
                                transcript: transcriptText,
                                context: context ?? undefined,
                        })

                        await updateConversationAnalysis({
                                db: client,
                                id: analysisId,
                                payload: {
                                        transcript: transcriptText,
                                        summary: analysis.overview,
                                        detected_questions: analysis.questions,
                                        participant_goals: analysis.participant_goals,
                                        key_takeaways: analysis.key_takeaways,
                                        open_questions: analysis.open_questions,
                                        recommendations: analysis.recommended_next_steps,
                                        duration_seconds: Number(sanitized.audio_duration ?? 0) || null,
                                        status: "completed",
                                        error_message: null,
                                },
                        })

                        consola.log("Conversation analysis completed", { analysisId })
                        return { analysisId }
                } catch (taskError) {
                        const message = taskError instanceof Error ? taskError.message : String(taskError)
                        consola.error("Conversation analysis failed", { analysisId, message })
                        await updateConversationAnalysis({
                                db: client,
                                id: analysisId,
                                payload: { status: "failed", error_message: message },
                        })
                        throw taskError
                }
        },
})
