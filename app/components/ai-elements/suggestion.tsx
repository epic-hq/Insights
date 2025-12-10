
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
			"hover:border-primary/30 hover:bg-muted/80",
			"transition-colors duration-150",
			className
		)}
		onClick={() => onClick?.(suggestion)}
		role="listitem"
		{...props}
	>
		{suggestion}
	</Button>
)
