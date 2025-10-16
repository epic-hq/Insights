import type { Meta, StoryObj } from "@storybook/react"
import React from "react"

const TestComponent = () => {
	return (
		<div>
			<h1 className="text-4xl font-bold text-blue-600 mb-4">Tailwind Test</h1>
			<p className="text-lg text-gray-600">If you see blue text and proper sizing, Tailwind is working!</p>
			<div className="mt-4 p-4 bg-primary text-primary-foreground rounded-lg">
				This should have primary background color
			</div>
			<div className="mt-4 p-4 border border-border rounded-lg">
				This should have a border
			</div>
		</div>
	)
}

const meta = {
	title: "Test/Tailwind",
	component: TestComponent,
	parameters: {
		layout: "padded",
	},
} satisfies Meta<typeof TestComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
