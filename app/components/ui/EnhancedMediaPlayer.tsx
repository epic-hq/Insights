import { Stream } from "@cloudflare/stream-react"
import consola from "consola"
import { Download } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { cn } from "~/lib/utils"
import { Button } from "./button"

export interface EnhancedMediaPlayerProps {
	mediaUrl: string
	startTime?: string | number // Can be seconds or MM:SS format
	title?: string
	className?: string
	autoPlay?: boolean
	showDebug?: boolean
}

type MediaIntent = "playback" | "download"

// Helper function to convert time to seconds
function parseTimeToSeconds(time: string | number | undefined): number {
	if (typeof time === "number") return time
	if (!time) return 0

	if (typeof time === "string" && time.includes(":")) {
		const parts = time.split(":")
		if (parts.length === 2) {
			const minutes = Number.parseInt(parts[0], 10) || 0
			const seconds = Number.parseInt(parts[1], 10) || 0
			return minutes * 60 + seconds
		}
		if (parts.length === 3) {
			const hours = Number.parseInt(parts[0], 10) || 0
			const minutes = Number.parseInt(parts[1], 10) || 0
			const seconds = Number.parseInt(parts[2], 10) || 0
			return hours * 3600 + minutes * 60 + seconds
		}
	}

	if (typeof time === "string") {
		const parsed = Number.parseFloat(time)
		if (!Number.isNaN(parsed)) {
			return parsed > 3600 ? parsed / 1000 : parsed
		}
	}

	return 0
}

function extractFilenameFromUrl(url: string): string | null {
	try {
		const withoutQuery = url.split("?")[0] ?? ""
		const segments = withoutQuery.split("/").filter(Boolean)
		if (!segments.length) return null
		return decodeURIComponent(segments[segments.length - 1])
	} catch {
		return null
	}
}

export function EnhancedMediaPlayer({
	mediaUrl,
	startTime,
	title = "Play Media",
	className,
	autoPlay = false,
	showDebug = false,
}: EnhancedMediaPlayerProps) {
	const startSeconds = parseTimeToSeconds(startTime)
	const [isClient, setIsClient] = useState(false)
	const [signedUrl, setSignedUrl] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setIsClient(true)
	}, [])

	// Fetch signed URL when component mounts or mediaUrl changes
	useEffect(() => {
		let cancelled = false

		const fetchSignedUrl = async () => {
			setIsLoading(true)
			setError(null)

			try {
				const response = await fetch("/api/media/signed-url", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mediaUrl, intent: "playback" }),
				})

				if (!response.ok) {
					throw new Error(`Failed to get signed URL: ${response.status}`)
				}

				const data = (await response.json()) as { signedUrl?: string }
				if (!cancelled && data.signedUrl) {
					setSignedUrl(data.signedUrl)
				}
			} catch (err) {
				if (!cancelled) {
					const message = err instanceof Error ? err.message : "Failed to load media"
					consola.error("Error fetching signed URL:", err)
					setError(message)
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		void fetchSignedUrl()

		return () => {
			cancelled = true
		}
	}, [mediaUrl])

	const handleDownload = useCallback(async () => {
		try {
			const response = await fetch("/api/media/signed-url", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					mediaUrl,
					intent: "download",
					filename: extractFilenameFromUrl(mediaUrl) ?? "media-file",
				}),
			})

			if (!response.ok) {
				alert("Failed to authorize download. Please try again.")
				return
			}

			const data = (await response.json()) as { signedUrl?: string }
			if (data.signedUrl) {
				const link = document.createElement("a")
				link.href = data.signedUrl
				link.download = extractFilenameFromUrl(data.signedUrl) ?? extractFilenameFromUrl(mediaUrl) ?? "media-file"
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)
			}
		} catch (err) {
			consola.error("Download error:", err)
			alert("Failed to download media. Please try again.")
		}
	}, [mediaUrl])

	if (!mediaUrl) return null

	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center rounded-md border bg-muted p-8", className)}>
				<div className="flex flex-col items-center gap-2">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-muted-foreground text-sm">Loading media...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className={cn("rounded-md border border-destructive bg-destructive/10 p-4", className)}>
				<p className="text-destructive text-sm">{error}</p>
			</div>
		)
	}

	if (!signedUrl) {
		return null
	}

	const ensurePlaybackSource = useCallback(async () => {
		if (playbackSource) {
			const expiresAt = playbackSource.expiresAt
			if (!expiresAt || expiresAt - Date.now() > 15_000) {
				return playbackSource.url
			}
		}

		const signed = await requestSignedUrl("playback")
		if (signed?.url) {
			setPlaybackSource(signed)
			return signed.url
		}

		consola.warn("No signed playback URL available for media", { mediaUrl })
		return null
	}, [mediaUrl, playbackSource, requestSignedUrl])

	const waitForMediaElement = useCallback(async () => {
		const maxAttempts = 20
		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			if (mediaRef.current) {
				return mediaRef.current
			}
			await sleep(25)
		}
		return mediaRef.current
	}, [])

	const handlePlayPause = useCallback(async () => {
		if (usesCloudflareStream) {
			if (shouldLoad) {
				setShouldLoad(false)
				setIsPlaying(false)
			} else {
				setShouldLoad(true)
				setIsPlaying(true)
			}
			return
		}

		if (isPlaying) {
			if (mediaRef.current) {
				mediaRef.current.pause()
			}
			setIsPlaying(false)
			return
		}

		try {
			setIsLoading(true)

			if (!shouldLoad) {
				setShouldLoad(true)
			}

			const playbackUrl = await ensurePlaybackSource()
			if (!playbackUrl) {
				throw new Error("Unable to resolve media URL for playback")
			}

			const element = await waitForMediaElement()
			if (!element) {
				throw new Error("Media element is not available")
			}

			if (element.src !== playbackUrl) {
				element.src = playbackUrl
				element.load()
			}

			if (startSeconds > 0) {
				element.currentTime = startSeconds
				setCurrentTime(startSeconds)
			}

			await element.play()
			setIsPlaying(true)
		} catch (error) {
			consola.error("Error playing media:", error)
			setShouldLoad(false)
			setPlaybackSource(null)
			alert("Unable to play media. Please check the file format and try again.")
		} finally {
			setIsLoading(false)
		}
	}, [ensurePlaybackSource, isPlaying, shouldLoad, startSeconds, usesCloudflareStream, waitForMediaElement])

	const handleSkipForward = () => {
		const element = mediaRef.current
		if (!element) return
		const computedDuration =
			duration ?? (Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0)
		const max = computedDuration > 0 ? computedDuration : element.currentTime + 10
		element.currentTime = Math.min(element.currentTime + 10, max)
	}

	const handleSkipBackward = () => {
		if (!mediaRef.current) return
		mediaRef.current.currentTime = Math.max(mediaRef.current.currentTime - 10, 0)
	}

	const handleSeek = (value: number[]) => {
		if (!mediaRef.current || !duration) return
		const newTime = (value[0] / 100) * duration
		mediaRef.current.currentTime = newTime
		setCurrentTime(newTime)
	}

	const handleVolumeChange = (value: number[]) => {
		const newVolume = value[0] / 100
		setVolume(newVolume)
		if (mediaRef.current) {
			mediaRef.current.volume = newVolume
		}
	}

	const handleDownload = useCallback(async () => {
		const fallbackName = extractFilenameFromUrl(mediaUrl) ?? "media-file"
		const signed = await requestSignedUrl("download", { filename: fallbackName })
		if (!signed?.url) {
			alert("We couldn't authorize the download for this media. Please refresh or contact support.")
			return
		}
		const downloadUrl = signed.url
		const filename = extractFilenameFromUrl(downloadUrl) ?? extractFilenameFromUrl(mediaUrl) ?? "media-file"

		const link = document.createElement("a")
		link.href = downloadUrl
		link.download = filename
		link.setAttribute("download", filename)
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}, [mediaUrl, requestSignedUrl])

	const handleTimeUpdate = () => {
		if (mediaRef.current) {
			const current = mediaRef.current.currentTime
			setCurrentTime(current)

			if (endSeconds > 0 && current >= endSeconds) {
				mediaRef.current.pause()
				setIsPlaying(false)
			}
		}
	}

	const handleEnded = () => {
		setIsPlaying(false)
	}

	const handleLoadStart = () => {
		setIsLoading(true)
	}

	const handleCanPlay = () => {
		setIsLoading(false)
	}

	const handleLoadedMetadata = () => {
		const mediaDuration = mediaRef.current?.duration
		if (typeof mediaDuration === "number" && Number.isFinite(mediaDuration) && mediaDuration > 0) {
			setDuration(Math.floor(mediaDuration))
		}
	}

	const handleError = (e: SyntheticEvent<HTMLMediaElement, Event>) => {
		setIsLoading(false)
		const error = (e.target as HTMLMediaElement).error
		consola.error("Media load error:", {
			code: error?.code,
			message: error?.message,
			mediaUrl,
		})
		alert(`Failed to load media: ${error?.message || "Unknown error"}. Check console for details.`)
	}

	useEffect(() => {
		if (!autoPlay || autoPlayTriggeredRef.current) {
			return
		}

		if (usesCloudflareStream) {
			setShouldLoad(true)
			setIsPlaying(true)
			autoPlayTriggeredRef.current = true
			return
		}

		autoPlayTriggeredRef.current = true
		void handlePlayPause()
	}, [autoPlay, usesCloudflareStream, handlePlayPause])

	const progressPercentage = duration ? (currentTime / duration) * 100 : 0

	const getTimeRangeDisplay = () => {
		if (startSeconds > 0) {
			const start = formatDuration(startSeconds)
			if (endSeconds > 0 && endSeconds > startSeconds) {
				const end = formatDuration(endSeconds)
				return `${start}-${end}`
			}
			return `@${start}`
		}
		return null
	}

	const timeRangeDisplay = getTimeRangeDisplay()
	const showNativeControls = !usesCloudflareStream
	const showProgressSlider = showNativeControls && Boolean(duration)
	const showVolumeControl = showNativeControls

	return (
		<div className={cn("relative w-full max-w-md space-y-3", className)}>
			<div className="flex items-center gap-3">
				<Button
					onClick={() => {
						void handlePlayPause()
					}}
					size={size}
					variant="outline"
					disabled={showNativeControls ? isLoading : false}
					className="flex items-center gap-2 border-blue-500 text-blue-600 hover:border-blue-600 hover:bg-blue-50"
				>
					{showNativeControls && isBusy ? (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
					) : isPlaying ? (
						<Pause className="h-4 w-4" />
					) : (
						<Play className="h-4 w-4" />
					)}
				</Button>

				<Button
					onClick={handleSkipBackward}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Rewind 10s"
					disabled={!showNativeControls}
				>
					<Rewind className="h-3 w-3" />
				</Button>

				<Button
					onClick={handleSkipForward}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Fast-forward 10s"
					disabled={!showNativeControls}
				>
					<FastForward className="h-3 w-3" />
				</Button>

				<div className="flex flex-1 items-center justify-center gap-1 text-muted-foreground text-xs">
					{showNativeControls ? (
						<>
							<span>{formatDuration(currentTime)}</span>
							{duration && (
								<>
									<span>/</span>
									<span>{formatDuration(duration)}</span>
								</>
							)}
						</>
					) : (
						<span>{title}</span>
					)}
				</div>

				<Button
					onClick={() => {
						void handleDownload()
					}}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Download media file"
					disabled={isSigning}
				>
					<Download className="h-3 w-3" />
				</Button>
			</div>

			{timeRangeDisplay && <div className="-mt-1 text-right text-muted-foreground text-xs">{timeRangeDisplay}</div>}

			{showProgressSlider && (
				<Slider value={[progressPercentage]} onValueChange={handleSeek} max={100} step={0.1} className="w-full" />
			)}

			{showVolumeControl && (
				<div className="flex items-center gap-2">
					<Volume2 className="h-3 w-3 text-muted-foreground" />
					<Slider value={[volume * 100]} onValueChange={handleVolumeChange} max={100} step={1} className="w-24" />
				</div>
			)}

			{usesCloudflareStream && !shouldLoad && (
				<p className="rounded border border-blue-200 border-dashed bg-blue-50/40 p-2 text-muted-foreground text-xs">
					Press play to launch the Cloudflare Stream player.
				</p>
			)}

			{showDebug && (
				<details className="text-xs">
					<summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
					<div className="mt-1 space-y-1 rounded bg-gray-50 p-2 text-xs">
						<div>Raw startTime: {JSON.stringify(startTime)}</div>
						<div>Raw endTime: {JSON.stringify(endTime)}</div>
						<div>Parsed startSeconds: {startSeconds}</div>
						<div>Parsed endSeconds: {endSeconds}</div>
						<div>Current time: {currentTime.toFixed(2)}s</div>
						<div>Duration: {duration ?? "unknown"}s</div>
						<div>Media URL: {mediaUrl}</div>
						<div>Cloudflare Stream: {usesCloudflareStream ? "yes" : "no"}</div>
						{cloudflareStreamInfo?.streamId ? <div>Stream ID: {cloudflareStreamInfo.streamId}</div> : null}
						<div>Signed source: {playbackSource?.url ?? "n/a"}</div>
						<div>Signed expiresAt: {playbackSource?.expiresAt ?? "n/a"}</div>
					</div>
				</details>
			)}

			{usesCloudflareStream && shouldLoad && cloudflareStreamInfo && (
				<div className="aspect-video w-full overflow-hidden rounded-md border">
					{isClient ? (
						<Stream
							key={`${cloudflareStreamInfo.streamId}-${cloudflareStreamInfo.token ?? "public"}`}
							src={cloudflareStreamInfo.streamId}
							controls
							autoplay={autoPlay || isPlaying}
							muted={autoPlay}
							playsInline
							token={cloudflareStreamInfo.token}
							className="h-full w-full"
						/>
					) : (
						<div className="h-full w-full animate-pulse bg-muted" />
					)}
				</div>
			)}

			{shouldLoad &&
				showNativeControls &&
				(mediaType === "video" ? (
					<video
						ref={mediaRef as RefObject<HTMLVideoElement>}
						src={playbackSource?.url ?? undefined}
						onEnded={handleEnded}
						onLoadStart={handleLoadStart}
						onCanPlay={handleCanPlay}
						onLoadedMetadata={handleLoadedMetadata}
						onTimeUpdate={handleTimeUpdate}
						onError={handleError}
						className="hidden"
						preload="metadata"
						controls={false}
					/>
				) : (
					<audio
						ref={mediaRef as RefObject<HTMLAudioElement>}
						src={playbackSource?.url ?? undefined}
						onEnded={handleEnded}
						onLoadStart={handleLoadStart}
						onCanPlay={handleCanPlay}
						onLoadedMetadata={handleLoadedMetadata}
						onTimeUpdate={handleTimeUpdate}
						onError={handleError}
						className="hidden"
						preload="metadata"
						controls={false}
					/>
				))}
		</div>
	)
}
