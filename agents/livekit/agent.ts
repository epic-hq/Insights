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
import { createMastraTools } from './mastra-integration'

const resolvedLivekitUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_SFU_URL

class Assistant extends voice.Agent {
	public projectId: string | null = null
	public accountId: string | null = null
	public userId: string | null = null

	constructor(tools: any = {}) {
		const hasTools = Object.keys(tools).length > 0
		const toolList = Object.keys(tools).join(", ")

		consola.info("Assistant constructor", {
			hasTools,
			toolCount: Object.keys(tools).length,
			toolNames: toolList
		})

		super({
			instructions: hasTools
				? `You are a knowledgeable researcher for Upsight.
				Keep replies short, casual, and actionable. Do not overexplain. Talk to me like a friend using 10th grade english.
				use an island intonation.

				You have access to these tools to help answer questions about the project:
				- getProjectStatus: Get project status, insights, themes, evidence, personas
				- getPeopleDetails: Get information about people and contacts
				- manageOpportunities: View and manage sales opportunities
				- manageTasks: View and manage tasks

				When the user asks about the project, people, opportunities, or tasks, USE THESE TOOLS to get accurate information.
				Don't say you don't know - use the tools to find the answer.`
				: `You are a knowledgeable researcher for Upsight.
				Keep replies short, casual, and actionable. Do not overexplain. Talk to me like a friend using 10th grade english.
				use an island intonation.
				If you dont know something, just say oh sorry i dont know. `,
			tools,
		})

		consola.info("Assistant created with tools", { toolNames: toolList })
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
			// Get room name from job context (available immediately, before connecting)
			const roomName = (ctx as any).job?.room?.name || ctx.room.name

			consola.info("LiveKit agent entry called", {
				roomName,
				jobRoomName: (ctx as any).job?.room?.name,
				ctxRoomName: ctx.room.name,
				hasJob: !!(ctx as any).job,
				hasJobRoom: !!(ctx as any).job?.room,
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

			// Extract project context from room name BEFORE creating assistant
			let assistant: Assistant
			try {
				// Parse format: p_{projectId}_a_{accountId}_u_{userId}_{uuid}
				const match = roomName?.match(/^p_([^_]+)_a_([^_]+)_u_([^_]+)_/)
				if (match) {
					const projectId = match[1]
					const accountId = match[2]
					const userId = match[3]

					consola.success("✓ Project context extracted from room name", {
						roomName,
						projectId,
						accountId,
						userId,
					})

					// Create Mastra tools with project context
					const mastraTools = createMastraTools({
						projectId,
						accountId,
						userId,
					})

					consola.info("Created Mastra tools", {
						toolCount: Object.keys(mastraTools).length,
						toolNames: Object.keys(mastraTools),
						toolStructure: Object.keys(mastraTools).map(name => ({
							name,
							hasDescription: !!mastraTools[name].description,
							hasParameters: !!mastraTools[name].parameters,
							hasExecute: typeof mastraTools[name].execute === 'function'
						}))
					})

					// Create Assistant WITH tools
					assistant = new Assistant(mastraTools)
					assistant.projectId = projectId
					assistant.accountId = accountId
					assistant.userId = userId

					consola.success("✓ Assistant created with Mastra tools and project context")
				} else {
					consola.warn("Room name does not contain project context, creating assistant without tools", { roomName })
					assistant = new Assistant()
				}
			} catch (error) {
				consola.error("Error parsing room name for context", error)
				assistant = new Assistant()
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

			// Start the session with the configured assistant
			consola.info("Starting agent session with assistant...")
			await session.start({
				agent: assistant,
				room: ctx.room,
			})
			consola.success("LiveKit agent session started with tools")

			// Connect to room AFTER session is started
			consola.info("Connecting to room...")
			await ctx.connect()
			consola.success("Connected to LiveKit room", { roomName: ctx.room.name })

			consola.info("Generating initial greeting...")
			consola.info("Session state before greeting", {
				hasAgent: !!session.agent,
				agentHasTools: session.agent && Object.keys((session.agent as any)._tools || {}).length > 0,
			})

			await session.generateReply({
				instructions:
					"Greet the user by saying: 'Hi, what can I help you with?'",
			})

			consola.success("Agent ready and listening")
			consola.info("Assistant tools after session start", {
				toolCount: Object.keys((assistant as any)._tools || {}).length,
				toolNames: Object.keys((assistant as any)._tools || {}),
			})
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
