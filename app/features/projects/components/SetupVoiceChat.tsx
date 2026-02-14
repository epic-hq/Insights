/**
 * SetupVoiceChat - Voice conversation mode for project setup
 *
 * Uses LiveKit for real-time voice AI conversation with VoiceOrb visualization.
 * Extracts project context from natural conversation with the AI agent.
 */

import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import "@livekit/components-styles";
import { type ConnectionState, type DisconnectReason, type Participant, RoomEvent } from "livekit-client";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { VoiceOrb, type VoiceOrbState } from "~/components/ui/voice-orb";

interface SetupVoiceChatProps {
	accountId: string;
	projectId: string;
	projectName: string;
	onSetupComplete?: () => void;
}

interface LiveKitSession {
	token: string;
	url: string;
	roomName: string;
	identity: string;
}

export function SetupVoiceChat({ accountId, projectId, projectName, onSetupComplete }: SetupVoiceChatProps) {
	const [isClient, setIsClient] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [session, setSession] = useState<LiveKitSession | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);

	useEffect(() => {
		setIsClient(true);
	}, []);

	const startVoiceChat = useCallback(async () => {
		if (!projectId || !accountId) {
			setError("Missing project context for voice setup");
			return;
		}

		setIsConnecting(true);
		setError(null);
		setConnectionState("connecting");

		try {
			const response = await fetch("/api.livekit-token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectId, accountId }),
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.error || "Unable to start voice chat");
			}

			const payload = (await response.json()) as LiveKitSession;
			setSession(payload);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Unable to connect";
			setError(message);
			setConnectionState("disconnected");
		} finally {
			setIsConnecting(false);
		}
	}, [projectId, accountId]);

	const stopVoiceChat = useCallback(() => {
		setSession(null);
		setConnectionState(null);
	}, []);

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
		);
	}

	// Active call state
	if (!isClient) return null;

	return (
		<LiveKitRoom
			key={session.roomName}
			connect
			audio
			video={false}
			token={session.token}
			serverUrl={session.url}
			data-lk-theme="default"
			className="rounded-2xl border border-border bg-card p-1 text-foreground shadow-sm"
			onConnected={() => setConnectionState("connected")}
			onDisconnected={(reason?: DisconnectReason) => {
				setConnectionState("disconnected");
				if (reason) {
					setError(typeof reason === "string" ? reason : "Disconnected from LiveKit");
				}
				stopVoiceChat();
			}}
			onError={(roomError: Error) => {
				setError(roomError.message || "LiveKit connection error");
				setConnectionState("disconnected");
				stopVoiceChat();
			}}
		>
			<VoiceChatUI
				projectName={projectName}
				onEnd={stopVoiceChat}
				onComplete={onSetupComplete}
				connectionState={connectionState}
				onConnectionStateChange={setConnectionState}
				error={error}
			/>
			<RoomAudioRenderer />
		</LiveKitRoom>
	);
}

interface VoiceChatUIProps {
	projectName: string;
	onEnd: () => void;
	onComplete?: () => void;
	connectionState: ConnectionState | null;
	onConnectionStateChange: (state: ConnectionState) => void;
	error?: string | null;
}

function VoiceChatUI({
	projectName,
	onEnd,
	onComplete,
	connectionState,
	onConnectionStateChange,
	error,
}: VoiceChatUIProps) {
	const room = useRoomContext();
	const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
	const [orbState, setOrbState] = useState<VoiceOrbState>("idle");
	const [audioLevel, setAudioLevel] = useState(0);

	// Track connection state directly from room events
	useEffect(() => {
		const handleConnectionChange = (state: ConnectionState) => {
			onConnectionStateChange(state);
			if (state === "connected") {
				setOrbState(isMicrophoneEnabled ? "listening" : "idle");
			} else if (state === "reconnecting" || state === "connecting") {
				setOrbState("processing");
			} else {
				setOrbState("idle");
			}
		};

		const handleReconnected = () => handleConnectionChange("connected");
		const handleReconnecting = () => handleConnectionChange("reconnecting");
		const handleDisconnected = () => handleConnectionChange("disconnected");

		handleConnectionChange(room.state);

		room.on(RoomEvent.ConnectionStateChanged, handleConnectionChange);
		room.on(RoomEvent.Reconnected, handleReconnected);
		room.on(RoomEvent.Reconnecting, handleReconnecting);
		room.on(RoomEvent.Disconnected, handleDisconnected);

		return () => {
			room.off(RoomEvent.ConnectionStateChanged, handleConnectionChange);
			room.off(RoomEvent.Reconnected, handleReconnected);
			room.off(RoomEvent.Reconnecting, handleReconnecting);
			room.off(RoomEvent.Disconnected, handleDisconnected);
		};
	}, [room, isMicrophoneEnabled, onConnectionStateChange]);

	// Track connection state
	useEffect(() => {
		const handleActiveSpeakers = (speakers: Participant[]) => {
			const localSpeaker = speakers.find((p) => p.isLocal);
			const remoteSpeaker = speakers.find((p) => !p.isLocal);

			setAudioLevel(localSpeaker?.audioLevel ?? 0);

			if (remoteSpeaker) {
				setOrbState("speaking");
			} else if (connectionState === "connected") {
				setOrbState(isMicrophoneEnabled ? "listening" : "idle");
			}
		};

		room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);

		return () => {
			room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
		};
	}, [connectionState, isMicrophoneEnabled, room]);

	// Track audio levels for visualization
	useEffect(() => {
		if (!localParticipant) return;

		const interval = setInterval(() => {
			// Use the SDK-provided audio level to animate the orb
			setAudioLevel(localParticipant.audioLevel ?? 0);
		}, 100);

		return () => clearInterval(interval);
	}, [localParticipant]);

	const statusText = useMemo(() => {
		switch (connectionState) {
			case "connected":
				return `Connected to ${projectName}`;
			case "reconnecting":
				return "Reconnecting to voice agent...";
			case "disconnected":
				return "Disconnected";
			case "connecting":
			default:
				return "Connecting...";
		}
	}, [connectionState, projectName]);

	const toggleMute = useCallback(async () => {
		if (localParticipant) {
			await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
		}
	}, [localParticipant, isMicrophoneEnabled]);

	const handleEnd = useCallback(() => {
		room.disconnect();
		onConnectionStateChange("disconnected");
		onEnd();
	}, [room, onConnectionStateChange, onEnd]);

	const handleDone = useCallback(() => {
		room.disconnect();
		onConnectionStateChange("disconnected");
		onComplete?.();
	}, [room, onComplete, onConnectionStateChange]);

	return (
		<div className="flex flex-col items-center justify-center rounded-2xl bg-background px-6 py-8 text-center text-foreground">
			<VoiceOrb state={orbState} audioLevel={audioLevel} size="xl" className="mb-6" />

			<p className="mb-8 text-muted-foreground text-sm">{statusText}</p>

			{error ? <p className="mb-4 text-destructive text-sm">{error}</p> : null}

			<div className="flex items-center gap-4">
				<Button
					variant={isMicrophoneEnabled ? "secondary" : "destructive"}
					size="lg"
					onClick={toggleMute}
					className="gap-2 text-foreground"
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

				<Button variant="secondary" size="lg" onClick={handleEnd} className="gap-2 text-foreground">
					<PhoneOff className="h-5 w-5" />
					End Call
				</Button>
			</div>

			{onComplete && (
				<Button variant="ghost" onClick={handleDone} className="mt-6 text-primary">
					Done, review my answers
				</Button>
			)}
		</div>
	);
}
