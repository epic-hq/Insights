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

const resolvedLivekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_SFU_URL

class Assistant extends voice.Agent {
	constructor() {
		super({
			instructions:
				`You are a knowledgeable researcher for Upsight.
				Keep replies short, casual, and actionable. Do not overexplain. Talk to me like a friend using 10th grade english.
				use an island intonation.
				If you dont know something, just say oh sorry i dont know. `,
		})
	}
}

export default defineAgent({
	prewarm: async (proc: JobProcess) => {
		try {
			if (!proc.userData.vad) {
				consola.info("Loading Silero VAD for voice activity detection...")
				proc.userData.vad = await silero.VAD.load()
				consola.success("Silero VAD loaded successfully")
			}
		} catch (error) {
			consola.error("Failed to load Silero VAD", error)
			throw error
		}
	},
	entry: async (ctx: JobContext) => {
		try {
			consola.info("LiveKit agent entry called", {
				roomName: ctx.room.name,
				hasApiKey: Boolean(process.env.LIVEKIT_API_KEY),
				hasApiSecret: Boolean(process.env.LIVEKIT_API_SECRET),
				hasUrl: Boolean(resolvedLivekitUrl),
				hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
			})

			if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !resolvedLivekitUrl) {
				consola.error("LiveKit environment missing", {
					hasKey: Boolean(process.env.LIVEKIT_API_KEY),
					hasSecret: Boolean(process.env.LIVEKIT_API_SECRET),
					hasUrl: Boolean(resolvedLivekitUrl),
				})
				throw new Error("Missing LiveKit configuration")
			}

			consola.info("Creating agent session...")
			const session = new voice.AgentSession({
				stt: new deepgram.STT({ model: "nova-2-general", language: "en" }),
				llm: new openai.LLM({ model: "gpt-4o-mini" }),
				tts: new deepgram.TTS({ model: "aura-2-delia-en" }),
				turnDetection: new livekit.turnDetector.MultilingualModel(),
				vad: ctx.proc.userData.vad as typeof silero.VAD,
			})
			consola.success("Agent session created with Deepgram STT/TTS, OpenAI LLM, and Silero VAD")

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

			consola.info("Starting agent session...")
			await session.start({
				agent: new Assistant(),
				room: ctx.room,
			})
			consola.success("LiveKit agent session started")

			consola.info("Connecting to room...")
			await ctx.connect()
			consola.success("Connected to LiveKit room", { roomName: ctx.room.name })

			consola.info("Generating initial greeting...")
			await session.generateReply({
				instructions:
					"Greet the user by saying: 'Hi, would you like me to analyze a live conversation, recording, or create a customer discovery guide with prompts?'",
			})

			consola.success("Agent ready and listening")
		} catch (error) {
			consola.error("FATAL ERROR in agent entry:", {
				error,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
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
