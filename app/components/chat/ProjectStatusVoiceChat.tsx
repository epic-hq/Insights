import { ControlBar, LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from "@livekit/components-react"
import type { ConnectionState } from "livekit-client"
import { useEffect, useMemo, useState } from "react"
import "@livekit/components-styles"
import { Mic, MicOff, Phone } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { LiveWaveform } from "~/components/ui/live-waveform"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

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

	useEffect(() => {
		setIsClient(true)
	}, [])

	const startVoiceChat = async () => {
		console.log("[VoiceChat] Starting voice chat", {
			projectId,
			accountId,
			hasProjectId: !!projectId,
			hasAccountId: !!accountId,
		})
		if (!projectId || !accountId) {
			console.warn("[VoiceChat] Missing required context", { projectId, accountId })
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			console.log("[VoiceChat] Requesting LiveKit token", { projectId, accountId })
			const response = await fetch("/api.livekit-token", {
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
			console.log("[VoiceChat] Received session", {
				roomName: payload.roomName,
				url: payload.url,
				identity: payload.identity,
			})
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
	}

	const connectionMessage = useMemo(() => {
		if (!session) return ""
		if (!connectionState) return "Connecting..."
		if (connectionState === "connected") {
			return "Connected"
		}
		return `${connectionState}`
	}, [connectionState, session])

	useEffect(() => {
		if (session) {
			console.log("[VoiceChat] Connecting to LiveKit", {
				serverUrl: session.url,
				roomName: session.roomName,
				identity: session.identity,
				tokenPrefix: session.token ? `${session.token.slice(0, 12)}...` : "missing",
			})
		}
	}, [session])

	return (
		<div className="mb-3 space-y-3">
			{!isOpen ? (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={startVoiceChat}
								disabled={isLoading}
								className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Phone className="h-3.5 w-3.5" />
								{isLoading ? "Starting..." : "Voice"}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Interactive realtime voice chat with AI agent: Beta</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : null}

			{error ? <p className="text-destructive text-xs">{error}</p> : null}

			{isClient && isOpen && session ? (
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
					}}
					onError={(roomError: Error) => {
						const message = roomError.message || "LiveKit connection error"
						setError(message)
					}}
				>
					<Card className="border border-border bg-card">
						<CardContent className="space-y-2 p-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div
										className={`h-2 w-2 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500"} animate-pulse`}
									/>
									<span className="font-medium text-foreground text-xs">{connectionMessage}</span>
								</div>
								<div className="flex items-center gap-2">
									<MuteButton />
									<Button onClick={stopVoiceChat} variant="ghost" size="sm">
										End Call
									</Button>
								</div>
							</div>

							<div className="relative mx-auto h-24">
								<LiveWaveform
									active={connectionState === "connected"}
									className="h-full w-full"
									barColor="hsl(var(--primary))"
								/>
							</div>

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
						</CardContent>
					</Card>
				</LiveKitRoom>
			) : null}
		</div>
	)
}

// Component for mute/unmute button
function MuteButton() {
	const { isMicrophoneEnabled, localParticipant } = useLocalParticipant()
	const [isMuted, setIsMuted] = useState(false)

	// Sync with LiveKit state
	useEffect(() => {
		setIsMuted(!isMicrophoneEnabled)
	}, [isMicrophoneEnabled])

	const toggleMute = async () => {
		if (localParticipant) {
			const newState = !isMicrophoneEnabled
			try {
				await localParticipant.setMicrophoneEnabled(newState)
				setIsMuted(!newState)
			} catch (error) {
				console.error("Failed to toggle microphone:", error)
			}
		}
	}

	return (
		<Button
			onClick={toggleMute}
			variant={isMuted ? "destructive" : "ghost"}
			size="sm"
			className="h-9 w-9 p-0"
			title={isMuted ? "Unmute microphone" : "Mute microphone"}
		>
			{isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
		</Button>
	)
}
