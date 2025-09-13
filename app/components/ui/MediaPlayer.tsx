import consola from "consola"
import { Play, Pause } from "lucide-react"
import { useRef, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "./button"
import { cn } from "~/lib/utils"

interface MediaPlayerProps {
	mediaUrl: string
	title?: string
	className?: string
	size?: "sm" | "default" | "lg"
	interviewId?: string
	accountId?: string
	projectId?: string
	existingDuration?: number // existing duration in minutes from database
	onDurationDetected?: (duration: number) => void
}

export function MediaPlayer({ 
	mediaUrl, 
	title = "Play Media", 
	className, 
	size = "default",
	interviewId,
	accountId,
	projectId,
	existingDuration,
	onDurationDetected 
}: MediaPlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [duration, setDuration] = useState<number | null>(existingDuration ? existingDuration * 60 : null) // convert minutes to seconds
	const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null)
	const fetcher = useFetcher()

	if (!mediaUrl) return null

	// Better media type detection
	const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(mediaUrl) || /video\//i.test(mediaUrl)
	const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(mediaUrl) || /audio\//i.test(mediaUrl)
	
	// If it's neither clearly video nor audio, assume it's audio (most common for interviews)
	const mediaType = isVideo ? 'video' : 'audio'

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
			consola.error('Error playing media:', error)
			alert('Unable to play media. Please check the file format and try again.')
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
		if (mediaRef.current && mediaRef.current.duration) {
			const mediaDuration = Math.floor(mediaRef.current.duration)
			setDuration(mediaDuration)
			
			// Save duration to database if we don't already have it and have the required IDs
			if (interviewId && accountId && projectId && mediaDuration > 0 && !existingDuration) {
				fetcher.submit(
					{ duration_seconds: mediaDuration },
					{
						method: "POST",
						action: `/a/${accountId}/${projectId}/interviews/${interviewId}/api/update-duration`,
						encType: "application/json"
					}
				)
			}
			
			// Call callback if provided 
			if (onDurationDetected && mediaDuration > 0) {
				onDurationDetected(mediaDuration)
			}
		}
	}

	const formatDuration = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const remainingSeconds = seconds % 60

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
		}
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				onClick={handlePlayPause}
				size={size}
				variant="outline"
				disabled={isLoading}
				className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600"
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
					{duration && (
						<span className="text-blue-500 text-xs">({formatDuration(duration)})</span>
					)}
				</span>
			</Button>

			{mediaType === 'video' ? (
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