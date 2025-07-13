import type { Meta, StoryObj } from "@storybook/react"
import type { Opportunity } from "./OpportunitiesList"
import OpportunitiesList from "./OpportunitiesList"

const meta: Meta<typeof OpportunitiesList> = {
	title: "Lists/OpportunitiesList",
	component: OpportunitiesList,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof OpportunitiesList>

const sampleOpportunities: Opportunity[] = [
	{
		id: "OPP-001",
		title: "Simplified Onboarding Flow",
		owner: "Sarah Chen",
		status: "Explore",
		impact: 4,
		effort: 2,
		description: "Create a streamlined onboarding experience focused on the core features",
	},
	{
		id: "OPP-002",
		title: "Mobile Dashboard Redesign",
		owner: "Miguel Rodriguez",
		status: "Validate",
		impact: 5,
		effort: 3,
		description: "Redesign the dashboard for mobile-first experience",
	},
	{
		id: "OPP-003",
		title: "AI-Powered Insights Summary",
		owner: "Priya Sharma",
		status: "Build",
		impact: 4,
		effort: 4,
		description: "Implement AI to generate automatic insights from user data",
	},
	{
		id: "OPP-004",
		title: "Interactive Chart Tooltips",
		owner: "James Wilson",
		status: "Explore",
		impact: 3,
		effort: 1,
		description: "Add contextual tooltips to all dashboard charts",
	},
	{
		id: "OPP-005",
		title: "Customizable Dashboard Layout",
		owner: "Emma Johnson",
		status: "Validate",
		impact: 4,
		effort: 3,
		description: "Allow users to customize their dashboard layout",
	},
]

export const Default: Story = {
	args: {
		opportunities: sampleOpportunities,
	},
}

export const Empty: Story = {
	args: {
		opportunities: [],
	},
}

export const FilteredByStatus: Story = {
	args: {
		title: "Build Phase Opportunities",
		opportunities: sampleOpportunities.filter((o) => o.status === "Build"),
	},
}
