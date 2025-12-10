/**
 * ContextPanel - Project context sidebar for dashboard
 *
 * Displays project goals, quick stats, and add conversation CTA.
 * Positioned as right sidebar on desktop, collapsible on mobile.
 */

import { FileAudio, Glasses, MessageCircle, Plus, Target } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export interface ContextPanelProps {
	/** Project research goal text */
	researchGoal?: string
	/** Total conversation count */
	conversationCount: number
	/** Number of active lenses */
	activeLensCount: number
	/** Base path for project routes */
	projectPath: string
	/** Additional CSS classes */
	className?: string
}

interface QuickStatProps {
	icon: React.ElementType
	label: string
	value: string | number
	href?: string
}

function QuickStat({ icon: Icon, label, value, href }: QuickStatProps) {
	const content = (
		<div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
			<div className="rounded-md bg-muted p-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
			</div>
			<div>
				<p className="font-medium text-foreground text-sm">{value}</p>
				<p className="text-muted-foreground text-xs">{label}</p>
			</div>
		</div>
	)

	if (href) {
		return <Link to={href}>{content}</Link>
	}

	return content
}

export function ContextPanel({
	researchGoal,
	conversationCount,
	activeLensCount,
	projectPath,
	className,
}: ContextPanelProps) {
	return (
		<aside className={cn("space-y-4", className)}>
			{/* Add Conversation CTA */}
			<Button asChild size="lg" className="w-full">
				<Link to={`${projectPath}/interviews/upload`}>
					<Plus className="mr-2 h-4 w-4" />
					Add Conversation
				</Link>
			</Button>

			{/* Project Context Card */}
			<Card>
				<CardHeader className="pb-3">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<CardTitle className="flex cursor-help items-center gap-2 text-sm">
									<Target className="h-4 w-4" />
									Project Context
								</CardTitle>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-xs">
								<p className="text-sm">Your research goal and key project stats at a glance.</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Research Goal */}
					{researchGoal ? (
						<div>
							<h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">Research Goal</h4>
							<p className="line-clamp-4 text-foreground text-sm leading-relaxed">{researchGoal}</p>
							<Link to={`${projectPath}/setup`} className="mt-2 inline-block text-primary text-xs hover:underline">
								Edit goal
							</Link>
						</div>
					) : (
						<div className="rounded-lg border border-muted-foreground/20 border-dashed p-3 text-center">
							<p className="mb-2 text-muted-foreground text-sm">No research goal defined</p>
							<Button asChild variant="outline" size="sm">
								<Link to={`${projectPath}/setup`}>Set Goal</Link>
							</Button>
						</div>
					)}

					{/* Quick Stats */}
					<div className="space-y-1 border-t pt-4">
						<QuickStat
							icon={FileAudio}
							label="Conversations"
							value={conversationCount}
							href={`${projectPath}/interviews`}
						/>
						<QuickStat
							icon={Glasses}
							label="Active Lenses"
							value={activeLensCount}
							href={`${projectPath}/lens-library`}
						/>
					</div>
				</CardContent>
			</Card>

			{/* AI Assistant Card */}
			<Card className="bg-gradient-to-br from-primary/5 to-primary/10">
				<CardContent className="p-4">
					<div className="mb-3 flex items-center gap-2">
						<div className="rounded-full bg-primary/10 p-2">
							<MessageCircle className="h-4 w-4 text-primary" />
						</div>
						<h3 className="font-medium text-foreground text-sm">AI Assistant</h3>
					</div>
					<p className="mb-3 text-muted-foreground text-xs">
						Ask questions about your conversations, get summaries, or explore insights.
					</p>
					<Button asChild variant="secondary" size="sm" className="w-full">
						<Link to={`${projectPath}/assistant`}>Open Chat</Link>
					</Button>
				</CardContent>
			</Card>
		</aside>
	)
}

export default ContextPanel
