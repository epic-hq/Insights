import type { Meta, StoryObj } from "@storybook/react"
import type { InsightCardProps } from "../insights/InsightCard"
import InsightsList from "../insights/InsightsList"

const meta: Meta<typeof InsightsList> = {
	title: "Lists/InsightsList",
	component: InsightsList,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof InsightsList>

const sampleInsights: InsightCardProps[] = [
	{
		id: "story-ins-1",
		createdAt: "2025-07-01",
		tag: "User Onboarding",
		category: "First-time Experience",
		journeyStage: "Awareness",
		impact: 4,
		novelty: 3,
		jtbD: "I want to quickly understand how to use the product without reading documentation",
		underlyingMotivation: "I'm busy and want to get value from the product immediately",
		pain: "Tutorial is too long and complex",
		desiredOutcome: "Feel confident using core features within 2 minutes",
		evidence: "I tried using it but gave up after the third step of the tutorial",
		opportunityIdeas: ["Simplified 3-step onboarding", "Interactive tooltips"],
		confidence: "High",
		relatedTags: ["UX", "Onboarding", "Tutorial"],
	},
	{
		id: "story-ins-2",
		createdAt: "2025-07-02",
		tag: "Data Visualization",
		category: "Dashboard Experience",
		journeyStage: "Engagement",
		impact: 5,
		novelty: 2,
		jtbD: "I want to understand my data at a glance without complex analysis",
		underlyingMotivation: "I need to make quick decisions based on trends",
		pain: "Charts are too complex and hard to interpret",
		desiredOutcome: "Immediately spot trends and anomalies",
		evidence: "I spend 20 minutes every morning trying to understand what the dashboard is telling me",
		opportunityIdeas: ["Simplified chart views", "AI-powered insights summary"],
		confidence: "Medium",
		relatedTags: ["Dashboard", "Charts", "UX"],
	},
	{
		id: "story-ins-3",
		createdAt: "2025-07-03",
		tag: "Mobile Experience",
		category: "Cross-platform",
		journeyStage: "Retention",
		impact: 4,
		novelty: 4,
		jtbD: "I want to check key metrics while away from my desk",
		underlyingMotivation: "I need to stay informed even when I'm not at my computer",
		pain: "Mobile view is cramped and hard to navigate",
		desiredOutcome: "Quick access to critical information on mobile",
		evidence: "I tried using the mobile app during a meeting but couldn't find the data I needed",
		opportunityIdeas: ["Mobile-first redesign", "Simplified mobile dashboard"],
		confidence: "High",
		relatedTags: ["Mobile", "Responsive", "On-the-go"],
	},
]

export const Default: Story = {
	args: {
		insights: sampleInsights,
		getInsightId: (insight) => insight.id,
	},
}

export const Empty: Story = {
	args: {
		insights: [],
	},
}

export const SingleColumn: Story = {
	args: {
		insights: sampleInsights.slice(0, 2),
		getInsightId: (insight) => insight.id,
	},
	parameters: {
		viewport: {
			defaultViewport: "mobile1",
		},
	},
}
