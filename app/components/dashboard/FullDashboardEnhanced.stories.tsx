import type { Meta, StoryObj } from "@storybook/react"
import { sampleData } from "../../data/sampleData"
import Dashboard from "../../features/dashboard/components/Dashboard"

const meta: Meta<typeof Dashboard> = {
	title: "Dashboard/FullDashboardEnhanced",
	component: Dashboard,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component: "Enhanced dashboard with sticky KPI bar, 12-column grid layout, and improved visual hierarchy.",
			},
		},
	},
}
export default meta

type Story = StoryObj<typeof Dashboard>

// Enhanced sample data with priorities for Kanban items
const enhancedData = {
	...sampleData,
	opportunities: [
		{ title: "Debate Mode", owner: "Jane", priority: "high" },
		{ title: "Peer Review Hub", owner: "Alan", priority: "medium" },
		{ title: "Rubric Builder", owner: "Sara", priority: "low" },
		{ title: "AI Tutor", owner: "Ben", priority: "high" },
		{ title: "Confidence Tracker", owner: "May", priority: "medium" },
		{ title: "Gamified Quests", owner: "Wes", priority: "low" },
		{ title: "Analytics Dashboard", owner: "Chris", priority: "high" },
		{ title: "Offline Support", owner: "Ana", priority: "medium" },
		{ title: "Custom Exports", owner: "Lee", priority: "low" },
	],
}

export const Enhanced: Story = {
	args: enhancedData,
	parameters: {
		chromatic: { viewports: [320, 768, 1200] },
	},
}

export const Mobile: Story = {
	args: enhancedData,
	parameters: {
		viewport: {
			defaultViewport: "mobile1",
		},
	},
}

export const Tablet: Story = {
	args: enhancedData,
	parameters: {
		viewport: {
			defaultViewport: "tablet",
		},
	},
}

export const Desktop: Story = {
	args: enhancedData,
	parameters: {
		viewport: {
			defaultViewport: "desktop",
		},
	},
}
