import type { Meta, StoryObj } from "@storybook/react"
import InterviewMetadata from "./interviews/InterviewMetadata"

const meta: Meta<typeof InterviewMetadata> = {
	title: "Interview Record/InterviewMetadata",
	component: InterviewMetadata,
}
export default meta

type Story = StoryObj<typeof InterviewMetadata>

export const Default: Story = {
	args: {
		interviewId: "INT-001",
		date: "2025-07-01",
		interviewer: "Jane D.",
		participant: "Pseudonym P01",
		segment: "Returning adult STEM student",
		duration: 42,
		transcriptLink: "https://example.com/int-001.pdf",
	},
}
