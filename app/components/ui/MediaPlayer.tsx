import consola from "consola"
import { Pause, Play } from "lucide-react"
import { useRef, useState } from "react"
import { cn } from "~/lib/utils"
import { Button } from "./button"

interface MediaPlayerProps {
	mediaUrl: string
	title?: string
	className?: string
	size?: "sm" | "default" | "lg"
	duration_sec?: number // existing duration in seconds from database
}

// Helper function to format seconds as MM:SS with safe fallbacks
function formatDuration(seconds: number | null | undefined): string {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
		return "00:00"
	}
	const whole = Math.floor(seconds)
	const minutes = Math.floor(whole / 60)
	const remainingSeconds = whole % 60
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function MediaPlayer({
	mediaUrl,
	title = "Play Media",
	className,
	size = "default",
	duration_sec,
}: MediaPlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [duration, setDuration] = useState<number | null>(
		typeof duration_sec === "number" && Number.isFinite(duration_sec) && duration_sec > 0 ? Math.floor(duration_sec) : 0
	)
	const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null)

	if (!mediaUrl) return null

	// Better media type detection
	const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(mediaUrl) || /video\//i.test(mediaUrl)

	// If it's not clearly video, assume it's audio (most common for interviews)
	const mediaType = isVideo ? "video" : "audio"

	const handlePlayPause = async () => {
		if (!mediaRef.current) return

		try {
			setIsLoading(true)
			if (isPlaying) {
				mediaRef.current.pause()
				setIsPlaying(false)
			} else {
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
		const d = mediaRef.current?.duration
		if (typeof d === "number" && Number.isFinite(d) && d > 0) {
			setDuration(Math.floor(d))
		}
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
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
				<span className="flex items-center gap-1">
					{title}
					<span className="text-blue-500 text-xs">({formatDuration(duration)})</span>
				</span>
			</Button>

			{mediaType === "video" ? (
				<video
					ref={mediaRef as React.RefObject<HTMLVideoElement>}
					src={mediaUrl}
					onEnded={handleEnded}
					onLoadStart={handleLoadStart}
					onCanPlay={handleCanPlay}
					onLoadedMetadata={handleLoadedMetadata}
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
					className="hidden"
					preload="metadata"
					controls={false}
				/>
			)}
		</div>
	)
}
