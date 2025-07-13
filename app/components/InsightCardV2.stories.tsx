import type { Meta, StoryObj } from "@storybook/react"
import type { InsightCardProps } from "./insights/InsightCard"
import { InsightCardV2 } from "./insights/InsightCardV2"

const meta: Meta<typeof InsightCardV2> = {
	title: "Interview Insights/InsightCardV2",
	component: InsightCardV2,
	tags: ["autodocs"],
	args: {
		tag: "Dialogue-based learning assessment",
		category: "Assessment",
		journeyStage: "Learning → Assessing",
		impact: 4,
		novelty: 4,
		jtbD: '"When I finish gathering information, I want to prove I actually understand it so I can satisfy teachers and internal confidence."',
		underlyingMotivation: "Mastery, recognition",
		pain: 'Tools stop at "organise & repeat," leaving teachers fearful of AI-enabled shortcuts and students without a way to demonstrate depth.',
		desiredOutcome: "Structured support for debates, oral defenses, or dialogue-based tasks built into the product.",
		evidence:
			'"Probably the most sophisticated way… would be to participate in a debate where you had to defend the knowledge you organised."',
		opportunityIdeas: [
			'Add a "Debate prep" mode that pairs learners with AI or peers to challenge assertions.',
			"Auto-generate opposing viewpoints and question lists from the knowledge base.",
		],
		confidence: "High",
		relatedTags: ["peer_teaching", "teacher_enablement"],
		upvotes: 12,
		downvotes: 2,
	},
	argTypes: {
		onUpvote: { action: "upvoted" },
		onDownvote: { action: "downvoted" },
		onConvertToOpportunity: { action: "converted to opportunity" },
		onArchive: { action: "archived" },
		onDontShowMe: { action: "marked as don't show" },
		onTagClick: { action: "tag clicked" },
	},
}

export default meta

type Story = StoryObj<typeof InsightCardV2>

export const Default: Story = {}

export const WithContradictions: Story = {
	args: {
		contradictions: "Some users mentioned they prefer written assessments over dialogue-based ones.",
	},
}

export const LowImpactNovelty: Story = {
	args: {
		impact: 2,
		novelty: 1,
	},
}

export const NoOpportunityIdeas: Story = {
	args: {
		opportunityIdeas: [],
	},
}

export const Expanded: Story = {
	render: (args: InsightCardProps) => {
		// Force the component to be expanded by default
		return (
			<div className="max-w-xl p-4">
				<InsightCardV2 {...args} />
			</div>
		)
	},
}
