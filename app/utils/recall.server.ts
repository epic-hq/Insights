import consola from "consola"
import { Webhook } from "svix"

export interface RecallConfig {
	apiKey: string
	region: string
	baseUrl: string
}

export interface CreateRecallBotParams {
	meetingUrl: string
	botName?: string
	recordingConfig?: Record<string, unknown>
	metadata?: Record<string, unknown>
}

export interface RecallBot {
	id: string
	status?: string | null
	meeting_url?: string
	bot_name?: string | null
	join_at?: string | null
	recording_config?: Record<string, unknown> | null
	[key: string]: unknown
}

export interface RecallWebhookVerificationResult {
	ok: boolean
	reason?: string
}

const DEFAULT_RECORDING_CONFIG = {
	transcript: {
		provider: {
			meeting_captions: {},
		},
	},
}

class RecallConfigError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "RecallConfigError"
	}
}

class RecallApiError extends Error {
	constructor(message: string, readonly status: number) {
		super(message)
		this.name = "RecallApiError"
	}
}

export function getRecallConfig(): RecallConfig | null {
	const apiKey = process.env.RECALLAI_API_KEY?.trim()
	const region = process.env.RECALLAI_REGION?.trim()

	if (!apiKey || !region) {
		return null
	}

	return {
		apiKey,
		region,
		baseUrl: `https://${region}.recall.ai/api/v1`,
	}
}

export function requireRecallConfig(): RecallConfig {
	const config = getRecallConfig()
	if (!config) {
		throw new RecallConfigError("Recall.ai API key or region is not configured")
	}
	return config
}

async function recallFetch<T>(path: string, init: RequestInit = {}, config = requireRecallConfig()): Promise<T> {
	const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: `Token ${config.apiKey}`,
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => response.statusText)
		throw new RecallApiError(errorText || response.statusText || "Recall.ai request failed", response.status)
	}

	return (await response.json()) as T
}

export async function createRecallBot({
	meetingUrl,
	botName,
	recordingConfig,
	metadata,
}: CreateRecallBotParams): Promise<RecallBot> {
	const payload = {
		meeting_url: meetingUrl,
		bot_name: botName ?? "Insights Meeting Notetaker",
		recording_config: recordingConfig ?? DEFAULT_RECORDING_CONFIG,
		metadata,
	}

	return await recallFetch<RecallBot>("/bot", {
		method: "POST",
		body: JSON.stringify(payload),
	})
}

export async function getRecallBot(botId: string): Promise<RecallBot> {
	if (!botId) {
		throw new RecallApiError("Recall bot id is required", 400)
	}
	return await recallFetch<RecallBot>(`/bot/${botId}`, { method: "GET" })
}

export function verifyRecallWebhook(headers: Headers, payload: string): RecallWebhookVerificationResult {
	const secret = process.env.RECALLAI_WEBHOOK_SECRET
	if (!secret) {
		consola.warn("Recall webhook secret not configured; skipping signature verification")
		return { ok: true, reason: "secret_not_configured" }
	}

	try {
		const webhook = new Webhook(secret)
		const headerPayload = {
			"svix-id": headers.get("svix-id") ?? "",
			"svix-timestamp": headers.get("svix-timestamp") ?? "",
			"svix-signature": headers.get("svix-signature") ?? "",
		}
		webhook.verify(payload, headerPayload)
		return { ok: true }
	} catch (error) {
		consola.error("Recall webhook verification failed:", error)
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "unknown_verification_error",
		}
	}
}

export function mapRecallStatusToJobStatus(status: string | null | undefined): "pending" | "in_progress" | "done" | "error" | "retry" {
	const normalized = status?.toLowerCase() ?? ""
	if (!normalized) return "pending"
	if (["queued", "pending", "created"].includes(normalized)) return "pending"
	if (["joining", "joined", "recording", "processing", "running", "in_meeting"].includes(normalized)) return "in_progress"
	if (["done", "completed", "complete", "finished"].includes(normalized)) return "done"
	if (["error", "failed", "cancelled", "canceled"].includes(normalized)) return "error"
	return "in_progress"
}

export type RecallJobStatus = ReturnType<typeof mapRecallStatusToJobStatus>
