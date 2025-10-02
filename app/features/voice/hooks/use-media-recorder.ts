import consola from "consola"
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react"

// import {
//   MediaRecorder as ExtendableMediaRecorder,
//   IMediaRecorder,
//   register,
// } from 'extendable-media-recorder';
// import { connect } from 'extendable-media-recorder-wav-encoder';

export type ReactMediaRecorderRenderProps = {
	error: string
	muteAudio: () => void
	unMuteAudio: () => void
	startRecording: () => void
	pauseRecording: () => void
	resumeRecording: () => void
	stopRecording: () => void
	mediaBlobUrl: undefined | string
	status: StatusMessages
	isAudioMuted: boolean
	previewStream: MediaStream | null
	previewAudioStream: MediaStream | null
	clearBlobUrl: () => void
	deleteRecording: () => void
}

export type ReactMediaRecorderHookProps = {
	audio?: boolean | MediaTrackConstraints
	video?: boolean | MediaTrackConstraints
	screen?: boolean
	selfBrowserSurface?: SelfBrowserSurface
	onStop?: (blobUrl: string, blob: Blob) => void
	onStart?: () => void
	blobPropertyBag?: BlobPropertyBag
	mediaRecorderOptions?: MediaRecorderOptions | undefined
	customMediaStream?: MediaStream | null
	stopStreamsOnStop?: boolean
	askPermissionOnMount?: boolean
}
export type ReactMediaRecorderProps = ReactMediaRecorderHookProps & {
	render: (props: ReactMediaRecorderRenderProps) => ReactElement
}

/**
 * Experimental (optional).
 * An enumerated value specifying whether the browser should allow the user to select the current tab for capture.
 * This helps to avoid the "infinite hall of mirrors" effect experienced when a video conferencing app inadvertently shares its own display.
 * Possible values are include, which hints that the browser should include the current tab in the choices offered for capture,
 * and exclude, which hints that it should be excluded.
 * A default value is not mandated by the spec.
 * See specs at: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#selfbrowsersurface
 */
export type SelfBrowserSurface = undefined | "include" | "exclude"

export type StatusMessages =
	| "media_aborted"
	| "permission_denied"
	| "no_specified_media_found"
	| "media_in_use"
	| "invalid_media_constraints"
	| "no_constraints"
	| "recorder_error"
	| "idle"
	| "acquiring_media"
	| "delayed_start"
	| "recording"
	| "stopping"
	| "stopped"
	| "paused"

export enum RecorderErrors {
	AbortError = "media_aborted",
	NotAllowedError = "permission_denied",
	NotFoundError = "no_specified_media_found",
	NotReadableError = "media_in_use",
	OverconstrainedError = "invalid_media_constraints",
	TypeError = "no_constraints",
	NONE = "",
	NO_RECORDER = "recorder_error",
}

export function useMediaRecorder({
	audio = true,
	video = false,
	selfBrowserSurface = undefined,
	onStop = () => null,
	onStart = () => null,
	blobPropertyBag,
	screen = false,
	mediaRecorderOptions = undefined,
	customMediaStream = null,
	stopStreamsOnStop = true,
	askPermissionOnMount = false,
}: ReactMediaRecorderHookProps): ReactMediaRecorderRenderProps {
	const mediaRecorder = useRef<MediaRecorder | null>(null)
	const mediaChunks = useRef<Blob[]>([])
	const mediaStream = useRef<MediaStream | null>(null)
	const previewStream = useRef<MediaStream | null>(null)
	const previewAudioStream = useRef<MediaStream | null>(null)
	const shouldDelete = useRef<boolean>(false)
	const [status, setStatus] = useState<StatusMessages>("idle")
	const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false)
	const [mediaBlobUrl, setMediaBlobUrl] = useState<string | undefined>(undefined)
	const [error, setError] = useState<keyof typeof RecorderErrors>("NONE")
	const [init, setInit] = useState(false)

	useEffect(() => {
		// avoid re-registering the encoder
		if (init) {
			return
		}

		const setup = async () => {
			try {
				// await register(await connect());
			} catch (e) {
				//
			}
		}

		setup()
		setInit(true)
	}, [])

	const getMediaStream = useCallback(async () => {
		// If we already have a valid stream that's active, reuse it
		if (mediaStream.current && mediaStream.current.active && mediaStream.current.getAudioTracks().length > 0) {
			return mediaStream.current
		}

		setStatus("acquiring_media")
		const requiredMedia: MediaStreamConstraints = {
			audio: typeof audio === "boolean" ? !!audio : audio,
			video: typeof video === "boolean" ? !!video : video,
		}
		try {
			if (customMediaStream) {
				mediaStream.current = customMediaStream
			} else if (screen) {
				const stream = (await window.navigator.mediaDevices.getDisplayMedia({
					video: video || true,
					// @ts-expect-error experimental feature, useful for Chrome
					selfBrowserSurface,
				})) as MediaStream
				stream.getVideoTracks()[0].addEventListener("ended", () => {
					stopRecording()
				})
				if (audio) {
					const audioStream = await window.navigator.mediaDevices.getUserMedia({
						audio,
					})

					audioStream.getAudioTracks().forEach((audioTrack) => stream.addTrack(audioTrack))
				}
				mediaStream.current = stream
			} else {
				const stream = await window.navigator.mediaDevices.getUserMedia(requiredMedia)
				mediaStream.current = stream

				// Create new preview streams when we get a new media stream
				if (stream.getVideoTracks().length > 0) {
					previewStream.current = new MediaStream(stream.getVideoTracks())
				}
				if (stream.getAudioTracks().length > 0) {
					previewAudioStream.current = new MediaStream(stream.getAudioTracks())
				}
			}
			return mediaStream.current
		} catch (err: any) {
			consola.error("error", err)
			setError(err.name)
			setStatus("idle")
		}
	}, [audio, video, screen])

	useEffect(() => {
		if (!window.MediaRecorder) {
			throw new Error("Unsupported Browser")
		}

		if (screen) {
			if (!window.navigator.mediaDevices.getDisplayMedia) {
				throw new Error("This browser doesn't support screen capturing")
			}
		}

		const checkConstraints = (mediaType: MediaTrackConstraints) => {
			const supportedMediaConstraints = navigator.mediaDevices.getSupportedConstraints()
			const filteredConstraints: MediaTrackConstraints = {}

			Object.entries(mediaType).forEach(([constraint, value]) => {
				if ((supportedMediaConstraints as { [key: string]: any })[constraint]) {
					;(filteredConstraints as any)[constraint] = value
				} else {
					console.warn(`Constraint "${constraint}" is not supported in this browser and will be ignored.`)
				}
			})

			return filteredConstraints
		}

		if (typeof audio === "object") {
			audio = checkConstraints(audio)
		}
		if (typeof video === "object") {
			video = checkConstraints(video)
		}

		if (mediaRecorderOptions && mediaRecorderOptions.mimeType) {
			if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
				console.error(`The specified MIME type you supplied for MediaRecorder doesn't support this browser`)
			}
		}

		if (!mediaStream.current && askPermissionOnMount) {
			getMediaStream()
		}

		return () => {
			if (mediaStream.current) {
				const tracks = mediaStream.current.getTracks()
				tracks.forEach((track) => track.stop())
			}
		}
	}, [audio, screen, video, getMediaStream, mediaRecorderOptions, askPermissionOnMount])

	// Media Recorder Handlers

	const getSupportedMimeType = () => {
		const types = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a", "audio/aac", "audio/mpeg"]

		return types.find((type) => MediaRecorder.isTypeSupported(type)) || "audio/webm"
	}

	const startRecording = async () => {
		setError("NONE")
		if (!mediaStream.current) {
			await getMediaStream()
		}
		if (mediaStream.current) {
			const isStreamEnded = mediaStream.current.getTracks().some((track) => track.readyState === "ended")
			if (isStreamEnded) {
				await getMediaStream()
			}

			// User blocked the permissions (getMediaStream errored out)
			if (!mediaStream.current.active) {
				return
			}

			const mimeType = getSupportedMimeType()
			consola.debug("Using MIME type:", mimeType)

			mediaRecorder.current = new MediaRecorder(mediaStream.current, {
				mimeType,
				audioBitsPerSecond: 128000, // 128 kbps
				...mediaRecorderOptions,
			})
			mediaRecorder.current.ondataavailable = onRecordingActive
			mediaRecorder.current.onstop = onRecordingStop
			mediaRecorder.current.onstart = onRecordingStart
			mediaRecorder.current.onerror = () => {
				setError("NO_RECORDER")
				setStatus("idle")
			}
			mediaRecorder.current.start()
			setStatus("recording")
		}
	}

	const onRecordingActive = ({ data }: BlobEvent) => {
		mediaChunks.current.push(data)
	}

	const onRecordingStart = () => {
		onStart()
	}

	const onRecordingStop = () => {
		const [chunk] = mediaChunks.current
		const blobProperty: BlobPropertyBag = Object.assign(
			{ type: chunk.type },
			blobPropertyBag || (video ? { type: "video/mp4" } : { type: "audio/wav" })
		)
		const blob = new Blob(mediaChunks.current, blobProperty)
		const url = URL.createObjectURL(blob)
		if (shouldDelete.current) {
			setStatus("idle")
			setMediaBlobUrl(undefined)
			shouldDelete.current = false
			mediaChunks.current = []
			return
		}
		setStatus("stopped")
		setMediaBlobUrl(url)
		onStop(url, blob)
		mediaChunks.current = []
	}

	const muteAudio = (mute: boolean) => {
		setIsAudioMuted(mute)
		if (mediaStream.current) {
			mediaStream.current.getAudioTracks().forEach((audioTrack) => (audioTrack.enabled = !mute))
		}
	}

	const pauseRecording = () => {
		if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
			setStatus("paused")
			mediaRecorder.current.pause()
		}
	}
	const resumeRecording = () => {
		if (mediaRecorder.current && mediaRecorder.current.state === "paused") {
			setStatus("recording")
			mediaRecorder.current.resume()
		}
	}

	const stopRecording = useCallback(() => {
		if (mediaRecorder.current?.state === "inactive") return
		setStatus("stopping")
		mediaRecorder.current?.stop()
		if (stopStreamsOnStop) {
			mediaStream.current?.getTracks().forEach((track) => track.stop())
			mediaStream.current = null
			previewStream.current = null
			previewAudioStream.current = null
		}
		setStatus("stopped")
	}, [stopStreamsOnStop])

	return {
		error: RecorderErrors[error],
		muteAudio: () => muteAudio(true),
		unMuteAudio: () => muteAudio(false),
		startRecording,
		pauseRecording,
		resumeRecording,
		stopRecording,
		mediaBlobUrl,
		status,
		isAudioMuted,
		previewStream: previewStream.current,
		previewAudioStream: previewAudioStream.current,
		clearBlobUrl: () => {
			if (mediaBlobUrl) {
				URL.revokeObjectURL(mediaBlobUrl)
			}
			setMediaBlobUrl(undefined)
			setStatus("idle")
		},
		deleteRecording: () => {
			consola.debug("deleteRecording")
			shouldDelete.current = true
			stopRecording()
		},
	}
}

export const ReactMediaRecorder = (props: ReactMediaRecorderProps) => props.render(useMediaRecorder(props))
