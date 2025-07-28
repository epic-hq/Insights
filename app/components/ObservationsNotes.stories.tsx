import type { Meta, StoryObj } from "@storybook/react"
import ObservationsNotes from "../features/interviews/components/ObservationsNotes"

const meta: Meta<typeof ObservationsNotes> = {
	title: "Interview Record/ObservationsNotes",
	component: ObservationsNotes,
}
export default meta

type Story = StoryObj<typeof ObservationsNotes>

export const Default: Story = {
	args: {
		notes: `Participant was animated when discussing peer feedback, leaning forward and gesturing.
Background noise minimal; interview conducted over Zoom.
Paused twice to think when asked about desired outcomes.`,
	},
}
