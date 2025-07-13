import type { Meta, StoryObj } from "@storybook/react"
import InterviewsList from "../interviews/InterviewsList"

const meta: Meta<typeof InterviewsList> = {
	title: "Lists/InterviewsList",
	component: InterviewsList,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof InterviewsList>

export const Default: Story = {
	args: {
		title: "Recent Interviews",
		interviews: [
			{ id: "INT-001", date: "2025-07-01", participant: "P01", status: "ready", persona: "Early Adopter" },
			{ id: "INT-002", date: "2025-07-02", participant: "P02", status: "transcribed", persona: "Mainstream Learner" },
			{ id: "INT-003", date: "2025-07-03", participant: "P03", status: "processing", persona: "Skeptic" },
			{ id: "INT-004", date: "2025-07-04", participant: "P04", status: "ready", persona: "Early Adopter" },
			{ id: "INT-005", date: "2025-07-05", participant: "P05", status: "ready", persona: "Mainstream Learner" },
		],
	},
}

export const Empty: Story = {
	args: {
		interviews: [],
	},
}

export const WithFiltering: Story = {
	args: {
		...Default.args,
		title: "Filtered Interviews",
		interviews: Default.args?.interviews?.filter((i) => i.status === "ready") || [],
	},
}
