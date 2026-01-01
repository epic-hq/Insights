/**
 * TypeformQuestion - Single question display with Typeform-style UX
 *
 * Shows one question at a time with:
 * - Smooth slide animations between questions
 * - Forward/back navigation with keyboard support
 * - Pre-generated contextual suggestions as clickable chips
 * - Speech-to-text for textarea inputs
 * - Progress indicator
 */

import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Search, SkipForward, Sparkles } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { TextareaWithSTT } from "~/components/ui/textarea-with-stt"
import { cn } from "~/lib/utils"

export type FieldType = "text" | "textarea" | "tags" | "select" | "url"

export type SuggestionType = "decision_questions" | "assumptions" | "unknowns" | "organizations" | "roles"

export interface TypeformQuestionProps {
	/** The question to display */
	question: string
	/** Optional description/helper text */
	description?: string
	/** Input field type */
	fieldType: FieldType
	/** Current value */
	value: string | string[]
	/** Value change handler */
	onChange: (value: string | string[]) => void
	/** Navigate to next question */
	onNext: () => void
	/** Navigate to previous question */
	onBack?: () => void
	/** Skip this question */
	onSkip?: () => void
	/** Current step number (1-indexed) */
	stepNumber: number
	/** Total number of steps */
	totalSteps: number
	/** Whether this question is required */
	required?: boolean
	/** Enable speech-to-text button */
	showSTT?: boolean
	/** Field key for suggestions */
	fieldKey?: string
	/** Suggestions to display */
	suggestions?: string[]
	/** Loading state for suggestions */
	suggestionsLoading?: boolean
	/** Handle suggestion click */
	onSuggestionClick?: (suggestion: string) => void
	/** Handle suggestion rejection */
	onSuggestionReject?: (suggestion: string) => void
	/** Refresh suggestions */
	onRefreshSuggestions?: () => void
	/** Animation direction: 1 = forward, -1 = back */
	direction?: number
	/** Placeholder text */
	placeholder?: string
	/** Options for select type */
	options?: { label: string; value: string }[]
	/** Whether URL research is in progress */
	isResearching?: boolean
	/** Callback to trigger URL research */
	onResearch?: () => void
	/** Custom className */
	className?: string
}

// Animation variants for slide transitions
const slideVariants = {
	enter: (direction: number) => ({
		x: direction > 0 ? 300 : -300,
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
	},
	exit: (direction: number) => ({
		x: direction > 0 ? -300 : 300,
		opacity: 0,
	}),
}

const suggestionVariants = {
	hidden: { opacity: 0, scale: 0.8, y: 10 },
	visible: (i: number) => ({
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			delay: i * 0.1,
			duration: 0.3,
			ease: "easeOut" as const,
		},
	}),
	exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
}

export function TypeformQuestion({
	question,
	description,
	fieldType,
	value,
	onChange,
	onNext,
	onBack,
	onSkip,
	stepNumber,
	totalSteps,
	required = false,
	showSTT = false,
	suggestions = [],
	suggestionsLoading = false,
	onSuggestionClick,
	onSuggestionReject,
	onRefreshSuggestions,
	direction = 1,
	placeholder,
	options = [],
	isResearching = false,
	onResearch,
	className,
}: TypeformQuestionProps) {
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
	const formId = useId()
	const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set())

	// Calculate if user can proceed (must be defined before useEffect that uses it)
	const canProceed = !required || (Array.isArray(value) ? value.length > 0 : Boolean(value?.toString().trim()))

	// Focus input when question changes
	useEffect(() => {
		const timer = setTimeout(() => {
			inputRef.current?.focus()
		}, 400) // After animation completes
		return () => clearTimeout(timer)
	}, [stepNumber])

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				// Textarea: allow newlines unless Cmd/Ctrl is held
				if (fieldType === "textarea" && !e.metaKey && !e.ctrlKey) {
					return
				}

				e.preventDefault()

				// Enter (no shift) to continue
				if (!e.shiftKey && canProceed) {
					onNext()
				}
			}

			// Escape to skip
			if (e.key === "Escape" && onSkip && !required) {
				e.preventDefault()
				onSkip()
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [fieldType, onNext, onSkip, required, canProceed])

	// Handle suggestion click
	const handleSuggestionClick = (suggestion: string) => {
		if (fieldType === "tags" && Array.isArray(value)) {
			if (!value.includes(suggestion)) {
				onChange([...value, suggestion])
			}
		} else if (typeof value === "string") {
			// For text/textarea, append suggestion
			const newValue = value ? `${value}\n${suggestion}` : suggestion
			onChange(newValue)
		}
		onSuggestionClick?.(suggestion)
	}

	// Handle suggestion rejection
	const handleSuggestionReject = (suggestion: string) => {
		setRejectedSuggestions((prev) => new Set(prev).add(suggestion))
		onSuggestionReject?.(suggestion)
	}

	// Remove tag
	const removeTag = (tag: string) => {
		if (Array.isArray(value)) {
			onChange(value.filter((v) => v !== tag))
		}
	}

	const visibleSuggestions = suggestions.filter((s) => !rejectedSuggestions.has(s))

	return (
		<AnimatePresence mode="wait" custom={direction}>
			<motion.div
				key={stepNumber}
				custom={direction}
				variants={slideVariants}
				initial="enter"
				animate="center"
				exit="exit"
				transition={{ duration: 0.3, ease: "easeInOut" }}
				className={cn("flex w-full flex-col items-center px-4 pt-8 md:pt-16", className)}
			>
				<div className="w-full max-w-xl space-y-8">
					{/* Question Header */}
					<div className="space-y-3 text-center">
						<motion.h2
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.4 }}
							className="font-medium text-2xl text-foreground sm:text-3xl"
						>
							{question}
							{required && <span className="ml-1 text-destructive">*</span>}
						</motion.h2>
						{description && (
							<motion.p
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2, duration: 0.4 }}
								className="text-muted-foreground text-sm sm:text-base"
							>
								{description}
							</motion.p>
						)}
					</div>

					{/* Input Area */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, duration: 0.4 }}
						className="space-y-4"
					>
						{/* Tags Display */}
						{fieldType === "tags" && Array.isArray(value) && value.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{value.map((tag) => (
									<motion.span
										key={tag}
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										exit={{ scale: 0.8, opacity: 0 }}
										className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary text-sm"
									>
										{tag}
										<button
											type="button"
											onClick={() => removeTag(tag)}
											className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
										>
											<span className="sr-only">Remove {tag}</span>×
										</button>
									</motion.span>
								))}
							</div>
						)}

						{/* Input Field */}
						<div className="relative">
							{fieldType === "textarea" ? (
								<TextareaWithSTT
									ref={inputRef as React.RefObject<HTMLTextAreaElement>}
									id={formId}
									value={typeof value === "string" ? value : ""}
									onChange={(e) => onChange(e.target.value)}
									onTranscription={(transcript) => {
										// Append transcript to existing value
										const current = typeof value === "string" ? value : ""
										const newValue = current ? `${current} ${transcript}` : transcript
										onChange(newValue)
									}}
									showSTT={showSTT}
									placeholder={placeholder || "Type your answer..."}
									rows={4}
									className={cn(
										"w-full resize-none rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
										"placeholder:text-muted-foreground/60",
										"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
									)}
								/>
							) : fieldType === "select" ? (
								<div className="relative">
									<select
										ref={inputRef as React.RefObject<HTMLSelectElement> as any}
										id={formId}
										value={typeof value === "string" ? value : ""}
										onChange={(e) => onChange(e.target.value)}
										className={cn(
											"w-full appearance-none rounded-xl border-2 border-border bg-background px-4 py-3 pr-10 text-foreground text-lg transition-all",
											"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
										)}
									>
										<option value="">Select an option...</option>
										{options.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
									<ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 h-5 w-5 text-muted-foreground" />
								</div>
							) : fieldType === "url" ? (
								<div className="flex gap-2">
									<input
										ref={inputRef as React.RefObject<HTMLInputElement>}
										type="url"
										id={formId}
										value={typeof value === "string" ? value : ""}
										onChange={(e) => onChange(e.target.value)}
										placeholder={placeholder || "https://yourcompany.com"}
										className={cn(
											"flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
											"placeholder:text-muted-foreground/60",
											"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
										)}
									/>
									{onResearch && (
										<Button
											type="button"
											onClick={onResearch}
											disabled={isResearching || !value?.toString().trim() || !value?.toString().includes(".")}
											className="gap-2 whitespace-nowrap"
										>
											{isResearching ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													<span className="hidden sm:inline">Researching...</span>
												</>
											) : (
												<>
													<Search className="h-4 w-4" />
													<span className="hidden sm:inline">Auto-fill</span>
												</>
											)}
										</Button>
									)}
								</div>
							) : (
								<input
									ref={inputRef as React.RefObject<HTMLInputElement>}
									type="text"
									id={formId}
									value={fieldType === "tags" ? "" : typeof value === "string" ? value : ""}
									onChange={(e) => {
										if (fieldType === "tags") {
											// Tags input handled separately
											return
										}
										onChange(e.target.value)
									}}
									onKeyDown={(e) => {
										if (fieldType === "tags" && e.key === "Enter") {
											e.preventDefault()
											const input = e.currentTarget.value.trim()
											if (input && Array.isArray(value) && !value.includes(input)) {
												onChange([...value, input])
												e.currentTarget.value = ""
											}
										}
									}}
									placeholder={
										fieldType === "tags"
											? placeholder || "Type and press Enter..."
											: placeholder || "Type your answer..."
									}
									className={cn(
										"w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-foreground text-lg transition-all",
										"placeholder:text-muted-foreground/60",
										"focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
										showSTT && "pr-14"
									)}
								/>
							)}
						</div>

						{/* Suggestions */}
						<AnimatePresence mode="sync">
							{(visibleSuggestions.length > 0 || suggestionsLoading) && (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									className="space-y-2"
								>
									<div className="flex items-center justify-between">
										<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
											<Sparkles className="h-3.5 w-3.5" />
											Suggestions
										</span>
										{onRefreshSuggestions && !suggestionsLoading && (
											<button
												type="button"
												onClick={() => {
													setRejectedSuggestions(new Set())
													onRefreshSuggestions()
												}}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												Refresh
											</button>
										)}
									</div>

									{suggestionsLoading ? (
										<div className="flex gap-2">
											{[1, 2, 3].map((i) => (
												<div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
											))}
										</div>
									) : (
										<div className="flex flex-wrap gap-2">
											{visibleSuggestions.map((suggestion, i) => (
												<motion.button
													key={suggestion}
													custom={i}
													variants={suggestionVariants}
													initial="hidden"
													animate="visible"
													exit="exit"
													type="button"
													onClick={() => handleSuggestionClick(suggestion)}
													className={cn(
														"group inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-sm transition-all",
														"hover:border-primary hover:bg-primary/5 hover:text-primary"
													)}
												>
													<span>+ {suggestion}</span>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation()
															handleSuggestionReject(suggestion)
														}}
														className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
														title="Dismiss suggestion"
													>
														×
													</button>
												</motion.button>
											))}
										</div>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>

					{/* Navigation */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3, duration: 0.4 }}
						className="flex items-center justify-between pt-4"
					>
						{/* Back Button */}
						<div>
							{onBack && stepNumber > 1 && (
								<Button type="button" variant="ghost" onClick={onBack} className="gap-2">
									<ArrowLeft className="h-4 w-4" />
									Back
								</Button>
							)}
						</div>

						{/* Continue / Skip */}
						<div className="flex items-center gap-3">
							{onSkip && !required && (
								<Button type="button" variant="ghost" onClick={onSkip} className="gap-2 text-muted-foreground">
									Skip
									<SkipForward className="h-4 w-4" />
								</Button>
							)}
							<Button type="button" onClick={onNext} disabled={!canProceed} className="gap-2">
								{stepNumber === totalSteps ? (
									<>
										<Check className="h-4 w-4" />
										Done
									</>
								) : (
									<>
										Continue
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</Button>
						</div>
					</motion.div>

					{/* Progress Dots */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4, duration: 0.4 }}
						className="flex items-center justify-center gap-2 pt-6"
					>
						{Array.from({ length: totalSteps }).map((_, i) => (
							<div
								key={i}
								className={cn(
									"h-2 w-2 rounded-full transition-all duration-300",
									i + 1 === stepNumber ? "w-6 bg-primary" : i + 1 < stepNumber ? "bg-primary/60" : "bg-muted"
								)}
							/>
						))}
					</motion.div>
				</div>
			</motion.div>
		</AnimatePresence>
	)
}
