import consola from "consola"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAudioIntensity } from "./use-audio-intensity"
import { useMediaRecorder } from "./use-media-recorder"

type UseSpeechToTextOptions = {
	onTranscription?: (text: string) => void
}

type SpeechToTextState = {
	startRecording: () => void
	stopRecording: () => void
	isRecording: boolean
	isTranscribing: boolean
	error: string | null
	isSupported: boolean
	intensity: number
}

const recorderErrorMessages: Record<string, string> = {
	permission_denied: "Microphone permission denied",
	media_in_use: "Microphone is already in use",
	invalid_media_constraints: "Requested microphone constraints are not supported",
	recorder_error: "Unable to start recording",
	no_specified_media_found: "No microphone detected",
	no_constraints: "No microphone constraints provided",
	media_aborted: "Microphone access aborted",
	stopping: "",
	stopped: "",
	idle: "",
	recording: "",
	acquiring_media: "",
	delayed_start: "",
	paused: "",
	unknown: "Recording error",
}

export function useSpeechToText({ onTranscription }: UseSpeechToTextOptions = {}): SpeechToTextState {
	const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
	const [isTranscribing, setIsTranscribing] = useState(false)
	const isMounted = useRef(true)

	useEffect(() => {
		return () => {
			isMounted.current = false
		}
	}, [])

	const isSupported = useMemo(() => {
		return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
	}, [])

	const {
		status,
		startRecording,
		stopRecording,
		previewAudioStream,
		clearBlobUrl,
		error: recorderError,
	} = useMediaRecorder({
		audio: true,
		video: false,
		stopStreamsOnStop: true,
		onStop: async (_blobUrl, blob) => {
			if (!blob || blob.size === 0) {
				setTranscriptionError("No audio captured, please try again.")
				return
			}

			setIsTranscribing(true)
			setTranscriptionError(null)

			try {
				const response = await fetch("/api/transcribe", {
					method: "POST",
					body: blob,
				})

				const transcript = await response.text()
				if (!response.ok) {
					throw new Error(`Transcription failed (${response.status})`)
				}

				const cleaned = transcript.trim()
				if (cleaned.length > 0) {
					onTranscription?.(cleaned)
				} else {
					setTranscriptionError("No speech detected in recording.")
				}
			} catch (error: any) {
				consola.error("Transcription error", error)
				setTranscriptionError("Failed to transcribe audio. Please try again.")
			} finally {
				if (isMounted.current) {
					setIsTranscribing(false)
				}
			}
		},
	})

	const intensity = useAudioIntensity(previewAudioStream)

	useEffect(() => {
		if (!recorderError || recorderError === "NONE") return
		const friendly = recorderErrorMessages[recorderError] || recorderErrorMessages.unknown
		setTranscriptionError(friendly)
	}, [recorderError])

	const handleStart = useCallback(() => {
		if (!isSupported) {
			setTranscriptionError("Microphone not supported in this browser.")
			return
		}
		setTranscriptionError(null)
		clearBlobUrl()
		startRecording()
	}, [clearBlobUrl, isSupported, startRecording])

	const isRecording = status === "recording"

	return {
		startRecording: handleStart,
		stopRecording,
		isRecording,
		isTranscribing,
		error: transcriptionError,
		isSupported,
		intensity,
	}
}
