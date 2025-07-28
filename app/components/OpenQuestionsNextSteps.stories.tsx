import type { Meta, StoryObj } from "@storybook/react"
import OpenQuestionsNextSteps from "../features/interviews/components/OpenQuestionsNextSteps"

const meta: Meta<typeof OpenQuestionsNextSteps> = {
	title: "Interview Record/OpenQuestionsNextSteps",
	component: OpenQuestionsNextSteps,
}
export default meta

type Story = StoryObj<typeof OpenQuestionsNextSteps>

export const Default: Story = {
	args: {
		items: [
			"Validate whether debate mode improves retention by 20%",
			"Prototype AI adversary for dialogue assessment",
			"Interview teachers about rubric needs for oral defenses",
		],
	},
}
