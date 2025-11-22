import { withRouter } from ".storybook/with-router"
import type { Meta, StoryObj } from "@storybook/react-vite"
import ThemesIndex from "./index"

const meta = {
	title: "Features/Themes/Pages/Index",
	component: ThemesIndex,
	decorators: [withRouter],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof ThemesIndex>

export default meta
type Story = StoryObj<typeof meta>

// Mock themes data
const mockThemes = [
	{
		id: "1",
		name: "Integration Challenges",
		statement: "Users struggle with connecting our platform to their existing tools",
		created_at: "2025-01-01",
	},
	{
		id: "2",
		name: "Onboarding Friction",
		statement: "New users need better guidance during their first experience",
		created_at: "2025-01-05",
	},
	{
		id: "3",
		name: "Performance Concerns",
		statement: "Teams report slowness when working with large datasets",
		created_at: "2025-01-10",
	},
]

// Mock insights
const mockInsights = [
	{
		id: "ins-1",
		statement: "API documentation is incomplete for third-party integrations",
		interview_id: "int-1",
		theme_ids: ["1"],
		votes: 5,
	},
	{
		id: "ins-2",
		statement: "First-time setup requires too many manual steps",
		interview_id: "int-2",
		theme_ids: ["2"],
		votes: 8,
	},
	{
		id: "ins-3",
		statement: "Dashboard loading takes over 10 seconds with 1000+ records",
		interview_id: "int-3",
		theme_ids: ["3"],
		votes: 12,
	},
]

export const Default: Story = {
	parameters: {
		loaderData: {
			themes: mockThemes,
			links: [],
			insights: mockInsights,
			allEvidence: [],
		},
	},
}

export const Empty: Story = {
	parameters: {
		loaderData: {
			themes: [],
			links: [],
			insights: [],
			allEvidence: [],
		},
	},
}

export const SingleTheme: Story = {
	parameters: {
		loaderData: {
			themes: [mockThemes[0]],
			links: [],
			insights: [mockInsights[0]],
			allEvidence: [],
		},
	},
}

export const ManyThemes: Story = {
	parameters: {
		loaderData: {
			themes: [
				...mockThemes,
				{
					id: "4",
					name: "Collaboration Features",
					statement: "Teams want better ways to work together on research",
					created_at: "2025-01-15",
				},
				{
					id: "5",
					name: "Mobile Experience",
					statement: "Mobile users need a responsive, touch-friendly interface",
					created_at: "2025-01-20",
				},
			],
			links: [],
			insights: mockInsights,
			allEvidence: [],
		},
	},
}
