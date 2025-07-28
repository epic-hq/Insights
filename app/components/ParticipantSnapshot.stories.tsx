import type { Meta, StoryObj } from "@storybook/react"
import ParticipantSnapshot from "../features/interviews/components/ParticipantSnapshot"

const meta: Meta<typeof ParticipantSnapshot> = {
	title: "Interview Record/ParticipantSnapshot",
	component: ParticipantSnapshot,
}
export default meta

type Story = StoryObj<typeof ParticipantSnapshot>

export const Default: Story = {
	args: {
		narrative: `Alex is a fourth-year CS student balancing part-time work and studies.
They rely heavily on recorded lectures and AI summarizers to review material quickly.
Top frustrations: information overload and lack of interactive checks for understanding.
Aspirations: graduate with honours and land a ML engineering role.
Stand-out quote: "AI tools are great at giving answers, but not at showing I *truly* get it."`,
	},
}
