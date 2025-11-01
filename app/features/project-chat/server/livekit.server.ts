import { AccessToken } from "livekit-server-sdk"
import { getServerEnv } from "~/env.server"
import type { VoiceMode } from "../voice-types"

interface LivekitCredentials {
        url: string
        apiKey: string
        apiSecret: string
}

function getCredentials(): LivekitCredentials {
        const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = getServerEnv()
        if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
                throw new Error("LiveKit credentials are not configured")
        }

        return {
                url: LIVEKIT_URL,
                apiKey: LIVEKIT_API_KEY,
                apiSecret: LIVEKIT_API_SECRET,
        }
}

export interface CreateVoiceSessionTokenOptions {
        sessionId: string
        projectId: string
        accountId: string
        userId: string
        mode: VoiceMode
        interviewId?: string
        metadata?: Record<string, unknown>
}

export interface VoiceSessionTokenPayload {
        roomName: string
        url: string
        token: string
        identity: string
}

export async function createVoiceSessionToken({
        sessionId,
        projectId,
        accountId,
        userId,
        mode,
        interviewId,
        metadata,
}: CreateVoiceSessionTokenOptions): Promise<VoiceSessionTokenPayload> {
        const creds = getCredentials()
        const roomName = `voice-${projectId}-${sessionId}`
        const identity = `user-${userId}`

        const token = new AccessToken(creds.apiKey, creds.apiSecret, {
                identity,
                ttl: 60 * 60, // 1 hour sessions
        })

        token.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
        })

        token.metadata = JSON.stringify({
                sessionId,
                projectId,
                accountId,
                userId,
                mode,
                interviewId,
                ...(metadata ?? {}),
        })

        return {
                roomName,
                url: creds.url,
                token: await token.toJwt(),
                identity,
        }
}
