import type { Meta, StoryObj } from "@storybook/react"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { AnalyzeStageValidation } from "./ValidationStatus"

const meta = {
	title: "Features/Projects/Pages/validationStatus",
	component: AnalyzeStageValidation,
	decorators: [withRouter],
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		// Add controls here
	},
} satisfies Meta<typeof AnalyzeStageValidation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {},
			},
			routing: {
				path: "/",
				loader: () => ({
					// Add mock data here
				}),
			},
		}),
	},
}
