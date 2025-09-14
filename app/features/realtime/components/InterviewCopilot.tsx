import consola from "consola"
import { Lightbulb, MessageSquare, Mic, MicOff, Pause, Play, Square, RotateCcw, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import MinimalQuestionView from "~/features/realtime/components/MinimalQuestionView"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { createClient } from "~/lib/supabase/client"
import { useNavigate } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import posthog from 'posthog-js'

interface InterviewCopilotProps {
	projectId: string
	interviewId?: string
}

interface AISuggestion {
	id: string
	type: "follow_up" | "probe_deeper" | "redirect" | "wrap_up"
	text: string
	confidence: number
	timestamp: Date
}

export function InterviewCopilot({ projectId, interviewId }: InterviewCopilotProps) {
	const [selectedQuestions, setSelectedQuestions] = useState<{ id: string; text: string }[]>([])
	const [isRecording, setIsRecording] = useState(false)
	// Store finalized turns with timing to support 15s replay
	const [turns, setTurns] = useState<{ transcript: string; start: number; end: number }[]>([])
	const [captions, setCaptions] = useState<string[]>([]) // kept for finalize consistency
	const [currentCaption, setCurrentCaption] = useState("")
	const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
	const [interviewNotes, setInterviewNotes] = useState("")
	const supabase = createClient()
  const navigate = useNavigate()
  const { accountId } = useCurrentProject()
  const basePath = `/a/${accountId}/${projectId}`

  // Realtime streaming state
  const [streamStatus, setStreamStatus] = useState<
    "idle" | "connecting" | "streaming" | "paused" | "stopped" | "error"
  >("idle")
  // Visible text for "Replay last 15s"
  const [replayText, setReplayText] = useState<string>("")
  const replayTimerRef = useRef<number | null>(null)
  const [assignedInterviewId, setAssignedInterviewId] = useState<string | undefined>(interviewId)
  const [isFinishing, setIsFinishing] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const bufferRef = useRef<Float32Array[]>([])
  const timerRef = useRef<number | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const recChunksRef = useRef<BlobPart[]>([])
  const insufficientRef = useRef(false)
  const firstSendRef = useRef(true)

  const TARGET_SAMPLE_RATE = 16000
  const CHUNK_MS = 100
  const MIN_OUT_MS = 60

  type TurnMsg = {
    type: "Turn"
    transcript: string
    end_of_turn: boolean
    turn_is_formatted: boolean
    words: { text: string; start: number; end: number; confidence: number; word_is_final: boolean }[]
  }
  // Track keys for final turns to avoid duplicates
  const finalKeysRef = useRef<string[]>([])

  // When route unmounts, ensure cleanup
  useEffect(() => {
    return () => {
      stopStreaming()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

	// Save interview notes to database (debounced)
	const saveInterviewNotes = useCallback(
		async (notes: string) => {
			if (!interviewId || !notes.trim()) return
			try {
				const { error } = await supabase
					.from("interviews")
					.update({ observations_and_notes: notes })
					.eq("id", interviewId)

				if (error) {
					consola.error("Error saving interview notes:", error)
				}
			} catch (error) {
				consola.error("Error saving interview notes:", error)
			}
		},
		[interviewId, supabase]
	)

	// Save AI suggestion as annotation
	const saveAISuggestionAsAnnotation = useCallback(
		async (suggestion: AISuggestion) => {
			if (!interviewId) return
			try {
				const { error } = await supabase.from("annotations").insert({
					entity_type: "interview",
					entity_id: interviewId,
					project_id: projectId,
					annotation_type: "ai_suggestion",
					content: suggestion.text,
					metadata: {
						suggestion_type: suggestion.type,
						confidence: suggestion.confidence,
						timestamp: suggestion.timestamp.toISOString(),
					},
					created_by_ai: true,
					ai_model: "copilot",
					status: "active",
					visibility: "team",
				})

				if (error) {
					consola.error("Error saving AI suggestion:", error)
				}
			} catch (error) {
				consola.error("Error saving AI suggestion:", error)
			}
		},
		[interviewId, projectId, supabase]
	)

	// Load existing interview notes
	useEffect(() => {
		const loadInterviewNotes = async () => {
			if (!interviewId) return
			try {
				const { data, error } = await supabase
					.from("interviews")
					.select("observations_and_notes")
					.eq("id", interviewId)
					.single()

				if (error) {
					consola.error("Error loading interview notes:", error)
					return
				}

				if (data?.observations_and_notes) {
					setInterviewNotes(data.observations_and_notes)
				}
			} catch (error) {
				consola.error("Error loading interview notes:", error)
			}
		}

		loadInterviewNotes()
	}, [interviewId, supabase])

	// Debounce notes saving
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (interviewNotes.trim()) {
				saveInterviewNotes(interviewNotes)
			}
		}, 1000) // Save after 1 second of inactivity

		return () => clearTimeout(timeoutId)
	}, [interviewNotes, saveInterviewNotes])

  // ========= Realtime streaming logic =========
  const startStreaming = useCallback(async () => {
    try {
      setStreamStatus("connecting")

      // Ensure interview ID exists; create if missing
      let useInterviewId = assignedInterviewId
      if (!useInterviewId) {
        const startRes = await fetch(`${basePath}/api/interviews/realtime-start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const startData = await startRes.json()
        if (!startRes.ok) throw new Error(startData?.error || "Failed to start interview")
        useInterviewId = startData.interviewId
        setAssignedInterviewId(useInterviewId)
      }

      // Connect to server WS proxy
      const scheme = window.location.protocol === "https:" ? "wss" : "ws"
      const url = `${scheme}://${window.location.host}/ws/realtime-transcribe`
      const ws = new WebSocket(url, ["binary"]) // we send binary PCM frames
      ws.binaryType = "arraybuffer"
      wsRef.current = ws

      ws.onopen = async () => {
        setStreamStatus("streaming")
        // Audio capture via AudioWorklet
        const ctx = new AudioContext({ sampleRate: 48000 })
        ctxRef.current = ctx
        await ctx.audioWorklet.addModule("/worklets/pcm-processor.js")
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
          video: false,
        })
        const src = ctx.createMediaStreamSource(stream)
        const node = new AudioWorkletNode(ctx, "pcm-processor")
        nodeRef.current = node
        src.connect(node)

        // Start in-browser recording for upload
        try {
          const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
          recRef.current = rec
          recChunksRef.current = []
          rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data) }
          rec.start(500)
        } catch {
          consola.warn("MediaRecorder unsupported; audio won't be saved")
        }

        node.port.onmessage = (e) => {
          bufferRef.current.push(e.data as Float32Array)
        }

        const sendChunk = () => {
          const minOutSamples = Math.ceil((TARGET_SAMPLE_RATE * MIN_OUT_MS) / 1000)
          const minInputSamples = Math.ceil((ctx.sampleRate * MIN_OUT_MS) / 1000)
          const available = bufferRef.current.reduce((acc, c) => acc + c.length, 0)
          if (available < minInputSamples) {
            insufficientRef.current = true
            return
          }
          const inputAim = Math.ceil((ctx.sampleRate * (firstSendRef.current ? CHUNK_MS * 2 : CHUNK_MS)) / 1000)
          let floats = drainForSamples(Math.max(minInputSamples, inputAim))
          if (!floats || floats.length === 0) return
          let pcm16 = downsampleTo16kPCM16(floats, ctx.sampleRate, TARGET_SAMPLE_RATE)
          if (!pcm16) return
          if (pcm16.length < minOutSamples) {
            insufficientRef.current = true
            return
          }
          insufficientRef.current = false
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pcm16.buffer)
            firstSendRef.current = false
          }
        }

        timerRef.current = window.setInterval(sendChunk, CHUNK_MS)
      }

      ws.onmessage = async (evt) => {
        try {
          let text: string | null = null
          if (typeof evt.data === "string") text = evt.data
          else if (evt.data instanceof Blob) text = await evt.data.text()
          else if (evt.data instanceof ArrayBuffer) text = new TextDecoder().decode(evt.data)
          if (!text) return
          const msg = JSON.parse(text) as { type: string }
          if ((msg as any).type === "Turn") {
            const t = msg as any as TurnMsg
            if (t.end_of_turn) {
              // Only keep final captions; de-dupe by timing window
              const key = computeTurnKey(t)
              setCaptions((prev) => {
                if (finalKeysRef.current.includes(key)) return prev
                finalKeysRef.current = [key, ...finalKeysRef.current.slice(0, 9)]
                return [t.transcript, ...prev.slice(0, 9)]
              })
              // Track turns with timestamps for replay
              if (t.words && t.words.length) {
                const start = t.words[0]?.start ?? 0
                const end = t.words[t.words.length - 1]?.end ?? 0
                setTurns((prev) => [{ transcript: t.transcript, start, end }, ...prev].slice(0, 100))
              }
              setCurrentCaption("")
            } else {
              // Keep draft transcript internally (not shown live) to support Replay
              setCurrentCaption(t.transcript)
            }
          } else if ((msg as any).type === "Begin") {
            setCaptions([])
            setTurns([])
            setCurrentCaption("")
          }
        } catch {
          // ignore non-JSON
        }
      }

      ws.onerror = () => {
        setStreamStatus("error")
        setIsRecording(false)
      }
      ws.onclose = () => {
        setStreamStatus("stopped")
        setIsRecording(false)
      }
    } catch (e) {
      consola.error("startStreaming error", e)
      setStreamStatus("error")
      setIsRecording(false)
      stopStreaming()
    }
  }, [assignedInterviewId, basePath])

  // Pause without finalizing; keeps WS alive if possible
  const pauseStreaming = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      nodeRef.current?.disconnect()
      ctxRef.current?.suspend?.()
      const rec = recRef.current
      if (rec && rec.state === "recording" && typeof rec.pause === "function") {
        try { rec.pause() } catch {}
      }
    } catch {}
    setStreamStatus("paused")
  }, [])

  // Resume after pause; reuse existing WS if open
  const resumeStreaming = useCallback(async () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setStreamStatus("streaming")
        const ctx = new AudioContext({ sampleRate: 48000 })
        ctxRef.current = ctx
        await ctx.audioWorklet.addModule("/worklets/pcm-processor.js")
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
          video: false,
        })
        const src = ctx.createMediaStreamSource(stream)
        const node = new AudioWorkletNode(ctx, "pcm-processor")
        nodeRef.current = node
        src.connect(node)

        try {
          const rec = recRef.current
          if (rec && rec.state === "paused" && typeof rec.resume === "function") {
            rec.resume()
          }
        } catch {}

        node.port.onmessage = (e) => {
          bufferRef.current.push(e.data as Float32Array)
        }

        const sendChunk = () => {
          const minOutSamples = Math.ceil((TARGET_SAMPLE_RATE * MIN_OUT_MS) / 1000)
          const minInputSamples = Math.ceil((ctx.sampleRate * MIN_OUT_MS) / 1000)
          const available = bufferRef.current.reduce((acc, c) => acc + c.length, 0)
          if (available < minInputSamples) {
            insufficientRef.current = true
            return
          }
          const inputAim = Math.ceil((ctx.sampleRate * (firstSendRef.current ? CHUNK_MS * 2 : CHUNK_MS)) / 1000)
          let floats = drainForSamples(Math.max(minInputSamples, inputAim))
          if (!floats || floats.length === 0) return
          let pcm16 = downsampleTo16kPCM16(floats, ctx.sampleRate, TARGET_SAMPLE_RATE)
          if (!pcm16) return
          if (pcm16.length < minOutSamples) {
            insufficientRef.current = true
            return
          }
          insufficientRef.current = false
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(pcm16.buffer)
            firstSendRef.current = false
          }
        }
        timerRef.current = window.setInterval(sendChunk, CHUNK_MS)
      } else {
        await startStreaming()
      }
    } catch (e) {
      consola.warn("resumeStreaming error", e)
    }
  }, [startStreaming])

  const stopStreaming = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
    }
    wsRef.current = null
    try {
      nodeRef.current?.disconnect()
      ctxRef.current?.close()
    } catch {}
    nodeRef.current = null
    ctxRef.current = null
    bufferRef.current = []
    setCurrentCaption("")
    setStreamStatus("stopped")

    // finalize recording and save transcript (captions joined)
    void (async () => {
      try {
        const rec = recRef.current
        if (rec && rec.state !== "inactive") {
          const stopped = new Promise<Blob>((resolve) => {
            rec.onstop = () => resolve(new Blob(recChunksRef.current, { type: "audio/webm" }))
          })
          rec.stop()
          const blob = await stopped
          let mediaUrl: string | undefined
          const id = assignedInterviewId
          if (blob.size > 0 && id) {
            const filename = `interviews/${projectId}/${id}-${Date.now()}.webm`
            const { error } = await supabase.storage.from("interview-recordings").upload(filename, blob, { upsert: true })
            if (!error) {
              const { data } = supabase.storage.from("interview-recordings").getPublicUrl(filename)
              mediaUrl = data.publicUrl
            } else {
              consola.warn("Audio upload failed:", error.message)
            }
          }

          if (id) {
            const transcript = [currentCaption, ...captions].reverse().join(" ").trim()
            await fetch(`${basePath}/api/interviews/realtime-finalize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interviewId: id,
                transcript,
                transcriptFormatted: undefined,
                mediaUrl,
              }),
            })
            // Navigate to interview detail
            navigate(`${basePath}/interviews/${id}`)
          }
        }
      } catch (e) {
        consola.warn("Finalize error", e)
      }
    })()
  }, [assignedInterviewId, basePath, captions, currentCaption, navigate, projectId, supabase])

  // In realtime flow, do not pre-seed questions/goals; manager will render empty unless user generates

	const handleQuestionStatusChange = useCallback(
		async (_questionId: string, status: "proposed" | "asked" | "answered" | "skipped") => {
			// Generate AI suggestion based on status
			if (status === "answered") {
				const suggestion: AISuggestion = {
					id: `suggestion_${Date.now()}`,
					type: "follow_up",
					text: "Great answer! Consider asking: 'Can you give me a specific example of when this happened?'",
					confidence: 0.85,
					timestamp: new Date(),
				}
				setAiSuggestions((prev) => [suggestion, ...prev.slice(0, 4)]) // Keep last 5

				// Save AI suggestion as annotation
				await saveAISuggestionAsAnnotation(suggestion)
			}
		},
		[saveAISuggestionAsAnnotation]
	)



	const generateAISuggestion = useCallback(async () => {
		const suggestions = [
			{
				type: "probe_deeper" as const,
				text: "Ask them to elaborate on the specific tools they mentioned. What works and what doesn't?",
				confidence: 0.92,
			},
			{
				type: "follow_up" as const,
				text: "This sounds like a communication issue. Ask about their current meeting cadence.",
				confidence: 0.78,
			},
			{
				type: "redirect" as const,
				text: "They're focusing on tools, but consider asking about team culture and relationships.",
				confidence: 0.85,
			},
		]

		const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
		const newSuggestion: AISuggestion = {
			id: `suggestion_${Date.now()}`,
			...randomSuggestion,
			timestamp: new Date(),
		}

		setAiSuggestions((prev) => [newSuggestion, ...prev.slice(0, 4)])

		// Save AI suggestion as annotation
		await saveAISuggestionAsAnnotation(newSuggestion)
	}, [saveAISuggestionAsAnnotation])

  // Toggle recording using realtime streaming
  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev)
    if (!isRecording) {
      if (streamStatus === "paused") {
        void resumeStreaming()
      } else {
        startStreaming()
      }
    } else {
      pauseStreaming()
    }
  }, [isRecording, pauseStreaming, resumeStreaming, startStreaming, streamStatus])

  const handleStop = useCallback(() => {
    setIsFinishing(true)
    // Explicit stop finalizes and navigates
    stopStreaming()
  }, [stopStreaming])

  // Replay: show last 15 seconds of transcript for 15s
  const replayLast15s = useCallback(() => {
    if (!turns.length) return
    const lastEnd = turns[0]?.end ?? 0
    // Treat current time as lastEnd; append currentCaption to reach "present"
    const cutoff = Math.max(0, lastEnd - 30)
    const historical = turns
      .filter((t) => t.end >= cutoff)
      .sort((a, b) => a.start - b.start)
      .map((t) => t.transcript)
    const historicalStr = historical.join(" ").replace(/\s+/g, " ").trim()
    const lastTurnText = historical.length ? historical[historical.length - 1] : ""
    const draft = (currentCaption || "").replace(/\s+/g, " ").trim()
    const shouldAppendDraft = !!draft && draft !== lastTurnText && !historicalStr.endsWith(draft)
    const combined = (shouldAppendDraft ? `${historicalStr} ${draft}` : historicalStr).replace(/\s+/g, " ").trim()
    if (!combined) return
    setReplayText(combined)
    if (replayTimerRef.current) window.clearTimeout(replayTimerRef.current)
    replayTimerRef.current = window.setTimeout(() => {
      setReplayText("")
    }, 15000)
  }, [currentCaption, turns])

  // Helpers for audio processing
  function drainForSamples(samplesNeeded: number): Float32Array | null {
    let have = 0
    const chunks: Float32Array[] = []
    while (bufferRef.current.length && have < samplesNeeded) {
      const c = bufferRef.current.shift()!
      chunks.push(c)
      have += c.length
    }
    if (!chunks.length) return null
    const out = new Float32Array(have)
    let offset = 0
    for (const c of chunks) {
      out.set(c, offset)
      offset += c.length
    }
    return out
  }

  function downsampleTo16kPCM16(input: Float32Array, inputRate: number, targetRate: number): Int16Array | null {
    if (inputRate === targetRate) return floatTo16(input)
    const ratio = inputRate / targetRate
    const outLen = Math.floor(input.length / ratio)
    const out = new Int16Array(outLen)
    let idx = 0
    let i = 0
    while (idx < outLen) {
      const next = Math.floor((idx + 1) * ratio)
      let sum = 0
      let count = 0
      for (; i < next && i < input.length; i++) {
        sum += input[i]
        count++
      }
      const sample = sum / (count || 1)
      out[idx++] = Math.max(-1, Math.min(1, sample)) * 0x7fff
    }
    return out
  }

  function floatTo16(f32: Float32Array): Int16Array {
    const out = new Int16Array(f32.length)
    for (let i = 0; i < f32.length; i++) {
      out[i] = Math.max(-1, Math.min(1, f32[i])) * 0x7fff
    }
    return out
  }

  // Compute a stable key for a turn from its word timing window
  function computeTurnKey(t: TurnMsg): string {
    if (t.words && t.words.length > 0) {
      const start = t.words[0]?.start ?? 0
      const end = t.words[t.words.length - 1]?.end ?? 0
      return `${start}-${end}`
    }
    return `tx-${t.transcript.length}:${t.transcript.slice(0, 32)}`
  }

	const getSuggestionIcon = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up":
				return <MessageSquare className="h-4 w-4" />
			case "probe_deeper":
				return <Lightbulb className="h-4 w-4" />
			case "redirect":
				return <Users className="h-4 w-4" />
			case "wrap_up":
				return <Play className="h-4 w-4" />
		}
	}

	const getSuggestionColor = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up":
				return "bg-blue-100 text-blue-800"
			case "probe_deeper":
				return "bg-purple-100 text-purple-800"
			case "redirect":
				return "bg-orange-100 text-orange-800"
			case "wrap_up":
				return "bg-green-100 text-green-800"
		}
	}

	return (
		<div className="grid h-screen grid-cols-1 gap-6 p-6 lg:grid-cols-2">
			{/* Left Side - Minimal Questions */}
			<div className="space-y-4 overflow-y-auto">
				<MinimalQuestionView projectId={projectId} />
			</div>

			{/* Right Side - Controls & Notes */}
			<div className="space-y-4 overflow-y-auto">
				{/* Recording Controls */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							{isRecording || streamStatus === "paused" ? (
								<Mic className="h-5 w-5 text-red-600" />
							) : (
								<MicOff className="h-5 w-5" />
							)}
							Interview Recording
							{isRecording && streamStatus === "streaming" && (
								<Badge variant="destructive" className="ml-auto animate-pulse">LIVE</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={toggleRecording}
              size="sm"
              className="flex-1 min-w-0 bg-red-600 hover:bg-red-700 text-white"
              disabled={streamStatus === "connecting" || isFinishing}
            >
              {streamStatus === "streaming" && isRecording ? (
                <>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {streamStatus === "connecting" ? "Connecting…" : streamStatus === "paused" ? "Resume" : "Record"}
                </>
              )}
            </Button>
            <Button onClick={handleStop} size="sm" className="flex-1 min-w-0 border-red-600 text-red-700 hover:bg-red-50" variant="outline" disabled={isFinishing}>
                <Square className="mr-2 h-4 w-4" /> {isFinishing ? 'Finishing & Analyzing' : 'Finish'}
            </Button>
          </div>
						<div className="text-muted-foreground text-xs">
							Summary compiles at end after you press Stop. You can pause/resume anytime.
						</div>
						<div className="flex items-center gap-2">
            <Button onClick={replayLast15s} variant="secondary" className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" /> Replay last 15s
            </Button>
          </div>
          {replayText && (
            <div className="rounded-md border p-3 text-foreground text-base md:text-lg">
              {replayText}
            </div>
          )}
					</CardContent>
				</Card>

				{/* Interview Notes */}
				<Card>
					<CardHeader>
						<CardTitle>Interview Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<Textarea
							placeholder="Jot down key insights, quotes, or observations..."
							value={interviewNotes}
							onChange={(e) => setInterviewNotes(e.target.value)}
							rows={6}
							className="resize-none"
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
