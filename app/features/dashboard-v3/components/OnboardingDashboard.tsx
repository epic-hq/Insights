/**
 * OnboardingDashboard - Empty state dashboard for new users
 *
 * Displayed when project has no conversations.
 * Shows onboarding tasks and placeholder sections.
 * Does NOT render the sidebar to reduce cognitive load.
 */

import { CheckSquare, Glasses, Lightbulb, Target, Upload } from "lucide-react"
import { type OnboardingTask, OnboardingTaskCard } from "./onboarding/OnboardingTaskCard"
import { WelcomeHeader } from "./onboarding/WelcomeHeader"
import { EmptyStateBox } from "./shared/EmptyStateBox"

export interface OnboardingDashboardProps {
	/** Project name to display */
	projectName: string
	/** Base path for project routes */
	projectPath: string
	/** Whether project goals have been set up */
	hasGoals: boolean
	/** Whether lenses have been configured */
	hasLenses: boolean
	/** Additional CSS classes */
	className?: string
}

export function OnboardingDashboard({
	projectName,
	projectPath,
	hasGoals,
	hasLenses,
	className,
}: OnboardingDashboardProps) {
	// Build onboarding tasks with completion state
	const onboardingTasks: OnboardingTask[] = [
		{
			id: "goals",
			title: "Define your research goals",
			description: "Set clear objectives for what you want to learn from your conversations",
			icon: Target,
			href: `${projectPath}/setup`,
			isComplete: hasGoals,
			priority: 1,
		},
		{
			id: "upload",
			title: "Upload your first conversation",
			description: "Add a recording, transcript, or notes to start extracting insights",
			icon: Upload,
			href: `${projectPath}/interviews/upload`,
			isComplete: false, // Will be true once they have conversations
			priority: 2,
		},
		{
			id: "lenses",
			title: "Configure your analysis lenses",
			description: "Choose which frameworks to apply (Sales BANT, Customer Discovery, etc)",
			icon: Glasses,
			href: `${projectPath}/lens-library`,
			isComplete: hasLenses,
			priority: 3,
		},
	]

	return (
		<div className={className}>
			{/* Welcome Header */}
			<WelcomeHeader projectName={projectName} className="mb-10" />

			{/* Onboarding Tasks */}
			<section className="mx-auto mb-12 max-w-2xl">
				<h2 className="mb-4 font-medium text-muted-foreground text-sm uppercase tracking-wider">Getting Started</h2>
				<div className="space-y-3">
					{onboardingTasks.map((task, index) => (
						<OnboardingTaskCard key={task.id} task={task} stepNumber={index + 1} />
					))}
				</div>
			</section>

			{/* What You'll See - Placeholder Grid */}
			<section className="mx-auto max-w-4xl">
				<h2 className="mb-6 text-center font-medium text-muted-foreground text-sm uppercase tracking-wider">
					What you'll see
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<EmptyStateBox
						icon={CheckSquare}
						title="Tasks"
						message="Upload a conversation to see AI-generated action items here"
						ctaText="Add Conversation"
						ctaHref={`${projectPath}/interviews/upload`}
					/>
					<EmptyStateBox
						icon={Lightbulb}
						title="Insights"
						message="Upload a conversation to see AI-discovered patterns and themes here"
						ctaText="Add Conversation"
						ctaHref={`${projectPath}/interviews/upload`}
					/>
					<EmptyStateBox
						icon={Glasses}
						title="Lens Results"
						message="Configure lenses, then upload conversations to see structured analysis here"
						ctaText="Configure Lenses"
						ctaHref={`${projectPath}/lens-library`}
						variant="subtle"
					/>
				</div>
			</section>
		</div>
	)
}

export default OnboardingDashboard
