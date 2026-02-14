/**
 * MessagePlayButton — Per-message play/stop button that appears on hover.
 *
 * Allows users to replay any past assistant message via TTS.
 * Shows a play icon by default, switches to stop when that message is playing.
 */
import { Pause, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface MessagePlayButtonProps {
	isPlaying: boolean;
	onPlay: () => void;
	onStop: () => void;
	/** Dark theme variant for embedded panel */
	variant?: "light" | "dark";
}

export function MessagePlayButton({ isPlaying, onPlay, onStop, variant = "light" }: MessagePlayButtonProps) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={isPlaying ? onStop : onPlay}
						className={cn(
							"flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all",
							"opacity-0 focus:opacity-100 group-hover:opacity-100",
							isPlaying && "!opacity-100",
							variant === "dark"
								? isPlaying
									? "bg-blue-600 text-white"
									: "border border-white/10 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
								: isPlaying
									? "bg-blue-600 text-white"
									: "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
						)}
						aria-label={isPlaying ? "Stop reading" : "Read aloud"}
					>
						{isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="ml-0.5 h-2.5 w-2.5" />}
					</button>
				</TooltipTrigger>
				<TooltipContent side="left">
					<p>{isPlaying ? "Stop reading" : "Read aloud"}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
