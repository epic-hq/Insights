import { z } from "zod"
import type { SupabaseClient } from "~/types"
import type {
        DiscoveryFormData,
        PostSalesFormData,
        VoiceConversationEntry,
        VoiceMode,
} from "../voice-types"

const voiceMetadataSchema = z
        .object({
                sessions: z.record(z.string(), z.any()).default({}),
        })
        .default({ sessions: {} })

interface SaveVoiceSessionArgs {
        supabase: SupabaseClient
        accountId: string
        projectId: string
        sessionId: string
        interviewId?: string
        mode: VoiceMode
        discoveryData: DiscoveryFormData
        postSalesData: PostSalesFormData
        conversation: VoiceConversationEntry[]
        completed: boolean
}

export async function saveVoiceSessionSnapshot({
        supabase,
        accountId,
        projectId,
        sessionId,
        interviewId,
        mode,
        discoveryData,
        postSalesData,
        conversation,
        completed,
}: SaveVoiceSessionArgs) {
        async function createInterviewSnapshot() {
                const { data, error } = await supabase
                        .from("interviews")
                        .insert({
                                account_id: accountId,
                                project_id: projectId,
                                title:
                                        mode === "postSales"
                                                ? "Project Voice: Post-Sales Call"
                                                : "Project Voice: Discovery",
                                status: "draft",
                                transcript_formatted: {
                                        voice_chat: {
                                                sessions: {
                                                        [sessionId]: {
                                                                mode,
                                                                discoveryData,
                                                                postSalesData,
                                                                conversation,
                                                                completed,
                                                                updatedAt: new Date().toISOString(),
                                                        },
                                                },
                                        },
                                },
                        })
                        .select("id")
                        .single()

                if (error) {
                        throw new Error(`Failed to create interview snapshot: ${error.message}`)
                }
                return data.id as string
        }

        async function updateInterviewSnapshot(targetId: string) {
                const { data: existing, error: fetchError } = await supabase
                        .from("interviews")
                        .select("id, transcript_formatted")
                        .eq("id", targetId)
                        .single()

                if (fetchError) {
                        throw new Error(`Failed to load interview snapshot: ${fetchError.message}`)
                }

                const baseFormatted = (existing?.transcript_formatted as Record<string, any>) ?? {}
                const voiceChatSection = voiceMetadataSchema.parse(baseFormatted.voice_chat ?? {})
                voiceChatSection.sessions[sessionId] = {
                        mode,
                        discoveryData,
                        postSalesData,
                        conversation,
                        completed,
                        updatedAt: new Date().toISOString(),
                }

                const { error: updateError } = await supabase
                        .from("interviews")
                        .update({ transcript_formatted: { ...baseFormatted, voice_chat: voiceChatSection } })
                        .eq("id", targetId)

                if (updateError) {
                        throw new Error(`Failed to update interview snapshot: ${updateError.message}`)
                }

                return targetId
        }

        if (!interviewId) {
                return createInterviewSnapshot()
        }

        return updateInterviewSnapshot(interviewId)
}

export function computeMissingDiscoveryFields(data: DiscoveryFormData) {
        const missing: string[] = []
        if (!data.icpCompany?.trim()) missing.push("Ideal customer company")
        if (!data.icpRole?.trim()) missing.push("Primary buyer or user role")
        if (!data.productDescription?.trim()) missing.push("Product description")
        if ((data.keyFeatures || []).length === 0) missing.push("Key features")
        if ((data.problems || []).length === 0) missing.push("Customer problems")
        if ((data.unknowns || []).length === 0) missing.push("Open unknowns to validate")
        return missing
}

export function computeMissingPostSalesFields(data: PostSalesFormData) {
        const missing: string[] = []
        if (!data.companyName?.trim()) missing.push("Company name")
        if ((data.participants || []).length === 0) missing.push("Participants and titles")
        if ((data.topics || []).length === 0) missing.push("Topics discussed")
        if ((data.needs || []).length === 0) missing.push("Customer needs")
        if ((data.openQuestions || []).length === 0) missing.push("Open questions")
        if ((data.objections || []).length === 0) missing.push("Objections or risks")
        if ((data.nextSteps || []).length === 0) missing.push("Next steps")
        if (!data.opportunityStage?.trim()) missing.push("Opportunity stage")
        if (!data.opportunitySize?.trim()) missing.push("Opportunity size")
        return missing
}
