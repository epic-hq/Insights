/**
 * OnboardingDashboard - Award-winning clarity for new users
 *
 * Shows a clear 3-phase journey: Define → Collect → Learn
 * Each phase has clear steps and progress indication.
 */

import {
	ArrowRight,
	Building2,
	CheckCircle2,
	FileText,
	Lightbulb,
	MessageSquareText,
	Mic,
	Settings,
	Upload,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface OnboardingDashboardProps {
	/** Project name to display */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Whether project goals have been set up */
	hasGoals: boolean
	/** Whether lenses have been configured */
	hasLenses: boolean
	/** Whether company context has been set up */
	hasCompanyContext: boolean
	/** Whether the user has conversations */
	hasConversations?: boolean
	/** Whether the user has applied lenses */
	hasAppliedLenses?: boolean
	/** Hide the header (when parent provides it) */
	hideHeader?: boolean
	/** Additional CSS classes */
	className?: string
}

interface PhaseProps {
	number: number
	title: string
	isActive: boolean
	isComplete: boolean
}

function PhaseIndicator({ number, title, isActive, isComplete }: PhaseProps) {
	return (
		<div className="flex items-center gap-2">
			<div
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm",
					isComplete && "bg-green-100 text-green-700 dark:bg-green-900/30",
					isActive && !isComplete && "bg-primary text-primary-foreground",
					!isActive && !isComplete && "bg-muted text-muted-foreground"
				)}
			>
				{isComplete ? <CheckCircle2 className="h-5 w-5" /> : number}
			</div>
			<span className={cn("font-medium text-sm", isActive || isComplete ? "text-foreground" : "text-muted-foreground")}>
				{title}
			</span>
		</div>
	)
}

export function OnboardingDashboard({
	projectName,
	projectPath,
	hasGoals,
	hasLenses: _hasLenses,
	hasCompanyContext,
	hasConversations = false,
	hasAppliedLenses = false,
	hideHeader,
	className,
}: OnboardingDashboardProps) {
	// Extract accountId from projectPath (format: /a/{accountId}/{projectId})
	const pathParts = projectPath.split("/")
	const accountId = pathParts[2]

	// Determine current phase
	// Define phase is complete when BOTH company context AND project goals are set
	const phase1Complete = hasCompanyContext && hasGoals
	const phase2Complete = hasConversations
	const phase3Complete = hasAppliedLenses

	const currentPhase = phase1Complete ? (phase2Complete ? 3 : 2) : 1

	// Within Define phase, determine sub-step
	const needsCompanySetup = !hasCompanyContext
	const needsProjectSetup = hasCompanyContext && !hasGoals

	return (
		<div className={cn("mx-auto max-w-2xl", className)}>
			{/* Header */}
			{!hideHeader && (
				<header className="mb-8 text-center">
					<h1 className="mb-2 font-semibold text-2xl text-foreground">{projectName}</h1>
					<p className="text-muted-foreground">Let's set up your research project</p>
				</header>
			)}

			{/* Phase Progress Bar */}
			<div className="mb-8 flex items-center justify-center gap-4">
				<PhaseIndicator number={1} title="Define" isActive={currentPhase === 1} isComplete={phase1Complete} />
				<ArrowRight className="h-4 w-4 text-muted-foreground" />
				<PhaseIndicator number={2} title="Collect" isActive={currentPhase === 2} isComplete={phase2Complete} />
				<ArrowRight className="h-4 w-4 text-muted-foreground" />
				<PhaseIndicator number={3} title="Learn" isActive={currentPhase === 3} isComplete={phase3Complete} />
			</div>

			{/* Current Phase Content */}
			<Card className="mb-6">
				<CardContent className="p-6">
					{/* Phase 1: Define */}
					{currentPhase === 1 && needsCompanySetup && (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<Building2 className="h-6 w-6 text-primary" />
								</div>
								<h2 className="mb-2 font-semibold text-lg">First, tell us about your company</h2>
								<p className="mx-auto max-w-md text-muted-foreground text-sm">
									Set up your company context so we can tailor insights and questions to your business.
								</p>
							</div>

							<div className="space-y-3">
								<Link to={`/a/${accountId}/settings`}>
									<Button className="w-full gap-2" size="lg">
										<Building2 className="h-5 w-5" />
										Set Up Company Context
										<ArrowRight className="ml-auto h-4 w-4" />
									</Button>
								</Link>
							</div>
						</div>
					)}

					{currentPhase === 1 && needsProjectSetup && (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<Settings className="h-6 w-6 text-primary" />
								</div>
								<h2 className="mb-2 font-semibold text-lg">What do you want to learn?</h2>
								<p className="mx-auto max-w-md text-muted-foreground text-sm">
									Tell us about your research goals so we can help you get the most relevant insights.
								</p>
							</div>

							<div className="space-y-3">
								<Link to={`${projectPath}/setup`}>
									<Button className="w-full gap-2" size="lg">
										<FileText className="h-5 w-5" />
										Set Up Project Context
										<ArrowRight className="ml-auto h-4 w-4" />
									</Button>
								</Link>
							</div>
						</div>
					)}

					{/* Phase 2: Collect */}
					{currentPhase === 2 && (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<MessageSquareText className="h-6 w-6 text-primary" />
								</div>
								<h2 className="mb-2 font-semibold text-lg">Add your first conversation</h2>
								<p className="mx-auto max-w-md text-muted-foreground text-sm">
									Upload a recording, conduct an interview, or collect responses via form.
								</p>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<Link to={`${projectPath}/interviews/upload`}>
									<Card surface="muted" className="h-full transition-all hover:border-primary/30">
										<CardContent className="p-4 text-center">
											<Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
											<span className="font-medium text-sm">Upload Recording</span>
										</CardContent>
									</Card>
								</Link>
								<Link to={`${projectPath}/interviews/quick`}>
									<Card surface="muted" className="h-full transition-all hover:border-primary/30">
										<CardContent className="p-4 text-center">
											<Mic className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
											<span className="font-medium text-sm">Record Interview</span>
										</CardContent>
									</Card>
								</Link>
								<Link to={`${projectPath}/questions`}>
									<Card surface="muted" className="h-full transition-all hover:border-primary/30">
										<CardContent className="p-4 text-center">
											<FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
											<span className="font-medium text-sm">Share Form</span>
										</CardContent>
									</Card>
								</Link>
							</div>
						</div>
					)}

					{/* Phase 3: Learn */}
					{currentPhase === 3 && (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<Lightbulb className="h-6 w-6 text-primary" />
								</div>
								<h2 className="mb-2 font-semibold text-lg">Discover what you've learned</h2>
								<p className="mx-auto max-w-md text-muted-foreground text-sm">
									Review evidence, explore insights, and prioritize actions based on what customers said.
								</p>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<Link to={`${projectPath}/evidence`}>
									<Button variant="outline" className="w-full gap-2">
										View Evidence
										<ArrowRight className="h-4 w-4" />
									</Button>
								</Link>
								<Link to={`${projectPath}/insights`}>
									<Button variant="outline" className="w-full gap-2">
										View Insights
										<ArrowRight className="h-4 w-4" />
									</Button>
								</Link>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Quick Links */}
			<div className="flex items-center justify-center gap-4 text-sm">
				<Link
					to={`${projectPath}/setup`}
					className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
				>
					<Settings className="h-4 w-4" />
					Project Context
				</Link>
				<span className="text-muted-foreground">•</span>
				<Link
					to={`${projectPath}/questions`}
					className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
				>
					<FileText className="h-4 w-4" />
					Interview Prompts
				</Link>
			</div>
		</div>
	)
}

export default OnboardingDashboard
