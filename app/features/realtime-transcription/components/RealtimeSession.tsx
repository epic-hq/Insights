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
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"
import type { EvidenceTurn, Person } from "baml_client"
import { Mic, Square, Play, Loader2, Radio, AlertCircle, Users, Sparkles, FileText } from "lucide-react"
import { EvidenceCard } from "./EvidenceCard"

// ── Types ────────────────────────────────────────────────────────────────

interface TranscriptTurn {
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

const SAMPLE_CONVERSATION: Array<{ speaker: string; text: string; delayMs: number }> = [
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

const TARGET_SAMPLE_RATE = 16000

function downsampleTo16kPCM16(input: Float32Array, inputRate: number): Int16Array | null {
	const ratio = inputRate / TARGET_SAMPLE_RATE
	const outputLen = Math.floor(input.length / ratio)
	if (outputLen < 1) return null
	const out = new Int16Array(outputLen)
	for (let i = 0; i < outputLen; i++) {
		const srcIdx = i * ratio
		const lo = Math.floor(srcIdx)
		const hi = Math.min(lo + 1, input.length - 1)
		const frac = srcIdx - lo
		const sample = input[lo] + frac * (input[hi] - input[lo])
		out[i] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)))
	}
	return out
}

// ── Utility ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000)
	const min = Math.floor(totalSec / 60)
	const sec = totalSec % 60
	return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
}

// ── Component ────────────────────────────────────────────────────────────

export function RealtimeSession() {
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
					// Deduplicate by gist + verbatim
					const existingKeys = new Set(prev.map((e) => `${e.gist}::${e.verbatim}`))
					const fresh = data.evidence.filter(
						(e: EvidenceTurn) => !existingKeys.has(`${e.gist}::${e.verbatim}`),
					)
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
		[extractEvidence, scheduleExtraction],
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
				audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
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
								endMs: msg.words?.at(-1)?.end
									? msg.words.at(-1).end * 1000
									: Date.now() - startTimeRef.current,
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
			const timer = setTimeout(
				() => {
					const turn: TranscriptTurn = {
						id: `sim-${++turnCounter}`,
						speaker: entry.speaker,
						text: entry.text,
						startMs: cumulativeDelay,
						endMs: cumulativeDelay + entry.text.length * 30, // rough estimate
						isFinal: true,
					}
					addTurn(turn)
				},
				cumulativeDelay + 500,
			) // small buffer
			timers.push(timer)
		}

		// Auto-stop after all turns + buffer
		const stopTimer = setTimeout(
			() => {
				setMode("stopped")
				if (durationTimerRef.current) {
					clearInterval(durationTimerRef.current)
					durationTimerRef.current = null
				}
				// Final extraction
				if (allTurnsRef.current.length > lastExtractedCountRef.current) {
					extractEvidence()
				}
			},
			cumulativeDelay + 3000,
		)
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

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* ── Header ──────────────────────────────────────────────── */}
			<header className="border-b px-6 py-4 shrink-0">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<Radio
								className={cn(
									"h-5 w-5",
									isActive ? "text-red-500 animate-pulse" : "text-muted-foreground",
								)}
							/>
							<h1 className="text-lg font-semibold">Realtime Transcription & Evidence</h1>
						</div>
						<Badge variant="outline" className="text-xs">
							Prototype
						</Badge>
					</div>
					<div className="flex items-center gap-4">
						{/* Stats */}
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							<span className="flex items-center gap-1">
								<FileText className="h-3.5 w-3.5" />
								{turns.length} turns
							</span>
							<span className="flex items-center gap-1">
								<Sparkles className="h-3.5 w-3.5" />
								{evidence.length} evidence
							</span>
							{people.length > 0 && (
								<span className="flex items-center gap-1">
									<Users className="h-3.5 w-3.5" />
									{people.length} speakers
								</span>
							)}
						</div>
						{/* Duration */}
						<span className="font-mono text-lg tabular-nums">{formatDuration(duration)}</span>
					</div>
				</div>
			</header>

			{/* ── Controls ─────────────────────────────────────────────── */}
			<div className="border-b px-6 py-3 shrink-0 flex items-center gap-3">
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
						<div className="flex items-center gap-2 text-sm text-red-500">
							<span className="relative flex h-2.5 w-2.5">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
								<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
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
						<div className="flex items-center gap-2 text-sm text-blue-500">
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
							}}
							variant="outline"
							size="sm"
							className="gap-2"
						>
							<Play className="h-4 w-4" />
							New Session
						</Button>
						{extractionStatus === "processing" && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Running final extraction...
							</div>
						)}
					</>
				)}

				{/* Extraction status */}
				{extractionStatus === "processing" && mode !== "stopped" && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Extracting evidence...
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="flex items-center gap-2 text-sm text-destructive ml-auto">
						<AlertCircle className="h-3.5 w-3.5" />
						{error}
					</div>
				)}
			</div>

			{/* ── Main content: split view ─────────────────────────────── */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left: Transcript */}
				<div className="w-1/2 border-r flex flex-col">
					<div className="px-4 py-3 border-b bg-muted/30 shrink-0">
						<h2 className="text-sm font-semibold flex items-center gap-2">
							<FileText className="h-4 w-4" />
							Live Transcript
						</h2>
					</div>
					<ScrollArea className="flex-1">
						<div className="p-4 space-y-3">
							{turns.length === 0 && !currentCaption && (
								<p className="text-sm text-muted-foreground text-center py-8">
									{mode === "idle"
										? "Start recording or simulate a conversation to see the live transcript."
										: "Waiting for speech..."}
								</p>
							)}
							{turns.map((turn) => (
								<div key={turn.id} className="group">
									<div className="flex items-baseline gap-2 mb-1">
										<Badge variant="secondary" className="text-xs font-mono shrink-0">
											{turn.speaker}
										</Badge>
										<span className="text-xs text-muted-foreground font-mono">
											{formatDuration(turn.startMs)}
										</span>
									</div>
									<p className="text-sm leading-relaxed pl-1">{turn.text}</p>
								</div>
							))}
							{currentCaption && (
								<div className="group opacity-60">
									<div className="flex items-baseline gap-2 mb-1">
										<Badge variant="outline" className="text-xs font-mono">
											...
										</Badge>
									</div>
									<p className="text-sm leading-relaxed pl-1 italic">{currentCaption}</p>
								</div>
							)}
							<div ref={transcriptEndRef} />
						</div>
					</ScrollArea>
				</div>

				{/* Right: Evidence */}
				<div className="w-1/2 flex flex-col">
					<div className="px-4 py-3 border-b bg-muted/30 shrink-0">
						<h2 className="text-sm font-semibold flex items-center gap-2">
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
						<div className="p-4 space-y-3">
							{evidence.length === 0 && (
								<div className="text-center py-8 space-y-2">
									{extractionStatus === "processing" ? (
										<>
											<Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
											<p className="text-sm text-muted-foreground">
												Analyzing transcript for evidence...
											</p>
										</>
									) : (
										<>
											<Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
											<p className="text-sm text-muted-foreground">
												Evidence turns will appear here as they are extracted from the conversation.
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
								/>
							))}
							<div ref={evidenceEndRef} />
						</div>
					</ScrollArea>

					{/* People panel */}
					{people.length > 0 && (
						<div className="border-t px-4 py-3 shrink-0 bg-muted/30">
							<h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
								<Users className="h-3 w-3" />
								Identified Speakers
							</h3>
							<div className="flex flex-wrap gap-2">
								{people.map((person) => (
									<Badge key={person.person_key} variant="outline" className="text-xs">
										{person.inferred_name || person.person_name || person.person_key}
										{person.role && (
											<span className="text-muted-foreground ml-1">({person.role})</span>
										)}
									</Badge>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
