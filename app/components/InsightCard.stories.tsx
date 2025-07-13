import type { Meta, StoryObj } from "@storybook/react"
import { InsightCard } from "./insights/InsightCard"

const meta: Meta<typeof InsightCard> = {
	title: "Interview Insights/InsightCard",
	component: InsightCard,
	tags: ["autodocs"],
	args: {
		tag: "#dialogue_learning",
		category: "Assessment",
		journeyStage: "Learning → Assessing",
		impact: 4,
		novelty: 4,
		jtbD: "“When I finish gathering information, I want to prove I actually understand it so I can satisfy teachers and internal confidence.”",
		underlyingMotivation: "Mastery, recognition",
		pain: "Tools stop at “organise & repeat,” leaving teachers fearful of AI-enabled shortcuts and students without a way to demonstrate depth.",
		desiredOutcome: "Structured support for debates, oral defenses, or dialogue-based tasks built into the product.",
		evidence:
			"“Probably the most sophisticated way… would be to participate in a debate where you had to defend the knowledge you organised.”",
		opportunityIdeas: [
			"Add a “Debate prep” mode that pairs learners with AI or peers to challenge assertions.",
			"Auto-generate opposing viewpoints and question lists from the knowledge base.",
		],
		confidence: "High",
		relatedTags: ["#peer_teaching", "#teacher_enablement"],
	},
}

export default meta

type Story = StoryObj<typeof InsightCard>

export const Default: Story = {}
