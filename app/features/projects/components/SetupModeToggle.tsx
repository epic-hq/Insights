/**
 * Mode toggle for switching between chat and form modes
 *
 * Uses a segmented control pattern with smooth transitions.
 * Both modes access the same underlying data.
 */

import { FileText, MessageSquare } from "lucide-react"
import { cn } from "~/lib/utils"

export type SetupMode = "chat" | "form"

interface SetupModeToggleProps {
	mode: SetupMode
	onModeChange: (mode: SetupMode) => void
	className?: string
}

/**
 * Toggle between chat and form modes
 *
 * Designed to feel like two views into the same data,
 * not two separate features.
 */
export function SetupModeToggle({ mode, onModeChange, className }: SetupModeToggleProps) {
	return (
		<div
			className={cn("inline-flex items-center gap-1 rounded-lg border bg-muted/50 p-1", className)}
			role="tablist"
			aria-label="Setup mode"
		>
			<button
				onClick={() => onModeChange("chat")}
				role="tab"
				aria-selected={mode === "chat"}
				aria-controls="setup-content"
				className={cn(
					"inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all duration-200",
					mode === "chat" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
			>
				<MessageSquare className="h-4 w-4" />
				<span>Chat</span>
			</button>
			<button
				onClick={() => onModeChange("form")}
				role="tab"
				aria-selected={mode === "form"}
				aria-controls="setup-content"
				className={cn(
					"inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all duration-200",
					mode === "form" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
			>
				<FileText className="h-4 w-4" />
				<span>Form</span>
			</button>
		</div>
	)
}

/**
 * Compact version for mobile/smaller screens
 * Shows only icons with tooltips
 */
export function SetupModeToggleCompact({ mode, onModeChange, className }: SetupModeToggleProps) {
	return (
		<div
			className={cn("inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5", className)}
			role="tablist"
			aria-label="Setup mode"
		>
			<button
				onClick={() => onModeChange("chat")}
				role="tab"
				aria-selected={mode === "chat"}
				aria-label="Chat mode"
				className={cn(
					"inline-flex items-center justify-center rounded-md p-2 transition-all duration-200",
					mode === "chat" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
			>
				<MessageSquare className="h-4 w-4" />
			</button>
			<button
				onClick={() => onModeChange("form")}
				role="tab"
				aria-selected={mode === "form"}
				aria-label="Form mode"
				className={cn(
					"inline-flex items-center justify-center rounded-md p-2 transition-all duration-200",
					mode === "form" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
			>
				<FileText className="h-4 w-4" />
			</button>
		</div>
	)
}
