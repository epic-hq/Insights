/**
 * TextareaWithSTT - Textarea with built-in Speech-to-Text button
 *
 * A reusable textarea component that includes a microphone button for
 * voice input. Uses the useSpeechToText hook for transcription.
 */

import { Mic, Square } from "lucide-react";
import { forwardRef, useCallback } from "react";
import { Textarea, type TextareaProps } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text";
import { cn } from "~/lib/utils";

export interface TextareaWithSTTProps extends TextareaProps {
	/** Called when transcription completes - receives the transcript text */
	onTranscription?: (text: string) => void;
	/** Whether to show the STT button */
	showSTT?: boolean;
	/** Custom class for the container */
	containerClassName?: string;
	/** Position of the mic button */
	micPosition?: "inside" | "outside";
}

export const TextareaWithSTT = forwardRef<HTMLTextAreaElement, TextareaWithSTTProps>(
	({ onTranscription, showSTT = true, containerClassName, micPosition = "inside", className, ...props }, ref) => {
		const handleTranscription = useCallback(
			(text: string) => {
				onTranscription?.(text);
			},
			[onTranscription]
		);

		const {
			toggleRecording,
			isRecording,
			isTranscribing,
			error: voiceError,
			isSupported: isVoiceSupported,
		} = useSpeechToText({ onTranscription: handleTranscription });

		const showMicButton = showSTT && isVoiceSupported;

		if (!showMicButton) {
			return <Textarea ref={ref} className={className} {...props} />;
		}

		return (
			<div className={cn("relative", containerClassName)}>
				<Textarea ref={ref} className={cn(micPosition === "inside" && "pr-12", className)} {...props} />
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={toggleRecording}
								disabled={isTranscribing}
								className={cn(
									"absolute flex items-center justify-center rounded-md transition-colors",
									micPosition === "inside" ? "right-2 bottom-2 h-8 w-8" : "-right-10 bottom-2 h-8 w-8",
									isRecording
										? "bg-red-500 text-white hover:bg-red-600"
										: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
									isTranscribing && "cursor-wait opacity-50"
								)}
								aria-label={isRecording ? "Stop recording" : "Start voice input"}
							>
								{isTranscribing ? (
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								) : isRecording ? (
									<Square className="h-4 w-4" />
								) : (
									<Mic className="h-4 w-4" />
								)}
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">
							{voiceError ? (
								<p className="text-destructive">{voiceError}</p>
							) : isTranscribing ? (
								<p>Transcribing...</p>
							) : isRecording ? (
								<p>Click to stop recording</p>
							) : (
								<p>Click to use voice input</p>
							)}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		);
	}
);

TextareaWithSTT.displayName = "TextareaWithSTT";
