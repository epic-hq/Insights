import type { Meta, StoryObj } from "@storybook/react"
import React from "react"

const TestComponent = () => {
	return (
		<div>
			<h1 className="mb-4 font-bold text-4xl text-blue-600">Tailwind Test</h1>
			<p className="text-gray-600 text-lg">If you see blue text and proper sizing, Tailwind is working!</p>
			<div className="mt-4 rounded-lg bg-primary p-4 text-primary-foreground">
				This should have primary background color
			</div>
			<div className="mt-4 rounded-lg border border-border p-4">This should have a border</div>
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
