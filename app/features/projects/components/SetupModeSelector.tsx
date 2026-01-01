/**
 * SetupModeSelector - Chat-first entry with escape hatches
 *
 * Leads with chat input (60% of users need planning guidance)
 * Provides clear alternatives for users who have data or are exploring
 */

import { motion } from "framer-motion"
import { ArrowRight, Loader2, Mic, Search, Upload } from "lucide-react"
import { useCallback, useId, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { useSpeechToText } from "~/features/voice/hooks/use-speech-to-text"
import { cn } from "~/lib/utils"

export type EntryPath = "chat" | "upload" | "explore"

export interface SetupModeSelectorProps {
	/** Callback when user starts chat with initial message */
	onStartChat: (initialMessage: string) => void
	/** Callback when user wants to upload recordings */
	onUpload: () => void
	/** Callback when user wants to explore/see demo */
	onExplore: () => void
	/** Whether STT is available */
	transcribeEnabled?: boolean
	/** Custom className */
	className?: string
	/** Loading state */
	isLoading?: boolean
}

export function SetupModeSelector({
	onStartChat,
	onUpload,
	onExplore,
	transcribeEnabled = true,
	className,
	isLoading = false,
}: SetupModeSelectorProps) {
	const [inputValue, setInputValue] = useState("")
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const formId = useId()

	// Handle transcription - append to input
	const handleTranscription = useCallback((text: string) => {
		setInputValue((prev) => {
			const trimmed = text.trim()
			if (!trimmed) return prev
			return prev ? `${prev} ${trimmed}` : trimmed
		})
		textareaRef.current?.focus()
	}, [])

	// Use the real speech-to-text hook
	const {
		toggleRecording,
		isRecording,
		isTranscribing,
		error: voiceError,
		isSupported: isVoiceSupported,
	} = useSpeechToText({ onTranscription: handleTranscription })

	const handleSubmit = useCallback(() => {
		const trimmed = inputValue.trim()
		if (trimmed) {
			onStartChat(trimmed)
		}
	}, [inputValue, onStartChat])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Cmd/Ctrl + Enter to submit
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSubmit()
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, ease: "easeOut" }}
			className={cn("mx-auto w-full max-w-2xl px-4", className)}
		>
			<div className="space-y-6">
				{/* Header - Simple and focused */}
				<div className="space-y-2 text-center">
					<motion.h1
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1, duration: 0.4 }}
						className="font-semibold text-2xl text-foreground sm:text-3xl"
					>
						Let's set up your research
					</motion.h1>
				</div>

				{/* Main Chat Input Card */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2, duration: 0.4 }}
					className="relative"
				>
					<div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-lg transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
						{/* Textarea with inline mic button */}
						<div className="relative">
							<textarea
								ref={textareaRef}
								id={formId}
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Tell me what you're trying to learn..."
								rows={3}
								className="min-h-[100px] w-full resize-none border-0 bg-transparent px-4 py-4 pr-14 text-foreground text-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
							/>

							{/* Mic button */}
							{transcribeEnabled && isVoiceSupported && (
								<button
									type="button"
									onClick={toggleRecording}
									disabled={isTranscribing}
									className={cn(
										"absolute top-3 right-3 rounded-lg p-2.5 transition-all",
										isRecording
											? "animate-pulse bg-red-500 text-white"
											: isTranscribing
												? "bg-muted text-muted-foreground"
												: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
									)}
									title={
										isRecording
											? "Stop recording"
											: isTranscribing
												? "Transcribing..."
												: voiceError
													? voiceError
													: "Click to speak"
									}
								>
									{isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
								</button>
							)}
						</div>

						{/* Submit Button - Clean bottom bar */}
						<div className="flex items-center justify-end border-border border-t bg-muted/30 px-4 py-3">
							<Button type="button" onClick={handleSubmit} disabled={!inputValue.trim() || isLoading} className="gap-2">
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Starting...
									</>
								) : (
									<>
										Start Chat
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</Button>
						</div>
					</div>

					{/* Keyboard Hint */}
					<p className="mt-2 text-center text-muted-foreground/60 text-xs">
						<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd> +{" "}
						<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to
						send
					</p>
				</motion.div>

				{/* Separator */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4, duration: 0.4 }}
					className="flex items-center gap-4"
				>
					<div className="h-px flex-1 bg-border" />
					<span className="text-muted-foreground text-sm">or</span>
					<div className="h-px flex-1 bg-border" />
				</motion.div>

				{/* Alternative Paths */}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.5, duration: 0.4 }}
					className="flex flex-col gap-3 sm:flex-row sm:justify-center"
				>
					<Button type="button" variant="outline" size="lg" onClick={onUpload} disabled={isLoading} className="gap-2">
						<Upload className="h-4 w-4" />I have recordings to upload
					</Button>

					<Button
						type="button"
						variant="ghost"
						size="lg"
						onClick={onExplore}
						disabled={isLoading}
						className="gap-2 text-muted-foreground"
					>
						<Search className="h-4 w-4" />
						Show me how it works
					</Button>
				</motion.div>
			</div>
		</motion.div>
	)
}
