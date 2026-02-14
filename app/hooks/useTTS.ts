/**
 * useTTS — Hook for managing text-to-speech playback via OpenAI TTS API.
 *
 * Supports:
 * - Global auto-read toggle (persisted to localStorage)
 * - Per-message playback (play specific message text)
 * - Sentence-chunked streaming for low perceived latency
 * - Automatic interruption on new messages or toggle-off
 * - Coexistence with LiveKit voice chat (auto-disables during calls)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import consola from "consola";

const TTS_STORAGE_KEY = "uppy-tts-enabled";
const TTS_API_PATH = "/api/tts";

/** Boundaries for sentence chunking — split on sentence endings */
const SENTENCE_BOUNDARY = /(?<=[.!?\n])\s+/;

interface UseTTSOptions {
	/** Whether LiveKit voice chat is currently active */
	voiceChatActive?: boolean;
}

interface UseTTSReturn {
	/** Whether auto-read for new responses is enabled */
	isEnabled: boolean;
	/** Toggle auto-read on/off */
	toggleEnabled: () => void;
	/** Set auto-read explicitly */
	setEnabled: (enabled: boolean) => void;
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** ID of the message currently being played */
	playingMessageId: string | null;
	/** Play TTS for a specific text. Returns a promise that resolves when done. */
	playText: (text: string, messageId?: string) => Promise<void>;
	/** Stop any currently playing audio */
	stopPlayback: () => void;
	/** Whether TTS is disabled due to voice chat being active */
	isDisabledByVoiceChat: boolean;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
	const { voiceChatActive = false } = options;

	const [isEnabled, setIsEnabledState] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(TTS_STORAGE_KEY) === "true";
	});

	const [isPlaying, setIsPlaying] = useState(false);
	const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

	// Refs for managing audio playback lifecycle
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const objectUrlRef = useRef<string | null>(null);

	// Save enabled state to localStorage
	const setEnabled = useCallback((enabled: boolean) => {
		setIsEnabledState(enabled);
		if (typeof window !== "undefined") {
			localStorage.setItem(TTS_STORAGE_KEY, String(enabled));
		}
	}, []);

	const toggleEnabled = useCallback(() => {
		setEnabled(!isEnabled);
		// If turning off, stop any current playback
		if (isEnabled) {
			stopPlaybackInternal();
		}
	}, [isEnabled, setEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

	// Clean up object URLs to prevent memory leaks
	const cleanupObjectUrl = useCallback(() => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
	}, []);

	// Internal stop function
	const stopPlaybackInternal = useCallback(() => {
		// Abort any in-flight fetch
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		// Stop and clean up audio element
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.src = "";
			audioRef.current = null;
		}
		cleanupObjectUrl();
		setIsPlaying(false);
		setPlayingMessageId(null);
	}, [cleanupObjectUrl]);

	// Public stop function
	const stopPlayback = useCallback(() => {
		stopPlaybackInternal();
	}, [stopPlaybackInternal]);

	// Play text via OpenAI TTS
	const playText = useCallback(
		async (text: string, messageId?: string) => {
			if (voiceChatActive) return;
			if (!text.trim()) return;

			// Stop any current playback first
			stopPlaybackInternal();

			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			setIsPlaying(true);
			if (messageId) setPlayingMessageId(messageId);

			try {
				// For shorter texts, send as one chunk. For longer texts, split by sentences
				// and send the first chunk immediately for lower perceived latency.
				const chunks = text.length > 200 ? splitIntoChunks(text) : [text];

				for (const chunk of chunks) {
					if (abortController.signal.aborted) break;

					const response = await fetch(TTS_API_PATH, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ text: chunk }),
						signal: abortController.signal,
					});

					if (!response.ok) {
						consola.error("TTS: API returned error", response.status);
						break;
					}

					if (abortController.signal.aborted) break;

					// Convert response to blob and play
					const audioBlob = await response.blob();
					if (abortController.signal.aborted) break;

					cleanupObjectUrl();
					const audioUrl = URL.createObjectURL(audioBlob);
					objectUrlRef.current = audioUrl;

					await playAudioBlob(audioUrl, abortController.signal);
				}
			} catch (error) {
				if ((error as Error).name !== "AbortError") {
					consola.error("TTS: Playback error", error);
				}
			} finally {
				if (!abortController.signal.aborted) {
					setIsPlaying(false);
					setPlayingMessageId(null);
					cleanupObjectUrl();
				}
			}
		},
		[voiceChatActive, stopPlaybackInternal, cleanupObjectUrl]
	);

	// Auto-disable when voice chat becomes active
	useEffect(() => {
		if (voiceChatActive) {
			stopPlaybackInternal();
		}
	}, [voiceChatActive, stopPlaybackInternal]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopPlaybackInternal();
		};
	}, [stopPlaybackInternal]);

	return {
		isEnabled,
		toggleEnabled,
		setEnabled,
		isPlaying,
		playingMessageId,
		playText,
		stopPlayback,
		isDisabledByVoiceChat: voiceChatActive,
	};
}

/** Split text into sentence-based chunks for streaming TTS */
function splitIntoChunks(text: string): string[] {
	const sentences = text.split(SENTENCE_BOUNDARY).filter((s) => s.trim().length > 0);

	// Group sentences into chunks of ~150-300 chars for good TTS flow
	const chunks: string[] = [];
	let current = "";

	for (const sentence of sentences) {
		if (current.length + sentence.length > 300 && current.length > 0) {
			chunks.push(current.trim());
			current = sentence;
		} else {
			current += (current ? " " : "") + sentence;
		}
	}
	if (current.trim()) {
		chunks.push(current.trim());
	}

	return chunks.length > 0 ? chunks : [text];
}

/** Play an audio blob URL and return a promise that resolves when playback ends */
function playAudioBlob(url: string, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const audio = new Audio(url);

		const cleanup = () => {
			audio.removeEventListener("ended", onEnded);
			audio.removeEventListener("error", onError);
			signal.removeEventListener("abort", onAbort);
		};

		const onEnded = () => {
			cleanup();
			resolve();
		};

		const onError = (event: Event) => {
			cleanup();
			const audioError = (event.target as HTMLAudioElement)?.error;
			reject(new Error(`Audio playback error: ${audioError?.message || "unknown"}`));
		};

		const onAbort = () => {
			audio.pause();
			audio.src = "";
			cleanup();
			reject(new DOMException("Aborted", "AbortError"));
		};

		audio.addEventListener("ended", onEnded);
		audio.addEventListener("error", onError);
		signal.addEventListener("abort", onAbort);

		audio.play().catch((error: Error) => {
			cleanup();
			reject(error);
		});
	});
}
