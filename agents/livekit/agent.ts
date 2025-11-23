import "dotenv/config"
import { fileURLToPath } from "node:url"
import consola from "consola"
import {
        type JobContext,
        type JobProcess,
        WorkerOptions,
        cli,
        defineAgent,
        metrics,
        voice,
} from "@livekit/agents"
import * as livekit from "@livekit/agents-plugin-livekit"
import * as deepgram from "@livekit/agents-plugin-deepgram"
import * as openai from "@livekit/agents-plugin-openai"
import * as silero from "@livekit/agents-plugin-silero"

const resolvedLivekitUrl = process.env.LIVEKIT_SFU_URL

class Assistant extends voice.Agent {
        constructor() {
                super({
                        instructions:
                                "You are a helpful voice AI assistant for Upsight project status. Keep replies concise, friendly, and actionable.",
                })
        }
}

export default defineAgent({
        prewarm: async (proc: JobProcess) => {
                if (!proc.userData.vad) {
                        proc.userData.vad = await silero.VAD.load()
                }
        },
        entry: async (ctx: JobContext) => {
                if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !resolvedLivekitUrl) {
                        consola.error("LiveKit environment missing", {
                                hasKey: Boolean(process.env.LIVEKIT_API_KEY),
                                hasSecret: Boolean(process.env.LIVEKIT_API_SECRET),
                                hasUrl: Boolean(resolvedLivekitUrl),
                        })
                        throw new Error("Missing LiveKit configuration")
                }

                const session = new voice.AgentSession({
                        stt: new deepgram.STT({ model: "nova-2-general", language: "en" }),
                        llm: new openai.LLM({ model: "gpt-4o-mini" }),
                        tts: new deepgram.TTS({ model: "aura-2-delia-en" }),
                        turnDetection: new livekit.turnDetector.MultilingualModel(),
                        vad: ctx.proc.userData.vad as silero.VAD,
                })

                const usageCollector = new metrics.UsageCollector()
                session.on(voice.AgentSessionEventTypes.MetricsCollected, (event) => {
                        metrics.logMetrics(event.metrics)
                        usageCollector.collect(event.metrics)
                })

                ctx.addShutdownCallback(() => {
                        const summary = usageCollector.getSummary()
                        consola.info("LiveKit agent usage", summary)
                })

                ctx.room.on("disconnected", () => {
                        consola.warn("Room disconnected; shutting down agent")
                })

                ctx.room.on("participantDisconnected", (participant) => {
                        consola.warn("Participant disconnected", { participant: participant.identity })
                })

                process.on("unhandledRejection", (reason, promise) => {
                        consola.error("Unhandled rejection in LiveKit agent", { reason, promise })
                })

                process.on("uncaughtException", (error) => {
                        consola.error("Uncaught exception in LiveKit agent", error)
                })

                try {
                        await session.start({
                                agent: new Assistant(),
                                room: ctx.room,
                        })

                        consola.info("LiveKit agent session started")

                        await ctx.connect()
                        consola.success("Connected to LiveKit room")

                        await session.generateReply({
                                instructions:
                                        "Greet the user by saying: 'Hi, would you like me to analyze a live conversation, recording, or create a customer discovery guide with prompts?'",
                        })

                        consola.start("Agent ready and listening")
                } catch (error) {
                        consola.error("Error during LiveKit agent initialization", error)
                        try {
                                await ctx.room.disconnect()
                        } catch (disconnectError) {
                                consola.error("Error disconnecting room", disconnectError)
                        }
                        throw error
                }
        },
})

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }))
