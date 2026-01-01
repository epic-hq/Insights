/**
 * OnboardingDashboard - Award-winning clarity for new users
 *
 * Shows a clear 3-phase journey: Plan → Collect → Learn
 * Each phase has clear steps and progress indication.
 */

import { ArrowRight, Building2, FileText, Lightbulb, MessageSquareText, Mic, Settings, Upload } from "lucide-react"
import { Link } from "react-router-dom"
import { JourneyPhaseBar } from "~/components/JourneyPhaseBar"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { cn } from "~/lib/utils"

export interface OnboardingDashboardProps {
	/** Project name to display */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Project ID for skip functionality */
	projectId: string
	/** Whether project goals have been set up */
	hasGoals: boolean
	/** Whether lenses have been configured */
	hasLenses: boolean
	/** Whether company context has been set up */
	hasCompanyContext: boolean
	/** Whether interview prompts have been generated */
	hasPrompts?: boolean
	/** Whether the user has conversations */
	hasConversations?: boolean
	/** Whether the user has applied lenses */
	hasAppliedLenses?: boolean
	/** Hide the header (when parent provides it) */
	hideHeader?: boolean
	/** Additional CSS classes */
	className?: string
}

export function OnboardingDashboard({
	projectName,
	projectPath,
	projectId,
	hasGoals,
	hasLenses: _hasLenses,
	hasCompanyContext,
	hasPrompts = false,
	hasConversations = false,
	hasAppliedLenses = false,
	hideHeader,
	className,
}: OnboardingDashboardProps) {
	// Determine current phase
	// Plan phase requires: context (company + goals) AND interview prompts
	const hasContext = hasCompanyContext && hasGoals
	const phase1Complete = hasContext && hasPrompts
	const phase2Complete = hasConversations
	const phase3Complete = hasAppliedLenses

	const currentPhase = phase1Complete ? (phase2Complete ? 3 : 2) : 1

	// Within Plan phase, determine sub-step
	const needsCompanySetup = !hasCompanyContext
	const needsProjectSetup = hasCompanyContext && !hasGoals
	const needsQuestionsSetup = hasContext && !hasPrompts

	return (
		<div className={cn("mx-auto max-w-2xl", className)}>
			{/* Header */}
			{!hideHeader && (
				<header className="mb-8 text-center">
					<h1 className="mb-2 font-semibold text-2xl text-foreground">Setup</h1>
					<p className="text-muted-foreground">Let's set up your research project</p>
				</header>
			)}

			{/* Journey Phase Bar with sub-steps */}
			<JourneyPhaseBar
				currentPhase={currentPhase === 1 ? "plan" : currentPhase === 2 ? "collect" : "learn"}
				basePath={projectPath}
				planComplete={phase1Complete}
				collectComplete={phase2Complete}
				planSubStep={needsQuestionsSetup ? "questions" : "context"}
				contextComplete={hasContext}
				questionsComplete={hasPrompts}
				className="mb-8"
			/>

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
								<Link to={`${projectPath}/setup`}>
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

					{currentPhase === 1 && needsQuestionsSetup && (
						<div className="space-y-6">
							<div className="text-center">
								<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<FileText className="h-6 w-6 text-primary" />
								</div>
								<h2 className="mb-2 font-semibold text-lg">Generate interview questions</h2>
								<p className="mx-auto max-w-md text-muted-foreground text-sm">
									Create AI-powered interview questions based on your research goals to guide your conversations.
								</p>
							</div>

							<div className="space-y-3">
								<Link to={`${projectPath}/questions`}>
									<Button className="w-full gap-2" size="lg">
										<FileText className="h-5 w-5" />
										Generate Questions
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
