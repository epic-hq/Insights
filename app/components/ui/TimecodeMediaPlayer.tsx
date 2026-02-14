import consola from "consola";
import { Pause, Play, SkipBack } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "./button";

interface TimecodeMediaPlayerProps {
	mediaUrl: string;
	startTime?: string | number; // Can be seconds or MM:SS format
	endTime?: string | number;
	title?: string;
	className?: string;
	size?: "sm" | "default" | "lg";
	duration_sec?: number;
	autoPlay?: boolean;
}

// Helper function to convert time to seconds
function parseTimeToSeconds(time: string | number | undefined): number {
	if (typeof time === "number") return time;
	if (!time) return 0;

	// Handle MM:SS format
	if (typeof time === "string" && time.includes(":")) {
		const parts = time.split(":");
		if (parts.length === 2) {
			const minutes = Number.parseInt(parts[0], 10) || 0;
			const seconds = Number.parseInt(parts[1], 10) || 0;
			return minutes * 60 + seconds;
		}
	}

	// Handle string numbers
	if (typeof time === "string") {
		const parsed = Number.parseFloat(time);
		return Number.isNaN(parsed) ? 0 : parsed;
	}

	return 0;
}

// Helper function to format seconds as MM:SS
function formatDuration(seconds: number | null | undefined): string {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
		return "00:00";
	}
	const whole = Math.floor(seconds);
	const minutes = Math.floor(whole / 60);
	const remainingSeconds = whole % 60;
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function TimecodeMediaPlayer({
	mediaUrl,
	startTime,
	endTime,
	title = "Play Media",
	className,
	size = "default",
	duration_sec,
	autoPlay = false,
}: TimecodeMediaPlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [_currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState<number | null>(
		typeof duration_sec === "number" && Number.isFinite(duration_sec) && duration_sec > 0 ? Math.floor(duration_sec) : 0
	);
	const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);

	const startSeconds = parseTimeToSeconds(startTime);
	const endSeconds = parseTimeToSeconds(endTime);

	if (!mediaUrl) return null;

	// Better media type detection
	const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(mediaUrl) || /video\//i.test(mediaUrl);
	const mediaType = isVideo ? "video" : "audio";

	const handlePlayPause = async () => {
		if (!mediaRef.current) return;

		try {
			setIsLoading(true);
			if (isPlaying) {
				mediaRef.current.pause();
				setIsPlaying(false);
			} else {
				// Set start time if specified
				if (startSeconds > 0) {
					mediaRef.current.currentTime = startSeconds;
				}
				await mediaRef.current.play();
				setIsPlaying(true);
			}
		} catch (error) {
			consola.error("Error playing media:", error);
			alert("Unable to play media. Please check the file format and try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSeekToStart = () => {
		if (mediaRef.current && startSeconds > 0) {
			mediaRef.current.currentTime = startSeconds;
			setCurrentTime(startSeconds);
		}
	};

	const handleTimeUpdate = () => {
		if (mediaRef.current) {
			const current = mediaRef.current.currentTime;
			setCurrentTime(current);

			// Auto-pause at end time if specified
			if (endSeconds > 0 && current >= endSeconds) {
				mediaRef.current.pause();
				setIsPlaying(false);
			}
		}
	};

	const handleEnded = () => {
		setIsPlaying(false);
	};

	const handleLoadStart = () => {
		setIsLoading(true);
	};

	const handleCanPlay = () => {
		setIsLoading(false);

		// Auto-play if requested and start time is set
		if (autoPlay && startSeconds > 0) {
			handlePlayPause();
		}
	};

	const handleLoadedMetadata = () => {
		const d = mediaRef.current?.duration;
		if (typeof d === "number" && Number.isFinite(d) && d > 0) {
			setDuration(Math.floor(d));
		}
	};

	// Format time range display
	const getTimeRangeDisplay = () => {
		if (startSeconds > 0) {
			const start = formatDuration(startSeconds);
			if (endSeconds > 0 && endSeconds > startSeconds) {
				const end = formatDuration(endSeconds);
				return `${start}-${end}`;
			}
			return `@${start}`;
		}
		return formatDuration(duration);
	};

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
					<span className="text-blue-500 text-xs">({getTimeRangeDisplay()})</span>
				</span>
			</Button>

			{startSeconds > 0 && (
				<Button
					onClick={handleSeekToStart}
					size="sm"
					variant="ghost"
					className="text-blue-600 hover:bg-blue-50"
					title="Jump to start time"
				>
					<SkipBack className="h-3 w-3" />
				</Button>
			)}

			{mediaType === "video" ? (
				<video
					ref={mediaRef as React.RefObject<HTMLVideoElement>}
					src={mediaUrl}
					onEnded={handleEnded}
					onLoadStart={handleLoadStart}
					onCanPlay={handleCanPlay}
					onLoadedMetadata={handleLoadedMetadata}
					onTimeUpdate={handleTimeUpdate}
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
					className="hidden"
					preload="metadata"
					controls={false}
				/>
			)}
		</div>
	);
}
