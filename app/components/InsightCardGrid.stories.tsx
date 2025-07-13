import type { Meta, StoryObj } from "@storybook/react"
import type { InsightCardProps } from "./insights/InsightCard"
import InsightCardGrid from "./insights/InsightCardGrid"

const meta: Meta<typeof InsightCardGrid> = {
	title: "Interview Record/InsightCardGrid",
	component: InsightCardGrid,
}
export default meta

type Story = StoryObj<typeof InsightCardGrid>

const sampleInsights: InsightCardProps[] = [
	{
		tag: "#dialogue_learning",
		category: "Assessment",
		journeyStage: "Learning → Assessing",
		impact: 4,
		novelty: 3,
		jtbD: "When I finish gathering information, I want to prove I actually understand it so I can satisfy teachers and internal confidence.",
		underlyingMotivation: "Mastery, recognition",
		pain: "Tools stop at organise & repeat, leaving teachers fearful of AI-enabled shortcuts and students without a way to demonstrate depth.",
		desiredOutcome: "Structured support for debates, oral defenses, or dialogue-based tasks built into the product.",
		evidence:
			"Probably the most sophisticated way… would be to participate in a debate where you had to defend the knowledge you organised.",
		opportunityIdeas: [
			"Add a 'Debate prep' mode that pairs learners with AI or peers to challenge assertions.",
			"Auto-generate opposing viewpoints and question lists from the knowledge base.",
		],
		confidence: "High",
		relatedTags: ["peer_teaching", "teacher_enablement"],
		contradictions: "None noted; Jed repeatedly reinforces dialogue as end-goal.",
	},
]

export const Default: Story = {
	args: {
		insights: sampleInsights,
	},
}
