/**
 * ChatSheet - Bottom sheet wrapper for mobile AI chat
 *
 * Wraps the ProjectStatusAgentChat in a bottom sheet for mobile use.
 * Uses shadcn Sheet component with custom styling.
 */

import { Sparkles, X } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet"
import { cn } from "~/lib/utils"
import { ProjectStatusAgentChat } from "./ProjectStatusAgentChat"

export interface ChatSheetProps {
	/** Whether the sheet is open */
	open: boolean
	/** Callback when sheet should close */
	onOpenChange: (open: boolean) => void
	/** Account ID for chat context */
	accountId: string
	/** Project ID for chat context */
	projectId: string
	/** System context for the AI */
	systemContext: string
	/** Additional CSS classes */
	className?: string
}

export function ChatSheet({ open, onOpenChange, accountId, projectId, systemContext, className }: ChatSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className={cn("h-[85vh] rounded-t-xl p-0", "flex flex-col", className)}>
				{/* Custom header */}
				<SheetHeader className="flex-shrink-0 border-b px-4 py-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-primary/10 p-2">
								<Sparkles className="h-4 w-4 text-primary" />
							</div>
							<SheetTitle className="text-base">AI Assistant</SheetTitle>
						</div>
						<SheetClose asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<X className="h-4 w-4" />
								<span className="sr-only">Close</span>
							</Button>
						</SheetClose>
					</div>
				</SheetHeader>

				{/* Chat content */}
				<div className="flex-1 overflow-hidden">
					<ProjectStatusAgentChat accountId={accountId} projectId={projectId} systemContext={systemContext} />
				</div>
			</SheetContent>
		</Sheet>
	)
}

/**
 * Floating chat button for triggering the sheet
 */
export function ChatFloatingButton({
	onClick,
	hasNotification,
	className,
}: {
	onClick: () => void
	hasNotification?: boolean
	className?: string
}) {
	return (
		<Button
			onClick={onClick}
			size="lg"
			className={cn(
				"fixed right-4 bottom-20 z-40",
				"h-14 w-14 rounded-full shadow-lg",
				"bg-primary hover:bg-primary/90",
				className
			)}
		>
			<Sparkles className="h-6 w-6" />
			{hasNotification && (
				<span className="-top-1 -right-1 absolute h-3 w-3 rounded-full border-2 border-background bg-destructive" />
			)}
			<span className="sr-only">Open AI Assistant</span>
		</Button>
	)
}

export default ChatSheet
