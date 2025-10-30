import { z } from "zod"

export const voiceModes = ["discovery", "postSales"] as const
export type VoiceMode = (typeof voiceModes)[number]

export const discoveryFieldSchema = z.object({
        icpCompany: z.string().optional(),
        icpRole: z.string().optional(),
        productDescription: z.string().optional(),
        keyFeatures: z.array(z.string()).default([]),
        problems: z.array(z.string()).default([]),
        unknowns: z.array(z.string()).default([]),
})

export type DiscoveryFormData = z.infer<typeof discoveryFieldSchema>

export const postSalesFieldSchema = z.object({
        companyName: z.string().optional(),
        participants: z
                .array(
                        z.object({
                                name: z.string(),
                                title: z.string().optional(),
                        })
                )
                .default([]),
        topics: z.array(z.string()).default([]),
        needs: z.array(z.string()).default([]),
        openQuestions: z.array(z.string()).default([]),
        objections: z.array(z.string()).default([]),
        nextSteps: z.array(z.string()).default([]),
        opportunityStage: z.string().optional(),
        opportunitySize: z.string().optional(),
})

export type PostSalesFormData = z.infer<typeof postSalesFieldSchema>

export function createEmptyDiscoveryData(): DiscoveryFormData {
        return {
                icpCompany: undefined,
                icpRole: undefined,
                productDescription: undefined,
                keyFeatures: [],
                problems: [],
                unknowns: [],
        }
}

export function createEmptyPostSalesData(): PostSalesFormData {
        return {
                companyName: undefined,
                participants: [],
                topics: [],
                needs: [],
                openQuestions: [],
                objections: [],
                nextSteps: [],
                opportunityStage: undefined,
                opportunitySize: undefined,
        }
}

const defaultDiscoveryData = createEmptyDiscoveryData()
const defaultPostSalesData = createEmptyPostSalesData()

export interface VoiceConversationEntry {
        role: "user" | "assistant"
        text: string
        timestamp: string
        audioUrl?: string
}

export const voiceConversationEntrySchema = z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string(),
        timestamp: z.string(),
        audioUrl: z.string().optional(),
})

export const voiceSessionSnapshotSchema = z.object({
        sessionId: z.string(),
        interviewId: z.string().optional(),
        mode: z.enum(voiceModes),
        discoveryData: discoveryFieldSchema.default(defaultDiscoveryData),
        postSalesData: postSalesFieldSchema.default(defaultPostSalesData),
        conversation: z.array(voiceConversationEntrySchema).default([]),
        completed: z.boolean().default(false),
})

export type VoiceSessionSnapshot = z.infer<typeof voiceSessionSnapshotSchema>

export const voiceSessionUpdateSchema = voiceSessionSnapshotSchema.extend({
        discoveryData: discoveryFieldSchema.default(defaultDiscoveryData),
        postSalesData: postSalesFieldSchema.default(defaultPostSalesData),
})

export const voiceSessionRequestSchema = z.object({
        sessionId: z.string().optional(),
        interviewId: z.string().optional(),
        mode: z.enum(voiceModes),
})

const voiceAgentTurnSchema = z.object({
        type: z.literal("turn"),
        role: z.enum(["user", "assistant"]),
        text: z.string(),
        timestamp: z.string().optional(),
        audioUrl: z.string().optional(),
})

const voiceAgentFormUpdateSchema = z.union([
        z.object({
                type: z.literal("form_update"),
                mode: z.literal("discovery"),
                data: discoveryFieldSchema.partial(),
        }),
        z.object({
                type: z.literal("form_update"),
                mode: z.literal("postSales"),
                data: postSalesFieldSchema.partial(),
        }),
])

const voiceAgentSummarySchema = z.object({
        type: z.literal("summary"),
        completed: z.boolean().optional(),
        missingFields: z.array(z.string()).optional(),
})

const voiceAgentSessionSchema = z.object({
        type: z.literal("session"),
        interviewId: z.string().optional(),
})

const voiceAgentErrorSchema = z.object({
        type: z.literal("error"),
        message: z.string(),
})

export const voiceAgentMessageSchema = z.union([
        voiceAgentTurnSchema,
        voiceAgentFormUpdateSchema,
        voiceAgentSummarySchema,
        voiceAgentSessionSchema,
        voiceAgentErrorSchema,
])

export type VoiceAgentMessage = z.infer<typeof voiceAgentMessageSchema>
