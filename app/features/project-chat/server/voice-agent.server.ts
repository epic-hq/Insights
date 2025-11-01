import consola from "consola"
import { getServerEnv } from "~/env.server"
import type { VoiceMode } from "../voice-types"

interface StartVoiceAgentSessionArgs {
        sessionId: string
        roomName: string
        accountId: string
        projectId: string
        userId: string
        mode: VoiceMode
        interviewId?: string
}

function normalizeUrl(value: string) {
        return value.endsWith("/") ? value.slice(0, -1) : value
}

export async function startVoiceAgentSession({
        sessionId,
        roomName,
        accountId,
        projectId,
        userId,
        mode,
        interviewId,
}: StartVoiceAgentSessionArgs) {
        const {
                VOICE_AGENT_CONTROL_URL,
                VOICE_AGENT_CONTROL_SECRET,
        } = getServerEnv()

        if (!VOICE_AGENT_CONTROL_URL || !VOICE_AGENT_CONTROL_SECRET) {
                consola.debug("[voice-agent] control endpoint disabled")
                return
        }

        const url = `${normalizeUrl(VOICE_AGENT_CONTROL_URL)}/sessions`
        try {
                const response = await fetch(url, {
                        method: "POST",
                        headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${VOICE_AGENT_CONTROL_SECRET}`,
                        },
                        body: JSON.stringify({
                                sessionId,
                                roomName,
                                accountId,
                                projectId,
                                userId,
                                mode,
                                interviewId,
                        }),
                })

                if (!response.ok) {
                        const detail = await response.text().catch(() => response.statusText)
                        consola.warn("[voice-agent] failed to start session", {
                                sessionId,
                                status: response.status,
                                detail,
                        })
                }
        } catch (error) {
                consola.error("[voice-agent] error contacting control endpoint", error)
        }
}
