import consola from "consola"

import { Settings } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useEffect, useMemo, useState } from "react"
import { VoiceInput } from "~/components/ui/voice-input"
import { useAudioIntensity } from "./hooks/use-audio-intensity"
import { useMediaRecorder } from "./hooks/use-media-recorder"
import { useScreenWakeLock } from "./hooks/use-screen-wake-lock"

type AudioRecorderProps = {
	mode?: "default" | "progress-bar"
	onAfterTranscription?: (text: string) => void
	isMessageSending?: boolean
	onRecordingStart?: () => void
	showSettings?: boolean
}

export const AudioRecorder = ({
	onAfterTranscription,
	isMessageSending,
	mode = "default",
	onRecordingStart,
	showSettings = true,
}: AudioRecorderProps) => {
	const posthog = usePostHog()

	const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
		localStorage.getItem("selectedDeviceId") || undefined
	)

	const [_hasDeviceAccess, setHasDeviceAccess] = useState<boolean | null>(null)

	const [_hasStartedRecording, setHasStartedRecording] = useState(false)

	// Add new state for browser compatibility error
	const [browserError, setBrowserError] = useState<string | null>(null)

	// Add state for audio quality warnings
	const [_audioQualityWarning, setAudioQualityWarning] = useState<string | null>(null)

	// Platform detection
	const isIOS = useMemo(() => /iPhone|iPad|iPod/i.test(navigator.userAgent), [])
	const isIOSChrome = useMemo(() => isIOS && /CriOS/i.test(navigator.userAgent), [isIOS])

	// Define flexible audio constraints based on platform
	const audioConstraints = useMemo(() => {
		const baseConstraints = {
			deviceId: selectedDeviceId ? { ideal: selectedDeviceId } : undefined,
			echoCancellation: { ideal: true },
			noiseSuppression: { ideal: true },
		}

		// Only add these constraints for non-iOS platforms
		if (!isIOS) {
			return {
				...baseConstraints,
				sampleRate: { ideal: 16000 },
				channelCount: { ideal: 1 },
			}
		}

		return baseConstraints
	}, [selectedDeviceId, isIOS])

	const getAudioDevices = () => {
		navigator.mediaDevices.enumerateDevices().then((deviceInfos) => {
			const audioDevices = deviceInfos.filter(
				(device) => device.kind === "audioinput" && device.deviceId && device.label
			)
			setDevices(audioDevices)
		})
	}

	// useEffect(() => {
	//   getAudioDevices();
	// }, []);

	const _handleDeviceChange = (deviceId: string) => {
		setSelectedDeviceId(deviceId)
		localStorage.setItem("selectedDeviceId", deviceId)
	}

	useEffect(() => {
		let permissionStatus: PermissionStatus

		// Function to handle permission state changes
		const handlePermissionChange = () => {
			if (permissionStatus.state === "granted") {
				setHasDeviceAccess(true)
				getAudioDevices()
				if (posthog) {
					posthog.capture("audio_granted")
				}
			} else if (permissionStatus.state === "denied") {
				if (posthog) {
					posthog.capture("audio_denied")
				}
				setHasDeviceAccess(false)
				setDevices([])
			}
		}

		// Query the microphone permission status
		navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
			permissionStatus = status
			handlePermissionChange() // Check initial state
			permissionStatus.onchange = handlePermissionChange // Listen for changes
		})

		// Cleanup listener on unmount
		return () => {
			if (permissionStatus) {
				permissionStatus.onchange = null
			}
		}
	}, [getAudioDevices, posthog])

	const fileType = useMemo(() => {
		const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
		if (isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
			return "audio/mp4" // iOS Safari actually records in MP4 format
		}
		return "audio/webm" // Default for other browsers
	}, [])

	useEffect(() => {
		if (devices.length > 0 && !selectedDeviceId) {
			const defaultDevice = devices[0]
			setSelectedDeviceId(defaultDevice.deviceId)
			localStorage.setItem("selectedDeviceId", defaultDevice.deviceId)
		}
	}, [devices, selectedDeviceId])

	const [status, setStatus] = useState<"listening" | "transcribing" | "idle">("idle")

	const {
		enable: enableWakeLock,
		release: releaseWakeLock,
		state: wakeLockState,
		error: wakeLockError,
		shouldSuggestManualWorkaround,
		shouldSuggestPwa,
	} = useScreenWakeLock()

	const {
		status: recorderStatus,
		startRecording: _startRecording,
		stopRecording,
		mediaBlobUrl,
		clearBlobUrl,
		deleteRecording,
		pauseRecording,
		resumeRecording,
		previewAudioStream,
		error: recordingError,
	} = useMediaRecorder({
		askPermissionOnMount: false,
		stopStreamsOnStop: true,
		onStop: async (_blobUrl, blob) => {
			setStatus("transcribing")
			if (posthog) {
				posthog.capture("message-sent", { type: "audio", $set: { no_recent_messages: false } })
			}

			// Verify we have valid data before sending
			if (!blob || blob.size === 0) {
				consola.error("No audio data recorded")
				return
			}

			// Analyze audio quality
			const qualityCheck = await analyzeAudioQuality(blob)
			if (qualityCheck.hasIssues) {
				setAudioQualityWarning(qualityCheck.warning)
				// Continue with transcription but show warning
			} else {
				setAudioQualityWarning(null)
			}

			// Read the first few bytes to verify content
			const _firstBytes = await blob.slice(0, 32).arrayBuffer()
			// setIsRunning?.(true);

			return fetch("/api/transcribe", {
				method: "POST",
				body: blob,
			})
				.then(async (response) => {
					// await queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
					const transcription = await response?.text()
					consola.log("transcription response", transcription)

					onAfterTranscription?.(transcription)
				})
				.catch((err) => consola.error(err))
				.finally(() => {
					// clearBlobUrl();
					// setIsRunning?.(false);
					setStatus("idle")
				})
		},
		audio: audioConstraints,
		blobPropertyBag: {
			type: fileType,
			endings: "native",
		},
	})

	const voiceIntensity = useAudioIntensity(previewAudioStream)

	// Handle recording errors
	useEffect(() => {
		if (recordingError) {
			console.error("MediaRecorder error:", recordingError)
			if (isIOSChrome) {
				setBrowserError("For the best experience, please open app.sidecoach.ai in Safari browser on your iOS device.")
			}
		}
	}, [recordingError, isIOSChrome])

	const startRecording = () => {
		setBrowserError(null) // Reset error state
		setAudioQualityWarning(null) // Reset audio quality warning
		clearBlobUrl()
		void enableWakeLock()
		_startRecording()
		onRecordingStart?.()
		setHasStartedRecording(true)
	}

	const isRecording = recorderStatus === "recording"
	const isPaused = recorderStatus === "paused"

	useEffect(() => {
		if (!isRecording && !isPaused) {
			void releaseWakeLock()
		}
	}, [isPaused, isRecording, releaseWakeLock])

	const handleStopRecording = () => {
		void releaseWakeLock()
		stopRecording()
	}

	const _onMainButtonClick = () => {
		if (isPaused) {
			resumeRecording()
			// startCountdown();
		} else if (isRecording) {
			// stopCountdown();
			stopRecording()
		} else {
			// reset elapsed time when starting a new recording
			setElapsedTimeMs(0)
			// startCountdown();
			startRecording()
		}
	}

	// Add debug info about supported formats
	useEffect(() => {
		if (typeof MediaRecorder !== "undefined") {
			consola.debug("iOS Supported MIME types:", {
				mp4: MediaRecorder.isTypeSupported("audio/mp4"),
				aac: MediaRecorder.isTypeSupported("audio/aac"),
				webm: MediaRecorder.isTypeSupported("audio/webm"),
				mp4_aac: MediaRecorder.isTypeSupported("audio/mp4;codecs=aac"),
			})
		}
	}, [])

	// Define maximum recording duration in milliseconds (e.g., 60 seconds)
	const maxDurationMs = 60000 // 60 seconds

	// Use useState to track elapsed recording time in milliseconds
	const [elapsedTimeMs, setElapsedTimeMs] = useState(0)

	// Update elapsed time when recording
	useEffect(() => {
		let intervalId: NodeJS.Timeout | null = null

		if (isRecording) {
			intervalId = setInterval(() => {
				setElapsedTimeMs((prevTime) => {
					const newTime = prevTime + 100 // Update every 100ms
					if (newTime >= maxDurationMs) {
						return maxDurationMs
					}
					return newTime
				})
			}, 100)
		} else if (!isRecording && elapsedTimeMs !== 0) {
			if (intervalId) clearInterval(intervalId)
		}

		return () => {
			if (intervalId) clearInterval(intervalId)
		}
	}, [isRecording, elapsedTimeMs])

	// Calculate progress percentage
	const _progressPercentage = Math.min((elapsedTimeMs / maxDurationMs) * 100, 100)

	// Function to analyze audio quality
	const analyzeAudioQuality = async (
		blob: Blob
	): Promise<{
		hasIssues: boolean
		warning: string | null
	}> => {
		try {
			// Check audio duration (blob size can give us a rough estimate)
			const duration = blob.size / 16000 // Rough estimate based on typical audio bitrate
			if (duration < 0.5) {
				return { hasIssues: true, warning: "Recording too short. Please speak for at least 1 second." }
			}

			// Analyze audio volume using Web Audio API
			const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
			const arrayBuffer = await blob.arrayBuffer()
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

			// Get audio data from the first channel
			const channelData = audioBuffer.getChannelData(0)

			// Calculate RMS (Root Mean Square) for volume level
			let sum = 0
			let maxAmplitude = 0
			for (let i = 0; i < channelData.length; i++) {
				const amplitude = Math.abs(channelData[i])
				maxAmplitude = Math.max(maxAmplitude, amplitude)
				sum += amplitude * amplitude
			}
			const rms = Math.sqrt(sum / channelData.length)

			// Close audio context
			audioContext.close()

			// Check if volume is too low (threshold values may need adjustment)
			if (maxAmplitude < 0.1 || rms < 0.01) {
				return {
					hasIssues: true,
					warning: "Low volume detected. Please speak louder or move closer to the microphone.",
				}
			}

			// Check if audio is mostly silence
			const silentSamples = channelData.filter((sample) => Math.abs(sample) < 0.01).length
			const silenceRatio = silentSamples / channelData.length
			if (silenceRatio > 0.9) {
				return {
					hasIssues: true,
					warning: "Mostly silence detected. Please ensure you are speaking clearly.",
				}
			}

			return { hasIssues: false, warning: null }
		} catch (error) {
			console.error("Error analyzing audio quality:", error)
			// Don't block the user if analysis fails
			return { hasIssues: false, warning: null }
		}
	}

	// If there's a browser compatibility error, show the message
	if (browserError) {
		return (
			<div className="w-full rounded-md border border-yellow-200 bg-yellow-50 p-4">
				<div className="flex items-center gap-2 text-yellow-800">
					<Settings className="size-4" />
					<p>{browserError} </p>
				</div>
				<a
					href="https://app.sidecoach.ai"
					className="mt-2 block text-blue-600 text-sm hover:underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					Current browser is not supported.Please try opening app.sidecoach.ai in Safari browser on your iOS device.
				</a>
			</div>
		)
	}

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="flex w-full flex-row gap-2">
				<VoiceInput
					onStart={startRecording}
					onStop={handleStopRecording}
					status={status}
					audioIntensity={voiceIntensity}
				/>
			</div>
			{(shouldSuggestManualWorkaround || wakeLockState === "error" || wakeLockError) && (
				<div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-900">
					<p className="font-medium text-sm">Keep your screen awake while recording</p>
					<ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
						<li>
							Temporarily set Settings -&gt; Display &amp; Brightness -&gt; Auto-Lock -&gt; Never while capturing
							interviews.
						</li>
						{shouldSuggestPwa && (
							<li>
								Add this app to your iOS home screen and launch it from there for a more stable recording session.
							</li>
						)}
						<li>Keep the tab in the foreground; locking the screen stops iOS Safari from sending microphone data.</li>
					</ul>
					{wakeLockError && <p className="mt-2 text-xs">Wake lock error: {wakeLockError}</p>}
				</div>
			)}
		</div>
	)
}
