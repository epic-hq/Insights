import consola from "consola"
import { Download, FastForward, Pause, Play, Rewind, Volume2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "~/lib/utils"
import { Button } from "./button"
import { Slider } from "./slider"

interface EnhancedMediaPlayerProps {
	mediaUrl: string
	startTime?: string | number // Can be seconds or MM:SS format
	endTime?: string | number
	title?: string
	className?: string
	size?: "sm" | "default" | "lg"
	duration_sec?: number
	autoPlay?: boolean
	showDebug?: boolean
}

// Helper function to convert time to seconds - handle multiple formats
function parseTimeToSeconds(time: string | number | undefined): number {
	if (typeof time === "number") return time
	if (!time) return 0

	// Handle MM:SS format
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

	// Handle milliseconds (if > 3600, likely milliseconds)
	if (typeof time === "string") {
		const parsed = Number.parseFloat(time)
		if (!Number.isNaN(parsed)) {
			// If the number is very large, it might be milliseconds
			if (parsed > 3600) {
				return parsed / 1000 // Convert milliseconds to seconds
			}
			return parsed
		}
	}

	return 0
}

// Helper function to format seconds as MM:SS or HH:MM:SS
function formatDuration(seconds: number | null | undefined): string {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
		return "00:00"
	}
	const whole = Math.floor(seconds)
	const hours = Math.floor(whole / 3600)
	const minutes = Math.floor((whole % 3600) / 60)
	const secs = whole % 60

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
	}

	return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function EnhancedMediaPlayer({
	mediaUrl,
	startTime,
	endTime,
	title = "Play Media",
	className,
	size = "default",
	duration_sec,
	autoPlay = false,
	showDebug = false,
}: EnhancedMediaPlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState<number | null>(
		typeof duration_sec === "number" && Number.isFinite(duration_sec) && duration_sec > 0
			? Math.floor(duration_sec)
			: null
	)
	const [volume, setVolume] = useState(1)
	const [shouldLoad, setShouldLoad] = useState(false) // Lazy load media
	const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null)

	// Cleanup when component unmounts or URL changes
	useEffect(() => {
		return () => {
			if (mediaRef.current) {
				mediaRef.current.pause()
				mediaRef.current.src = ""
				mediaRef.current.load()
			}
		}
	}, [mediaUrl])

	const startSeconds = parseTimeToSeconds(startTime)
	const endSeconds = parseTimeToSeconds(endTime)

	if (!mediaUrl) return null

	// Better media type detection
	const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(mediaUrl) || /video\//i.test(mediaUrl)
	const mediaType = isVideo ? "video" : "audio"

	const handlePlayPause = async () => {
		// Load media on first play
		if (!shouldLoad) {
			setShouldLoad(true)
			setIsLoading(true)
			// Wait for next render cycle when media element exists
			setTimeout(async () => {
				if (mediaRef.current) {
					try {
						if (startSeconds > 0) {
							mediaRef.current.currentTime = startSeconds
						}
						await mediaRef.current.play()
						setIsPlaying(true)
					} catch (error) {
						consola.error("Error playing media:", error)
						alert("Unable to play media. Please check the file format and try again.")
					} finally {
						setIsLoading(false)
					}
				}
			}, 100)
			return
		}

		if (!mediaRef.current) return

		try {
			setIsLoading(true)
			if (isPlaying) {
				mediaRef.current.pause()
				setIsPlaying(false)
			} else {
				// Set start time if specified
				if (startSeconds > 0) {
					mediaRef.current.currentTime = startSeconds
				}
				await mediaRef.current.play()
				setIsPlaying(true)
			}
		} catch (error) {
			consola.error("Error playing media:", error)
			alert("Unable to play media. Please check the file format and try again.")
		} finally {
			setIsLoading(false)
		}
	}

	const handleSeekToStart = () => {
		if (mediaRef.current && startSeconds > 0) {
			mediaRef.current.currentTime = startSeconds
			setCurrentTime(startSeconds)
		}
	}

	const handleSkipForward = () => {
		if (mediaRef.current) {
			mediaRef.current.currentTime = Math.min(
				mediaRef.current.currentTime + 10,
				duration || mediaRef.current.duration || 0
			)
		}
	}

	const handleSkipBackward = () => {
		if (mediaRef.current) {
			mediaRef.current.currentTime = Math.max(mediaRef.current.currentTime - 10, 0)
		}
	}

	const handleSeek = (value: number[]) => {
		if (mediaRef.current && duration) {
			const newTime = (value[0] / 100) * duration
			mediaRef.current.currentTime = newTime
			setCurrentTime(newTime)
		}
	}

	const handleVolumeChange = (value: number[]) => {
		const newVolume = value[0] / 100
		setVolume(newVolume)
		if (mediaRef.current) {
			mediaRef.current.volume = newVolume
		}
	}

	const handleDownload = () => {
		const link = document.createElement("a")
		link.href = mediaUrl
		link.download = mediaUrl.split("/").pop() || "media-file"
		link.setAttribute("download", link.download)
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	const handleTimeUpdate = () => {
		if (mediaRef.current) {
			const current = mediaRef.current.currentTime
			setCurrentTime(current)

			// Auto-pause at end time if specified
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

		// Auto-play if requested and start time is set
		if (autoPlay && startSeconds > 0) {
			handlePlayPause()
		}
	}

	const handleLoadedMetadata = () => {
		const d = mediaRef.current?.duration
		if (typeof d === "number" && Number.isFinite(d) && d > 0) {
			setDuration(Math.floor(d))
		}
	}

	const handleError = (e: React.SyntheticEvent<HTMLMediaElement, Event>) => {
		setIsLoading(false)
		const error = (e.target as HTMLMediaElement).error
		consola.error("Media load error:", {
			code: error?.code,
			message: error?.message,
			mediaUrl,
		})
		alert(`Failed to load media: ${error?.message || "Unknown error"}. Check console for details.`)
	}

	// Calculate progress percentage
	const progressPercentage = duration ? (currentTime / duration) * 100 : 0

	// Format time range display
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

	return (
		<div className={cn("relative w-full max-w-md space-y-3", className)}>
			{/* Target time in upper right */}
			{/* {timeRangeDisplay && (
				<div className="-top-5 absolute right-0 text-muted-foreground text-xs">{timeRangeDisplay}</div>
			)} */}

			{/* Main Controls Row */}
			<div className="flex items-center gap-3">
				<Button
					onClick={handlePlayPause}
					size={size}
					variant="outline"
					disabled={isLoading}
					className="flex items-center gap-2 border-blue-500 text-blue-600 hover:border-blue-600 hover:bg-blue-50"
				>
					{isLoading ? (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
					) : isPlaying ? (
						<Pause className="h-4 w-4" />
					) : (
						<Play className="h-4 w-4" />
					)}
				</Button>

				{/* Rewind/Fast-forward Controls */}
				<Button
					onClick={handleSkipBackward}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Rewind 10s"
				>
					<Rewind className="h-3 w-3" />
				</Button>

				<Button
					onClick={handleSkipForward}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Fast-forward 10s"
				>
					<FastForward className="h-3 w-3" />
				</Button>

				{/* Current Time / Total Duration */}
				<div className="flex flex-1 items-center justify-center gap-1 text-muted-foreground text-xs">
					<span>{formatDuration(currentTime)}</span>
					{duration && (
						<>
							<span>/</span>
							<span>{formatDuration(duration)}</span>
						</>
					)}
				</div>

				{/* Download button */}
				<Button
					onClick={handleDownload}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Download media file"
				>
					<Download className="h-3 w-3" />
				</Button>
			</div>

			{/* Progress Slider */}
			{duration && (
				<Slider value={[progressPercentage]} onValueChange={handleSeek} max={100} step={0.1} className="w-full" />
			)}

			{/* Volume Control */}
			<div className="flex items-center gap-2">
				<Volume2 className="h-3 w-3 text-muted-foreground" />
				<Slider value={[volume * 100]} onValueChange={handleVolumeChange} max={100} step={1} className="w-24" />
			</div>

			{/* Debug Information */}
			{showDebug && (
				<details className="text-xs">
					<summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
					<div className="mt-1 space-y-1 rounded bg-gray-50 p-2 text-xs">
						<div>Raw startTime: {JSON.stringify(startTime)}</div>
						<div>Raw endTime: {JSON.stringify(endTime)}</div>
						<div>Parsed startSeconds: {startSeconds}</div>
						<div>Parsed endSeconds: {endSeconds}</div>
						<div>Current time: {currentTime.toFixed(2)}s</div>
						<div>Duration: {duration}s</div>
						<div>Media URL: {mediaUrl}</div>
					</div>
				</details>
			)}

			{/* Only load media when user clicks play - lazy loading for memory management */}
			{shouldLoad &&
				(mediaType === "video" ? (
					<video
						ref={mediaRef as React.RefObject<HTMLVideoElement>}
						src={mediaUrl}
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
						ref={mediaRef as React.RefObject<HTMLAudioElement>}
						src={mediaUrl}
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
