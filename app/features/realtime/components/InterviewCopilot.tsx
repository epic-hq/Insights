import consola from "consola"
import { Loader2, Mic, MicOff, Pause, Play, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import { deleteInterview } from "~/features/interviews/db"
import MinimalQuestionView from "~/features/realtime/components/MinimalQuestionView"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"

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
	const [_selectedQuestions, _setSelectedQuestions] = useState<{ id: string; text: string }[]>([])
	const [isRecording, setIsRecording] = useState(false)
	// Store finalized turns with timing to support 15s replay
	const [turns, setTurns] = useState<{ transcript: string; start: number; end: number }[]>([])
	const [_captions, setCaptions] = useState<string[]>([]) // kept for finalize consistency
	const [currentCaption, setCurrentCaption] = useState("")
	const [_aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
	const [interviewNotes, setInterviewNotes] = useState("")
	const [notesExpanded, setNotesExpanded] = useState(false)
	const supabase = createClient()
	const navigate = useNavigate()
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Realtime streaming state
	const [streamStatus, setStreamStatus] = useState<
		"idle" | "connecting" | "streaming" | "paused" | "stopped" | "error"
	>("idle")
	// Visible text for "Replay last 15s"
	const [replayText, setReplayText] = useState<string>("")
	const replayTimerRef = useRef<number | null>(null)
	const [assignedInterviewId, setAssignedInterviewId] = useState<string | undefined>(interviewId)
	const [isFinishing, setIsFinishing] = useState(false)
	const [showCompletionDialog, setShowCompletionDialog] = useState(false)
	const [completedInterviewId, setCompletedInterviewId] = useState<string | undefined>()
	const [redirectCountdown, setRedirectCountdown] = useState(3)
	const [showCancelDialog, setShowCancelDialog] = useState(false)
	const [isCanceling, setIsCanceling] = useState(false)
	const wsRef = useRef<WebSocket | null>(null)
	const ctxRef = useRef<AudioContext | null>(null)
	const nodeRef = useRef<AudioWorkletNode | null>(null)
	const bufferRef = useRef<Float32Array[]>([])
	const timerRef = useRef<number | null>(null)
	const recRef = useRef<MediaRecorder | null>(null)
	const recChunksRef = useRef<BlobPart[]>([])
	const insufficientRef = useRef(false)
	const firstSendRef = useRef(true)
	// Approximate timeline in seconds when word timings are unavailable
	const approxTimeRef = useRef(0)
	// Track recording elapsed time for duration fallback and full transcript
	const recordStartRef = useRef<number | null>(null)
	const elapsedMsRef = useRef(0)
	const allFinalTranscriptsRef = useRef<string[]>([])

	// Recording duration and timer
	const [recordingDuration, setRecordingDuration] = useState(0)
	const durationTimerRef = useRef<number | null>(null)

	// Track all media streams for cleanup
	const mediaStreamsRef = useRef<MediaStream[]>([])

	// Ref to store stopStreaming function to avoid circular dependencies
	const stopStreamingRef = useRef<((finalize?: boolean) => Promise<void>) | null>(null)

	// Audio source selection
	const [audioSource, setAudioSource] = useState<"microphone" | "system">("microphone")
	const [micDeviceId, setMicDeviceId] = useState<string | "default">("default")
	const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

	const TARGET_SAMPLE_RATE = 16000
	const CHUNK_MS = 100
	const MIN_OUT_MS = 60

	// Helper function to extract duration from audio blob
	const getAudioDuration = async (blob: Blob): Promise<number> => {
		return new Promise((resolve, reject) => {
			const audio = new Audio()
			const url = URL.createObjectURL(blob)

			audio.addEventListener("loadedmetadata", () => {
				URL.revokeObjectURL(url)
				resolve(Math.floor(audio.duration))
			})

			audio.addEventListener("error", (e) => {
				URL.revokeObjectURL(url)
				reject(new Error(`Failed to load audio: ${e}`))
			})

			audio.src = url
		})
	}

	type TurnMsg = {
		type: "Turn"
		transcript: string
		end_of_turn: boolean
		turn_is_formatted: boolean
		words: { text: string; start: number; end: number; confidence: number; word_is_final: boolean }[]
	}
	// Track keys for final turns to avoid duplicates
	const finalKeysRef = useRef<string[]>([])

	// Helper function to clean up all media streams
	const cleanupMediaStreams = useCallback(() => {
		mediaStreamsRef.current.forEach((stream) => {
			stream.getTracks().forEach((track) => {
				track.stop()
				consola.log("Stopped media track:", track.kind)
			})
		})
		mediaStreamsRef.current = []
	}, [])

	// When route unmounts, ensure cleanup
	useEffect(() => {
		return () => {
			if (durationTimerRef.current) {
				clearInterval(durationTimerRef.current)
			}
			cleanupMediaStreams()
			// On unmount, ensure we don't accidentally finalize
			if (stopStreamingRef.current) {
				stopStreamingRef.current(false)
			}
		}
	}, [cleanupMediaStreams])

	// Start duration timer
	const startDurationTimer = useCallback(() => {
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current)
		}

		const startTime = Date.now() - recordingDuration * 1000

		durationTimerRef.current = window.setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000)
			setRecordingDuration(elapsed)
		}, 1000)
	}, [recordingDuration])

	// Stop duration timer
	const stopDurationTimer = useCallback(() => {
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current)
			durationTimerRef.current = null
		}
	}, [])

	// Format duration as MM:SS
	const formatDuration = useCallback((seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${secs.toString().padStart(2, "0")}`
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

	// Expand notes by default on md+ screens
	useEffect(() => {
		try {
			const mq = window.matchMedia("(min-width: 768px)")
			const setFromMatch = () => setNotesExpanded(mq.matches)
			setFromMatch()
			mq.addEventListener?.("change", setFromMatch)
			return () => mq.removeEventListener?.("change", setFromMatch)
		} catch {
			// no-op for SSR or older browsers
		}
	}, [])

	// Load audio devices (labels may be empty until mic permission granted)
	useEffect(() => {
		const loadDevices = async () => {
			try {
				const devs = await navigator.mediaDevices.enumerateDevices()
				setAudioDevices(devs.filter((d) => d.kind === "audioinput"))
			} catch {
				setAudioDevices([])
			}
		}
		loadDevices()
		navigator.mediaDevices.addEventListener?.("devicechange", loadDevices)
		return () => navigator.mediaDevices.removeEventListener?.("devicechange", loadDevices)
	}, [])

	// Helper to get capture stream based on selected source
	const getCaptureStream = useCallback(async (): Promise<MediaStream> => {
		if (audioSource === "system") {
			// Use display capture to get tab/system audio. Keep video track alive but ignore it.
			// User will pick the tab/window and opt to share audio in the browser prompt.
			const ds = (await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: true,
			})) as MediaStream
			return ds
		}

		// Microphone capture with optional deviceId
		const mic = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: micDeviceId === "default" ? undefined : { exact: micDeviceId },
				echoCancellation: true,
				noiseSuppression: true,
				channelCount: 1,
			},
			video: false,
		})
		return mic
	}, [audioSource, micDeviceId])

	// ========= Realtime streaming logic =========
	const startStreaming = useCallback(async () => {
		try {
			setStreamStatus("connecting")

			// Ensure interview ID exists; create if missing
			let useInterviewId = assignedInterviewId
			if (!useInterviewId) {
				const startRes = await fetch(`${projectPath}/api/interviews/realtime-start`, {
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
				// Start wall-clock timer for duration fallback
				recordStartRef.current = performance.now()
				startDurationTimer()
				// Audio capture via AudioWorklet
				const ctx = new AudioContext({ sampleRate: 48000 })
				ctxRef.current = ctx
				await ctx.audioWorklet.addModule("/worklets/pcm-processor.js")
				// Choose stream based on selected source
				const fullStream = await getCaptureStream()
				// Track the full stream for cleanup (may include video if system capture)
				mediaStreamsRef.current.push(fullStream)
				// Use audio-only stream for processing/recording
				const audioOnly = new MediaStream(fullStream.getAudioTracks())
				const src = ctx.createMediaStreamSource(audioOnly)
				const node = new AudioWorkletNode(ctx, "pcm-processor")
				nodeRef.current = node
				src.connect(node)

				// Start in-browser recording for upload
				try {
					const rec = new MediaRecorder(audioOnly, { mimeType: "audio/webm;codecs=opus" })
					recRef.current = rec
					recChunksRef.current = []
					rec.ondataavailable = (e) => {
						if (e.data && e.data.size > 0) recChunksRef.current.push(e.data)
					}
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
					const floats = drainForSamples(Math.max(minInputSamples, inputAim))
					if (!floats || floats.length === 0) return
					const pcm16 = downsampleTo16kPCM16(floats, ctx.sampleRate, TARGET_SAMPLE_RATE)
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
							const isNew = !finalKeysRef.current.includes(key)
							// Accumulate full transcript before mutating the key set
							if (isNew) {
								allFinalTranscriptsRef.current.push(t.transcript)
							}
							setCaptions((prev) => {
								if (!isNew) return prev
								finalKeysRef.current = [key, ...finalKeysRef.current.slice(0, 9)]
								return [t.transcript, ...prev.slice(0, 9)]
							})
							// Track turns with timestamps for replay (fallback if no word timings)
							if (t.words?.length) {
								const start = t.words[0]?.start ?? approxTimeRef.current
								const end = t.words[t.words.length - 1]?.end ?? start
								approxTimeRef.current = end
								setTurns((prev) => [{ transcript: t.transcript, start, end }, ...prev].slice(0, 100))
							} else {
								const start = approxTimeRef.current
								// Roughly estimate 4s per short turn when timings missing
								const estimated = Math.max(2, Math.min(10, Math.ceil((t.transcript?.length || 20) / 40)))
								const end = start + estimated
								approxTimeRef.current = end
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
						allFinalTranscriptsRef.current = []
						approxTimeRef.current = 0
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
			if (stopStreamingRef.current) {
				stopStreamingRef.current()
			}
		}
	}, [
		assignedInterviewId,
		getCaptureStream,
		computeTurnKey,
		downsampleTo16kPCM16,
		drainForSamples,
		projectPath,
		startDurationTimer,
	])

	// Pause without finalizing; keeps WS alive if possible
	const pauseStreaming = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
		stopDurationTimer()
		try {
			nodeRef.current?.disconnect()
			ctxRef.current?.suspend?.()
			const rec = recRef.current
			if (rec && rec.state === "recording" && typeof rec.pause === "function") {
				try {
					rec.pause()
				} catch {}
			}
		} catch {}
		// Accumulate elapsed time until now
		try {
			if (recordStartRef.current != null) {
				elapsedMsRef.current += performance.now() - recordStartRef.current
				recordStartRef.current = null
			}
		} catch {}
		setStreamStatus("paused")
	}, [stopDurationTimer])

	// Resume after pause; reuse existing WS if open
	const resumeStreaming = useCallback(async () => {
		try {
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				setStreamStatus("streaming")
				// Resume wall-clock timer
				recordStartRef.current = performance.now()
				startDurationTimer()
				const ctx = new AudioContext({ sampleRate: 48000 })
				ctxRef.current = ctx
				await ctx.audioWorklet.addModule("/worklets/pcm-processor.js")
				const fullStream = await getCaptureStream()
				mediaStreamsRef.current.push(fullStream)
				const audioOnly = new MediaStream(fullStream.getAudioTracks())
				const src = ctx.createMediaStreamSource(audioOnly)
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
					const floats = drainForSamples(Math.max(minInputSamples, inputAim))
					if (!floats || floats.length === 0) return
					const pcm16 = downsampleTo16kPCM16(floats, ctx.sampleRate, TARGET_SAMPLE_RATE)
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
	}, [startStreaming, startDurationTimer, getCaptureStream, downsampleTo16kPCM16, drainForSamples])

	// Process the recording
	const stopStreaming = useCallback(
		async (finalize = true) => {
			if (timerRef.current) {
				clearInterval(timerRef.current)
				timerRef.current = null
			}
			stopDurationTimer()
			if (wsRef.current) {
				try {
					if (wsRef.current.readyState === WebSocket.OPEN) {
						if (finalize) {
							// Signal end of stream to upstream to flush final results
							try {
								wsRef.current.send("__end__")
							} catch {}
							await new Promise((r) => setTimeout(r, 300))
						}
					}
					wsRef.current.close()
				} catch {}
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

			// Stop wall-clock timer and accumulate
			try {
				if (recordStartRef.current != null) {
					elapsedMsRef.current += performance.now() - recordStartRef.current
					recordStartRef.current = null
				}
			} catch {}

			// finalize or abort recording
			void (async () => {
				try {
					if (!finalize) {
						cleanupMediaStreams()
						return
					}

					// Try to stop MediaRecorder and get a blob
					let blob: Blob = new Blob()
					const rec = recRef.current
					if (rec) {
						try {
							const stopped = new Promise<Blob>((resolve) => {
								const handler = () => resolve(new Blob(recChunksRef.current, { type: "audio/webm" }))
								try {
									rec.addEventListener?.("stop", handler as any)
								} catch {
									;(rec as any).onstop = handler
								}
							})
							if (rec.state !== "inactive") {
								try {
									rec.stop()
								} catch {}
							}
							blob = await Promise.race<Blob>([
								stopped,
								new Promise<Blob>((resolve) => setTimeout(() => resolve(new Blob()), 2000)),
							])
						} catch {
							/* swallow */
						}
					}

					// Now safe to stop media tracks
					cleanupMediaStreams()
					setShowCompletionDialog(true)

					// Upload media to storage in Cloudflare R2 via server endpoint
					let mediaUrl: string | undefined
					const id = assignedInterviewId
					if (blob.size > 0 && id) {
						const uploadEndpoint = projectPath
							? `${projectPath}/api/interviews/realtime-upload`
							: "/api/interviews/realtime-upload"
						const formData = new FormData()
						formData.append("file", blob, `realtime-${id}-${Date.now()}.webm`)
						formData.append("interviewId", id)
						formData.append("projectId", projectId)

						try {
							const response = await fetch(uploadEndpoint, {
								method: "POST",
								body: formData,
							})

							if (response.ok) {
								const payload = (await response.json()) as { mediaUrl?: string }
								if (typeof payload?.mediaUrl === "string" && payload.mediaUrl) {
									mediaUrl = payload.mediaUrl
								} else {
									consola.warn("Realtime upload succeeded but returned no mediaUrl")
								}
							} else {
								const errorText = await response.text().catch(() => "")
								consola.warn(
									"Realtime audio upload failed",
									response.status,
									response.statusText,
									errorText.slice(0, 200)
								)
							}
						} catch (uploadError) {
							consola.warn("Realtime audio upload error", uploadError)
						}
					}

					if (id) {
						const full = allFinalTranscriptsRef.current.join(" ")
						const draft = (currentCaption || "").trim()
						const transcript = [full, draft].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()

						// Determine duration
						let audioDuration: number | undefined
						try {
							if (blob.size > 0) {
								audioDuration = await getAudioDuration(blob)
							}
						} catch (e) {
							consola.warn("Failed to extract audio duration:", e)
						}
						if (!audioDuration || !Number.isFinite(audioDuration) || audioDuration <= 0) {
							audioDuration = Math.max(1, Math.round(elapsedMsRef.current / 1000))
						}

						try {
							// Convert turns to speaker_transcripts format for BAML processing
							const utterances = turns.map((turn, idx) => ({
								speaker: `Speaker ${idx % 2 === 0 ? "A" : "B"}`, // Simple alternating speaker labels
								text: turn.transcript,
								start: turn.start,
								end: turn.end,
								confidence: 0.8,
							}))

							await fetch(`${projectPath}/api/interviews/realtime-finalize`, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									interviewId: id,
									transcript,
									transcriptFormatted: {
										full_transcript: transcript,
										utterances,
										speaker_transcripts: utterances,
										audio_duration: audioDuration,
										file_type: "realtime",
									},
									mediaUrl,
									audioDuration,
								}),
							})
						} catch (e) {
							consola.warn("Realtime finalize error", e)
						}

						// Show completion dialog instead of immediately navigating
						setCompletedInterviewId(id)
						setIsFinishing(false)
					}
				} catch (e) {
					consola.warn("Finalize error", e)
				}
			})()
		},
		[
			assignedInterviewId,
			currentCaption,
			projectId,
			stopDurationTimer,
			cleanupMediaStreams,
			getAudioDuration,
			projectPath,
		]
	)

	// Update ref whenever stopStreaming changes to avoid circular dependencies
	useEffect(() => {
		stopStreamingRef.current = stopStreaming
	}, [stopStreaming])

	// In realtime flow, do not pre-seed questions/goals; manager will render empty unless user generates

	const _handleQuestionStatusChange = useCallback(
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

	// Replay: show last 15 seconds of transcript for 15s
	const replayLast30s = useCallback(() => {
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

	const handleCancel = useCallback(() => {
		setShowCancelDialog(true)
	}, [])

	const handleFinish = useCallback(() => {
		setIsFinishing(true)
		// Explicit stop finalizes and navigates, cleanup happens in stopStreaming
		stopStreaming()
	}, [stopStreaming])

	const handleConfirmCancel = useCallback(async () => {
		if (isCanceling) return
		setIsCanceling(true)
		let redirectPath: string | null = null
		try {
			await stopStreaming(false)
			setIsRecording(false)
			setRecordingDuration(0)
			const id = assignedInterviewId
			if (id) {
				const { error } = await deleteInterview({
					supabase,
					id,
					accountId,
					projectId,
				})
				if (error) {
					throw new Error(error.message)
				}
				setAssignedInterviewId(undefined)
			}
			redirectPath = routes.interviews.index()
			setShowCancelDialog(false)
		} catch (error) {
			consola.error("Cancel interview error:", error)
		} finally {
			setIsCanceling(false)
			if (redirectPath) {
				navigate(redirectPath)
			}
		}
	}, [isCanceling, stopStreaming, assignedInterviewId, supabase, accountId, projectId, navigate, routes])

	// Dialog handlers
	const _handleRecordAnother = useCallback(() => {
		setShowCompletionDialog(false)
		setCompletedInterviewId(undefined)
		// Reset recording state and REDIRECT to new interview
		navigate(routes.interviews.index())
	}, [navigate, routes])

	const handleViewInterview = useCallback(() => {
		if (completedInterviewId) {
			setShowCompletionDialog(false)
			navigate(routes.interviews.detail(completedInterviewId))
		}
	}, [completedInterviewId, navigate, routes])

	// Auto-redirect to interview detail after 3 seconds when analysis completes
	useEffect(() => {
		if (completedInterviewId && !isFinishing) {
			// Reset countdown to 3
			setRedirectCountdown(3)

			// Countdown timer (updates every second)
			const countdownInterval = setInterval(() => {
				setRedirectCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(countdownInterval)
						return 0
					}
					return prev - 1
				})
			}, 1000)

			// Redirect after 3 seconds
			const redirectTimer = setTimeout(() => {
				handleViewInterview()
			}, 3000)

			return () => {
				clearInterval(countdownInterval)
				clearTimeout(redirectTimer)
			}
		}
	}, [completedInterviewId, isFinishing, handleViewInterview])

	// Simple waveform component with dynamic animation
	const WaveformAnimation = ({ isRecording }: { isRecording: boolean }) => {
		const [bars, setBars] = useState([8, 12, 6, 15, 9])

		useEffect(() => {
			if (!isRecording) {
				setBars([8, 8, 8, 8, 8])
				return
			}

			const interval = setInterval(() => {
				setBars([
					Math.random() * 12 + 4,
					Math.random() * 16 + 6,
					Math.random() * 10 + 4,
					Math.random() * 18 + 8,
					Math.random() * 14 + 5,
				])
			}, 150)

			return () => clearInterval(interval)
		}, [isRecording])

		return (
			<div className="flex items-center gap-1">
				{bars.map((height, i) => (
					<div
						key={i}
						className={`w-1 rounded-full bg-red-500 transition-all duration-150 ${isRecording ? "animate-pulse" : ""}`}
						style={{
							height: `${height}px`,
							animationDelay: `${i * 50}ms`,
						}}
					/>
				))}
			</div>
		)
	}

	return (
		// Use viewport height minus navigation space. Add small-screen bottom padding safety for bottom nav.
		<div className="relative flex min-h-0 flex-col pb-14 md:pb-0" style={{ height: "calc(100vh - 4rem)" }}>
			{/* Header with responsive layout for title, audio source, timer, and actions */}
			<div className="flex flex-shrink-0 border-b bg-background p-3">
				<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					{/* Left cluster: title + audio source + timer (wraps on small) */}
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="font-semibold text-lg">Interview</h1>
						{/* Audio source selector */}
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-xs">Audio source</span>
							<Select
								value={audioSource === "system" ? "system" : `mic:${micDeviceId}`}
								onValueChange={(val) => {
									if (val === "system") {
										setAudioSource("system")
									} else if (val.startsWith("mic:")) {
										const id = val.slice(4) || "default"
										setAudioSource("microphone")
										setMicDeviceId((id as any) || "default")
									}
								}}
								disabled={isRecording || streamStatus === "paused" || streamStatus === "streaming"}
							>
								<SelectTrigger className="h-8 w-44 text-xs sm:w-56">
									<SelectValue placeholder="Select audio source" />
								</SelectTrigger>
								<SelectContent className="text-sm">
									<SelectItem value="mic:default">Microphone (default)</SelectItem>
									{audioDevices.map((d, idx) => (
										<SelectItem key={d.deviceId || idx} value={`mic:${d.deviceId}`}>
											{d.label || `Microphone ${idx + 1}`}
										</SelectItem>
									))}
									<SelectItem value="system">Share tab/system audio…</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{(isRecording || streamStatus === "paused") && (
							<div className="flex items-center gap-2 text-sm">
								<WaveformAnimation isRecording={streamStatus === "streaming"} />
								<span className="font-mono text-muted-foreground">{formatDuration(recordingDuration)}</span>
							</div>
						)}
					</div>

					{/* Right cluster: actions (wrap on small) */}
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleCancel}>
							Cancel
						</Button>
						<Button size="sm" onClick={handleFinish} disabled={isFinishing}>
							{isFinishing ? (
								<>
									<Loader2 className="mr-2 h-3 w-3 animate-spin" /> Finishing...
								</>
							) : (
								"Finish"
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="min-h-0 flex-1 overflow-hidden">
				<div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
					{/* Left Side - Questions */}
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:max-w-md">
						<MinimalQuestionView projectId={projectId} interviewId={interviewId} />
					</div>

					{/* Right Side - Notes (collapsible on mobile) */}
					<div className="flex min-h-0 flex-col space-y-2 md:flex-1">
						{/* Processing Notification */}
						{isFinishing && (
							<Card className="flex-shrink-0 border-blue-200 bg-blue-50">
								<CardContent className="p-3">
									<div className="flex items-center gap-3">
										<Loader2 className="h-4 w-4 animate-spin text-blue-600" />
										<div>
											<p className="font-medium text-blue-900 text-sm">Processing your recording...</p>
											<p className="text-blue-700 text-xs">Storing audio file and generating insights.</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Notes header with mobile toggle */}
						<div className="mb-1 flex items-center justify-between">
							<div className="text-lg">Notes</div>
							<Button variant="ghost" size="sm" onClick={() => setNotesExpanded((v) => !v)} className="md:hidden">
								{notesExpanded ? "Collapse" : "Expand"}
							</Button>
						</div>

						<Card className={`min-h-0 ${notesExpanded ? "block h-64" : "hidden"} md:block md:h-auto md:flex-1`}>
							<CardContent className="h-full p-0">
								<Textarea
									placeholder="Jot down key insights..."
									value={interviewNotes}
									onChange={(e) => setInterviewNotes(e.target.value)}
									className="h-full resize-none border-0 text-sm"
									rows={6}
								/>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			{/* Fixed Bottom Recording Controls */
			/* Ensure always visible regardless of inner scroll */}
			<div className="flex-shrink-0 border-t bg-background/95 p-3 backdrop-blur-sm">
				<div className="mx-auto flex max-w-sm items-center gap-2">
					{/* Recording Status Indicator */}
					<div className="flex items-center gap-1">
						{isRecording || streamStatus === "paused" ? (
							<Mic className="h-3 w-3 text-red-600" />
						) : (
							<MicOff className="h-3 w-3 text-muted-foreground" />
						)}
						{isRecording && streamStatus === "streaming" && (
							<Badge variant="destructive" className="animate-pulse px-1 py-0 text-xs">
								LIVE
							</Badge>
						)}
					</div>

					{/* Main Controls */}
					<div className="flex flex-1 items-center gap-2">
						<Button
							onClick={toggleRecording}
							size="sm"
							className="h-8 flex-1 bg-red-600 text-white text-xs hover:bg-red-700"
							disabled={streamStatus === "connecting" || isFinishing}
						>
							{streamStatus === "streaming" && isRecording ? (
								<>
									<Pause className="mr-1 h-3 w-3" /> Pause
								</>
							) : (
								<>
									<Play className="mr-1 h-3 w-3" />
									{streamStatus === "connecting" ? "Connecting…" : streamStatus === "paused" ? "Resume" : "Record"}
								</>
							)}
						</Button>

						<Button onClick={replayLast30s} variant="outline" size="sm" className="h-8 px-2">
							<RotateCcw className="h-3 w-3" />
						</Button>
					</div>
				</div>

				{/* Replay Text */}
				{replayText && (
					<div className="mx-auto mt-2 max-w-sm rounded-md border bg-muted/50 p-2 text-xs">{replayText}</div>
				)}
			</div>

			<AlertDialog
				open={showCancelDialog}
				onOpenChange={(open) => {
					if (isCanceling) return
					setShowCancelDialog(open)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cancel recording?</AlertDialogTitle>
						<AlertDialogDescription>
							We&apos;ll delete this realtime interview and discard the in-progress recording. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isCanceling}>Continue recording</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmCancel}
							disabled={isCanceling}
							className="bg-red-600 hover:bg-red-700"
						>
							{isCanceling ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Discarding...
								</>
							) : (
								"Discard interview"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Analysis Complete Dialog */}
			<Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
				<DialogContent className="sm:max-w-md" showCloseButton={false}>
					<DialogHeader>
						{isFinishing ? (
							<DialogTitle className="flex items-center gap-2">
								<Loader2 className="h-5 w-5 animate-spin text-blue-600" />
								Analyzing your recording
							</DialogTitle>
						) : (
							<DialogTitle>Analysis Complete</DialogTitle>
						)}
						{isFinishing ? (
							<DialogDescription>This may take a minute... please standby</DialogDescription>
						) : (
							<DialogDescription>
								Redirecting to interview in {redirectCountdown} second{redirectCountdown !== 1 ? "s" : ""}...
							</DialogDescription>
						)}
					</DialogHeader>

					<DialogFooter className="flex-col gap-3 sm:flex-col">
						{/* <div className="flex w-full flex-col gap-2">

							<Button onClick={handleRecordAnother} className="flex w-full items-center gap-2" variant="outline">
								<Plus className="h-4 w-4" />
								Record Another Interview
							</Button>
							<Button onClick={handleGoHome} className="flex w-full items-center gap-2" variant="outline">
								<Home className="h-4 w-4" />
								Go Home
							</Button>
						</div> */}

						{completedInterviewId && !isFinishing && (
							<div className="text-center text-sm">
								<Button onClick={handleViewInterview} variant="default" className="h-auto w-full p-3 text-base md:p-4">
									View Interview Now
								</Button>
								<p className="mt-2 text-muted-foreground text-xs">
									Or wait {redirectCountdown} second{redirectCountdown !== 1 ? "s" : ""} for auto-redirect
								</p>
							</div>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
