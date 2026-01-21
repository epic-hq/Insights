/**
 * Display card for captured product feedback.
 * Shows as a visual receipt in the chat stream after feedback is logged.
 * No input - just confirms what was captured.
 */
import { Bug, Check, Lightbulb, MessageSquare, Sparkles } from "lucide-react"
import { cn } from "~/lib/utils"

export type FeedbackType = "bug" | "feature_request" | "general" | "compliment"

interface FeedbackConfirmationCardProps {
	type: FeedbackType
	summary: string
	affectedFeature?: string
	className?: string
}

const feedbackTypeConfig: Record<
	FeedbackType,
	{ label: string; icon: typeof Bug; bgColor: string; textColor: string; borderColor: string }
> = {
	bug: {
		label: "Bug Report",
		icon: Bug,
		bgColor: "bg-red-50 dark:bg-red-950/30",
		textColor: "text-red-700 dark:text-red-400",
		borderColor: "border-red-200 dark:border-red-900",
	},
	feature_request: {
		label: "Feature Request",
		icon: Lightbulb,
		bgColor: "bg-amber-50 dark:bg-amber-950/30",
		textColor: "text-amber-700 dark:text-amber-400",
		borderColor: "border-amber-200 dark:border-amber-900",
	},
	compliment: {
		label: "Compliment",
		icon: Sparkles,
		bgColor: "bg-green-50 dark:bg-green-950/30",
		textColor: "text-green-700 dark:text-green-400",
		borderColor: "border-green-200 dark:border-green-900",
	},
	general: {
		label: "Feedback",
		icon: MessageSquare,
		bgColor: "bg-blue-50 dark:bg-blue-950/30",
		textColor: "text-blue-700 dark:text-blue-400",
		borderColor: "border-blue-200 dark:border-blue-900",
	},
}

export function FeedbackConfirmationCard({
	type,
	summary,
	affectedFeature,
	className,
}: FeedbackConfirmationCardProps) {
	const config = feedbackTypeConfig[type] || feedbackTypeConfig.general
	const Icon = config.icon

	return (
		<div
			className={cn(
				"rounded-lg border p-3",
				config.bgColor,
				config.borderColor,
				className
			)}
		>
			{/* Header with type badge */}
			<div className="mb-2 flex items-center gap-2">
				<Icon className={cn("h-4 w-4", config.textColor)} />
				<span className={cn("text-xs font-medium", config.textColor)}>{config.label}</span>
			</div>

			{/* Summary quote */}
			<p className="text-sm text-foreground/90 leading-relaxed">"{summary}"</p>

			{/* Footer with feature tag and submitted indicator */}
			<div className="mt-2 flex items-center justify-between">
				{affectedFeature && (
					<span className="inline-flex items-center rounded-md bg-background/60 px-2 py-0.5 text-xs text-muted-foreground">
						{affectedFeature}
					</span>
				)}
				<span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
					<Check className="h-3 w-3" />
					Submitted
				</span>
			</div>
		</div>
	)
}
