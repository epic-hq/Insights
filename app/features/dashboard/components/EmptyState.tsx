/**
 * EmptyState - Dashboard state when project has no content
 *
 * Guides users to either setup goals or upload their first content.
 * Large touch targets, clear visual hierarchy.
 */

import { FileAudio, FileText, Mic, Target, Upload } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface EmptyStateProps {
	/** Project name to display */
	projectName: string
	/** Link to project goals/setup */
	goalsHref: string
	/** Link to upload page */
	uploadHref: string
	/** Whether goals have been set up */
	hasGoals?: boolean
	/** Additional CSS classes */
	className?: string
}

export function EmptyState({
	projectName,
	goalsHref,
	uploadHref,
	hasGoals = false,
	className,
}: EmptyStateProps) {
	return (
		<div className={cn("py-8", className)}>
			{/* Welcome message */}
			<div className="text-center mb-8">
				<h1 className="text-2xl font-semibold text-foreground mb-2">
					Welcome to {projectName}
				</h1>
				<p className="text-muted-foreground">
					Let's get started with your research project
				</p>
			</div>

			{/* Action cards grid */}
			<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 max-w-lg mx-auto">
				{/* Setup Goals Card */}
				<Link to={goalsHref} className="block">
					<Card
						className={cn(
							"h-full transition-all hover:shadow-md active:scale-[0.98]",
							!hasGoals && "ring-2 ring-primary ring-offset-2"
						)}
					>
						<CardContent className="p-6 flex flex-col items-center text-center">
							<div className="rounded-full bg-primary/10 p-4 mb-4">
								<Target className="h-8 w-8 text-primary" />
							</div>
							<h3 className="font-medium text-foreground mb-2">Setup Goals</h3>
							<p className="text-sm text-muted-foreground">
								Define your research objectives and questions
							</p>
							{!hasGoals && (
								<span className="mt-3 text-xs text-primary font-medium">
									Recommended first step
								</span>
							)}
						</CardContent>
					</Card>
				</Link>

				{/* Upload Content Card */}
				<Link to={uploadHref} className="block">
					<Card className="h-full transition-all hover:shadow-md active:scale-[0.98]">
						<CardContent className="p-6 flex flex-col items-center text-center">
							<div className="rounded-full bg-secondary p-4 mb-4">
								<Upload className="h-8 w-8 text-secondary-foreground" />
							</div>
							<h3 className="font-medium text-foreground mb-2">Add Content</h3>
							<p className="text-sm text-muted-foreground">
								Recordings, notes, voice memos
							</p>
						</CardContent>
					</Card>
				</Link>
			</div>

			{/* Supported formats hint */}
			<div className="mt-8 text-center">
				<p className="text-xs text-muted-foreground mb-3">Supported formats</p>
				<div className="flex items-center justify-center gap-4">
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<FileAudio className="h-4 w-4" />
						<span className="text-xs">Audio</span>
					</div>
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<Mic className="h-4 w-4" />
						<span className="text-xs">Voice</span>
					</div>
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<FileText className="h-4 w-4" />
						<span className="text-xs">Notes</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export default EmptyState
