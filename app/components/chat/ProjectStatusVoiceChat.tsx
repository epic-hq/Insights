import { useEffect, useMemo, useState } from "react"
import type { ConnectionState } from "livekit-client"
import { ControlBar, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react"
import "@livekit/components-styles"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

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
                if (!projectId || !accountId) return
                setIsLoading(true)
                setError(null)
                try {
                        const response = await fetch(`/api.livekit-token`, {
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
                        setIsOpen(true)
                } catch (tokenError) {
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
                if (!connectionState) return "Connecting to voice chat..."
                if (connectionState === "connected") {
                        return `Connected to ${session.roomName}`
                }
                return `Connection status: ${connectionState}`
        }, [connectionState, session])

        return (
                <div className="space-y-2">
                        <div className="flex items-center gap-2">
                                <Button onClick={startVoiceChat} disabled={isLoading || isOpen} variant="secondary">
                                        {isLoading ? "Starting..." : "Voice Chat"}
                                </Button>
                                {isOpen && (
                                        <Button onClick={stopVoiceChat} variant="ghost">
                                                End
                                        </Button>
                                )}
                        </div>
                        {error ? <p className="text-xs text-destructive">{error}</p> : null}
                        {isClient && isOpen && session ? (
                                <Card className="border-dashed border-muted-foreground/40 bg-background/80">
                                        <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">LiveKit Voice Chat</CardTitle>
                                                <p className="text-xs text-muted-foreground">{connectionMessage}</p>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                                <LiveKitRoom
                                                        connect
                                                        audio
                                                        video={false}
                                                        token={session.token}
                                                        serverUrl={session.url}
                                                        data-lk-theme="default"
                                                        onConnected={() => setConnectionState("connected")}
                                                        onDisconnected={() => setConnectionState("disconnected")}
                                                        onError={(roomError) => {
                                                                const message =
                                                                        roomError instanceof Error
                                                                                ? roomError.message
                                                                                : "LiveKit connection error"
                                                                setError(message)
                                                        }}
                                                >
                                                        <RoomAudioRenderer />
                                                        <ControlBar
                                                                variation="minimal"
                                                                controls={{
                                                                        camera: false,
                                                                        screenShare: false,
                                                                        leave: true,
                                                                        microphone: true,
                                                                        settings: false,
                                                                }}
                                                                onLeave={stopVoiceChat}
                                                        />
                                                </LiveKitRoom>
                                        </CardContent>
                                </Card>
                        ) : null}
                </div>
        )
}
