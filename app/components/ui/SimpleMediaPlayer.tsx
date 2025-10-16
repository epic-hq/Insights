import consola from "consola"
import { Download } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "~/lib/utils"
import { Button } from "./button"

export interface SimpleMediaPlayerProps {
	mediaUrl: string
	startTime?: string | number
	title?: string
	className?: string
	autoPlay?: boolean
	showDebug?: boolean
	lazyLoad?: boolean // Only fetch signed URL when user clicks play
}

function parseTimeToSeconds(time: string | number | undefined): number {
	if (typeof time === "number") return time
	if (!time) return 0

	if (typeof time === "string") {
		// Handle millisecond format like "2500ms"
		if (time.endsWith("ms")) {
			const ms = Number.parseFloat(time.replace("ms", ""))
			if (!Number.isNaN(ms)) {
				return ms / 1000
			}
		}

		// Handle MM:SS or HH:MM:SS format
		if (time.includes(":")) {
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

		// Handle plain numbers
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

function isAudioFile(url: string): boolean {
	return /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(url)
}

function isVideoFile(url: string): boolean {
	return /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(url)
}

export function SimpleMediaPlayer({
	mediaUrl,
	startTime,
	title = "Play Media",
	className,
	autoPlay = false,
	showDebug = false,
	lazyLoad = true, // Default to lazy loading
}: SimpleMediaPlayerProps) {
	const startSeconds = parseTimeToSeconds(startTime)
	const [isClient, setIsClient] = useState(false)
	const [signedUrl, setSignedUrl] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasUserInteracted, setHasUserInteracted] = useState(false)
	const audioRef = useRef<HTMLAudioElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		setIsClient(true)
	}, [])

	// Fetch signed URL - either on mount (if autoPlay or !lazyLoad) or when user clicks play
	const fetchSignedUrl = useCallback(async () => {
		if (signedUrl) return // Already fetched
		
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
			if (data.signedUrl) {
				setSignedUrl(data.signedUrl)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to load media"
			consola.error("Error fetching signed URL:", err)
			setError(message)
		} finally {
			setIsLoading(false)
		}
	}, [mediaUrl, signedUrl])

	// Auto-fetch if autoPlay is enabled or lazyLoad is disabled
	useEffect(() => {
		if (!lazyLoad || autoPlay) {
			void fetchSignedUrl()
		}
	}, [lazyLoad, autoPlay, fetchSignedUrl])

	// Handle user clicking play button
	const handlePlayClick = useCallback(() => {
		setHasUserInteracted(true)
		void fetchSignedUrl()
	}, [fetchSignedUrl])

	// Set start time when signed URL is loaded and refs are available
	useEffect(() => {
		if (!signedUrl || startSeconds <= 0) return

		const audio = audioRef.current
		const video = videoRef.current
		const element = audio || video
		
		if (!element) return

		const setStartTime = () => {
			element.currentTime = startSeconds
		}

		// Wait for metadata to be loaded before setting time
		const handleLoadedMetadata = () => {
			setStartTime()
		}

		// If metadata is already loaded, set immediately
		if (element.readyState >= 1) {
			setStartTime()
		} else {
			element.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true })
		}

		return () => {
			element.removeEventListener("loadedmetadata", handleLoadedMetadata)
		}
	}, [signedUrl, startSeconds, mediaUrl])

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

	if (error) {
		return (
			<div className={cn("rounded-md border border-destructive bg-destructive/10 p-4", className)}>
				<p className="text-destructive text-sm">{error}</p>
			</div>
		)
	}

	// Show loading state
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

	// Show play button if lazy loading and not yet loaded
	if (lazyLoad && !signedUrl && !hasUserInteracted) {
		const isAudio = isAudioFile(mediaUrl)
		const isVideo = isVideoFile(mediaUrl)
		
		return (
			<div className={cn("relative w-full", className)}>
				<div className="flex items-center justify-between gap-3 mb-3">
					<span className="font-medium text-sm">{title}</span>
				</div>
				<button
					type="button"
					onClick={handlePlayClick}
					className={cn(
						"group relative w-full overflow-hidden rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors",
						isVideo ? "aspect-video" : "h-16"
					)}
				>
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="rounded-full bg-primary/90 p-4 group-hover:bg-primary transition-colors">
							<svg className="h-8 w-8 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						</div>
					</div>
					{isVideo && (
						<div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
							Click to load video
						</div>
					)}
					{isAudio && (
						<div className="absolute left-4 text-sm text-muted-foreground">
							Click to load audio
						</div>
					)}
				</button>
			</div>
		)
	}

	if (!signedUrl) {
		return null
	}

	const isAudio = isAudioFile(mediaUrl)
	const isVideo = isVideoFile(mediaUrl)

	return (
		<div className={cn("relative w-full space-y-3", className)}>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm font-medium">{title}</span>
				<Button
					onClick={() => {
						void handleDownload()
					}}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Download media file"
				>
					<Download className="h-3 w-3" />
				</Button>
			</div>

			{startSeconds > 0 && (
				<div className="text-right text-xs text-muted-foreground">
					Start time: {Math.floor(startSeconds / 60)}:{String(Math.floor(startSeconds % 60)).padStart(2, "0")}
				</div>
			)}

			{isClient && (
				<>
					{isAudio ? (
						<audio ref={audioRef} src={signedUrl} controls autoPlay={autoPlay || hasUserInteracted} className="w-full" />
					) : isVideo ? (
						<video 
							ref={videoRef} 
							src={signedUrl} 
							controls 
							autoPlay={autoPlay || hasUserInteracted} 
							className="aspect-video w-full rounded-md border bg-black"
						/>
					) : (
						<video ref={videoRef} src={signedUrl} controls autoPlay={autoPlay || hasUserInteracted} className="w-full rounded-md border" />
					)}
				</>
			)}

			{showDebug && (
				<details className="text-xs">
					<summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
					<div className="mt-1 space-y-1 rounded bg-gray-50 p-2 text-xs">
						<div>Original URL: {mediaUrl}</div>
						<div>Signed URL: {signedUrl || 'Not loaded'}</div>
						<div>Start time: {startSeconds}s</div>
						<div>Media type: {isAudio ? "audio" : isVideo ? "video" : "unknown"}</div>
						<div>Lazy load: {lazyLoad ? 'enabled' : 'disabled'}</div>
					</div>
				</details>
			)}
		</div>
	)
}
