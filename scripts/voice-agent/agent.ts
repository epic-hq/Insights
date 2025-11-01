import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { AccessToken } from "livekit-server-sdk"
import consola from "consola"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { z } from "zod"
import {
        type AgentContext,
        AgentRuntime,
        defineAgent,
        type JobMetadata,
} from "@livekit/agents"
import { createAssemblyAITranscriber } from "@livekit/agents-plugin-assemblyai"
import { createElevenLabsSynthesizer } from "@livekit/agents-plugin-elevenlabs"
import { createOpenAIRealtimeModel } from "@livekit/agents-plugin-openai"
import { TimeoutTurnDetector } from "@livekit/agents-plugin-turn-detection"
import { buildConversationPrompt } from "./prompts"
import { StructuredUpdate, VoiceSessionState } from "./session-state"
import {
        discoveryFieldSchema,
        postSalesFieldSchema,
        voiceAgentClientInitSchema,
        type VoiceAgentMessage,
        type VoiceMode,
} from "~/features/project-chat/voice-types"

const textEncoder = new TextEncoder()

interface EnvConfig {
        livekitUrl: string
        livekitApiKey: string
        livekitApiSecret: string
        assemblyApiKey: string
        elevenApiKey: string
        elevenVoiceId: string
        openaiModel: string
        openaiApiKey: string
        controlSecret: string
        port: number
        turnSilence: number
}

function readNumber(value: string | undefined, fallback: number) {
        if (!value) return fallback
        const parsed = Number.parseFloat(value)
        if (Number.isNaN(parsed)) return fallback
        return parsed
}

function requireEnv(key: string, fallback?: string) {
        const value = process.env[key] ?? fallback
        if (!value) {
                throw new Error(`Missing required env var ${key}`)
        }
        return value
}

const env: EnvConfig = {
        livekitUrl: requireEnv("LIVEKIT_URL"),
        livekitApiKey: requireEnv("LIVEKIT_API_KEY"),
        livekitApiSecret: requireEnv("LIVEKIT_API_SECRET"),
        assemblyApiKey: requireEnv("ASSEMBLYAI_API_KEY", process.env.AAI_API_KEY),
        elevenApiKey: requireEnv("ELEVEN_API_KEY"),
        elevenVoiceId: requireEnv("ELEVEN_VOICE_ID", "eleven_monolingual_v1"),
        openaiModel: requireEnv("VOICE_AGENT_MODEL", "gpt-4o-mini"),
        openaiApiKey: requireEnv("OPENAI_API_KEY"),
        controlSecret: requireEnv("VOICE_AGENT_CONTROL_SECRET"),
        port: Number.parseInt(process.env.VOICE_AGENT_PORT ?? "4070", 10),
        turnSilence: readNumber(process.env.VOICE_AGENT_TURN_SILENCE_SECONDS, 1.1),
}

const structuredUpdateSchema = z.object({
        response: z.string().describe("Natural language response to speak to the user"),
        followup: z.string().optional(),
        discovery: discoveryFieldSchema.partial().optional(),
        postSales: postSalesFieldSchema.partial().optional(),
        completed: z.boolean().optional(),
})

type StructuredObject = z.infer<typeof structuredUpdateSchema>

interface VoiceAgentMetadata extends JobMetadata {
        sessionId: string
        accountId: string
        projectId: string
        userId: string
        mode: VoiceMode
        interviewId?: string
}

async function publish(room: AgentContext["room"], message: VoiceAgentMessage) {
        await room.localParticipant.publishData(textEncoder.encode(JSON.stringify(message)))
}

async function handleUserTurn({
        context,
        pipeline,
        transcript,
        state,
}: {
        context: AgentContext
        pipeline: Awaited<ReturnType<AgentContext["createPipeline"]>>
        transcript: string
        state: VoiceSessionState
}) {
        state.appendTurn("user", transcript)
        await publish(context.room, {
                type: "turn",
                role: "user",
                text: transcript,
                timestamp: new Date().toISOString(),
        })

        const { object } = await generateObject({
                model: openai.responses({ model: env.openaiModel }),
                schema: structuredUpdateSchema,
                prompt: [
                        "You are filling structured CRM fields during a live voice conversation.",
                        `Conversation history: ${state.conversation.map((entry) => `${entry.role}: ${entry.text}`).join("\n")}`,
                        `Latest user turn: ${transcript}`,
                        `Mode: ${state.mode}`,
                        state.mode === "postSales"
                                ? "Required post-sales fields: company name, meeting participants (names + titles), topics discussed, customer needs/requirements, open questions, objections/risks, next steps, opportunity stage, opportunity size."
                                : "Required discovery fields: ICP company, ICP role, product description, key features, problems, unknowns to validate.",
                        `Current structured data: ${JSON.stringify({ discovery: state.discovery, postSales: state.postSales })}`,
                        "Respond with updated structured data and a short spoken reply.",
                ].join("\n\n"),
        })

        if (!object) return

        const structured = object as StructuredObject

        const update: StructuredUpdate = {
                discovery: structured.discovery,
                postSales: structured.postSales,
                completed: structured.completed,
        }
        state.integrate(update)

        if (structured.discovery && state.mode === "discovery") {
                await publish(context.room, { type: "form_update", mode: "discovery", data: structured.discovery })
        }
        if (structured.postSales && state.mode === "postSales") {
                await publish(context.room, { type: "form_update", mode: "postSales", data: structured.postSales })
        }

        const missing = state.missingFields()
        await publish(context.room, {
                type: "summary",
                completed: state.completed,
                missingFields: missing,
        })

        const reply = structured.followup?.trim().length ? structured.followup : structured.response
        if (reply) {
                state.appendTurn("assistant", reply)
                await publish(context.room, {
                        type: "turn",
                        role: "assistant",
                        text: reply,
                        timestamp: new Date().toISOString(),
                })
                await pipeline.respond(reply)
        }

        const prompt = buildConversationPrompt({
                mode: state.mode,
                discovery: state.discovery,
                postSales: state.postSales,
                missing,
        })
        await pipeline.setInstructions(prompt)
}

const projectVoiceAgent = defineAgent({
        name: "project-chat-voice",
        async entry(context) {
                const metadata = (context.job?.metadata ?? {}) as Partial<VoiceAgentMetadata>
                const mode = metadata.mode ?? "discovery"
                const state = new VoiceSessionState(mode)

                const pipeline = await context.createPipeline({
                        llm: createOpenAIRealtimeModel({
                                apiKey: env.openaiApiKey,
                                model: env.openaiModel,
                        }),
                        synthesizer: createElevenLabsSynthesizer({
                                apiKey: env.elevenApiKey,
                                voiceId: env.elevenVoiceId,
                        }),
                        transcriber: createAssemblyAITranscriber({
                                apiKey: env.assemblyApiKey,
                                model: "slam-1",
                        }),
                        turnDetector: new TimeoutTurnDetector({
                                type: "voice_activity",
                                minVoiceDurationSeconds: 0.4,
                                minSilenceDurationSeconds: env.turnSilence,
                                activationThreshold: 0.6,
                        }),
                        instructions: buildConversationPrompt({
                                mode,
                                discovery: state.discovery,
                                postSales: state.postSales,
                                missing: state.missingFields(),
                        }),
                })

                context.room.on("data", (payload: Uint8Array) => {
                        try {
                                const message = voiceAgentClientInitSchema.parse(JSON.parse(new TextDecoder().decode(payload)))
                                if (message.type === "session_init") {
                                        publish(context.room, { type: "session", interviewId: metadata.interviewId ?? message.interviewId })
                                }
                        } catch (error) {
                                consola.warn("[voice-agent] failed to parse client data", error)
                        }
                })

                pipeline.on("user_transcription", async (event: { text: string; isFinal: boolean }) => {
                        if (!event.isFinal || !event.text.trim()) return
                        await handleUserTurn({ context, pipeline, transcript: event.text, state }).catch((error) => {
                                consola.error("[voice-agent] failed to process user turn", error)
                        })
                })

                pipeline.on("agent_response", (event: { text: string }) => {
                        if (!event.text.trim()) return
                        state.appendTurn("assistant", event.text)
                        void publish(context.room, {
                                type: "turn",
                                role: "assistant",
                                text: event.text,
                                timestamp: new Date().toISOString(),
                        })
                })

                await pipeline.start()
        },
})

class VoiceAgentServer {
        private readonly runtime: AgentRuntime
        private readonly sessions = new Map<string, Promise<void>>()

        constructor() {
                this.runtime = new AgentRuntime({
                        url: env.livekitUrl,
                        apiKey: env.livekitApiKey,
                        apiSecret: env.livekitApiSecret,
                        agents: [projectVoiceAgent],
                })
        }

        async start() {
                await this.runtime.start()
        }

        async ensureSession(payload: VoiceAgentMetadata & { roomName: string }) {
                if (this.sessions.has(payload.sessionId)) return this.sessions.get(payload.sessionId)

                const token = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
                        identity: `agent-${payload.sessionId}`,
                        ttl: 60 * 60,
                })
                token.addGrant({
                        roomJoin: true,
                        room: payload.roomName,
                        canPublish: true,
                        canSubscribe: true,
                        canPublishData: true,
                })

                const job = this.runtime.createJob({
                        agent: projectVoiceAgent,
                        roomName: payload.roomName,
                        token: await token.toJwt(),
                        metadata: payload,
                })

                this.sessions.set(payload.sessionId, job)
                job.finally(() => this.sessions.delete(payload.sessionId))
                return job
        }
}

async function main() {
        const server = new VoiceAgentServer()
        await server.start()

        const app = new Hono()
        app.get("/health", (c) => c.json({ ok: true }))
        app.post("/sessions", async (c) => {
                const auth = c.req.header("authorization") ?? ""
                if (!auth.startsWith("Bearer ") || auth.slice(7) !== env.controlSecret) {
                        return c.json({ error: "unauthorized" }, 401)
                }

                const body = await c.req.json<VoiceAgentMetadata & { roomName?: string }>()
                const roomName = body.roomName
                if (!roomName) {
                        return c.json({ error: "roomName required" }, 400)
                }

                await server.ensureSession({ ...body, roomName })
                return c.json({ ok: true })
        })

        serve({
                fetch: app.fetch,
                port: env.port,
        })

        consola.info(`Voice agent listening on :${env.port}`)
}

void main()
