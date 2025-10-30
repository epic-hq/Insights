import { randomUUID } from "node:crypto"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createVoiceSessionToken } from "~/features/project-chat/server/livekit.server"
import {
        computeMissingDiscoveryFields,
        computeMissingPostSalesFields,
        saveVoiceSessionSnapshot,
} from "~/features/project-chat/server/voice-session.server"
import {
        voiceSessionRequestSchema,
        voiceSessionUpdateSchema,
        type VoiceSessionSnapshot,
} from "~/features/project-chat/voice-types"
import { userContext } from "~/server/user-context"

function json(data: unknown, status = 200) {
        return new Response(JSON.stringify(data), {
                status,
                headers: { "Content-Type": "application/json" },
        })
}

export async function action({ request, context, params }: ActionFunctionArgs) {
        const ctx = context.get(userContext)
        const accountId = String(params.accountId || ctx?.account_id || "")
        const projectId = String(params.projectId || "")
        const userId = ctx?.claims?.sub

        if (!accountId || !projectId || !userId) {
                return json({ error: "Missing accountId, projectId, or user" }, 400)
        }

        if (request.method === "POST") {
                let payload
                try {
                        payload = voiceSessionRequestSchema.parse(await request.json())
                } catch (error) {
                        consola.error("[voice-turn] invalid request body", error)
                        return json({ error: "Invalid payload" }, 400)
                }

                const sessionId = payload.sessionId || randomUUID()

                try {
                        const tokenPayload = await createVoiceSessionToken({
                                sessionId,
                                projectId,
                                accountId,
                                userId,
                                mode: payload.mode,
                                interviewId: payload.interviewId,
                        })

                        return json({
                                sessionId,
                                interviewId: payload.interviewId,
                                roomName: tokenPayload.roomName,
                                url: tokenPayload.url,
                                token: tokenPayload.token,
                                identity: tokenPayload.identity,
                        })
                } catch (error) {
                        consola.error("[voice-turn] failed to create LiveKit token", error)
                        return json({ error: "LiveKit configuration error" }, 500)
                }
        }

        if (request.method === "PATCH") {
                let payload: VoiceSessionSnapshot
                try {
                        payload = voiceSessionUpdateSchema.parse(await request.json())
                } catch (error) {
                        consola.error("[voice-turn] invalid snapshot payload", error)
                        return json({ error: "Invalid payload" }, 400)
                }

                const missingFields =
                        payload.mode === "discovery"
                                ? computeMissingDiscoveryFields(payload.discoveryData)
                                : computeMissingPostSalesFields(payload.postSalesData)

                let interviewId = payload.interviewId
                try {
                        interviewId = await saveVoiceSessionSnapshot({
                                supabase: ctx.supabase,
                                accountId,
                                projectId,
                                sessionId: payload.sessionId,
                                interviewId,
                                mode: payload.mode,
                                discoveryData: payload.discoveryData,
                                postSalesData: payload.postSalesData,
                                conversation: payload.conversation,
                                completed: payload.completed,
                        })
                } catch (error) {
                        consola.error("[voice-turn] failed to persist session", error)
                }

                return json({
                        sessionId: payload.sessionId,
                        interviewId,
                        missingFields,
                        completed: payload.completed,
                })
        }

        return new Response("Method Not Allowed", { status: 405 })
}
