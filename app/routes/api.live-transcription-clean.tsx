import { consola } from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser, createSupabaseAdminClient } from "~/lib/supabase/server"
import type { ExtractedEntity, WindowAnalysis } from "~/utils/lemur-analysis.server"
import { SlidingWindowManager } from "~/utils/lemur-analysis.server"
import { AssemblyAIStreaming } from "~/utils/assemblyai-streaming.server"
import type { InterviewInsert } from "~/types"

// Clean session management - no global state
interface LiveSession {
  id: string
  userId: string
  accountId: string
  projectId?: string
  startTime: number
  lastActivity: number
  status: "active" | "stopping" | "stopped"
  customInstructions?: string
  entities: ExtractedEntity[]
  windowAnalyses: WindowAnalysis[]
  transcript: string
  duration: number
}

interface SessionData {
  session: LiveSession
  streaming: AssemblyAIStreaming
  windowManager: SlidingWindowManager
  transcriptChunks: Array<{
    id: string
    text: string
    isPartial: boolean
    timestamp: number
    entities?: ExtractedEntity[]
  }>
}

// In-memory session store - clean singleton pattern
class SessionStore {
  private sessions = new Map<string, SessionData>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.startCleanup()
  }

  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId)
  }

  set(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data)
  }

  delete(sessionId: string): boolean {
    const data = this.sessions.get(sessionId)
    if (data) {
      try {
        data.streaming.terminate()
      } catch (error) {
        consola.warn("Error terminating session:", error)
      }
    }
    return this.sessions.delete(sessionId)
  }

  updateActivity(sessionId: string): void {
    const data = this.sessions.get(sessionId)
    if (data) {
      data.session.lastActivity = Date.now()
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const timeout = 30 * 60 * 1000 // 30 minutes

      for (const [sessionId, data] of this.sessions) {
        if (now - data.session.lastActivity > timeout) {
          consola.info(`Cleaning up inactive session: ${sessionId}`)
          this.delete(sessionId)
        }
      }
    }, 5 * 60 * 1000) // Check every 5 minutes
  }
}

const sessionStore = new SessionStore()

// Unified loader - handles session status queries
export async function loader({ request }: LoaderFunctionArgs) {
  const userContext = await getUserContext(request)
  if (!userContext) {
    throw new Response("Unauthorized", { status: 401 })
  }

  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId")

  // Handle Server-Sent Events streaming
  if (url.pathname.endsWith('/stream')) {
    if (!sessionId) {
      return new Response("Session ID required", { status: 400 })
    }

    const session = sessionStore.get(sessionId)
    if (!session || session.session.userId !== userContext.user.id) {
      return new Response("Session not found", { status: 404 })
    }

    const stream = new ReadableStream({
      start(controller) {
        // Set up event listener for real-time updates
        const eventHandler = (data: any) => {
          const sseData = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(sseData))
        }

        // Store handler for cleanup
        session.session.eventHandler = eventHandler

        // Send initial connection message
        eventHandler({ type: 'connected', sessionId })

        // Keep connection alive with periodic heartbeat
        const heartbeat = setInterval(() => {
          eventHandler({ type: 'heartbeat', timestamp: Date.now() })
        }, 30000)

        // Cleanup on close
        const cleanup = () => {
          clearInterval(heartbeat)
          if (session.session.eventHandler === eventHandler) {
            delete session.session.eventHandler
          }
        }

        // Handle client disconnect
        request.signal?.addEventListener('abort', cleanup)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
  }

  // Regular polling endpoint
  if (!sessionId) {
    return Response.json({ error: "Session ID required" }, { status: 400 })
  }

  const sessionData = sessionStore.get(sessionId)
  if (!sessionData) {
    return Response.json({ error: "Session not found" }, { status: 404 })
  }

  // Verify user owns this session
  if (sessionData.session.userId !== userContext.user.id) {
    throw new Response("Unauthorized", { status: 403 })
  }

  return Response.json({
    session: {
      ...sessionData.session,
      transcriptChunks: sessionData.transcriptChunks
    },
    configuration: sessionData.windowManager.getConfiguration()
  })
}

// Unified action - handles all operations
export async function action({ request }: ActionFunctionArgs) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") || ""

  // Handle different operation types based on content
  if (contentType.includes("application/json")) {
    const body = await request.json()
    const { operation } = body

    switch (operation) {
      case "start":
        return handleStartSession(body, user)
      case "stop":
        return handleStopSession(body, user)
      case "update":
        return handleUpdateSession(body, user)
      case "audio":
        return handleAudioChunk(body, user)
      default:
        return Response.json({ error: "Invalid operation" }, { status: 400 })
    }
  }

  return Response.json({ error: "Invalid request format" }, { status: 400 })
}

async function handleStartSession(body: any, user: { sub: string }) {
  const {
    sessionId,
    accountId,
    projectId,
    customInstructions,
    windowSizeSeconds = 30,
    overlapSeconds = 10
  } = body

  if (!sessionId || !accountId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Check if session already exists
  if (sessionStore.get(sessionId)) {
    return Response.json({ error: "Session already exists" }, { status: 409 })
  }

  try {
    // Create session object
    const session: LiveSession = {
      id: sessionId,
      userId: user.sub,
      accountId,
      projectId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      status: "active",
      customInstructions,
      entities: [],
      windowAnalyses: [],
      transcript: "",
      duration: 0
    }

    // Initialize window manager
    const windowManager = new SlidingWindowManager(windowSizeSeconds, overlapSeconds)

    // Initialize AssemblyAI streaming
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      return Response.json({ 
        error: "AssemblyAI API key not configured. Please add ASSEMBLYAI_API_KEY to your .env file to enable live transcription." 
      }, { status: 500 })
    }
    
    const streaming = new AssemblyAIStreaming(apiKey, {
      sampleRate: 16000,
      encoding: "pcm_s16le"
    })

    // Set up event handlers
    streaming.on("session_begins", (data) => {
      consola.log("AssemblyAI session started:", data)
    })

    streaming.on("transcript", async (data) => {
      await handleTranscriptUpdate(sessionId, data.text, data.message_type === "PartialTranscript", Date.now())
    })

    streaming.on("error", (error) => {
      consola.error("AssemblyAI streaming error:", error)
    })

    streaming.on("session_terminated", (data) => {
      consola.log("AssemblyAI session terminated:", data)
    })

    // Connect to AssemblyAI
    await streaming.connect()

    // Store session data
    sessionStore.set(sessionId, {
      session,
      streaming,
      windowManager,
      transcriptChunks: []
    })

    consola.log("✅ Live transcription session started:", sessionId)

    return Response.json({
      success: true,
      sessionId,
      status: "active"
    })

  } catch (error) {
    consola.error("Failed to start session:", error)
    return Response.json(
      { error: "Failed to start transcription session" },
      { status: 500 }
    )
  }
}

async function handleAudioChunk(body: any, user: { sub: string }) {
  const { sessionId, audioData, timestamp } = body

  if (!sessionId || !audioData) {
    return Response.json({ error: "Missing sessionId or audioData" }, { status: 400 })
  }

  const sessionData = sessionStore.get(sessionId)
  if (!sessionData || sessionData.session.userId !== user.sub) {
    return Response.json({ error: "Session not found or unauthorized" }, { status: 404 })
  }

  try {
    // Update activity
    sessionStore.updateActivity(sessionId)

    // Decode base64 audio data
    const binaryString = atob(audioData)
    const audioBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i)
    }

    // Send to AssemblyAI
    sessionData.streaming.sendAudio(Buffer.from(audioBytes))

    return Response.json({ success: true })

  } catch (error) {
    consola.error("Failed to process audio chunk:", error)
    return Response.json({ error: "Failed to process audio" }, { status: 500 })
  }
}

async function handleTranscriptUpdate(
  sessionId: string,
  text: string,
  isPartial: boolean,
  timestamp: number
) {
  const sessionData = sessionStore.get(sessionId)
  if (!sessionData) return

  try {
    // Create transcript chunk
    const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const chunk = {
      id: chunkId,
      text,
      isPartial,
      timestamp
    }

    // Process with sliding window analysis
    const analysis = await sessionData.windowManager.addTranscriptChunk(text, timestamp, isPartial)

    // Add entities to chunk if found
    if (analysis.entities.length > 0) {
      (chunk as any).entities = analysis.entities
      sessionData.session.entities.push(...analysis.entities)
    }

    // Store transcript chunk
    sessionData.transcriptChunks.push(chunk)

    // Update session transcript
    if (!isPartial) {
      sessionData.session.transcript += (sessionData.session.transcript ? " " : "") + text
    }

    // Update with completed window analyses
    if (analysis.completedWindows.length > 0) {
      sessionData.session.windowAnalyses.push(...analysis.completedWindows)
    }

    // Update activity
    sessionStore.updateActivity(sessionId)

    consola.log(`📝 Transcript update for ${sessionId}: "${text}" (partial: ${isPartial})`)

  } catch (error) {
    consola.error("Failed to process transcript update:", error)
  }
}

async function handleUpdateSession(body: any, user: { sub: string }) {
  const { sessionId, windowSizeSeconds, overlapSeconds } = body

  const sessionData = sessionStore.get(sessionId)
  if (!sessionData || sessionData.session.userId !== user.sub) {
    return Response.json({ error: "Session not found or unauthorized" }, { status: 404 })
  }

  // Update window configuration
  if (windowSizeSeconds) {
    sessionData.windowManager.setWindowSize(windowSizeSeconds, overlapSeconds || 10)
  }

  return Response.json({
    success: true,
    configuration: sessionData.windowManager.getConfiguration()
  })
}

async function handleStopSession(body: any, user: { sub: string }) {
  const { sessionId, saveAsInterview = false } = body

  const sessionData = sessionStore.get(sessionId)
  if (!sessionData || sessionData.session.userId !== user.sub) {
    return Response.json({ error: "Session not found or unauthorized" }, { status: 404 })
  }

  try {
    // Terminate AssemblyAI streaming
    await sessionData.streaming.terminate()

    // Update session status
    sessionData.session.status = "stopped"
    sessionData.session.duration = Date.now() - sessionData.session.startTime

    let interviewId: string | null = null

    // Save as interview if requested
    if (saveAsInterview && sessionData.session.transcript.trim()) {
      const adminClient = createSupabaseAdminClient()

      const interviewData: InterviewInsert = {
        account_id: sessionData.session.accountId,
        project_id: sessionData.session.projectId || null,
        title: `Live Session ${new Date().toLocaleDateString()}`,
        transcript_formatted: sessionData.session.transcript,
        audio_duration: Math.round(sessionData.session.duration / 1000),
        processing_duration: 0,
        file_type: "live_session",
        original_filename: `live_session_${sessionId}`,
        analysis_data: {
          full_transcript: sessionData.session.transcript,
          confidence: 0.95,
          audio_duration: Math.round(sessionData.session.duration / 1000),
          processing_duration: 0,
          file_type: "live_session",
          original_filename: `live_session_${sessionId}`,
          entities: sessionData.session.entities as any,
          window_analyses: sessionData.session.windowAnalyses as any
        }
      }

      const { data: interview, error: interviewError } = await adminClient
        .from("interviews")
        .insert(interviewData)
        .select()
        .single()

      if (interviewError) {
        consola.error("Failed to save interview:", interviewError)
      } else {
        interviewId = interview.id
        consola.log("Saved live session as interview:", interviewId)
      }
    }

    // Remove from session store
    sessionStore.delete(sessionId)

    consola.log("✅ Live transcription session stopped:", sessionId)

    return Response.json({
      success: true,
      interviewId,
      duration: sessionData.session.duration,
      transcript: sessionData.session.transcript,
      entities: sessionData.session.entities,
      windowAnalyses: sessionData.session.windowAnalyses
    })

  } catch (error) {
    consola.error("Failed to stop session:", error)
    return Response.json(
      { error: "Failed to stop transcription session" },
      { status: 500 }
    )
  }
}
