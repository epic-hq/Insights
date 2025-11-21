import { Edit2 } from "lucide-react"
import { useState } from "react"
import { useFetcher, useParams } from "react-router-dom"
import { cn } from "~/lib/utils"

interface InlineEditableFacetSummaryProps {
	value: string | null
	personId: string
	kindSlug: string
	placeholder?: string
	className?: string
}

export function InlineEditableFacetSummary({
	value,
	personId,
	kindSlug,
	placeholder = "Click to edit summary",
	className,
}: InlineEditableFacetSummaryProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [currentValue, setCurrentValue] = useState(value || "")
	const fetcher = useFetcher()
	const params = useParams()

	const handleSave = () => {
		if (currentValue !== value) {
			fetcher.submit(
				JSON.stringify({
					person_id: personId,
					kind_slug: kindSlug,
					summary: currentValue,
					account_id: params.accountId,
					project_id: params.projectId,
				}),
				{
					method: "post",
					action: "/api/update-person-facet-summary",
					encType: "application/json",
				}
			)
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			setCurrentValue(value || "")
			setIsEditing(false)
		}
		// Allow Enter with Shift for new lines, but not Enter alone
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSave()
		}
	}

	if (isEditing) {
		return (
			<textarea
				value={currentValue}
				onChange={(e) => setCurrentValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				autoFocus
				rows={2}
				className={cn(
					"w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					className
				)}
			/>
		)
	}

	return (
		<div
			className={cn(
				"group relative cursor-text rounded-md px-2 py-1 transition-colors hover:bg-muted/30",
				!currentValue && "text-muted-foreground",
				className
			)}
			onClick={() => setIsEditing(true)}
		>
			{currentValue || placeholder}
			<Edit2 className="absolute top-1 right-1 h-3 w-3 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
		</div>
	)
}
