/**
 * Main real-time transcription + evidence extraction session component.
 * Supports three modes:
 * 1. Live recording via microphone -> WebSocket transcription -> evidence extraction
 * 2. Simulation mode with pre-recorded conversation for demos
 * 3. Manual paste mode for processing existing transcripts
 *
 * Audio capture uses AudioWorklet with PCM16 downsampling (48kHz -> 16kHz),
 * streamed to the server-side AssemblyAI WebSocket proxy at /ws/realtime-transcribe.
 */

import type { EvidenceTurn, Person } from "baml_client"
import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	FileText,
	Lightbulb,
	Loader2,
	Mic,
	Play,
	Radio,
	Sparkles,
	Square,
	Users,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"
import { deduplicateEvidence, downsampleTo16kPCM16, formatDuration } from "../lib/audio"
import { EvidenceCard } from "./EvidenceCard"

// ── Types ────────────────────────────────────────────────────────────────

export interface TranscriptTurn {
	id: string
	speaker: string
	text: string
	startMs: number
	endMs: number
	isFinal: boolean
}

type SessionMode = "idle" | "recording" | "paused" | "simulating" | "stopped"
type ExtractionStatus = "idle" | "processing" | "error"

// ── Sample conversation for demo simulation ──────────────────────────────

const SAMPLE_CONVERSATION: Array<{
	speaker: string
	text: string
	delayMs: number
}> = [
	{
		speaker: "SPEAKER A",
		text: "Thanks for taking the time today. I'd love to hear about your experience with your current project management tools.",
		delayMs: 0,
	},
	{
		speaker: "SPEAKER B",
		text: "Sure, happy to chat. We've been using a mix of tools honestly. Jira for engineering, Notion for product docs, and then spreadsheets for the roadmap. It's kind of a mess.",
		delayMs: 4000,
	},
	{
		speaker: "SPEAKER A",
		text: "That's a common setup. What's the biggest pain point with that workflow?",
		delayMs: 3000,
	},
	{
		speaker: "SPEAKER B",
		text: "The biggest issue is keeping everything in sync. When a requirement changes in Notion, someone has to manually update Jira tickets, and then the roadmap spreadsheet gets stale. We lose probably two hours a week just on reconciliation.",
		delayMs: 5000,
	},
	{
		speaker: "SPEAKER A",
		text: "Two hours a week is significant. Have you tried any automation or integration tools?",
		delayMs: 3000,
	},
	{
		speaker: "SPEAKER B",
		text: "We tried Zapier to connect Notion and Jira, but the mappings broke every time someone changed a field. And the real problem is the spreadsheet. There's no good way to automate that. My PM ends up doing a manual sync every Friday afternoon.",
		delayMs: 6000,
	},
	{
		speaker: "SPEAKER A",
		text: "What would an ideal solution look like for you?",
		delayMs: 3000,
	},
	{
		speaker: "SPEAKER B",
		text: "Honestly, I'd love one tool that handles all three use cases. The engineering ticketing, the product documentation, and the roadmapping. But it has to be flexible enough for different teams. Engineering wants kanban boards, product wants docs, leadership wants Gantt charts.",
		delayMs: 7000,
	},
	{
		speaker: "SPEAKER A",
		text: "That's an interesting tension. How do the different teams feel about potentially switching tools?",
		delayMs: 3000,
	},
	{
		speaker: "SPEAKER B",
		text: "Engineering would resist leaving Jira. They've got years of workflow automation built in. But product and leadership are more open to change because they're the ones suffering from the fragmentation. We actually tried Linear last quarter for a pilot team and they loved it, but it didn't solve the docs and roadmap problem.",
		delayMs: 8000,
	},
	{
		speaker: "SPEAKER A",
		text: "You mentioned the PM doing a manual sync every Friday. How does that affect the team's velocity?",
		delayMs: 3500,
	},
	{
		speaker: "SPEAKER B",
		text: "It's a real bottleneck. Our PM spends half of Friday just updating spreadsheets. And by Monday, things are already outdated because engineers worked over the weekend or priorities shifted. We've actually missed deadlines because leadership was looking at stale data in the roadmap.",
		delayMs: 7000,
	},
]

// ── Audio Worklet Processor (inline) ─────────────────────────────────────

const WORKLET_CODE = `
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
  }
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch) this.buffer.push(new Float32Array(ch))
    if (this.buffer.length >= 4) {
      const total = this.buffer.reduce((s, b) => s + b.length, 0)
      const merged = new Float32Array(total)
      let off = 0
      for (const b of this.buffer) { merged.set(b, off); off += b.length }
      this.port.postMessage(merged.buffer, [merged.buffer])
      this.buffer = []
    }
    return true
  }
}
registerProcessor("pcm-processor", PcmProcessor)
`

// ── Component Props ───────────────────────────────────────────────────────

interface RealtimeSessionProps {
	/** Optional participant names to label speakers (e.g., ["Alice", "Bob"]) */
	participantNames?: string[]
	/** Project ID for saving evidence to database (optional for demo) */
	projectId?: string
	/** Interview ID for linking evidence (optional for demo) */
	interviewId?: string
}

// ── Component ────────────────────────────────────────────────────────────

export function RealtimeSession({ participantNames = [], projectId, interviewId }: RealtimeSessionProps) {
	// Core state
	const [mode, setMode] = useState<SessionMode>("idle")
	const [turns, setTurns] = useState<TranscriptTurn[]>([])
	const [currentCaption, setCurrentCaption] = useState("")
	const [evidence, setEvidence] = useState<EvidenceTurn[]>([])
	const [people, setPeople] = useState<Person[]>([])
	const [duration, setDuration] = useState(0)
	const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>("idle")
	const [error, setError] = useState<string | null>(null)
	const [newEvidenceIds, setNewEvidenceIds] = useState<Set<string>>(new Set())
	const [showTranscript, setShowTranscript] = useState(true)

	// Mode ref to avoid stale closures in WS callbacks
	const modeRef = useRef<SessionMode>("idle")
	useEffect(() => {
		modeRef.current = mode
	}, [mode])

	// Refs for audio recording
	const wsRef = useRef<WebSocket | null>(null)
	const audioCtxRef = useRef<AudioContext | null>(null)
	const processorRef = useRef<AudioWorkletNode | null>(null)
	const mediaStreamRef = useRef<MediaStream | null>(null)
	const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const startTimeRef = useRef<number>(0)

	// Refs for evidence batching
	const allTurnsRef = useRef<TranscriptTurn[]>([])
	const extractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const batchIndexRef = useRef(0)
	const isExtractingRef = useRef(false)
	const lastExtractedCountRef = useRef(0)

	// Refs for simulation
	const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

	// Scroll refs
	const transcriptEndRef = useRef<HTMLDivElement>(null)
	const evidenceEndRef = useRef<HTMLDivElement>(null)

	// Map generic speaker labels to participant names
	const speakerNameMap = useMemo(() => {
		const map: Record<string, string> = {}
		if (participantNames.length > 0) {
			// Map SPEAKER A -> first name, SPEAKER B -> second name, etc.
			const labels = ["SPEAKER A", "SPEAKER B", "SPEAKER C", "SPEAKER D"]
			labels.forEach((label, idx) => {
				if (participantNames[idx]) {
					map[label] = participantNames[idx]
				}
			})
		}
		return map
	}, [participantNames])

	// Helper to get display name for a speaker
	const getDisplayName = useCallback((speaker: string) => speakerNameMap[speaker] || speaker, [speakerNameMap])

	// Derive unique speakers from turns
	const uniqueSpeakers = useMemo(() => {
		const speakers = new Set(turns.map((t) => t.speaker))
		return Array.from(speakers)
	}, [turns])

	// Derive recommendations from evidence (pains + gains + why_it_matters)
	const recommendations = useMemo(() => {
		const recs: Array<{
			type: "pain" | "gain" | "insight"
			text: string
			source: string
		}> = []

		for (const ev of evidence) {
			// Extract pains as problems to address
			if (ev.pains?.length) {
				for (const pain of ev.pains) {
					recs.push({ type: "pain", text: pain, source: ev.gist })
				}
			}
			// Extract gains as opportunities
			if (ev.gains?.length) {
				for (const gain of ev.gains) {
					recs.push({ type: "gain", text: gain, source: ev.gist })
				}
			}
			// Extract why_it_matters as insights
			if (ev.why_it_matters) {
				recs.push({
					type: "insight",
					text: ev.why_it_matters,
					source: ev.gist,
				})
			}
		}

		// Deduplicate by text
		const seen = new Set<string>()
		return recs.filter((r) => {
			const key = r.text.toLowerCase()
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	}, [evidence])

	// Auto-scroll transcript
	useEffect(() => {
		transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [turns, currentCaption])

	// Auto-scroll evidence
	useEffect(() => {
		evidenceEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [evidence])

	// Clear new evidence markers after animation
	useEffect(() => {
		if (newEvidenceIds.size === 0) return
		const timer = setTimeout(() => setNewEvidenceIds(new Set()), 1000)
		return () => clearTimeout(timer)
	}, [newEvidenceIds])

	// Auto-hide transcript when stopped
	useEffect(() => {
		if (mode === "stopped") {
			setShowTranscript(false)
		} else if (mode === "recording" || mode === "simulating") {
			setShowTranscript(true)
		}
	}, [mode])

	// ── Evidence extraction ─────────────────────────────────────────────

	const extractEvidence = useCallback(async () => {
		const allTurns = allTurnsRef.current
		if (allTurns.length === 0 || isExtractingRef.current) return
		if (allTurns.length <= lastExtractedCountRef.current) return

		isExtractingRef.current = true
		setExtractionStatus("processing")
		const batchIdx = batchIndexRef.current++

		try {
			const utterances = allTurns.map((t) => ({
				speaker: t.speaker,
				text: t.text,
				start: t.startMs,
				end: t.endMs,
			}))

			const response = await fetch("/api/realtime-evidence", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ utterances, language: "en" }),
			})

			if (!response.ok) {
				throw new Error(`Extraction failed: ${response.status}`)
			}

			const data = await response.json()

			if (data.evidence?.length) {
				const newIds = new Set<string>()
				setEvidence((prev) => {
					const fresh = deduplicateEvidence(prev, data.evidence)
					for (const e of fresh) {
						newIds.add(`${e.gist}::${e.verbatim}`)
					}
					return [...prev, ...fresh]
				})
				setNewEvidenceIds(newIds)
			}

			if (data.people?.length) {
				setPeople((prev) => {
					const existingKeys = new Set(prev.map((p) => p.person_key))
					const fresh = data.people.filter((p: Person) => !existingKeys.has(p.person_key))
					return [...prev, ...fresh]
				})
			}

			lastExtractedCountRef.current = allTurns.length
			setExtractionStatus("idle")
		} catch (err: any) {
			setExtractionStatus("error")
			setError(err?.message || "Evidence extraction failed")
			// Reset after error so we can retry
			setTimeout(() => {
				setExtractionStatus("idle")
				setError(null)
			}, 5000)
		} finally {
			isExtractingRef.current = false
		}
	}, [])

	// Schedule evidence extraction when turns accumulate
	const scheduleExtraction = useCallback(() => {
		if (extractionTimerRef.current) clearTimeout(extractionTimerRef.current)
		extractionTimerRef.current = setTimeout(() => {
			extractEvidence()
		}, 2000) // Wait 2s after last turn before extracting
	}, [extractEvidence])

	// ── Add a turn ──────────────────────────────────────────────────────

	const addTurn = useCallback(
		(turn: TranscriptTurn) => {
			setTurns((prev) => [...prev, turn])
			allTurnsRef.current = [...allTurnsRef.current, turn]

			// Auto-extract every 4 new turns or schedule extraction
			const newTurnsSinceExtract = allTurnsRef.current.length - lastExtractedCountRef.current
			if (newTurnsSinceExtract >= 4 && !isExtractingRef.current) {
				extractEvidence()
			} else {
				scheduleExtraction()
			}
		},
		[extractEvidence, scheduleExtraction]
	)

	// ── Live recording ──────────────────────────────────────────────────

	const startRecording = useCallback(async () => {
		try {
			setError(null)
			setTurns([])
			setEvidence([])
			setPeople([])
			allTurnsRef.current = []
			lastExtractedCountRef.current = 0
			batchIndexRef.current = 0

			// Get microphone
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 48000,
				},
			})
			mediaStreamRef.current = stream

			// Create AudioContext
			const ctx = new AudioContext({ sampleRate: 48000 })
			audioCtxRef.current = ctx

			// Register AudioWorklet
			const blob = new Blob([WORKLET_CODE], { type: "application/javascript" })
			const workletUrl = URL.createObjectURL(blob)
			await ctx.audioWorklet.addModule(workletUrl)
			URL.revokeObjectURL(workletUrl)

			// Connect mic -> worklet (don't connect to destination to avoid echo)
			const source = ctx.createMediaStreamSource(stream)
			const processor = ctx.createAudioWorkletNode(ctx, "pcm-processor")
			processorRef.current = processor
			source.connect(processor)

			// Connect WebSocket
			const protocol = location.protocol === "https:" ? "wss" : "ws"
			const ws = new WebSocket(`${protocol}://${location.host}/ws/realtime-transcribe`)
			wsRef.current = ws

			let turnCounter = 0

			ws.onopen = () => {
				setMode("recording")
				startTimeRef.current = Date.now()

				// Start duration timer
				durationTimerRef.current = setInterval(() => {
					setDuration(Date.now() - startTimeRef.current)
				}, 200)
			}

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data)
					if (msg.type === "Turn") {
						if (msg.end_of_turn) {
							const turn: TranscriptTurn = {
								id: `turn-${++turnCounter}`,
								speaker: "SPEAKER A",
								text: msg.transcript,
								startMs: msg.words?.[0]?.start ? msg.words[0].start * 1000 : Date.now() - startTimeRef.current,
								endMs: msg.words?.at(-1)?.end ? msg.words.at(-1).end * 1000 : Date.now() - startTimeRef.current,
								isFinal: true,
							}
							setCurrentCaption("")
							addTurn(turn)
						} else {
							setCurrentCaption(msg.transcript || "")
						}
					}
				} catch {}
			}

			ws.onerror = () => {
				setError("WebSocket connection error. Check that the server is running.")
			}

			ws.onclose = () => {
				if (modeRef.current === "recording") {
					setMode("stopped")
				}
			}

			// Stream audio to WebSocket
			processor.port.onmessage = (event) => {
				if (ws.readyState !== WebSocket.OPEN) return
				const float32 = new Float32Array(event.data)
				const pcm16 = downsampleTo16kPCM16(float32, 48000)
				if (pcm16) {
					ws.send(pcm16.buffer)
				}
			}
		} catch (err: any) {
			setError(err?.message || "Failed to start recording")
			setMode("idle")
		}
	}, [addTurn])

	const stopRecording = useCallback(() => {
		// Close WebSocket
		if (wsRef.current) {
			try {
				wsRef.current.send("__end__")
			} catch {}
			try {
				wsRef.current.close()
			} catch {}
			wsRef.current = null
		}

		// Stop audio
		if (processorRef.current) {
			processorRef.current.disconnect()
			processorRef.current = null
		}
		if (audioCtxRef.current) {
			audioCtxRef.current.close()
			audioCtxRef.current = null
		}
		if (mediaStreamRef.current) {
			for (const track of mediaStreamRef.current.getTracks()) track.stop()
			mediaStreamRef.current = null
		}

		// Stop timer
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current)
			durationTimerRef.current = null
		}

		setMode("stopped")

		// Run final extraction
		if (allTurnsRef.current.length > lastExtractedCountRef.current) {
			extractEvidence()
		}
	}, [extractEvidence])

	// ── Simulation mode ─────────────────────────────────────────────────

	const startSimulation = useCallback(() => {
		setError(null)
		setTurns([])
		setEvidence([])
		setPeople([])
		allTurnsRef.current = []
		lastExtractedCountRef.current = 0
		batchIndexRef.current = 0
		setMode("simulating")
		startTimeRef.current = Date.now()

		// Start duration timer
		durationTimerRef.current = setInterval(() => {
			setDuration(Date.now() - startTimeRef.current)
		}, 200)

		let cumulativeDelay = 0
		let turnCounter = 0
		const timers: ReturnType<typeof setTimeout>[] = []

		for (const entry of SAMPLE_CONVERSATION) {
			cumulativeDelay += entry.delayMs
			const timer = setTimeout(() => {
				const turn: TranscriptTurn = {
					id: `sim-${++turnCounter}`,
					speaker: entry.speaker,
					text: entry.text,
					startMs: cumulativeDelay,
					endMs: cumulativeDelay + entry.text.length * 30, // rough estimate
					isFinal: true,
				}
				addTurn(turn)
			}, cumulativeDelay + 500) // small buffer
			timers.push(timer)
		}

		// Auto-stop after all turns + buffer
		const stopTimer = setTimeout(() => {
			setMode("stopped")
			if (durationTimerRef.current) {
				clearInterval(durationTimerRef.current)
				durationTimerRef.current = null
			}
			// Final extraction
			if (allTurnsRef.current.length > lastExtractedCountRef.current) {
				extractEvidence()
			}
		}, cumulativeDelay + 3000)
		timers.push(stopTimer)

		simTimersRef.current = timers
	}, [addTurn, extractEvidence])

	const stopSimulation = useCallback(() => {
		for (const timer of simTimersRef.current) clearTimeout(timer)
		simTimersRef.current = []
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current)
			durationTimerRef.current = null
		}
		setMode("stopped")
		if (allTurnsRef.current.length > lastExtractedCountRef.current) {
			extractEvidence()
		}
	}, [extractEvidence])

	// ── Cleanup ─────────────────────────────────────────────────────────

	useEffect(() => {
		return () => {
			if (wsRef.current) {
				try {
					wsRef.current.close()
				} catch {}
			}
			if (audioCtxRef.current) {
				try {
					audioCtxRef.current.close()
				} catch {}
			}
			if (mediaStreamRef.current) {
				for (const track of mediaStreamRef.current.getTracks()) track.stop()
			}
			if (durationTimerRef.current) clearInterval(durationTimerRef.current)
			if (extractionTimerRef.current) clearTimeout(extractionTimerRef.current)
			for (const timer of simTimersRef.current) clearTimeout(timer)
		}
	}, [])

	// ── Render ──────────────────────────────────────────────────────────

	const isActive = mode === "recording" || mode === "simulating"
	const isStopped = mode === "stopped"

	return (
		<div className="flex h-screen flex-col bg-background">
			{/* ── Header ──────────────────────────────────────────────── */}
			<header className="shrink-0 border-b px-6 py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<Radio className={cn("h-5 w-5", isActive ? "animate-pulse text-red-500" : "text-muted-foreground")} />
							<h1 className="font-semibold text-lg">Realtime Transcription & Evidence</h1>
						</div>
						<Badge variant="outline" className="text-xs">
							Prototype
						</Badge>
					</div>
					<div className="flex items-center gap-4">
						{/* Stats */}
						<div className="flex items-center gap-3 text-muted-foreground text-sm">
							<span className="flex items-center gap-1">
								<FileText className="h-3.5 w-3.5" />
								{turns.length} turns
							</span>
							<span className="flex items-center gap-1">
								<Sparkles className="h-3.5 w-3.5" />
								{evidence.length} evidence
							</span>
							<span className="flex items-center gap-1">
								<Users className="h-3.5 w-3.5" />
								{uniqueSpeakers.length} speakers
							</span>
						</div>
						{/* Duration */}
						<span className="font-mono text-lg tabular-nums">{formatDuration(duration)}</span>
					</div>
				</div>
			</header>

			{/* ── Controls ─────────────────────────────────────────────── */}
			<div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
				{mode === "idle" && (
					<>
						<Button onClick={startRecording} variant="default" size="sm" className="gap-2">
							<Mic className="h-4 w-4" />
							Record
						</Button>
						<Button onClick={startSimulation} variant="outline" size="sm" className="gap-2">
							<Play className="h-4 w-4" />
							Simulate Conversation
						</Button>
					</>
				)}
				{mode === "recording" && (
					<>
						<Button onClick={stopRecording} variant="destructive" size="sm" className="gap-2">
							<Square className="h-4 w-4" />
							Stop Recording
						</Button>
						<div className="flex items-center gap-2 text-red-500 text-sm">
							<span className="relative flex h-2.5 w-2.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
								<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
							</span>
							Recording...
						</div>
					</>
				)}
				{mode === "simulating" && (
					<>
						<Button onClick={stopSimulation} variant="destructive" size="sm" className="gap-2">
							<Square className="h-4 w-4" />
							Stop Simulation
						</Button>
						<div className="flex items-center gap-2 text-blue-500 text-sm">
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							Simulating conversation...
						</div>
					</>
				)}
				{mode === "stopped" && (
					<>
						<Button
							onClick={() => {
								setMode("idle")
								setDuration(0)
								setShowTranscript(true)
							}}
							variant="outline"
							size="sm"
							className="gap-2"
						>
							<Play className="h-4 w-4" />
							New Session
						</Button>
						{extractionStatus === "processing" && (
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Running final extraction...
							</div>
						)}
					</>
				)}

				{/* Extraction status */}
				{extractionStatus === "processing" && mode !== "stopped" && (
					<div className="ml-auto flex items-center gap-2 text-muted-foreground text-sm">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Extracting evidence...
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="ml-auto flex items-center gap-2 text-destructive text-sm">
						<AlertCircle className="h-3.5 w-3.5" />
						{error}
					</div>
				)}
			</div>

			{/* ── Main content ─────────────────────────────────────────── */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left: Transcript (collapsible when stopped) */}
				{showTranscript && (
					<div className={cn("flex flex-col border-r", isStopped ? "w-80" : "w-1/2")}>
						<div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-4 py-3">
							<h2 className="flex items-center gap-2 font-semibold text-sm">
								<FileText className="h-4 w-4" />
								Live Transcript
							</h2>
							{isStopped && (
								<Button variant="ghost" size="sm" onClick={() => setShowTranscript(false)} className="h-6 px-2">
									<ChevronDown className="h-3.5 w-3.5" />
								</Button>
							)}
						</div>
						<ScrollArea className="flex-1">
							<div className="space-y-3 p-4">
								{turns.length === 0 && !currentCaption && (
									<p className="py-8 text-center text-muted-foreground text-sm">
										{mode === "idle"
											? "Start recording or simulate a conversation to see the live transcript."
											: "Waiting for speech..."}
									</p>
								)}
								{turns.map((turn) => (
									<div key={turn.id} className="group">
										<div className="mb-1 flex items-baseline gap-2">
											<Badge variant="secondary" className="shrink-0 font-mono text-xs">
												{getDisplayName(turn.speaker)}
											</Badge>
											<span className="font-mono text-muted-foreground text-xs">{formatDuration(turn.startMs)}</span>
										</div>
										<p className="pl-1 text-sm leading-relaxed">{turn.text}</p>
									</div>
								))}
								{currentCaption && (
									<div className="group opacity-60">
										<div className="mb-1 flex items-baseline gap-2">
											<Badge variant="outline" className="font-mono text-xs">
												...
											</Badge>
										</div>
										<p className="pl-1 text-sm italic leading-relaxed">{currentCaption}</p>
									</div>
								)}
								<div ref={transcriptEndRef} />
							</div>
						</ScrollArea>
					</div>
				)}

				{/* Toggle transcript button when hidden */}
				{!showTranscript && isStopped && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowTranscript(true)}
						className="-translate-y-1/2 absolute top-1/2 left-0 z-10 h-auto rounded-r-md rounded-l-none border border-l-0 bg-background px-1 py-4 shadow-sm"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				)}

				{/* Right: Insights & Evidence */}
				<div className="flex flex-1 flex-col">
					{/* Recommendations section */}
					{recommendations.length > 0 && (
						<div className="shrink-0 border-b bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
							<h2 className="mb-2 flex items-center gap-2 font-semibold text-sm">
								<Lightbulb className="h-4 w-4 text-amber-500" />
								Key Insights
								<Badge variant="secondary" className="text-xs">
									{recommendations.length}
								</Badge>
							</h2>
							<div className="space-y-2">
								{recommendations.slice(0, 5).map((rec, idx) => (
									<div key={`${rec.type}-${idx}`} className="flex items-start gap-2 text-sm">
										<Badge
											variant="outline"
											className={cn(
												"mt-0.5 shrink-0 text-xs",
												rec.type === "pain" &&
													"border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
												rec.type === "gain" &&
													"border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
												rec.type === "insight" &&
													"border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
											)}
										>
											{rec.type === "pain" ? "Problem" : rec.type === "gain" ? "Opportunity" : "Insight"}
										</Badge>
										<span className="text-muted-foreground">{rec.text}</span>
									</div>
								))}
								{recommendations.length > 5 && (
									<p className="text-muted-foreground text-xs">+{recommendations.length - 5} more insights</p>
								)}
							</div>
						</div>
					)}

					{/* Evidence stream */}
					<div className="shrink-0 border-b bg-muted/30 px-4 py-3">
						<h2 className="flex items-center gap-2 font-semibold text-sm">
							<Sparkles className="h-4 w-4" />
							Evidence Stream
							{evidence.length > 0 && (
								<Badge variant="secondary" className="text-xs">
									{evidence.length}
								</Badge>
							)}
						</h2>
					</div>
					<ScrollArea className="flex-1">
						<div className="space-y-3 p-4">
							{evidence.length === 0 && (
								<div className="space-y-2 py-8 text-center">
									{extractionStatus === "processing" ? (
										<>
											<Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
											<p className="text-muted-foreground text-sm">Analyzing transcript for evidence...</p>
										</>
									) : (
										<>
											<Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
											<p className="text-muted-foreground text-sm">
												Evidence will appear here as key moments are identified from the conversation.
											</p>
										</>
									)}
								</div>
							)}
							{evidence.map((ev, idx) => (
								<EvidenceCard
									key={`${ev.gist}-${ev.verbatim}-${idx}`}
									evidence={ev}
									index={idx}
									isNew={newEvidenceIds.has(`${ev.gist}::${ev.verbatim}`)}
									compact={isStopped}
									speakerNames={speakerNameMap}
								/>
							))}
							<div ref={evidenceEndRef} />
						</div>
					</ScrollArea>

					{/* Speakers panel */}
					{uniqueSpeakers.length > 0 && (
						<div className="shrink-0 border-t bg-muted/30 px-4 py-3">
							<h3 className="mb-2 flex items-center gap-1 font-semibold text-muted-foreground text-xs">
								<Users className="h-3 w-3" />
								Speakers in Conversation
							</h3>
							<div className="flex flex-wrap gap-2">
								{uniqueSpeakers.map((speaker) => (
									<Badge key={speaker} variant="outline" className="text-xs">
										{getDisplayName(speaker)}
									</Badge>
								))}
								{people.length > 0 && (
									<>
										<span className="text-muted-foreground text-xs">•</span>
										{people.map((person) => (
											<Badge key={person.person_key} variant="secondary" className="text-xs">
												{person.inferred_name || person.person_name || person.person_key}
												{person.role && <span className="ml-1 text-muted-foreground">({person.role})</span>}
											</Badge>
										))}
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
