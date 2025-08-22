import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"
import { useFetcher, useLoaderData } from "react-router-dom"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Mic, Square, Users, MapPin } from "lucide-react"
import type { ExtractedEntity, WindowAnalysis } from "~/utils/lemur-analysis.server"
import { AssemblyAIStreaming } from "~/utils/assemblyai-streaming.server"
import { SlidingWindowManager } from "~/utils/lemur-analysis.server"
import { userContext } from "~/server/user-context"
import consola from "consola"

interface LiveTranscriptionData {
  accountId: string
  projectId: string
}

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext)
  const accountId = ctx.account_id
  
  return {
    accountId: params.accountId || accountId,
    projectId: params.projectId
  }
}

// Server-side session storage (should be moved to database/redis in production)
const activeSessions = new Map<string, {
  assemblyAI: AssemblyAIStreaming
  windowManager: SlidingWindowManager
  transcriptChunks: Array<{ text: string; isPartial: boolean; timestamp: number }>
  entities: ExtractedEntity[]
  windowAnalyses: WindowAnalysis[]
  accountId: string
  userId: string
}>()

export async function action({ request, context, params }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const accountId = ctx.account_id
  const userId = ctx.claims.sub
  
  const formData = await request.formData()
  const intent = formData.get("intent")
  const sessionId = formData.get("sessionId") as string
  
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return { success: false, message: "AssemblyAI API key not configured" }
  }
  
  if (intent === "start") {
    try {
      // Initialize AssemblyAI streaming session
      const assemblyAI = new AssemblyAIStreaming(apiKey, {
        sampleRate: 16000,
        encoding: "pcm_s16le"
      })
      
      const windowManager = new SlidingWindowManager(apiKey, 30, 5) // 30s windows with 5s overlap
      
      // Set up event handlers for real-time transcription
      const sessionData = {
        assemblyAI,
        windowManager,
        transcriptChunks: [] as Array<{ text: string; isPartial: boolean; timestamp: number }>,
        entities: [] as ExtractedEntity[],
        windowAnalyses: [] as WindowAnalysis[],
        accountId,
        userId
      }
      
      assemblyAI.on("partial_transcript", ({ text }: { text: string; confidence?: number; words?: any[] }) => {
        if (text) {
          sessionData.transcriptChunks.push({
            text,
            isPartial: true,
            timestamp: Date.now()
          })
        }
      })
      
      assemblyAI.on("final_transcript", async ({ text }: { text: string; confidence?: number; words?: any[] }) => {
        if (text) {
          const timestamp = Date.now()
          sessionData.transcriptChunks.push({
            text,
            isPartial: false,
            timestamp
          })
          
          // Process with LEMUR for entities and window analysis
          const analysis = await windowManager.addTranscriptChunk(text, timestamp, false)
          sessionData.entities.push(...analysis.entities)
          sessionData.windowAnalyses.push(...analysis.completedWindows)
        }
      })
      
      assemblyAI.on("error", ({ error }: { error: string }) => {
        consola.error("AssemblyAI streaming error:", error)
      })
      
      // Connect to AssemblyAI
      await assemblyAI.connect()
      
      // Store session
      activeSessions.set(sessionId, sessionData)
      
      return { success: true, message: "Recording started", sessionId }
    } catch (error) {
      consola.error("Failed to start AssemblyAI session:", error)
      return { success: false, message: `Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }
  
  if (intent === "audio") {
    const audioData = formData.get("audioData") as string
    
    const session = activeSessions.get(sessionId)
    if (!session) {
      return { success: false, message: "Session not found" }
    }
    
    // Verify session belongs to current user/account
    if (session.accountId !== accountId || session.userId !== userId) {
      return { success: false, message: "Unauthorized session access" }
    }
    
    try {
      // Convert base64 to buffer and send to AssemblyAI
      const audioBuffer = Buffer.from(audioData, 'base64')
      const sent = session.assemblyAI.sendAudio(audioBuffer)
      
      if (!sent) {
        return { success: false, message: "Failed to send audio data" }
      }
      
      return { success: true }
    } catch (error) {
      consola.error("Failed to process audio:", error)
      return { success: false, message: "Failed to process audio" }
    }
  }
  
  if (intent === "poll") {
    const session = activeSessions.get(sessionId)
    if (!session) {
      return { success: false, message: "Session not found" }
    }
    
    // Verify session belongs to current user/account
    if (session.accountId !== accountId || session.userId !== userId) {
      return { success: false, message: "Unauthorized session access" }
    }
    
    // Return latest transcription data
    const latestChunk = session.transcriptChunks[session.transcriptChunks.length - 1]
    const recentEntities = session.entities.slice(-10) // Last 10 entities
    const recentAnalyses = session.windowAnalyses.slice(-3) // Last 3 window analyses
    
    return {
      success: true,
      transcriptChunk: latestChunk,
      entities: recentEntities,
      windowAnalyses: recentAnalyses
    }
  }
  
  if (intent === "stop") {
    const session = activeSessions.get(sessionId)
    if (session) {
      // Verify session belongs to current user/account
      if (session.accountId !== accountId || session.userId !== userId) {
        return { success: false, message: "Unauthorized session access" }
      }
      
      try {
        await session.assemblyAI.terminate()
        activeSessions.delete(sessionId)
        return { success: true, message: "Recording stopped" }
      } catch (error) {
        consola.error("Failed to stop session:", error)
        return { success: false, message: "Failed to stop recording properly" }
      }
    }
    return { success: true, message: "Recording stopped" }
  }
  
  return { success: false, message: "Unknown action" }
}

interface LiveSession {
  status: "idle" | "recording"
  isRecording: boolean
  duration: number
  transcript: string
  entities: ExtractedEntity[]
  windowAnalyses: WindowAnalysis[]
}

interface TranscriptChunk {
  text: string
  isPartial: boolean
  timestamp: number
}

export default function LiveTranscriptionPage() {
  const loaderData = useLoaderData<LiveTranscriptionData>()
  const fetcher = useFetcher()

  // Session state
  const [session, setSession] = useState<LiveSession>({
    status: "idle",
    isRecording: false,
    duration: 0,
    transcript: "",
    entities: [],
    windowAnalyses: []
  })
  
  // Transcript chunks for real-time display
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([])

  // UI state
  const [errorMessage, setErrorMessage] = useState<string>("")
  
  // Refs
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Send audio data to backend
  const sendAudioToBackend = useCallback(async (audioData: ArrayBuffer) => {
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)))
    
    fetcher.submit(
      {
        intent: "audio",
        sessionId: sessionIdRef.current,
        audioData: base64Audio,
        timestamp: Date.now().toString()
      },
      { method: "post" }
    )
  }, [fetcher])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setSession(prev => ({ ...prev, status: "recording", isRecording: true }))
      setErrorMessage("")
      
      // Get microphone access with specific audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream
      
      // Set up audio context for processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })
      audioContextRef.current = audioContext
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      let audioBuffer: Int16Array[] = []
      let bufferDuration = 0
      const SEND_INTERVAL_MS = 250 // Send every 250ms
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0)
        
        // Convert Float32 to Int16 for AssemblyAI
        const int16Buffer = new Int16Array(inputBuffer.length)
        for (let i = 0; i < inputBuffer.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputBuffer[i]))
          int16Buffer[i] = sample < 0 ? sample * 32768 : sample * 32767
        }
        
        audioBuffer.push(int16Buffer)
        bufferDuration += (inputBuffer.length / audioContext.sampleRate) * 1000
        
        // Send buffered audio when we have enough
        if (bufferDuration >= SEND_INTERVAL_MS && audioBuffer.length > 0) {
          const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
          const combinedBuffer = new Int16Array(totalLength)
          let offset = 0
          
          for (const chunk of audioBuffer) {
            combinedBuffer.set(chunk, offset)
            offset += chunk.length
          }
          
          sendAudioToBackend(combinedBuffer.buffer)
          audioBuffer = []
          bufferDuration = 0
        }
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      // Start session via API
      fetcher.submit(
        {
          intent: "start",
          sessionId: sessionIdRef.current,
          accountId: loaderData.accountId,
          projectId: loaderData.projectId
        },
        { method: "post" }
      )
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setSession(prev => ({ ...prev, duration: prev.duration + 1 }))
      }, 1000)
      
      // Start polling for transcription updates
      startPolling()

    } catch (error) {
      console.error("Failed to start recording:", error)
      setSession(prev => ({ ...prev, status: "idle", isRecording: false }))
      setErrorMessage(error instanceof Error ? error.message : "Failed to start recording")
    }
  }, [fetcher, loaderData, sendAudioToBackend])

  // Poll for transcription updates
  const startPolling = useCallback(() => {
    const pollInterval = setInterval(async () => {
      if (!session.isRecording) {
        clearInterval(pollInterval)
        return
      }
      
      fetcher.submit(
        {
          intent: "poll",
          sessionId: sessionIdRef.current
        },
        { method: "post" }
      )
    }, 1000) // Poll every second
  }, [session.isRecording, fetcher])
  
  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.data?.transcriptChunk) {
      const chunk = fetcher.data.transcriptChunk
      setTranscriptChunks(prev => {
        const updated = [...prev]
        if (chunk.isPartial && updated.length > 0) {
          // Replace last partial chunk
          updated[updated.length - 1] = chunk
        } else {
          // Add new chunk
          updated.push(chunk)
        }
        return updated
      })
    }
    
    if (fetcher.data?.entities) {
      setSession(prev => ({ ...prev, entities: fetcher.data.entities }))
    }
    
    if (fetcher.data?.windowAnalyses) {
      setSession(prev => ({ ...prev, windowAnalyses: fetcher.data.windowAnalyses }))
    }
  }, [fetcher.data])

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      setSession(prev => ({ ...prev, status: "idle", isRecording: false }))
      
      // Stop audio processing
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
        })
        streamRef.current = null
      }
      
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
      
      // Stop session via API
      fetcher.submit(
        {
          intent: "stop",
          sessionId: sessionIdRef.current
        },
        { method: "post" }
      )
      
    } catch (error) {
      console.error("Failed to stop recording:", error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to stop recording")
    }
  }, [fetcher])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Transcription</h1>
          <p className="text-muted-foreground">
            Project: {loaderData.projectId} • Account: {loaderData.accountId}
          </p>
        </div>
      </div>

      {/* Main Recording Interface */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Recording Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Recording Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  session.isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                }`} />
                <span className="font-medium">
                  {session.isRecording ? 'Recording...' : 'Ready to record'}
                </span>
              </div>
              
              {session.isRecording && (
                <div className="text-sm font-mono">
                  {formatDuration(session.duration)}
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-3">
              {!session.isRecording ? (
                <Button 
                  onClick={startRecording}
                  className="flex items-center gap-2"
                  disabled={fetcher.state !== "idle"}
                >
                  <Mic className="w-4 h-4" />
                  Start Recording
                </Button>
              ) : (
                <Button 
                  onClick={stopRecording}
                  variant="destructive"
                  className="flex items-center gap-2"
                  disabled={fetcher.state !== "idle"}
                >
                  <Square className="w-4 h-4" />
                  Stop Recording
                </Button>
              )}
            </div>

            {/* Fetcher Status */}
            {fetcher.state !== "idle" && (
              <div className="text-sm text-muted-foreground">
                {fetcher.state === "submitting" && "Submitting..."}
                {fetcher.state === "loading" && "Processing..."}
              </div>
            )}

            {/* Fetcher Response */}
            {fetcher.data?.message && (
              <div className={`p-3 rounded-md ${
                fetcher.data.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm ${
                  fetcher.data.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {fetcher.data.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Live Transcription Display */}
        {session.isRecording && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transcript */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Live Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {transcriptChunks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Listening for speech...</p>
                  ) : (
                    transcriptChunks.map((chunk, idx) => (
                      <div key={`chunk-${chunk.timestamp}-${idx}`} className={`p-2 rounded ${
                        chunk.isPartial ? 'bg-yellow-50 border-l-2 border-yellow-400' : 'bg-gray-50'
                      }`}>
                        <p className="text-sm">{chunk.text}</p>
                        {chunk.isPartial && (
                          <Badge variant="outline" className="mt-1 text-xs">partial</Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Entities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Extracted Entities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {session.entities.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No entities detected yet</p>
                  ) : (
                    session.entities.map((entity, idx) => (
                      <div key={`entity-${entity.text}-${idx}`} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        {entity.type === 'person' && <Users className="w-4 h-4" />}
                        {entity.type === 'location' && <MapPin className="w-4 h-4" />}
                        <div>
                          <Badge variant="secondary" className="text-xs">
                            {entity.type}
                          </Badge>
                          <p className="text-sm font-medium">{entity.text}</p>
                          {entity.confidence && (
                            <p className="text-xs text-muted-foreground">
                              {Math.round(entity.confidence * 100)}% confidence
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Window Analyses */}
        {session.windowAnalyses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Windows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {session.windowAnalyses.slice(-3).map((analysis, idx) => (
                  <div key={`analysis-${analysis.timestamp}-${idx}`} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{analysis.sentiment}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Window {idx + 1}
                      </span>
                    </div>
                    <p className="text-sm">{analysis.summary}</p>
                    {analysis.key_insights.length > 0 && (
                      <div className="mt-2">
                        <ul className="text-xs space-y-1">
                          {analysis.key_insights.map((insight, insightIdx) => (
                            <li key={`insight-${insightIdx}-${insight.slice(0, 20)}`} className="flex items-start gap-1">
                              <span className="text-muted-foreground">•</span>
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
