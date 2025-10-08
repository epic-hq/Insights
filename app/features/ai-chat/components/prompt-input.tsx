import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "~/components/ai-elements/prompt-input"
import { TextShimmer } from "~/components/ui/text-shimmer"
import { AudioRecorder } from "~/features/voice/audio-recorder"
import { cn } from "~/lib/utils"

type ChatInputProps = {
	input: string
	setInput: (input: string) => void
	handleSubmit: (e: React.FormEvent) => void
	sendMessage: (message: { text: string }) => void
	status: "streaming" | "submitted" | "error"
}

export function ChatInput(props: ChatInputProps) {
	return (
		<div>
			<div className="flex flex-row justify-between gap-2">
				<AudioRecorder
					onAfterTranscription={(transcription) => {
						console.log("transcription", transcription)
						// setInput((prev) => prev?.trim() ? prev + "\n" + transcription : transcription)
						if (transcription.trim()) {
							props.sendMessage({ text: transcription })
							// setInput("")
						}
					}}
				/>
				<span>
					<TextShimmer
						className={cn(
							"mt-1 hidden font-mono text-sm",
							props.status === "streaming" || (props.status === "submitted" && "block")
						)}
						duration={3}
					>
						Thinking...
					</TextShimmer>
					<div className={cn("mt-1 hidden font-mono text-destructive text-sm", props.status === "error" && "block")}>
						Error
					</div>
				</span>
			</div>
			<PromptInput onSubmit={props.handleSubmit} className="relative mx-auto mt-1 mb-6 w-full max-w-2xl">
				<PromptInputTextarea
					value={props.input}
					placeholder="Say something..."
					onChange={(e) => props.setInput(e.currentTarget.value)}
					className="pr-12"
				/>
				<PromptInputSubmit
					status={props.status === "streaming" ? "streaming" : "ready"}
					disabled={!props.input.trim()}
					className="absolute right-1 bottom-1"
				/>
			</PromptInput>
		</div>
	)
}
