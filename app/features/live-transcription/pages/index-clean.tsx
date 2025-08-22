import { useState, useEffect, useCallback, useRef } from "react"
import { useFetcher, useLoaderData } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Mic, MicOff, Square, Play, Save, Users, MapPin, Lightbulb } from "lucide-react"
import consola from "consola"
import type { ExtractedEntity, WindowAnalysis } from "~/utils/lemur-analysis.server"

interface LiveTranscriptionData {
  accountId: string
  projectId: string
}

export async function loader({ params }: { params: { accountId: string; projectId: string } }) {
  return {
    accountId: params.accountId,
    projectId: params.projectId
  }
}

interface LiveSession {
  status: "idle" | "starting" | "recording" | "stopping"
  isRecording: boolean
  duration: number
  sessionId: string
  transcript: string
  entities: ExtractedEntity[]
  windowAnalyses: WindowAnalysis[]
}

interface TranscriptChunk {
  id: string
  text: string
  isPartial: boolean
  timestamp: number
  entities?: ExtractedEntity[]
}

interface LiveConfig {
  projectId: string
  windowSizeSeconds: number
  overlapSeconds: number
  customInstructions: string
}

export default function LiveTranscriptionPage() {
  const loaderData = useLoaderData<LiveTranscriptionData>()
  const fetcher = useFetcher()

  // Session state
  const [session, setSession] = useState<LiveSession>({
    status: "idle",
    isRecording: false,
    duration: 0,
    sessionId: "",
    transcript: "",
    entities: [],
    windowAnalyses: []
  })

  // Configuration state
  const [config, setConfig] = useState<LiveConfig>({
    projectId: loaderData.projectId || "default",
    windowSizeSeconds: 30,
    overlapSeconds: 5,
    customInstructions: ""
  })

  // Real-time transcript chunks
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([])
  const [realtimeEntities, setRealtimeEntities] = useState<ExtractedEntity[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "recording" | "error">("disconnected")
  const [errorMessage, setErrorMessage] = useState<string>("")

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Send audio data to backend
  const sendAudioToBackend = useCallback(async (audioBuffers: Int16Array[]) => {
    if (!session.sessionId || session.status !== "recording") return

    try {
      // Convert Int16Array to base64
      const combinedLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
      const combinedBuffer = new Int16Array(combinedLength)
      let offset = 0
      
      for (const buffer of audioBuffers) {
        combinedBuffer.set(buffer, offset)
        offset += buffer.length
      }

      const uint8Array = new Uint8Array(combinedBuffer.buffer)
      const base64Audio = btoa(String.fromCharCode(...uint8Array))

      await fetch("/api/live-transcription-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "audio",
          sessionId: session.sessionId,
          audioData: base64Audio
        })
      })
    } catch (error) {
      consola.error("Failed to send audio:", error)
    }
  }, [session.sessionId, session.status])

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcriptChunks])

  // Start transcription session
  const startSession = useCallback(async () => {
    try {
      setSession(prev => ({ ...prev, status: "starting" }))
      setErrorMessage("")
      setConnectionStatus("connecting")

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Start session via API
      const response = await fetch("/api/live-transcription-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "start",
          sessionId,
          accountId: loaderData.accountId,
          projectId: config.projectId,
          windowSizeSeconds: config.windowSizeSeconds,
          overlapSeconds: config.overlapSeconds,
          customInstructions: config.customInstructions
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`)
      }

      // Set up audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })
      
      streamRef.current = stream
      
      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      
      let audioBuffer: Int16Array[] = []
      let bufferDuration = 0
      const SEND_INTERVAL_MS = 100 // Send every 100ms
      
      processor.onaudioprocess = (event) => {
        if (session.status !== "recording") return
        
        const inputBuffer = event.inputBuffer.getChannelData(0)
        
        // Convert float32 to int16
        const int16Buffer = new Int16Array(inputBuffer.length)
        for (let i = 0; i < inputBuffer.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputBuffer[i]))
          int16Buffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        }
        
        audioBuffer.push(int16Buffer)
        bufferDuration += (inputBuffer.length / audioContext.sampleRate) * 1000
        
        // Send buffered audio when we have enough
        if (bufferDuration >= SEND_INTERVAL_MS && audioBuffer.length > 0) {
          sendAudioToBackend(audioBuffer)
          audioBuffer = []
          bufferDuration = 0
        }
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)

      // Start real-time transcript streaming
      startTranscriptStream(sessionId)

      setSession(prev => ({
        ...prev,
        status: "recording",
        isRecording: true,
        sessionId
      }))
      
      setConnectionStatus("recording")

    } catch (error) {
      consola.error("Failed to start recording:", error)
      setSession(prev => ({ ...prev, status: "idle", isRecording: false }))
      setConnectionStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Failed to start recording")
    }
  }, [config, loaderData.accountId, sendAudioToBackend])

  // Set up real-time transcript streaming via Server-Sent Events
  const startTranscriptStream = useCallback((sessionId: string) => {
    const eventSource = new EventSource(`/api/live-transcription-clean/stream?sessionId=${sessionId}`)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'transcript') {
          const chunk: TranscriptChunk = {
            id: data.id || `chunk_${Date.now()}`,
            text: data.text,
            isPartial: data.isPartial,
            timestamp: data.timestamp,
            entities: data.entities
          }
          
          setTranscriptChunks(prev => {
            if (data.isPartial) {
              // Replace last partial or add new
              const withoutPartials = prev.filter(c => !c.isPartial)
              return [...withoutPartials, chunk]
            }
            // Add final transcript
            const withoutPartials = prev.filter(c => !c.isPartial)
            return [...withoutPartials, chunk]
          })
          
          if (data.entities) {
            setRealtimeEntities(prev => [...prev, ...data.entities])
          }
        }
        
        if (data.type === 'analysis') {
          setSession(prev => ({
            ...prev,
            windowAnalyses: [...prev.windowAnalyses, data.analysis]
          }))
        }
      } catch (error) {
        consola.error('Failed to parse SSE data:', error)
      }
    }
    
    eventSource.onerror = () => {
      consola.error('SSE connection error')
      eventSource.close()
      setConnectionStatus("error")
    }
    
    // Store for cleanup
    ;(window as any).transcriptionStream = eventSource
  }, [])

  // Stop transcription session
  const stopSession = useCallback(async (saveAsInterview = false) => {
    try {
      setSession(prev => ({ ...prev, status: "stopping" }))

      // Stop audio recording
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      // Stop session via API
      await fetch("/api/live-transcription-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "stop",
          sessionId: session.sessionId,
          saveAsInterview
        })
      })

      // Clean up streaming
      if ((window as any).transcriptionStream) {
        (window as any).transcriptionStream.close()
        ;(window as any).transcriptionStream = null
      }

      setSession(prev => ({
        ...prev,
        status: "idle",
        isRecording: false,
        sessionId: ""
      }))
      
      setConnectionStatus("disconnected")

    } catch (error) {
      consola.error("Failed to stop session:", error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to stop session")
    }
  }, [session.sessionId])

  // Format duration helper
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Transcription</h1>
          <p className="text-muted-foreground">Real-time audio transcription with entity extraction</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === "recording" ? 'bg-red-500 animate-pulse' :
              connectionStatus === "connected" ? 'bg-green-500' :
              connectionStatus === "connecting" ? 'bg-yellow-500 animate-pulse' :
              connectionStatus === "error" ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-sm text-muted-foreground">
              {connectionStatus === "recording" ? 'Recording' :
               connectionStatus === "connected" ? 'Connected' :
               connectionStatus === "connecting" ? 'Connecting...' :
               connectionStatus === "error" ? 'Error' : 'Disconnected'}
            </span>
          </div>

          {session.status === "recording" && (
            <div className="text-sm text-muted-foreground">
              Duration: {formatDuration(session.duration)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Controls & Transcript */}
        <div className="lg:col-span-2 space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Recording Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {session.status === "idle" && (
                  <Button onClick={startSession} className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Start Session
                  </Button>
                )}

                {session.status === "starting" && (
                  <Button disabled className="flex items-center gap-2">
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Starting...
                  </Button>
                )}

                {session.status === "recording" && (
                  <>
                    <Button onClick={() => stopSession(false)} variant="destructive" className="flex items-center gap-2">
                      <Square className="w-4 h-4" />
                      Stop
                    </Button>
                    <Button onClick={() => stopSession(true)} className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save as Interview
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Transcript */}
          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transcriptChunks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Start recording to see live transcription...
                  </p>
                ) : (
                  transcriptChunks.map((chunk) => (
                    <div key={chunk.id} className={`p-3 rounded-lg ${
                      chunk.isPartial ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : 'bg-green-50 border-l-4 border-l-green-400'
                    }`}>
                      <div className="text-sm">
                        {chunk.text}
                        {chunk.isPartial && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Partial
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Tabs defaultValue="entities" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="entities" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-4 h-4" />
                    Real-time Entities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {realtimeEntities.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No entities detected yet...</p>
                    ) : (
                      realtimeEntities.map((entity) => (
                        <div key={`${entity.type}-${entity.value}-${entity.timestamp}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{entity.value}</div>
                            <div className="text-xs text-muted-foreground">{entity.type}</div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {entity.confidence ? `${Math.round(entity.confidence * 100)}%` : 'N/A'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="w-4 h-4" />
                    Window Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {session.windowAnalyses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No analysis available yet...</p>
                    ) : (
                      session.windowAnalyses.map((analysis) => (
                        <Card key={`analysis-${analysis.windowStart}-${analysis.windowEnd}`} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">
                                Window {Math.floor(analysis.windowStart / 1000)}s - {Math.floor(analysis.windowEnd / 1000)}s
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {analysis.summary}
                              </div>
                              {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-xs font-medium">Key Points:</div>
                                  <ul className="text-xs text-muted-foreground space-y-1">
                                    {analysis.keyPoints.map((point, idx) => (
                                      <li key={idx} className="flex items-start gap-1">
                                        <span>•</span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
