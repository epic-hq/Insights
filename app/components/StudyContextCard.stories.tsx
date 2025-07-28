import type { Meta, StoryObj } from "@storybook/react"
import StudyContextCard from "../features/projects/components/ProjectContextCard"

const meta: Meta<typeof StudyContextCard> = {
	title: "Interview Record/StudyContextCard",
	component: StudyContextCard,
}
export default meta

type Story = StoryObj<typeof StudyContextCard>

export const Default: Story = {
	args: {
		researchGoal: "Understand how students use AI tools to learn dialogues",
		studyCode: "DLG_2025_Q3",
		recruitmentChannel: "University email list",
		scriptVersion: "v2.1",
	},
}
