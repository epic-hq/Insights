/**
 * Inline feedback form that renders within the chat interface.
 * Pre-populated by the agent with extracted context from conversation.
 * Submits to PostHog for analytics.
 */
import { Bug, Lightbulb, MessageSquare, Sparkles, X } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useCallback, useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { cn } from "~/lib/utils"

export type FeedbackType = "bug" | "feature_request" | "general" | "compliment"

interface InlineFeedbackFormProps {
	/** Pre-filled feedback type from agent */
	initialType?: FeedbackType
	/** Pre-filled summary from agent */
	initialSummary?: string
	/** Feature area this relates to */
	affectedFeature?: string
	/** Callback when form is submitted */
	onSubmit?: (data: FeedbackData) => void
	/** Callback when form is dismissed */
	onDismiss?: () => void
	/** Additional context for the feedback */
	context?: {
		currentPage?: string
		projectId?: string
		accountId?: string
	}
}

export interface FeedbackData {
	type: FeedbackType
	message: string
	affectedFeature?: string
	email?: string
}

const feedbackTypeConfig: Record<FeedbackType, { label: string; icon: typeof Bug; color: string }> = {
	bug: { label: "Bug", icon: Bug, color: "text-destructive" },
	feature_request: { label: "Feature", icon: Lightbulb, color: "text-amber-500" },
	compliment: { label: "Compliment", icon: Sparkles, color: "text-green-500" },
	general: { label: "General", icon: MessageSquare, color: "text-muted-foreground" },
}

export function InlineFeedbackForm({
	initialType = "general",
	initialSummary = "",
	affectedFeature,
	onSubmit,
	onDismiss,
	context,
}: InlineFeedbackFormProps) {
	const posthog = usePostHog()
	const [type, setType] = useState<FeedbackType>(initialType)
	const [message, setMessage] = useState(initialSummary)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)

	const handleSubmit = useCallback(async () => {
		if (!message.trim()) return

		setIsSubmitting(true)

		const feedbackData: FeedbackData = {
			type,
			message: message.trim(),
			affectedFeature,
		}

		try {
			// Capture feedback event to PostHog
			posthog?.capture("product_feedback_submitted", {
				feedback_type: type,
				feedback_message: message.trim(),
				affected_feature: affectedFeature,
				source: "inline_chat_form",
				current_page: context?.currentPage,
				project_id: context?.projectId,
				account_id: context?.accountId,
			})

			// Also capture as a survey response for PostHog's survey analytics
			posthog?.capture("survey sent", {
				$survey_id: "product_feedback_chat",
				$survey_name: "Product Feedback (Chat)",
				$survey_response: message.trim(),
				feedback_type: type,
				affected_feature: affectedFeature,
			})

			onSubmit?.(feedbackData)
			setIsSubmitted(true)
		} catch (error) {
			console.error("Failed to submit feedback:", error)
		} finally {
			setIsSubmitting(false)
		}
	}, [type, message, affectedFeature, context, posthog, onSubmit])

	if (isSubmitted) {
		return (
			<Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
				<CardContent className="flex items-center gap-3 py-4">
					<Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
					<p className="text-sm text-green-700 dark:text-green-300">
						Thank you for your feedback! We really appreciate it.
					</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="border-primary/20 bg-card">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">Share your feedback</CardTitle>
				{onDismiss && (
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
						<X className="h-4 w-4" />
						<span className="sr-only">Dismiss</span>
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Feedback Type Toggle */}
				<div className="space-y-2">
					<Label className="text-xs text-muted-foreground">What type of feedback?</Label>
					<ToggleGroup
						type="single"
						value={type}
						onValueChange={(value) => value && setType(value as FeedbackType)}
						className="justify-start"
					>
						{(Object.entries(feedbackTypeConfig) as [FeedbackType, typeof feedbackTypeConfig.bug][]).map(
							([key, config]) => {
								const Icon = config.icon
								return (
									<ToggleGroupItem
										key={key}
										value={key}
										aria-label={config.label}
										className={cn("gap-1.5 text-xs", type === key && config.color)}
									>
										<Icon className="h-3.5 w-3.5" />
										{config.label}
									</ToggleGroupItem>
								)
							}
						)}
					</ToggleGroup>
				</div>

				{/* Feature Context */}
				{affectedFeature && (
					<div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
						Related to: <span className="font-medium text-foreground">{affectedFeature}</span>
					</div>
				)}

				{/* Message Input */}
				<div className="space-y-2">
					<Label htmlFor="feedback-message" className="text-xs text-muted-foreground">
						Tell us more
					</Label>
					<Textarea
						id="feedback-message"
						placeholder={
							type === "bug"
								? "What happened? What did you expect?"
								: type === "feature_request"
									? "What would you like to see?"
									: "Share your thoughts..."
						}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						rows={3}
						className="resize-none text-sm"
					/>
				</div>

				{/* Submit Button */}
				<div className="flex justify-end">
					<Button
						onClick={handleSubmit}
						disabled={!message.trim() || isSubmitting}
						size="sm"
						className="gap-2"
					>
						{isSubmitting ? (
							<>
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Sending...
							</>
						) : (
							<>
								<MessageSquare className="h-4 w-4" />
								Send Feedback
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
