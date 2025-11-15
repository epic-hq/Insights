import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DataPacket_Kind, Room, RoomEvent, Track } from "livekit-client"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import {
        createEmptyDiscoveryData,
        createEmptyPostSalesData,
        type DiscoveryFormData,
        type PostSalesFormData,
        type VoiceAgentMessage,
        type VoiceConversationEntry,
        type VoiceMode,
        voiceAgentMessageSchema,
} from "../voice-types"

interface VoiceChatWidgetProps {
        accountId?: string
        projectId?: string
}

interface VoiceClientSession {
        sessionId: string
        interviewId?: string
        roomName: string
        url: string
        token: string
        identity: string
        mode: VoiceMode
}

interface SnapshotState {
        discoveryData: DiscoveryFormData
        postSalesData: PostSalesFormData
        conversation: VoiceConversationEntry[]
        completed: boolean
        interviewId?: string
}

const DISCOVERY_FIELDS: { key: keyof DiscoveryFormData; label: string }[] = [
        { key: "icpCompany", label: "Ideal customer company" },
        { key: "icpRole", label: "Primary buyer / user role" },
        { key: "productDescription", label: "Product or service description" },
        { key: "keyFeatures", label: "Key features" },
        { key: "problems", label: "Customer problems" },
        { key: "unknowns", label: "Unknowns to validate" },
]

const POST_SALES_FIELDS: { key: keyof PostSalesFormData; label: string }[] = [
        { key: "companyName", label: "Company name" },
        { key: "participants", label: "People and titles" },
        { key: "topics", label: "Topics discussed" },
        { key: "needs", label: "Customer needs" },
        { key: "openQuestions", label: "Open questions" },
        { key: "objections", label: "Customer objections / risks" },
        { key: "nextSteps", label: "Next steps" },
        { key: "opportunityStage", label: "Opportunity stage" },
        { key: "opportunitySize", label: "Opportunity size" },
]

const textDecoder = new TextDecoder()

export function VoiceChatWidget({ accountId, projectId }: VoiceChatWidgetProps) {
        const [mode, setMode] = useState<VoiceMode>("discovery")
        const [session, setSession] = useState<VoiceClientSession | null>(null)
        const [isDialogOpen, setDialogOpen] = useState(false)
        const [isRequestingSession, setRequestingSession] = useState(false)
        const [isConnecting, setConnecting] = useState(false)
        const [isConnected, setConnected] = useState(false)
        const [isMicEnabled, setMicEnabled] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const [missingFields, setMissingFields] = useState<string[]>([])
        const [syncing, setSyncing] = useState(false)

        const [discoveryData, setDiscoveryData] = useState<DiscoveryFormData>(createEmptyDiscoveryData)
        const [postSalesData, setPostSalesData] = useState<PostSalesFormData>(createEmptyPostSalesData)
        const [conversation, setConversation] = useState<VoiceConversationEntry[]>([])
        const [completed, setCompleted] = useState(false)

        const roomRef = useRef<Room | null>(null)
        const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
        const syncTimeoutRef = useRef<number | null>(null)
        const snapshotRef = useRef<SnapshotState>({
                discoveryData,
                postSalesData,
                conversation,
                completed,
                interviewId: undefined,
        })

        const discoveryMissingCount = useMemo(() => {
                return DISCOVERY_FIELDS.reduce((count, field) => {
                        const value = discoveryData[field.key]
                        if (Array.isArray(value)) return count + (value.length === 0 ? 1 : 0)
                        return count + (value && String(value).trim().length > 0 ? 0 : 1)
                }, 0)
        }, [discoveryData])

        const postSalesMissingCount = useMemo(() => {
                return POST_SALES_FIELDS.reduce((count, field) => {
                        const value = postSalesData[field.key]
                        if (Array.isArray(value)) {
                                return count + (value.length === 0 ? 1 : 0)
                        }
                        if (field.key === "participants") {
                                const participants = postSalesData.participants
                                return count + (participants.length === 0 ? 1 : 0)
                        }
                        return count + (value && String(value).trim().length > 0 ? 0 : 1)
                }, 0)
        }, [postSalesData])

        const missingCount = mode === "discovery" ? discoveryMissingCount : postSalesMissingCount

        const resetSyncTimer = useCallback(() => {
                if (syncTimeoutRef.current) {
                        window.clearTimeout(syncTimeoutRef.current)
                        syncTimeoutRef.current = null
                }
        }, [])

        const scheduleSync = useCallback(() => {
                if (!session) return
                resetSyncTimer()
                syncTimeoutRef.current = window.setTimeout(() => {
                        syncTimeoutRef.current = null
                        void (async () => {
                                setSyncing(true)
                                try {
                                        const payload = {
                                                sessionId: session.sessionId,
                                                interviewId: snapshotRef.current.interviewId,
                                                mode: session.mode,
                                                discoveryData: snapshotRef.current.discoveryData,
                                                postSalesData: snapshotRef.current.postSalesData,
                                                conversation: snapshotRef.current.conversation,
                                                completed: snapshotRef.current.completed,
                                        }
                                        const response = await fetch(
                                                `/a/${accountId}/${projectId}/api/project-chat/voice-turn`,
                                                {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify(payload),
                                                }
                                        )

                                        if (response.ok) {
                                                const data = await response.json()
                                                snapshotRef.current.interviewId = data.interviewId || snapshotRef.current.interviewId
                                                setMissingFields(Array.isArray(data.missingFields) ? data.missingFields : [])
                                        } else {
                                                setError("Failed to save voice session snapshot.")
                                        }
                                } catch (err) {
                                        console.error("[VoiceChat] sync error", err)
                                        setError("Failed to sync with the server.")
                                } finally {
                                        setSyncing(false)
                                }
                        })()
                }, 400)
        }, [accountId, projectId, resetSyncTimer, session])

        const mergeStringArray = useCallback((current: string[], incoming?: string[]) => {
                if (!incoming || incoming.length === 0) return current
                const set = new Set<string>()
                for (const value of current) {
                        if (value) set.add(value.trim())
                }
                for (const value of incoming) {
                        if (value) set.add(value.trim())
                }
                return Array.from(set).filter(Boolean)
        }, [])

        const mergeParticipants = useCallback(
                (
                        current: PostSalesFormData["participants"],
                        incoming?: PostSalesFormData["participants"]
                ) => {
                        if (!incoming || incoming.length === 0) return current
                        const map = new Map<string, { name: string; title?: string }>()
                        for (const item of current) {
                                if (!item.name) continue
                                const key = `${item.name.toLowerCase()}::${item.title?.toLowerCase() || ""}`
                                map.set(key, item)
                        }
                        for (const item of incoming) {
                                if (!item.name) continue
                                const key = `${item.name.toLowerCase()}::${item.title?.toLowerCase() || ""}`
                                map.set(key, item)
                        }
                        return Array.from(map.values())
                },
                []
        )

        const applyDiscoveryUpdate = useCallback(
                (update: Partial<DiscoveryFormData>) => {
                        setDiscoveryData((prev) => {
                                const next: DiscoveryFormData = {
                                        icpCompany: update.icpCompany ?? prev.icpCompany,
                                        icpRole: update.icpRole ?? prev.icpRole,
                                        productDescription: update.productDescription ?? prev.productDescription,
                                        keyFeatures: mergeStringArray(prev.keyFeatures, update.keyFeatures),
                                        problems: mergeStringArray(prev.problems, update.problems),
                                        unknowns: mergeStringArray(prev.unknowns, update.unknowns),
                                }
                                snapshotRef.current.discoveryData = next
                                return next
                        })
                        scheduleSync()
                },
                [mergeStringArray, scheduleSync]
        )

        const applyPostSalesUpdate = useCallback(
                (update: Partial<PostSalesFormData>) => {
                        setPostSalesData((prev) => {
                                const next: PostSalesFormData = {
                                        companyName: update.companyName ?? prev.companyName,
                                        participants: mergeParticipants(prev.participants, update.participants),
                                        topics: mergeStringArray(prev.topics, update.topics),
                                        needs: mergeStringArray(prev.needs, update.needs),
                                        openQuestions: mergeStringArray(prev.openQuestions, update.openQuestions),
                                        objections: mergeStringArray(prev.objections, update.objections),
                                        nextSteps: mergeStringArray(prev.nextSteps, update.nextSteps),
                                        opportunityStage: update.opportunityStage ?? prev.opportunityStage,
                                        opportunitySize: update.opportunitySize ?? prev.opportunitySize,
                                }
                                snapshotRef.current.postSalesData = next
                                return next
                        })
                        scheduleSync()
                },
                [mergeParticipants, mergeStringArray, scheduleSync]
        )

        const appendConversationEntry = useCallback(
                (entry: VoiceConversationEntry) => {
                        setConversation((prev) => {
                                const next = [...prev, entry]
                                snapshotRef.current.conversation = next
                                return next
                        })
                        scheduleSync()
                },
                [scheduleSync]
        )

        const updateCompleted = useCallback(
                (value: boolean) => {
                        setCompleted(value)
                        snapshotRef.current.completed = value
                        scheduleSync()
                },
                [scheduleSync]
        )

        const ensureSession = useCallback(async () => {
                if (!accountId || !projectId) return null
                setError(null)
                if (session && session.mode === mode) return session

                setRequestingSession(true)
                try {
                        const response = await fetch(
                                `/a/${accountId}/${projectId}/api/project-chat/voice-turn`,
                                {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                                sessionId: session?.sessionId,
                                                interviewId: snapshotRef.current.interviewId,
                                                mode,
                                        }),
                                }
                        )

                        if (!response.ok) {
                                const data = await response.json().catch(() => ({ error: "LiveKit unavailable" }))
                                setError(data.error || "LiveKit session unavailable.")
                                return null
                        }

                        const data = await response.json()
                        const nextSession: VoiceClientSession = {
                                sessionId: data.sessionId,
                                interviewId: data.interviewId,
                                roomName: data.roomName,
                                url: data.url,
                                token: data.token,
                                identity: data.identity,
                                mode,
                        }
                        snapshotRef.current.interviewId = data.interviewId
                        snapshotRef.current.conversation = snapshotRef.current.conversation || []
                        setSession(nextSession)
                        return nextSession
                } catch (err) {
                        console.error("[VoiceChat] failed to create session", err)
                        setError("Unable to initialize voice session.")
                        return null
                } finally {
                        setRequestingSession(false)
                }
        }, [accountId, projectId, session, mode])

        const disconnectRoom = useCallback(() => {
                const room = roomRef.current
                if (room) {
                        room.removeAllListeners()
                        room.disconnect().catch(() => {})
                        roomRef.current = null
                }
                setConnected(false)
                setMicEnabled(false)
        }, [])

        const handleAgentMessage = useCallback(
                (message: VoiceAgentMessage) => {
                        switch (message.type) {
                                case "turn": {
                                        appendConversationEntry({
                                                role: message.role,
                                                text: message.text,
                                                audioUrl: message.audioUrl,
                                                timestamp: message.timestamp || new Date().toISOString(),
                                        })
                                        break
                                }
                                case "form_update": {
                                        if (message.mode === "discovery") {
                                                applyDiscoveryUpdate(message.data)
                                        } else {
                                                applyPostSalesUpdate(message.data)
                                        }
                                        break
                                }
                                case "summary": {
                                        if (typeof message.completed === "boolean") {
                                                updateCompleted(message.completed)
                                        }
                                        if (Array.isArray(message.missingFields)) {
                                                setMissingFields(message.missingFields)
                                        }
                                        break
                                }
                                case "session": {
                                        if (message.interviewId) {
                                                snapshotRef.current.interviewId = message.interviewId
                                                scheduleSync()
                                        }
                                        break
                                }
                                case "error": {
                                        setError(message.message)
                                        break
                                }
                                default:
                                        break
                        }
                },
                [appendConversationEntry, applyDiscoveryUpdate, applyPostSalesUpdate, scheduleSync, updateCompleted]
        )

        useEffect(() => {
                snapshotRef.current.discoveryData = discoveryData
        }, [discoveryData])

        useEffect(() => {
                snapshotRef.current.postSalesData = postSalesData
        }, [postSalesData])

        useEffect(() => {
                snapshotRef.current.conversation = conversation
        }, [conversation])

        useEffect(() => {
                snapshotRef.current.completed = completed
        }, [completed])

        useEffect(() => {
                snapshotRef.current.interviewId = snapshotRef.current.interviewId
        }, [])

        useEffect(() => {
                if (!isDialogOpen) {
                        disconnectRoom()
                        return
                }
                void ensureSession()
        }, [ensureSession, disconnectRoom, isDialogOpen])

        useEffect(() => {
                const activeSession = session
                if (!isDialogOpen || !activeSession) {
                        disconnectRoom()
                        return
                }

                const room = new Room({ adaptiveStream: true, dynacast: true })
                roomRef.current = room
                setConnecting(true)
                setConnected(false)

                const handleData = (payload: Uint8Array, _participant: any, kind: DataPacket_Kind) => {
                        if (kind !== DataPacket_Kind.LOSSY) {
                                // Expecting reliable channel for JSON messages
                                try {
                                        const raw = textDecoder.decode(payload)
                                        const parsed = JSON.parse(raw)
                                        const result = voiceAgentMessageSchema.safeParse(parsed)
                                        if (result.success) {
                                                handleAgentMessage(result.data)
                                        }
                                } catch (err) {
                                        console.warn("[VoiceChat] invalid agent payload", err)
                                }
                        }
                }

                room.on(RoomEvent.DataReceived, handleData)

                const handleTrackSubscribed = (track: Track) => {
                        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
                                track.attach(remoteAudioRef.current)
                        }
                }

                const handleTrackUnsubscribed = (track: Track) => {
                        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
                                track.detach(remoteAudioRef.current)
                        }
                }

                room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
                room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)

                room
                        .connect(activeSession.url, activeSession.token, { autoSubscribe: true })
                        .then(async () => {
                                setConnecting(false)
                                setConnected(true)
                                try {
                                        await room.localParticipant.setMicrophoneEnabled(true)
                                        setMicEnabled(true)
                                        const payload = {
                                                type: "session_init" as const,
                                                sessionId: activeSession.sessionId,
                                                roomName: activeSession.roomName,
                                                accountId: accountId ?? "",
                                                projectId: projectId ?? "",
                                                mode,
                                                interviewId: snapshotRef.current.interviewId,
                                        }
                                        await room.localParticipant.publishData(
                                                new TextEncoder().encode(JSON.stringify(payload)),
                                                DataPacket_Kind.RELIABLE,
                                        )
                                } catch (err) {
                                        console.error("[VoiceChat] failed to enable microphone", err)
                                }
                        })
                        .catch((err) => {
                                console.error("[VoiceChat] LiveKit connection error", err)
                                setConnecting(false)
                                setError("Unable to connect to the voice agent.")
                        })

                room.on(RoomEvent.Disconnected, () => {
                        setConnected(false)
                        setMicEnabled(false)
                })

                return () => {
                                room.off(RoomEvent.DataReceived, handleData)
                                room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
                                room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
                                room.disconnect().catch(() => {})
                                roomRef.current = null
                                setConnected(false)
                                setMicEnabled(false)
                        }
        }, [handleAgentMessage, isDialogOpen, session, disconnectRoom])

        useEffect(() => () => {
                resetSyncTimer()
                disconnectRoom()
        }, [disconnectRoom, resetSyncTimer])

        const toggleDialog = useCallback(() => {
                setDialogOpen((prev) => !prev)
                setError(null)
        }, [])

        const toggleMode = useCallback(
                (nextMode: VoiceMode) => {
                        if (nextMode === mode) return
                        setMode(nextMode)
                        disconnectRoom()
                        setSession(null)
                        setMissingFields([])
                        snapshotRef.current.completed = false
                        setCompleted(false)
                },
                [disconnectRoom, mode]
        )

        const toggleMicrophone = useCallback(async () => {
                const room = roomRef.current
                if (!room) return
                try {
                        const next = !isMicEnabled
                        await room.localParticipant.setMicrophoneEnabled(next)
                        setMicEnabled(next)
                } catch (err) {
                        console.error("[VoiceChat] toggle microphone failed", err)
                        setError("Unable to toggle microphone.")
                }
        }, [isMicEnabled])

        return (
                <Card className="border-blue-100 bg-white/80 shadow-sm dark:border-blue-900/40 dark:bg-neutral-900/70">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                                <div>
                                        <CardTitle className="text-lg font-semibold">Voice Project Intake</CardTitle>
                                        <p className="text-muted-foreground text-sm">
                                                Press the swirl to talk through project context or post-sales updates.
                                        </p>
                                </div>
                                <div className="flex items-center gap-2">
                                        <button
                                                type="button"
                                                className={cn(
                                                        "relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-blue-200 bg-gradient-to-br from-blue-500 via-violet-500 to-sky-400 text-white shadow-md transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                                                        completed && "ring-2 ring-green-400"
                                                )}
                                                onClick={toggleDialog}
                                                disabled={isRequestingSession}
                                        >
                                                <span className="absolute inset-0 animate-[spin_6s_linear_infinite] bg-[conic-gradient(var(--tw-gradient-stops))] opacity-60" />
                                                <span className="relative z-10 text-2xl">🌀</span>
                                        </button>
                                        <div className="text-right text-xs font-medium text-muted-foreground">
                                                {missingCount === 0 ? "All fields captured" : `${missingCount} fields remaining`}
                                        </div>
                                </div>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                        <button
                                                type="button"
                                                onClick={() => toggleMode("discovery")}
                                                className={cn(
                                                        "rounded-full border px-3 py-1",
                                                        mode === "discovery"
                                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                                : "border-transparent bg-muted"
                                                )}
                                        >
                                                Product Discovery
                                        </button>
                                        <button
                                                type="button"
                                                onClick={() => toggleMode("postSales")}
                                                className={cn(
                                                        "rounded-full border px-3 py-1",
                                                        mode === "postSales"
                                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                                : "border-transparent bg-muted"
                                                )}
                                        >
                                                Post-sales Call Update
                                        </button>
                                </div>
                                <Separator />
                                <div className="grid gap-4 md:grid-cols-2">
                                        {mode === "discovery" ? renderDiscoveryCards(discoveryData) : renderPostSalesCards(postSalesData)}
                                </div>
                        </CardContent>

                        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                                <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                                <DialogTitle className="text-lg font-semibold">
                                                        {mode === "discovery"
                                                                ? "Product discovery voice assistant"
                                                                : "Post-sales call update assistant"}
                                                </DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4">
                                                <audio ref={remoteAudioRef} autoPlay className="hidden" />
                                                <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                                                        <div>
                                                                <p className="font-medium">
                                                                        {isConnecting
                                                                                ? "Connecting to voice agent..."
                                                                                : completed
                                                                                ? "All required details captured"
                                                                                : isConnected
                                                                                ? "You can speak freely—turn detection will handle pauses"
                                                                                : "Press connect to begin the conversation"}
                                                                </p>
                                                                <p className="text-muted-foreground text-sm">
                                                                        We listen for pauses before replying so you are never interrupted.
                                                                </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                                <Button
                                                                        type="button"
                                                                        variant={isMicEnabled ? "destructive" : "default"}
                                                                        onClick={toggleMicrophone}
                                                                        disabled={!isConnected || isConnecting}
                                                                >
                                                                        {isMicEnabled ? "Mute" : "Unmute"}
                                                                </Button>
                                                        </div>
                                                </div>
                                                {error ? (
                                                        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                                                {error}
                                                        </div>
                                                ) : null}
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>
                                                                {isRequestingSession
                                                                        ? "Preparing LiveKit session..."
                                                                        : syncing
                                                                        ? "Saving conversation..."
                                                                        : missingFields.length > 0
                                                                        ? `Still need: ${missingFields.join(", ")}`
                                                                        : completed
                                                                        ? "All required details captured"
                                                                        : "Listening for new details"}
                                                        </span>
                                                        <span>{session?.roomName}</span>
                                                </div>
                                                <div className="grid gap-3">
                                                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                                                Conversation
                                                        </h3>
                                                        <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border bg-background/60 p-3">
                                                                {conversation.length === 0 ? (
                                                                        <p className="text-muted-foreground text-sm">
                                                                                Start speaking to capture your first turn.
                                                                        </p>
                                                                ) : (
                                                                        conversation.map((entry, index) => (
                                                                                <div key={index} className="space-y-1">
                                                                                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                                                                                                <span>{entry.role === "assistant" ? "Assistant" : "You"}</span>
                                                                                                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                                                                        </div>
                                                                                        <Textarea readOnly value={entry.text} className="min-h-[80px] resize-none bg-muted/40" />
                                                                                </div>
                                                                        ))
                                                                )}
                                                        </div>
                                                </div>
                                        </div>
                                </DialogContent>
                        </Dialog>
                </Card>
        )
}

function renderDiscoveryCards(discoveryData: DiscoveryFormData) {
        return DISCOVERY_FIELDS.map(({ key, label }) => {
                const value = discoveryData[key]
                const isComplete = Array.isArray(value)
                        ? value.length > 0
                        : Boolean(value && String(value).trim())

                return (
                        <div
                                key={key}
                                className={cn(
                                        "rounded-lg border bg-white/50 p-3 text-sm shadow-sm transition dark:bg-neutral-900/80",
                                        isComplete ? "border-green-200 ring-1 ring-green-200" : "border-gray-200"
                                )}
                        >
                                <div className="flex items-center justify-between">
                                        <span className="font-medium">{label}</span>
                                        <span
                                                className={cn(
                                                        "text-xs font-semibold uppercase",
                                                        isComplete ? "text-green-600" : "text-muted-foreground"
                                                )}
                                        >
                                                {isComplete ? "Captured" : "Needed"}
                                        </span>
                                </div>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        {Array.isArray(value) && value.length > 0 ? (
                                                <ul className="list-disc pl-4">
                                                        {value.map((item, index) => (
                                                                <li key={index}>{item}</li>
                                                        ))}
                                                </ul>
                                        ) : value ? (
                                                <p>{String(value)}</p>
                                        ) : (
                                                <p className="italic">Waiting for details...</p>
                                        )}
                                </div>
                        </div>
                )
        })
}

function renderPostSalesCards(postSalesData: PostSalesFormData) {
        return POST_SALES_FIELDS.map(({ key, label }) => {
                const value = postSalesData[key]
                let isComplete = false

                if (key === "participants") {
                        isComplete = postSalesData.participants.length > 0
                } else if (Array.isArray(value)) {
                        isComplete = value.length > 0
                } else {
                        isComplete = Boolean(value && String(value).trim())
                }

                return (
                        <div
                                key={key}
                                className={cn(
                                        "rounded-lg border bg-white/50 p-3 text-sm shadow-sm transition dark:bg-neutral-900/80",
                                        isComplete ? "border-green-200 ring-1 ring-green-200" : "border-gray-200"
                                )}
                        >
                                <div className="flex items-center justify-between">
                                        <span className="font-medium">{label}</span>
                                        <span
                                                className={cn(
                                                        "text-xs font-semibold uppercase",
                                                        isComplete ? "text-green-600" : "text-muted-foreground"
                                                )}
                                        >
                                                {isComplete ? "Captured" : "Needed"}
                                        </span>
                                </div>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        {key === "participants" ? (
                                                postSalesData.participants.length > 0 ? (
                                                        <ul className="list-disc pl-4">
                                                                {postSalesData.participants.map((participant, index) => (
                                                                        <li key={index}>
                                                                                {participant.name}
                                                                                {participant.title ? ` — ${participant.title}` : ""}
                                                                        </li>
                                                                ))}
                                                        </ul>
                                                ) : (
                                                        <p className="italic">Waiting for details...</p>
                                                )
                                        ) : Array.isArray(value) && value.length > 0 ? (
                                                <ul className="list-disc pl-4">
                                                        {value.map((item, index) => (
                                                                <li key={index}>{item}</li>
                                                        ))}
                                                </ul>
                                        ) : value ? (
                                                <p>{String(value)}</p>
                                        ) : (
                                                <p className="italic">Waiting for details...</p>
                                        )}
                                </div>
                        </div>
                )
        })
}
