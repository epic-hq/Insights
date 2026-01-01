/**
 * SetupVoiceChat - Voice conversation mode for project setup
 *
 * Uses LiveKit for real-time voice AI conversation with VoiceOrb visualization.
 * Extracts project context from natural conversation with the AI agent.
 */

import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useRoomContext } from "@livekit/components-react"
import "@livekit/components-styles"
import { RoomEvent } from "livekit-client"
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "~/components/ui/button"
import { VoiceOrb, type VoiceOrbState } from "~/components/ui/voice-orb"

interface SetupVoiceChatProps {
	accountId: string
	projectId: string
	projectName: string
	onSetupComplete?: () => void
}

interface LiveKitSession {
	token: string
	url: string
	roomName: string
	identity: string
}

export function SetupVoiceChat({ accountId, projectId, projectName, onSetupComplete }: SetupVoiceChatProps) {
	const [isClient, setIsClient] = useState(false)
	const [isConnecting, setIsConnecting] = useState(false)
	const [session, setSession] = useState<LiveKitSession | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setIsClient(true)
	}, [])

	const startVoiceChat = useCallback(async () => {
		if (!projectId || !accountId) return

		setIsConnecting(true)
		setError(null)

		try {
			const response = await fetch("/api.livekit-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectId, accountId }),
			})

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(payload.error || "Unable to start voice chat")
			}

			const payload = (await response.json()) as LiveKitSession
			setSession(payload)
		} catch (e) {
			const message = e instanceof Error ? e.message : "Unable to connect"
			setError(message)
		} finally {
			setIsConnecting(false)
		}
	}, [projectId, accountId])

	const stopVoiceChat = useCallback(() => {
		setSession(null)
	}, [])

	// Pre-call state
	if (!session) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<VoiceOrb state="idle" size="xl" className="mb-8" />

				<h2 className="mb-2 font-semibold text-xl">Voice Setup</h2>
				<p className="mb-8 max-w-md text-muted-foreground">
					Have a natural conversation to set up {projectName}. I'll ask you about your research goals and target
					customers.
				</p>

				{error && <p className="mb-4 text-destructive text-sm">{error}</p>}

				<Button onClick={startVoiceChat} disabled={isConnecting} size="lg" className="gap-2">
					<Phone className="h-5 w-5" />
					{isConnecting ? "Connecting..." : "Start Voice Chat"}
				</Button>
			</div>
		)
	}

	// Active call state
	if (!isClient) return null

	return (
		<LiveKitRoom
			connect
			audio
			video={false}
			token={session.token}
			serverUrl={session.url}
			data-lk-theme="default"
			onError={(e: Error) => setError(e.message)}
		>
			<VoiceChatUI projectName={projectName} onEnd={stopVoiceChat} onComplete={onSetupComplete} />
			<RoomAudioRenderer />
		</LiveKitRoom>
	)
}

interface VoiceChatUIProps {
	projectName: string
	onEnd: () => void
	onComplete?: () => void
}

function VoiceChatUI({ projectName, onEnd, onComplete }: VoiceChatUIProps) {
	const room = useRoomContext()
	const { isMicrophoneEnabled, localParticipant } = useLocalParticipant()
	const [orbState, setOrbState] = useState<VoiceOrbState>("idle")
	const [audioLevel, setAudioLevel] = useState(0)
	const [statusText, setStatusText] = useState("Connecting...")

	// Track connection state
	useEffect(() => {
		const handleConnected = () => {
			setStatusText("Connected - speak when ready")
			setOrbState("listening")
		}

		const handleDisconnected = () => {
			setStatusText("Disconnected")
			setOrbState("idle")
		}

		room.on(RoomEvent.Connected, handleConnected)
		room.on(RoomEvent.Disconnected, handleDisconnected)

		// Check if already connected
		if (room.state === "connected") {
			handleConnected()
		}

		return () => {
			room.off(RoomEvent.Connected, handleConnected)
			room.off(RoomEvent.Disconnected, handleDisconnected)
		}
	}, [room])

	// Track audio levels for visualization
	useEffect(() => {
		if (!localParticipant) return

		const interval = setInterval(() => {
			const audioTrack = localParticipant.audioTrackPublications.values().next().value
			if (audioTrack?.track) {
				// Get audio level from track (simplified - would need AudioAnalyser for real implementation)
				const level = Math.random() * 0.3 + (isMicrophoneEnabled ? 0.1 : 0)
				setAudioLevel(level)
			}
		}, 100)

		return () => clearInterval(interval)
	}, [localParticipant, isMicrophoneEnabled])

	// Update orb state based on mic status
	useEffect(() => {
		if (room.state !== "connected") {
			setOrbState("processing")
		} else if (isMicrophoneEnabled) {
			setOrbState("listening")
		} else {
			setOrbState("idle")
		}
	}, [room.state, isMicrophoneEnabled])

	const toggleMute = useCallback(async () => {
		if (localParticipant) {
			await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
		}
	}, [localParticipant, isMicrophoneEnabled])

	const handleEnd = useCallback(() => {
		room.disconnect()
		onEnd()
	}, [room, onEnd])

	const handleDone = useCallback(() => {
		room.disconnect()
		onComplete?.()
	}, [room, onComplete])

	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<VoiceOrb state={orbState} audioLevel={audioLevel} size="xl" className="mb-6" />

			<p className="mb-8 text-muted-foreground text-sm">{statusText}</p>

			<div className="flex items-center gap-4">
				<Button
					variant={isMicrophoneEnabled ? "outline" : "destructive"}
					size="lg"
					onClick={toggleMute}
					className="gap-2"
				>
					{isMicrophoneEnabled ? (
						<>
							<Mic className="h-5 w-5" />
							Mute
						</>
					) : (
						<>
							<MicOff className="h-5 w-5" />
							Unmute
						</>
					)}
				</Button>

				<Button variant="outline" size="lg" onClick={handleEnd} className="gap-2">
					<PhoneOff className="h-5 w-5" />
					End Call
				</Button>
			</div>

			{onComplete && (
				<Button variant="ghost" onClick={handleDone} className="mt-6 text-muted-foreground">
					Done, review my answers
				</Button>
			)}
		</div>
	)
}
