import type { Meta, StoryObj } from "@storybook/react"
import { withRouter } from ".storybook/with-router"
import PersonasIndex from "./index"

const meta = {
	title: "Features/Personas/Pages/Index",
	component: PersonasIndex,
	decorators: [withRouter],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof PersonasIndex>

export default meta
type Story = StoryObj<typeof meta>

// Mock personas data with all fields the component expects
const mockPersonas = [
	{
		id: "1",
		account_id: "acc-1",
		project_id: "proj-1",
		name: "Technical Decision Maker",
		description: "Senior engineering leaders who evaluate and approve technical solutions",
		kind: "buyer",
		goals: ["Evaluate technical solutions", "Ensure scalability", "Minimize technical debt"],
		pains: ["Complex integration requirements", "Lack of documentation", "Vendor lock-in concerns"],
		tags: ["technical", "decision-maker", "enterprise"],
		color_hex: "#3b82f6",
		created_at: "2025-01-01",
		updated_at: "2025-01-01",
		people_personas: [{ count: 12 }],
	},
	{
		id: "2",
		account_id: "acc-1",
		project_id: "proj-1",
		name: "Business Stakeholder",
		description: "Product managers and business analysts focused on ROI and user outcomes",
		kind: "influencer",
		goals: ["Demonstrate ROI", "Improve user satisfaction", "Drive adoption"],
		pains: ["Difficulty measuring impact", "Stakeholder alignment", "Budget constraints"],
		tags: ["business", "product", "roi"],
		color_hex: "#10b981",
		created_at: "2025-01-05",
		updated_at: "2025-01-05",
		people_personas: [{ count: 8 }],
	},
	{
		id: "3",
		account_id: "acc-1",
		project_id: "proj-1",
		name: "End User",
		description: "Daily users of the platform seeking efficiency and ease of use",
		kind: "user",
		goals: ["Complete tasks efficiently", "Easy to learn", "Reliable performance"],
		pains: ["Steep learning curve", "Slow workflows", "Frequent errors"],
		tags: ["end-user", "daily-user", "productivity"],
		color_hex: "#f59e0b",
		created_at: "2025-01-10",
		updated_at: "2025-01-10",
		people_personas: [{ count: 24 }],
	},
]

export const Default: Story = {
	parameters: {
		loaderData: {
			personas: mockPersonas,
		},
	},
}

export const Empty: Story = {
	parameters: {
		loaderData: {
			personas: [],
		},
	},
}

export const SinglePersona: Story = {
	parameters: {
		loaderData: {
			personas: [mockPersonas[0]],
		},
	},
}

export const ManyPersonas: Story = {
	parameters: {
		loaderData: {
			personas: [
				...mockPersonas,
				{
					id: "4",
					account_id: "acc-1",
					project_id: "proj-1",
					name: "Security Officer",
					description: "Security and compliance professionals ensuring data protection",
					created_at: "2025-01-15",
					updated_at: "2025-01-15",
					people_personas: [{ count: 5 }],
				},
				{
					id: "5",
					account_id: "acc-1",
					project_id: "proj-1",
					name: "Executive Sponsor",
					description: "C-level executives who champion initiatives and allocate budgets",
					created_at: "2025-01-20",
					updated_at: "2025-01-20",
					people_personas: [{ count: 3 }],
				},
			],
		},
	},
}
