import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { createClient } from "~/lib/supabase/client"

const TARGET_SAMPLE_RATE = 16000
// Timers are imprecise; target ~100ms but enforce >= 60ms per packet
const CHUNK_MS = 100
const MIN_OUT_MS = 60

type TurnMsg = {
	type: "Turn"
	transcript: string
	end_of_turn: boolean
	turn_is_formatted: boolean
	words: { text: string; start: number; end: number; confidence: number; word_is_final: boolean }[]
}

type FinalTurn = {
	key: string
	formatted: boolean
	turn: TurnMsg
}

export default function QuickRealtime() {
	const { accountId, projectId } = useCurrentProject()
	const supabase = createClient()
	const navigate = useNavigate()
	const basePath = `/a/${accountId}/${projectId}`
	const [status, setStatus] = useState<"idle" | "connecting" | "streaming" | "stopped" | "error">("idle")
	const [log, setLog] = useState<string[]>([])
	const [finalTurns, setFinalTurns] = useState<FinalTurn[]>([])
	const [_draftTurn, setDraftTurn] = useState<TurnMsg | null>(null)
	const [interviewId, setInterviewId] = useState<string | null>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const ctxRef = useRef<AudioContext | null>(null)
	const nodeRef = useRef<AudioWorkletNode | null>(null)
	const bufferRef = useRef<Float32Array[]>([])
	const timerRef = useRef<number | null>(null)
	const recRef = useRef<MediaRecorder | null>(null)
	const recChunksRef = useRef<BlobPart[]>([])
	const insufficientRef = useRef(false)
	const firstSendRef = useRef(true)

	function appendLog(m: string) {
		setLog((l) => [m, ...l].slice(0, 200))
	}

	useEffect(() => {
		return () => stop()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stop])

	async function start() {
		try {
			setStatus("connecting")

			// Create interview record on server (project-scoped)
			const startRes = await fetch(`${basePath}/api/interviews/realtime-start`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			})
			const startData = await startRes.json()
			if (!startRes.ok) throw new Error(startData?.error || "Failed to start interview")
			setInterviewId(startData.interviewId as string)

			// Connect to our server proxy
			const scheme = window.location.protocol === "https:" ? "wss" : "ws"
			const url = `${scheme}://${window.location.host}/ws/realtime-transcribe`
			const ws = new WebSocket(url, ["binary"]) // we send binary PCM frames
			ws.binaryType = "arraybuffer"
			wsRef.current = ws

			ws.onopen = async () => {
				appendLog("WS open → starting mic")
				setStatus("streaming")

				// 3) Setup AudioWorklet pipeline
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
				// If you do not want local loopback, do not connect to destination
				// node.connect(ctx.destination)

				// Also start browser recording (webm/opus) for saving audio
				try {
					const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
					recRef.current = rec
					recChunksRef.current = []
					rec.ondataavailable = (e) => {
						if (e.data && e.data.size > 0) recChunksRef.current.push(e.data)
					}
					rec.start(500)
				} catch {
					appendLog("MediaRecorder unsupported; audio won't be saved")
				}

				node.port.onmessage = (e) => {
					bufferRef.current.push(e.data as Float32Array)
				}

				const sendChunk = () => {
					// Only send if we have enough input samples to produce >= MIN_OUT_MS at target rate
					const minOutSamples = Math.ceil((TARGET_SAMPLE_RATE * MIN_OUT_MS) / 1000) // e.g., 960 for 60ms
					const minInputSamples = Math.ceil((ctx.sampleRate * MIN_OUT_MS) / 1000) // e.g., 2880 for 60ms at 48k
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
						// If we still fell short due to rounding, skip this tick
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
							const key = computeTurnKey(t)
							setFinalTurns((prev) => {
								if (prev.length > 0 && prev[prev.length - 1].key === key) {
									const last = prev[prev.length - 1]
									if (t.turn_is_formatted && !last.formatted) {
										const updated = prev.slice(0, -1)
										updated.push({ key, formatted: true, turn: t })
										return updated
									}
									return prev
								}
								return [...prev, { key, formatted: !!t.turn_is_formatted, turn: t }]
							})
							setDraftTurn(null)
						} else {
							setDraftTurn(t)
						}
					} else if ((msg as any).type === "Error") {
						appendLog(`Server error: ${text}`)
					} else if ((msg as any).type === "Begin") {
						setFinalTurns([])
						setDraftTurn(null)
						appendLog("Streaming begun")
					}
				} catch (_e: any) {
					// ignore non-JSON frames
				}
			}

			ws.onerror = (_e: Event) => {
				appendLog("WS error")
				setStatus("error")
			}

			ws.onclose = (evt) => {
				appendLog(`WS closed code=${evt.code} reason=${evt.reason || ""}`)
				setStatus("stopped")
			}
		} catch (err: any) {
			appendLog(`Error: ${err.message}`)
			setStatus("error")
			stop()
		}
	}

	function stop() {
		// Snapshot current final turns before any state resets
		const turnsSnapshot = finalTurns.map((f) => f.turn)
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
		if (wsRef.current) {
			try {
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
		setDraftTurn(null)
		setStatus("stopped")

		// Stop and save recording, then finalize transcript
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
					if (blob.size > 0 && interviewId) {
						const uploadEndpoint = `${basePath}/api/interviews/realtime-upload`
						const formData = new FormData()
						formData.append("file", blob, `realtime-${interviewId}-${Date.now()}.webm`)
						formData.append("interviewId", interviewId)
						formData.append("projectId", projectId ?? "")

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
									appendLog("Audio upload response missing mediaUrl")
								}
							} else {
								const errorText = await response.text().catch(() => "")
								appendLog(`Audio upload failed: ${response.status} ${response.statusText} ${errorText.slice(0, 120)}`)
							}
						} catch (uploadError) {
							appendLog(`Audio upload error: ${(uploadError as Error).message ?? uploadError}`)
						}
					}

					if (interviewId) {
						const transcript = turnsSnapshot.map((t) => t.transcript).join(" ")
						await fetch(`${basePath}/api/interviews/realtime-finalize`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								interviewId,
								transcript,
								transcriptFormatted: { turns: turnsSnapshot },
								mediaUrl,
							}),
						})
						// Navigate to interview detail
						navigate(`${basePath}/interviews/${interviewId}`)
					}
				}
			} catch {}
		})()
		// Now that we've queued finalize, clear the UI transcript state
		setFinalTurns([])
	}

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

	// No base64 needed for Universal-Streaming; we send binary frames.

	function computeTurnKey(t: TurnMsg): string {
		if (t.words && t.words.length > 0) {
			const start = t.words[0]?.start ?? 0
			const end = t.words[t.words.length - 1]?.end ?? 0
			return `${start}-${end}`
		}
		return `tx-${t.transcript.length}:${t.transcript.slice(0, 32)}`
	}

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			<h1 className="font-semibold text-2xl">Live Recording</h1>

			<div className="flex gap-3">
				<button
					className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
					onClick={start}
					disabled={status === "streaming" || status === "connecting"}
				>
					{status === "connecting" ? "Connecting…" : status === "streaming" ? "Streaming…" : "Start"}
				</button>
				<button
					className="rounded border px-4 py-2"
					onClick={stop}
					disabled={status !== "streaming" && status !== "connecting"}
				>
					Stop
				</button>
			</div>

			<section className="space-y-2">
				<h2 className="font-medium">Transcript</h2>
				<div className="h-64 overflow-auto rounded border p-3 text-sm">
					{finalTurns.map(({ turn: t }, i) => (
						<div key={`final-${i}`} className="mb-2">
							<div>{t.transcript}</div>
							<div className="text-gray-500 text-xs">
								{t.words?.map((w, j) => (
									<span key={j} title={`start:${w.start} end:${w.end} conf:${w.confidence.toFixed(2)}`}>
										{w.text}{" "}
									</span>
								))}
							</div>
						</div>
					))}
					{finalTurns.length === 0 && <div className="text-gray-400">Say something…</div>}
				</div>
			</section>

			<section>
				<h2 className="font-medium">Log</h2>
				<pre className="max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs">{log.map((l, _i) => `${l}\n`)}</pre>
			</section>
		</div>
	)
}
