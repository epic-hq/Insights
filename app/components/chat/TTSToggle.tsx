/**
 * TTSToggle — Speaker icon button for toggling text-to-speech.
 *
 * Placed in the chat header next to the title as a "mode badge."
 * Visually distinct from session management actions (history, new chat, minimize).
 */
import { Volume2, VolumeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface TTSToggleProps {
	isEnabled: boolean;
	isPlaying: boolean;
	isDisabledByVoiceChat: boolean;
	onToggle: () => void;
	/** Dark theme variant for embedded panel */
	variant?: "light" | "dark";
}

export function TTSToggle({
	isEnabled,
	isPlaying,
	isDisabledByVoiceChat,
	onToggle,
	variant = "light",
}: TTSToggleProps) {
	const tooltipText = isDisabledByVoiceChat
		? "TTS disabled during voice call"
		: isEnabled
			? "Turn off read aloud"
			: "Read responses aloud";

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={onToggle}
						disabled={isDisabledByVoiceChat}
						className={cn(
							"flex h-7 w-7 items-center justify-center rounded-md transition-all",
							isDisabledByVoiceChat && "cursor-not-allowed opacity-40",
							variant === "dark"
								? isEnabled
									? "bg-blue-500/15 text-blue-400"
									: "text-slate-400 hover:text-white"
								: isEnabled
									? "border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-500/15 dark:text-blue-400"
									: "text-muted-foreground hover:text-foreground",
							isPlaying && isEnabled && "animate-tts-pulse"
						)}
						aria-label={tooltipText}
						aria-pressed={isEnabled}
					>
						{isEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeOff className="h-3.5 w-3.5" />}
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{tooltipText}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
