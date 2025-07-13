import type { Meta, StoryObj } from "@storybook/react"
// For Storybook stories
import * as ReactRouterDom from "react-router-dom"
import { vi } from "vitest"
import ThemeDetail from "../components/themes/ThemeDetail"
import { sampleData } from "../data/sampleData"

// Create a mock for useParams
const mockUseParams = vi.fn()

const meta: Meta<typeof ThemeDetail> = {
	title: "Components/ThemeDetail",
	component: ThemeDetail,
	parameters: {
		layout: "fullscreen",
		reactRouter: {
			routePath: "/themes/:themeId",
			outlet: ({ children }: { children: React.ReactNode }) => children,
		},
	},
	decorators: [
		(Story) => {
			// Mock useParams before rendering the story
			vi.spyOn(ReactRouterDom, "useParams").mockImplementation(() => mockUseParams())

			return (
				<div className="mx-auto max-w-7xl p-4">
					<Story />
				</div>
			)
		},
	],
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

// Default story with onboarding theme
export const Onboarding: Story = {
	args: {
		insights: sampleData.insights,
	},
	parameters: {
		reactRouter: {
			routePath: "/themes/:themeId",
			routeParams: { themeId: "onboarding" },
		},
	},
	decorators: [
		(Story) => {
			mockUseParams.mockReturnValue({ themeId: "onboarding" })
			return <Story />
		},
	],
}

// Navigation theme
export const Navigation: Story = {
	args: {
		insights: sampleData.insights,
	},
	parameters: {
		reactRouter: {
			routePath: "/themes/:themeId",
			routeParams: { themeId: "navigation" },
		},
	},
	decorators: [
		(Story) => {
			mockUseParams.mockReturnValue({ themeId: "not-found" })
			return <Story />
		},
	],
}

// Theme with many insights
export const ThemeWithManyInsights: Story = {
	args: {
		insights: [
			...sampleData.insights,
			{
				id: "insight-extra-1",
				tag: "Onboarding",
				category: "User Experience",
				jtbD: "Users need clearer first-time setup instructions",
				impact: 5,
				novelty: 4,
				evidence: "Multiple interviewees mentioned confusion during setup",
				relatedTags: ["UX", "Documentation"],
			},
			{
				id: "insight-extra-2",
				tag: "Onboarding",
				category: "User Experience",
				jtbD: "Tutorial videos would improve onboarding experience",
				impact: 4,
				novelty: 3,
				evidence: "Several users requested video tutorials",
				relatedTags: ["UX", "Learning"],
			},
			{
				id: "insight-extra-3",
				tag: "Onboarding",
				category: "User Experience",
				jtbD: "Onboarding checklist would help track progress",
				impact: 3,
				novelty: 2,
				evidence: "Users reported feeling lost in the process",
				relatedTags: ["UX", "Progress Tracking"],
			},
		],
	},
	parameters: {
		reactRouter: {
			routePath: "/themes/:themeId",
			routeParams: { themeId: "onboarding" },
		},
	},
	decorators: [
		(Story) => {
			mockUseParams.mockReturnValue({ themeId: "onboarding" })
			return <Story />
		},
	],
}

// Theme not found
export const ThemeNotFound: Story = {
	args: {
		insights: sampleData.insights,
	},
	parameters: {
		reactRouter: {
			routePath: "/themes/:themeId",
			routeParams: { themeId: "non-existent-theme" },
		},
	},
	decorators: [
		(Story) => {
			vi.mocked(useParams).mockReturnValue({ themeId: "non-existent-theme" })
			return <Story />
		},
	],
}
