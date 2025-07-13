import type { Meta, StoryObj } from "@storybook/react"
import type { Persona } from "./PersonasList"
import PersonasList from "./PersonasList"

const meta: Meta<typeof PersonasList> = {
	title: "Lists/PersonasList",
	component: PersonasList,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof PersonasList>

const samplePersonas: Persona[] = [
	{
		id: "persona-1",
		name: "Early Adopters",
		percentage: 35,
		count: 28,
		color: "#2563EB",
		description: "Tech-savvy users who are first to try new features and provide feedback",
		slices: [
			{ name: "Feature Usage", value: 70, color: "#3b82f6" },
			{ name: "Feedback", value: 30, color: "#93c5fd" },
		],
	},
	{
		id: "persona-2",
		name: "Mainstream Learners",
		percentage: 45,
		count: 36,
		color: "#14B8A6",
		description: "Regular users who adopt features after they've been proven by early adopters",
		slices: [
			{ name: "Feature Usage", value: 50, color: "#2dd4bf" },
			{ name: "Feedback", value: 50, color: "#99f6e4" },
		],
	},
	{
		id: "persona-3",
		name: "Skeptics",
		percentage: 20,
		count: 16,
		color: "#E11D48",
		description: "Users who are hesitant to adopt new features and require convincing",
		slices: [
			{ name: "Feature Usage", value: 30, color: "#f43f5e" },
			{ name: "Feedback", value: 70, color: "#fda4af" },
		],
	},
]

export const Default: Story = {
	args: {
		personas: samplePersonas,
		totalParticipants: 80,
	},
}

export const Empty: Story = {
	args: {
		personas: [],
	},
}

export const WithoutDonutCharts: Story = {
	args: {
		personas: samplePersonas.map(({ slices, ...rest }) => rest),
		totalParticipants: 80,
	},
}
