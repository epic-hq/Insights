import type { Meta, StoryObj } from "@storybook/react"
import Dashboard from "~/features/dashboard/components/Dashboard"

const meta: Meta<typeof Dashboard> = {
	title: "Dashboard/FullDashboard",
	component: Dashboard,
	parameters: { layout: "fullscreen" },
}
export default meta

type Story = StoryObj<typeof Dashboard>

const sampleInsights = []

export const Default: Story = {
	args: {
		kpis: [
			{ label: "Total Interviews", value: 24, change: "+20%", href: "/interviews" },
			{ label: "Insights", value: 87, change: "+12%", href: "/insights" },
			{ label: "Opportunities", value: 15, change: "+3%", href: "/opportunities" },
			{ label: "Average Impact", value: "3.6" },
		],
		personas: [
			{ name: "Early Adopters", percentage: 35, count: 28, color: "#2563EB", href: "/personas/early-adopters" },
			{
				name: "Mainstream Learners",
				percentage: 45,
				count: 36,
				color: "#14B8A6",
				href: "/personas/mainstream-learners",
			},
			{ name: "Skeptics", percentage: 20, count: 16, color: "#E11D48", href: "/personas/skeptics" },
		],
		interviews: [
			{ id: "INT-024", date: "2025-07-06", participant: "P24", status: "ready" },
			{ id: "INT-023", date: "2025-07-05", participant: "P23", status: "transcribed" },
			{ id: "INT-022", date: "2025-07-02", participant: "P22", status: "processing" },
		],
		opportunities: [
			{ title: "Debate Mode", owner: "Jane" },
			{ title: "Peer Review Hub", owner: "Alan" },
			{ title: "Rubric Builder", owner: "Sara" },
			{ title: "AI Tutor", owner: "Ben" },
			{ title: "Confidence Tracker", owner: "May" },
			{ title: "Gamified Quests", owner: "Wes" },
			{ title: "Analytics Dashboard", owner: "Chris" },
			{ title: "Offline Support", owner: "Ana" },
			{ title: "Custom Exports", owner: "Lee" },
		],
		themeTree: [
			{
				name: "Learning",
				value: 18, // Sum of children values
				fill: "#2563EB", // Blue color for Learning theme
				children: [
					{ name: "Dialogues", value: 10, fill: "#3B82F6" },
					{ name: "Peer Teaching", value: 8, fill: "#60A5FA" },
				],
			},
			{
				name: "Enablement",
				value: 12, // Sum of children values
				fill: "#14B8A6", // Teal color for Enablement theme
				children: [
					{ name: "Teacher", value: 5, fill: "#2DD4BF" },
					{ name: "Motivation", value: 7, fill: "#5EEAD4" },
				],
			},
		],
		insights: sampleInsights,
	},
}
