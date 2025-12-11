/**
 * OnboardingDashboard - Empty state dashboard for new users
 *
 * Displayed when project has no conversations.
 * Shows onboarding tasks and placeholder sections.
 * Does NOT render the sidebar to reduce cognitive load.
 */

import { CalendarPlus, CheckSquare, Glasses, Lightbulb, MessageSquareText, Search, Settings } from "lucide-react"
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
	hasGoals,
	hasLenses,
	hasConversations = false,
	hasAppliedLenses = false,
	hideHeader,
	className,
}: OnboardingDashboardProps) {
	// Build onboarding tasks with completion state based on user's progress
	const onboardingTasks: OnboardingTask[] = [
		{
			id: "setup",
			title: "Provide context",
			description: "Share your customer goals and background to get personalized prompts, analysis and guidance",
			icon: Settings,
			href: `${projectPath}/setup`,
			isComplete: hasGoals,
			priority: 1,
		},
		{
			id: "upload",
			title: "Add a conversation",
			description: "Upload your first conversation to unlock AI-powered insights and analysis",
			icon: MessageSquareText,
			href: `${projectPath}/interviews/upload`,
			isComplete: hasConversations,
			priority: 2,
		},
		{
			id: "review",
			title: "Discover what customers really want",
			description: "Uncover hidden patterns, validate assumptions, and find the insights that drive product decisions",
			icon: Search,
			href: hasConversations ? `${projectPath}/evidence` : undefined,
			isComplete: hasAppliedLenses,
			priority: 3,
		},
		{
			id: "tasks",
			title: "Turn insights into action",
			description: "Prioritize what matters most and never lose track of customer feedback again",
			icon: CalendarPlus,
			href: hasConversations ? `${projectPath}/priorities` : undefined,
			isComplete: false,
			priority: 4,
		},
	]

	return (
		<div className={className}>
			{/* Welcome Header */}
			{!hideHeader && <WelcomeHeader projectName={projectName} className="mb-10" />}

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
					What You'll Unlock
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<EmptyStateBox
						icon={MessageSquareText}
						title="Never Forget a Detail"
						message="Every conversation is automatically transcribed, searchable, and connected—no more lost notes or forgotten context"
						ctaText="Add Conversation"
						ctaHref={`${projectPath}/interviews/upload`}
					/>
					<EmptyStateBox
						icon={Lightbulb}
						title="Surface Hidden Patterns"
						message="AI automatically discovers recurring themes, pain points, and opportunities across all your customer conversations"
						ctaText="View Themes"
						ctaHref={`${projectPath}/themes`}
					/>
					<EmptyStateBox
						icon={CheckSquare}
						title="Turn Insights into Action"
						message="AI-detected tasks and follow-ups ensure nothing falls through the cracks—stay on top of what matters most"
						ctaText="View Tasks"
						ctaHref={`${projectPath}/priorities`}
					/>
					<EmptyStateBox
						icon={Search}
						title="Instant Answers"
						message="Ask questions across all your conversations and get AI-powered answers with citations—research in seconds, not hours"
						ctaText="Search Evidence"
						ctaHref={`${projectPath}/evidence`}
						variant="subtle"
					/>
					<EmptyStateBox
						icon={Glasses}
						title="Structured Analysis"
						message="Extract competitor mentions, feature requests, sentiment, and more with configurable analysis lenses"
						ctaText="Configure Lenses"
						ctaHref={`${projectPath}/lenses`}
						variant="subtle"
					/>
					<EmptyStateBox
						icon={CalendarPlus}
						title="People & Opportunities"
						message="Keep track of key contacts, promising leads, and important relationships—never lose sight of who matters most"
						ctaText="View Contacts"
						ctaHref={`${projectPath}/people`}
						variant="subtle"
					/>
				</div>
			</section>
		</div>
	)
}

export default OnboardingDashboard
