import type { DiscoveryFormData, PostSalesFormData, VoiceMode } from "~/features/project-chat/voice-types"

function formatList(values: string[] | undefined) {
        if (!values || values.length === 0) return "(none)"
        return values.map((value, index) => `${index + 1}. ${value}`).join("\n")
}

function renderDiscoveryState(state: DiscoveryFormData) {
        return [
                `Ideal customer company: ${state.icpCompany ?? "(missing)"}`,
                `Primary buyer role: ${state.icpRole ?? "(missing)"}`,
                `Product description: ${state.productDescription ?? "(missing)"}`,
                `Key features:\n${formatList(state.keyFeatures)}`,
                `Customer problems:\n${formatList(state.problems)}`,
                `Unknowns to validate:\n${formatList(state.unknowns)}`,
        ].join("\n")
}

function renderPostSalesState(state: PostSalesFormData) {
        const participants = state.participants?.map((entry) => `- ${entry.name}${entry.title ? ` (${entry.title})` : ""}`) ?? []
        return [
                `Company: ${state.companyName ?? "(missing)"}`,
                `Participants:\n${participants.length > 0 ? participants.join("\n") : "(missing)"}`,
                `Topics:\n${formatList(state.topics)}`,
                `Customer needs:\n${formatList(state.needs)}`,
                `Open questions:\n${formatList(state.openQuestions)}`,
                `Objections / risks:\n${formatList(state.objections)}`,
                `Next steps:\n${formatList(state.nextSteps)}`,
                `Opportunity stage: ${state.opportunityStage ?? "(missing)"}`,
                `Opportunity size: ${state.opportunitySize ?? "(missing)"}`,
        ].join("\n")
}

interface PromptOptions {
        mode: VoiceMode
        discovery: DiscoveryFormData
        postSales: PostSalesFormData
        missing: string[]
}

export function buildConversationPrompt({ mode, discovery, postSales, missing }: PromptOptions) {
        const sharedIntro = `You are a professional discovery voice agent helping a founder capture ${mode === "postSales" ? "post-sales call notes" : "product discovery context"}. Speak in short, friendly sentences.`

        const required =
                mode === "postSales"
                        ? `Collect the post-sales call data: company name, meeting participants and titles, topics discussed, customer needs/requirements, open questions, objections/risks, next steps, opportunity stage, and opportunity size.`
                        : `Collect the discovery intake data: the ideal customer profile (company and primary role), product or service description, key features, customer problems, and unknowns to validate.`

        const summary =
                mode === "postSales"
                        ? renderPostSalesState(postSales)
                        : renderDiscoveryState(discovery)

        const missingSummary =
                missing.length > 0
                        ? `Missing fields (${missing.length}): ${missing.join(", ")}. Ask concise follow-ups to complete them.`
                        : "All required data captured. Thank the user and wrap up gracefully after confirming they are done."

        return [sharedIntro, required, "Current structured data:", summary, missingSummary, "Never invent details. Confirm uncertain answers."].join(
                "\n\n",
        )
}
