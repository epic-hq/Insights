import { Edit2 } from "lucide-react"
import { useState } from "react"
import { useFetcher } from "react-router-dom"
import { cn } from "~/lib/utils"

interface InlineEditableFieldProps {
	value: string | null
	table: string
	id: string
	field: string
	placeholder?: string
	className?: string
	multiline?: boolean
	rows?: number
}

export function InlineEditableField({
	value,
	table,
	id,
	field,
	placeholder = "Click to edit",
	className,
	multiline = false,
	rows = 3,
}: InlineEditableFieldProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [currentValue, setCurrentValue] = useState(value || "")
	const fetcher = useFetcher()

	const handleSave = () => {
		if (currentValue !== value) {
			fetcher.submit(
				JSON.stringify({
					table,
					id,
					field,
					value: currentValue,
				}),
				{
					method: "post",
					action: "/api/update-field",
					encType: "application/json",
				}
			)
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!multiline && e.key === "Enter") {
			e.preventDefault()
			handleSave()
		}
		if (e.key === "Escape") {
			setCurrentValue(value || "")
			setIsEditing(false)
		}
	}

	if (isEditing) {
		return multiline ? (
			<textarea
				value={currentValue}
				onChange={(e) => setCurrentValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				autoFocus
				rows={rows}
				className={cn(
					"w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					className
				)}
			/>
		) : (
			<input
				type="text"
				value={currentValue}
				onChange={(e) => setCurrentValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				autoFocus
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
				"group relative cursor-text rounded-md px-3 py-2 transition-colors hover:bg-muted/50",
				!currentValue && "text-muted-foreground",
				className
			)}
			onClick={() => setIsEditing(true)}
		>
			{currentValue || placeholder}
			<Edit2 className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
		</div>
	)
}
