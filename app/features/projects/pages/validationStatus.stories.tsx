import type { Meta, StoryObj } from "@storybook/react"
import { withRouter } from ".storybook/with-router"
import { AnalyzeStageValidation } from "./validationStatus"

const meta = {
	title: "Features/Projects/Pages/validationStatus",
	component: AnalyzeStageValidation,
	decorators: [withRouter],
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof AnalyzeStageValidation>

export default meta
type Story = StoryObj<typeof meta>

// Mock data that would normally come from loader
export const Default: Story = {
	parameters: {
		loaderData: {
			// Add whatever data your component expects from useLoaderData()
			// For now, empty object - add fields as you discover what's needed
		},
	},
}
