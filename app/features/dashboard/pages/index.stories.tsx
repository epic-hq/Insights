import { withRouter } from ".storybook/with-router";
import type { Meta, StoryObj } from "@storybook/react-vite";
import DashboardIndex from "./index";

const meta = {
	title: "Features/Dashboard/Pages/Index",
	component: DashboardIndex,
	decorators: [withRouter],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof DashboardIndex>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock project data
const mockProject = {
	id: "proj-1",
	account_id: "acc-1",
	name: "Customer Research 2025",
	description: "Understanding our enterprise customer needs",
	created_at: "2025-01-01",
};

// Mock project sections
const mockProjectSections = [
	{
		id: "sec-1",
		project_id: "proj-1",
		kind: "goal",
		content: "Identify key pain points in the onboarding process",
		created_at: "2025-01-01",
	},
	{
		id: "sec-2",
		project_id: "proj-1",
		kind: "research_goal",
		content: "Conduct 20 customer interviews by end of Q1",
		created_at: "2025-01-01",
	},
];

// Mock personas
const mockPersonas = [
	{
		id: "1",
		name: "Technical Decision Maker",
		description: "Senior engineering leaders",
	},
	{
		id: "2",
		name: "Business Stakeholder",
		description: "Product managers and analysts",
	},
];

export const Default: Story = {
	parameters: {
		loaderData: {
			project: mockProject,
			projectSections: mockProjectSections,
			kpis: [
				{ label: "Interviews", value: "15", href: "/interviews", icon: "interviews" },
				{ label: "Insights", value: "42", href: "/insights", icon: "insights" },
				{ label: "Opportunities", value: "8", href: "/opportunities", icon: "opportunities" },
			],
			personas: mockPersonas,
			interviews: [
				{ id: "1", date: "2025-01-10", participant: "John Doe", status: "transcribed" },
				{ id: "2", date: "2025-01-09", participant: "Jane Smith", status: "ready" },
				{ id: "3", date: "2025-01-08", participant: "Bob Johnson", status: "processing" },
			],
			opportunities: [],
			themeTree: [],
			insights: [],
			tags: [
				{ name: "Integration Pain", frequency: 12 },
				{ name: "Onboarding Issues", frequency: 8 },
				{ name: "Performance", frequency: 6 },
			],
		},
	},
};

export const EmptyProject: Story = {
	parameters: {
		loaderData: {
			project: mockProject,
			projectSections: [],
			kpis: [
				{ label: "Interviews", value: "0", href: "/interviews", icon: "interviews" },
				{ label: "Insights", value: "0", href: "/insights", icon: "insights" },
				{ label: "Opportunities", value: "0", href: "/opportunities", icon: "opportunities" },
			],
			personas: [],
			interviews: [],
			opportunities: [],
			themeTree: [],
			insights: [],
			tags: [],
		},
	},
};

export const ActiveProject: Story = {
	parameters: {
		loaderData: {
			project: mockProject,
			projectSections: mockProjectSections,
			kpis: [
				{ label: "Interviews", value: "45", href: "/interviews", icon: "interviews" },
				{ label: "Insights", value: "128", href: "/insights", icon: "insights" },
				{ label: "Opportunities", value: "23", href: "/opportunities", icon: "opportunities" },
			],
			personas: [
				...mockPersonas,
				{
					id: "3",
					name: "End User",
					description: "Daily platform users",
				},
				{
					id: "4",
					name: "Executive Sponsor",
					description: "C-level champions",
				},
			],
			interviews: [
				{ id: "1", date: "2025-01-14", participant: "Alice Chen", status: "ready" },
				{ id: "2", date: "2025-01-14", participant: "Bob Martinez", status: "transcribed" },
				{ id: "3", date: "2025-01-13", participant: "Carol Williams", status: "transcribed" },
				{ id: "4", date: "2025-01-13", participant: "David Brown", status: "ready" },
				{ id: "5", date: "2025-01-12", participant: "Emma Davis", status: "processing" },
			],
			opportunities: [],
			themeTree: [],
			insights: [],
			tags: [
				{ name: "API Integration", frequency: 24 },
				{ name: "User Onboarding", frequency: 18 },
				{ name: "Performance Issues", frequency: 15 },
				{ name: "Mobile Experience", frequency: 12 },
				{ name: "Data Security", frequency: 9 },
				{ name: "Collaboration Tools", frequency: 7 },
				{ name: "Reporting Features", frequency: 5 },
				{ name: "Pricing Concerns", frequency: 4 },
			],
		},
	},
};
