import { randomUUID } from "node:crypto"
import consola from "consola"
import { AccessToken } from "livekit-server-sdk"
import type { ActionFunctionArgs } from "react-router"
import { getServerEnv } from "~/env.server"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SFU_URL, LIVEKIT_TTL_SECONDS } = getServerEnv()

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method Not Allowed" }, { status: 405 })
	}

	const { user } = await getAuthenticatedUser(request)
	if (!user?.sub) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_SFU_URL) {
		consola.error("LiveKit token request missing configuration", {
			hasKey: Boolean(LIVEKIT_API_KEY),
			hasSecret: Boolean(LIVEKIT_API_SECRET),
			hasUrl: Boolean(LIVEKIT_SFU_URL),
		})
		return Response.json({ error: "LiveKit is not configured" }, { status: 500 })
	}

	let projectId: string | null = null
	let accountId: string | null = null
	try {
		const payload = (await request.json()) as {
			projectId?: string | null
			accountId?: string | null
		}
		projectId = payload.projectId ?? null
		accountId = payload.accountId ?? null
	} catch {
		projectId = null
		accountId = null
	}

	// Encode project context in room name for agent access
	const roomName =
		projectId && accountId
			? `p_${projectId}_a_${accountId}_u_${user.sub}_${randomUUID()}`
			: `u_${user.sub}_${randomUUID()}`
	const maxTtlSeconds = 600
	const ttlSeconds = Number.isFinite(Number(LIVEKIT_TTL_SECONDS))
		? Math.min(Number(LIVEKIT_TTL_SECONDS), maxTtlSeconds)
		: maxTtlSeconds

	const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
		identity: user.sub,
		ttl: ttlSeconds,
	})

	token.addGrant({
		room: roomName,
		roomJoin: true,
		canPublish: true,
		canSubscribe: true,
		canPublishData: true,
	})

	const serialized = await token.toJwt()

	consola.info("Issued LiveKit access token", {
		roomName,
		userId: user.sub,
		projectId,
		accountId,
		hasProjectContext: !!(projectId && accountId),
		ttlSeconds,
	})

	return Response.json({
		token: serialized,
		url: LIVEKIT_SFU_URL,
		roomName,
		identity: user.sub,
	})
}
