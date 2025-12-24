import type { ComponentProps } from "react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

type SuggestionsProps = ComponentProps<"div">

export const Suggestions = ({ className, ...props }: SuggestionsProps) => (
	<div
		className={cn("flex flex-wrap items-center gap-2", className)}
		role="list"
		aria-label="Suggested prompts"
		{...props}
	/>
)

interface SuggestionProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
	suggestion: string
	onClick?: (suggestion: string) => void
}

export const Suggestion = ({ suggestion, onClick, className, ...props }: SuggestionProps) => (
	<Button
		variant="outline"
		size="sm"
		className={cn(
			"h-auto whitespace-normal rounded-full px-3 py-1.5 text-left font-normal text-sm",
			"border-border/60 bg-card/80 text-foreground shadow-sm transition-all duration-200",
			"hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg",
			"focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
			"active:translate-y-0",
			"dark:bg-slate-900/60",
			className
		)}
		onClick={() => onClick?.(suggestion)}
		role="listitem"
		{...props}
	>
		{suggestion}
	</Button>
)
