import { useEffect, useMemo, useState } from "react"
import type { ConnectionState } from "livekit-client"
import { ControlBar, LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useRemoteParticipants } from "@livekit/components-react"
import "@livekit/components-styles"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Orb, type AgentState } from "~/components/ui/orb"
import { Mic, MicOff, Phone } from "lucide-react"

interface ProjectStatusVoiceChatProps {
	accountId: string
	projectId: string
}

interface LiveKitSession {
	token: string
	url: string
	roomName: string
	identity: string
}

export function ProjectStatusVoiceChat({ accountId, projectId }: ProjectStatusVoiceChatProps) {
	const [isClient, setIsClient] = useState(false)
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)
	const [session, setSession] = useState<LiveKitSession | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [agentState, setAgentState] = useState<AgentState>(null)

	useEffect(() => {
		setIsClient(true)
	}, [])

	const startVoiceChat = async () => {
		console.log("[VoiceChat] Starting voice chat", { projectId, accountId, hasProjectId: !!projectId, hasAccountId: !!accountId })
		if (!projectId || !accountId) {
			console.warn("[VoiceChat] Missing required context", { projectId, accountId })
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			console.log("[VoiceChat] Requesting LiveKit token", { projectId, accountId })
			const response = await fetch(`/api.livekit-token`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectId, accountId }),
			})

			console.log("[VoiceChat] Token response status", { status: response.status, ok: response.ok })

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(payload.error || "Unable to start voice chat")
			}

			const payload = (await response.json()) as LiveKitSession
			console.log("[VoiceChat] Received session", { roomName: payload.roomName, url: payload.url, identity: payload.identity })
			setSession(payload)
			setIsOpen(true)
		} catch (tokenError) {
			console.error("[VoiceChat] Error starting voice chat", tokenError)
			const message = tokenError instanceof Error ? tokenError.message : "Unable to request LiveKit token"
			setError(message)
		} finally {
			setIsLoading(false)
		}
	}

	const stopVoiceChat = () => {
		setIsOpen(false)
		setSession(null)
		setConnectionState(null)
		setAgentState(null)
	}

	const connectionMessage = useMemo(() => {
		if (!session) return ""
		if (!connectionState) return "Connecting..."
		if (connectionState === "connected") {
			return "Connected"
		}
		return `${connectionState}`
	}, [connectionState, session])

	return (
		<div className="mb-3 space-y-3">
			{!isOpen ? (
				<button
					type="button"
					onClick={startVoiceChat}
					disabled={isLoading}
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Phone className="h-4 w-4" />
					{isLoading ? "Starting..." : "Voice Chat"}
				</button>
			) : null}

			{error ? <p className="text-xs text-destructive">{error}</p> : null}

			{isClient && isOpen && session ? (
				<Card className="border border-border bg-card">
					<CardContent className="space-y-3 p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className={`h-2 w-2 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
								<span className="text-xs font-medium text-foreground">{connectionMessage}</span>
							</div>
							<div className="flex items-center gap-2">
								<MuteButton />
								<Button onClick={stopVoiceChat} variant="ghost" size="sm">
									End Call
								</Button>
							</div>
						</div>

						<div className="relative mx-auto h-32 w-32">
							<Orb
								agentState={agentState}
								colors={["#3B82F6", "#60A5FA"]}
								className="h-full w-full"
							/>
						</div>

						<LiveKitRoom
							connect
							audio
							video={false}
							token={session.token}
							serverUrl={session.url}
							data-lk-theme="default"
							onConnected={() => setConnectionState("connected")}
							onDisconnected={() => {
								setConnectionState("disconnected")
								setAgentState(null)
							}}
							onError={(roomError) => {
								const message =
									roomError instanceof Error
										? roomError.message
										: "LiveKit connection error"
								setError(message)
							}}
						>
							<RoomAudioRenderer />
							<div className="hidden">
								<ControlBar
									variation="minimal"
									controls={{
										camera: false,
										screenShare: false,
										leave: false,
										microphone: true,
										settings: false,
									}}
								/>
							</div>
							<VoiceStateUpdater onStateChange={setAgentState} />
						</LiveKitRoom>
					</CardContent>
				</Card>
			) : null}
		</div>
	)
}

// Component for mute/unmute button
function MuteButton() {
	const { isMicrophoneEnabled, microphoneTrack } = useLocalParticipant()

	const toggleMute = () => {
		if (microphoneTrack) {
			microphoneTrack.setEnabled(!isMicrophoneEnabled)
		}
	}

	return (
		<Button
			onClick={toggleMute}
			variant={isMicrophoneEnabled ? "ghost" : "destructive"}
			size="sm"
			className="h-9 w-9 p-0"
			title={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
		>
			{isMicrophoneEnabled ? (
				<Mic className="h-4 w-4" />
			) : (
				<MicOff className="h-4 w-4" />
			)}
		</Button>
	)
}

// Component to update agent state based on LiveKit room activity
function VoiceStateUpdater({ onStateChange }: { onStateChange: (state: AgentState) => void }) {
	const remoteParticipants = useRemoteParticipants()

	useEffect(() => {
		// Start with listening state when connected
		onStateChange("listening")

		// Track if any remote participant (agent) is publishing audio
		const hasActiveAudio = remoteParticipants.some(
			participant => participant.audioTrackPublications.size > 0 &&
			Array.from(participant.audioTrackPublications.values()).some(pub => pub.isSubscribed)
		)

		if (hasActiveAudio) {
			onStateChange("talking")
		} else {
			onStateChange("listening")
		}
	}, [remoteParticipants, onStateChange])

	return null
}
