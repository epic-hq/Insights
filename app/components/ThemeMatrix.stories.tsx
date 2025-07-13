import type { Meta, StoryObj } from "@storybook/react"
import { ThemeMatrix } from "./themes/ThemeMatrix"

const meta: Meta<typeof ThemeMatrix> = {
	title: "Foundations/ThemeMatrix",
	component: ThemeMatrix,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Visual reference of all Tailwind color tokens against light & dark backgrounds to aid design decisions.",
			},
		},
	},
}
export default meta

type Story = StoryObj<typeof ThemeMatrix>

export const Default: Story = {
	args: {},
}
