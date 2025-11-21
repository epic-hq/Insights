import { withRouter } from ".storybook/with-router"
import type { Meta, StoryObj } from "@storybook/react"
import OpportunitiesIndex from "./index"

const meta = {
	title: "Features/Opportunities/Pages/Index",
	component: OpportunitiesIndex,
	decorators: [withRouter],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof OpportunitiesIndex>

export default meta
type Story = StoryObj<typeof meta>

// Mock opportunities data
const mockOpportunities = [
	{
		id: "1",
		name: "Enterprise CRM Integration",
		account_id: "acc-1",
		project_id: "proj-1",
		stage: "Explore",
		value: 50000,
		close_date: "2025-03-15",
		created_at: "2025-01-01",
	},
	{
		id: "2",
		name: "API Platform Upgrade",
		account_id: "acc-1",
		project_id: "proj-1",
		stage: "Validate",
		value: 75000,
		close_date: "2025-04-20",
		created_at: "2025-01-05",
	},
	{
		id: "3",
		name: "Mobile App Development",
		account_id: "acc-1",
		project_id: "proj-1",
		stage: "Build",
		value: 120000,
		close_date: "2025-06-30",
		created_at: "2025-01-10",
	},
]

export const Default: Story = {
	parameters: {
		loaderData: {
			opportunities: mockOpportunities,
		},
	},
}

export const Empty: Story = {
	parameters: {
		loaderData: {
			opportunities: [],
		},
	},
}

export const ManyOpportunities: Story = {
	parameters: {
		loaderData: {
			opportunities: [
				...mockOpportunities,
				{
					id: "4",
					name: "Data Analytics Platform",
					account_id: "acc-1",
					project_id: "proj-1",
					stage: "Explore",
					value: 95000,
					close_date: "2025-05-15",
					created_at: "2025-01-15",
				},
				{
					id: "5",
					name: "Customer Portal Redesign",
					account_id: "acc-1",
					project_id: "proj-1",
					stage: "Validate",
					value: 45000,
					close_date: "2025-04-01",
					created_at: "2025-01-20",
				},
			],
		},
	},
}
