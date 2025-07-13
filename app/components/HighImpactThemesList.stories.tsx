import type { Meta, StoryObj } from "@storybook/react"
import type { ThemeItem } from "./themes/HighImpactThemesList"
import HighImpactThemesList from "./themes/HighImpactThemesList"

const meta: Meta<typeof HighImpactThemesList> = {
	title: "Interview Record/HighImpactThemesList",
	component: HighImpactThemesList,
}
export default meta

type Story = StoryObj<typeof HighImpactThemesList>

const sample: ThemeItem[] = [
	{
		tag: "#dialogue_learning",
		text: "Students need debate-style checks to prove understanding.",
		impact: 4,
		novelty: 3,
	},
	{ tag: "#peer_teaching", text: "Learners retain more when they explain topics to peers.", impact: 3, novelty: 4 },
]

export const Default: Story = {
	args: {
		themes: sample,
	},
}
