import type { Meta, StoryObj } from "@storybook/react"
import ThemesList from "../components/lists/ThemesList"
import { sampleData } from "../data/sampleData"

const meta: Meta<typeof ThemesList> = {
	title: "Components/ThemesList",
	component: ThemesList,
	parameters: {
		layout: "fullscreen",
		reactRouter: {
			routePath: "/themes",
			outlet: ({ children }: { children: React.ReactNode }) => children,
		},
	},
	decorators: [
		(Story) => (
			<div className="mx-auto max-w-7xl p-4">
				<Story />
			</div>
		),
	],
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		themeTree: sampleData.themeTree,
	},
}

export const EmptyState: Story = {
	args: {
		themeTree: [],
	},
}

export const SingleCategory: Story = {
	args: {
		themeTree: [
			{
				name: "User Experience",
				value: 100,
				fill: "#2563EB",
				children: [
					{ name: "Onboarding", value: 40, fill: "#3B82F6" },
					{ name: "Navigation", value: 30, fill: "#60A5FA" },
					{ name: "Performance", value: 30, fill: "#93C5FD" },
				],
			},
		],
	},
}

export const ManyThemes: Story = {
	args: {
		themeTree: [
			{
				name: "User Experience",
				value: 100,
				fill: "#2563EB",
				children: [
					{ name: "Onboarding", value: 40, fill: "#3B82F6" },
					{ name: "Navigation", value: 30, fill: "#60A5FA" },
					{ name: "Performance", value: 30, fill: "#93C5FD" },
					{ name: "Accessibility", value: 25, fill: "#BFDBFE" },
					{ name: "Mobile Responsiveness", value: 20, fill: "#DBEAFE" },
				],
			},
			{
				name: "Feature Requests",
				value: 80,
				fill: "#10B981",
				children: [
					{ name: "Integration", value: 50, fill: "#34D399" },
					{ name: "Customization", value: 30, fill: "#6EE7B7" },
					{ name: "Automation", value: 25, fill: "#A7F3D0" },
					{ name: "Reporting", value: 20, fill: "#D1FAE5" },
				],
			},
			{
				name: "Technical Issues",
				value: 60,
				fill: "#EF4444",
				children: [
					{ name: "Performance", value: 30, fill: "#F87171" },
					{ name: "Bugs", value: 20, fill: "#FCA5A5" },
					{ name: "Compatibility", value: 10, fill: "#FECACA" },
				],
			},
		],
	},
}
