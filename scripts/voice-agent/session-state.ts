import {
        computeMissingDiscoveryFields,
        computeMissingPostSalesFields,
} from "~/features/project-chat/server/voice-session.server"
import {
        createEmptyDiscoveryData,
        createEmptyPostSalesData,
        discoveryFieldSchema,
        postSalesFieldSchema,
        type DiscoveryFormData,
        type PostSalesFormData,
        type VoiceMode,
} from "~/features/project-chat/voice-types"

export interface StructuredUpdate {
        discovery?: Partial<DiscoveryFormData>
        postSales?: Partial<PostSalesFormData>
        completed?: boolean
}

function mergeUnique(values: string[] | undefined, update: string[] | undefined) {
        const existing = new Set(values ?? [])
        for (const entry of update ?? []) {
                const trimmed = entry.trim()
                if (trimmed.length === 0) continue
                existing.add(trimmed)
        }
        return Array.from(existing)
}

function mergeParticipants(
        base: PostSalesFormData["participants"],
        update: PostSalesFormData["participants"],
) {
        const merged = [...(base ?? [])]
        for (const next of update ?? []) {
                const exists = merged.find(
                        (entry) => entry.name.toLowerCase() === next.name.toLowerCase() && entry.title === next.title,
                )
                if (!exists) merged.push(next)
        }
        return merged
}

export class VoiceSessionState {
        readonly mode: VoiceMode
        discovery: DiscoveryFormData
        postSales: PostSalesFormData
        conversation: { role: "user" | "assistant"; text: string }[] = []
        completed = false

        constructor(mode: VoiceMode) {
                this.mode = mode
                this.discovery = createEmptyDiscoveryData()
                this.postSales = createEmptyPostSalesData()
        }

        applyDiscovery(update: Partial<DiscoveryFormData>) {
        this.discovery = {
                ...this.discovery,
                ...discoveryFieldSchema.partial().parse(update),
                keyFeatures: mergeUnique(this.discovery.keyFeatures, update.keyFeatures),
                problems: mergeUnique(this.discovery.problems, update.problems),
                unknowns: mergeUnique(this.discovery.unknowns, update.unknowns),
        }
        }

        applyPostSales(update: Partial<PostSalesFormData>) {
        const parsed = postSalesFieldSchema.partial().parse(update)
        this.postSales = {
                ...this.postSales,
                ...parsed,
                participants: mergeParticipants(this.postSales.participants, parsed.participants ?? []),
                topics: mergeUnique(this.postSales.topics, parsed.topics),
                needs: mergeUnique(this.postSales.needs, parsed.needs),
                openQuestions: mergeUnique(this.postSales.openQuestions, parsed.openQuestions),
                objections: mergeUnique(this.postSales.objections, parsed.objections),
                nextSteps: mergeUnique(this.postSales.nextSteps, parsed.nextSteps),
        }
        }

        integrate(update: StructuredUpdate) {
                if (update.discovery) this.applyDiscovery(update.discovery)
                if (update.postSales) this.applyPostSales(update.postSales)
                if (typeof update.completed === "boolean") this.completed = update.completed
        }

        appendTurn(role: "user" | "assistant", text: string) {
                this.conversation.push({ role, text })
        }

        missingFields() {
                return this.mode === "postSales"
                        ? computeMissingPostSalesFields(this.postSales)
                        : computeMissingDiscoveryFields(this.discovery)
        }
}
