import type { Meta, StoryObj } from "@storybook/react"
import InterviewDetailStorybook from "./detail.storybook"

const meta = {
	title: "Features/Interviews/Pages/Detail",
	component: InterviewDetailStorybook,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof InterviewDetailStorybook>

export default meta
type Story = StoryObj<typeof meta>

// Mock interview data with full structure
const mockInterview = {
	id: "interview-1",
	account_id: "acc-1",
	project_id: "proj-1",
	title: "Customer Discovery Interview - Enterprise SaaS",
	description: "Initial discovery call with VP of Engineering at TechCorp",
	status: "transcribed" as const,
	media_url: "https://example.com/audio.mp3",
	media_type: "audio/mpeg" as const,
	duration_seconds: 1847, // ~30 minutes
	created_at: "2025-01-10T14:30:00Z",
	updated_at: "2025-01-10T16:45:00Z",
	scheduled_at: "2025-01-10T14:00:00Z",
	participant_pseudonym: "Alex Johnson",
	questions: [
		"What are your biggest challenges with current developer tools?",
		"How does your team currently handle code reviews?",
		"What would make your workflow more efficient?",
	],
	conversation_analysis: {
		overview:
			"Productive conversation with Alex Johnson, VP of Engineering at TechCorp. Discussion focused on their current development workflow pain points, particularly around code review processes and team collaboration. Alex expressed strong interest in automation tools and better integration with existing systems.",
		key_takeaways: [
			{
				priority: "high" as const,
				summary: "Code review process takes 2-3 days on average, causing significant deployment delays",
				evidence_snippets: [
					"We're averaging 2-3 days for code reviews right now",
					"The delay is really hurting our deployment velocity",
				],
			},
			{
				priority: "high" as const,
				summary: "Team struggles with context switching between multiple tools (GitHub, Jira, Slack)",
				evidence_snippets: [
					"My team is constantly switching between GitHub, Jira, and Slack",
					"We lose so much context in the handoffs",
				],
			},
			{
				priority: "medium" as const,
				summary: "Security concerns around third-party integrations",
				evidence_snippets: ["We need to be careful about what tools we integrate with", "SOC 2 compliance is critical for us"],
			},
		],
		open_questions: [
			"What is TechCorp's budget cycle for new tooling?",
			"Who else on the team would need to be involved in the evaluation?",
			"What are their current integration requirements?",
		],
		recommended_next_steps: [
			{
				focus_area: "Technical Demo",
				action: "Schedule a demo of our GitHub integration features with Alex's senior engineers",
				rationale: "They specifically mentioned code review automation as a top priority",
			},
			{
				focus_area: "Security Review",
				action: "Share SOC 2 compliance documentation and security whitepaper",
				rationale: "Security and compliance are critical decision factors",
			},
			{
				focus_area: "Stakeholder Mapping",
				action: "Ask Alex to introduce us to the Director of Platform Engineering",
				rationale: "Alex mentioned this person owns tool selection decisions",
			},
		],
		custom_lenses: {},
	},
	participants: [
		{
			id: 1,
			role: "Interviewee",
			transcript_key: "Speaker 1",
			display_name: "Alex Johnson",
			people: {
				id: "person-1",
				name: "Alex Johnson",
				segment: "Enterprise",
				project_id: "proj-1",
				people_personas: [
					{
						personas: {
							id: "persona-1",
							name: "Technical Decision Maker",
						},
					},
				],
			},
		},
		{
			id: 2,
			role: "Interviewer",
			transcript_key: "Speaker 2",
			display_name: "Sarah Chen",
			people: {
				id: "person-2",
				name: "Sarah Chen",
				segment: null,
				project_id: "proj-1",
			},
		},
	],
	primaryParticipant: {
		id: "person-1",
		name: "Alex Johnson",
		segment: "Enterprise",
		project_id: "proj-1",
	},
	hasTranscript: true,
	hasFormattedTranscript: true,
}

const mockPeopleOptions = [
	{ id: "person-1", name: "Alex Johnson", segment: "Enterprise" },
	{ id: "person-2", name: "Sarah Chen", segment: null },
	{ id: "person-3", name: "Michael Brown", segment: "Mid-Market" },
	{ id: "person-4", name: "Jennifer Liu", segment: "SMB" },
]

const mockInsights = [
	{
		id: "insight-1",
		statement: "Code review delays are blocking deployment velocity",
		evidence_count: 3,
		theme_names: ["Process Pain Points", "Team Velocity"],
		created_at: "2025-01-10T17:00:00Z",
	},
	{
		id: "insight-2",
		statement: "Security and compliance are critical decision factors",
		evidence_count: 2,
		theme_names: ["Security", "Enterprise Requirements"],
		created_at: "2025-01-10T17:05:00Z",
	},
]

const mockSalesLens = {
	bant: {
		budget: {
			score: 7,
			summary: "Has budget allocated for developer tools this quarter",
			evidence: ["Mentioned they have budget for Q1", "Currently spending on similar tools"],
		},
		authority: {
			score: 8,
			summary: "VP of Engineering with decision-making power",
			evidence: ["Makes tool selection decisions", "Can approve budget up to $50k"],
		},
		need: {
			score: 9,
			summary: "Strong pain around code review delays",
			evidence: ["2-3 day code review delays", "Hurting deployment velocity"],
		},
		timeline: {
			score: 6,
			summary: "Looking to implement new tools this quarter",
			evidence: ["Want to move fast", "Q1 is the evaluation period"],
		},
	},
	overallScore: 75,
	buyingStage: "Evaluation" as const,
	nextActions: [
		"Schedule technical demo with engineering team",
		"Share security documentation",
		"Introduce to Director of Platform Engineering",
	],
}

const mockAnalysisJobs = [
	{
		id: "job-1",
		status: "done" as const,
		status_detail: "Analysis completed successfully",
		progress: 100,
		trigger_run_id: null,
		created_at: "2025-01-10T16:00:00Z",
		updated_at: "2025-01-10T16:45:00Z",
	},
]

export const Default: Story = {
	args: {
		data: {
			interview: mockInterview,
			peopleOptions: mockPeopleOptions,
			insights: mockInsights,
			salesLens: mockSalesLens,
			analysisJobs: mockAnalysisJobs,
			conversationAnalysis: mockInterview.conversation_analysis,
		},
	},
}

export const NoAnalysis: Story = {
	args: {
		data: {
			interview: {
				...mockInterview,
				conversation_analysis: null,
			},
			peopleOptions: mockPeopleOptions,
			insights: [],
			salesLens: null,
			analysisJobs: [
				{
					id: "job-1",
					status: "pending" as const,
					status_detail: "Waiting for analysis to start",
					progress: 0,
					trigger_run_id: null,
					created_at: "2025-01-10T16:00:00Z",
					updated_at: "2025-01-10T16:00:00Z",
				},
			],
			conversationAnalysis: null,
		},
	},
}

export const Processing: Story = {
	args: {
		data: {
			interview: {
				...mockInterview,
				status: "processing" as const,
				conversation_analysis: null,
			},
			peopleOptions: mockPeopleOptions,
			insights: [],
			salesLens: null,
			analysisJobs: [
				{
					id: "job-1",
					status: "in_progress" as const,
					status_detail: "Analyzing transcript...",
					progress: 45,
					trigger_run_id: "run-123",
					created_at: "2025-01-10T16:00:00Z",
					updated_at: "2025-01-10T16:30:00Z",
				},
			],
			conversationAnalysis: null,
		},
	},
}

export const NoTranscript: Story = {
	args: {
		data: {
			interview: {
				...mockInterview,
				status: "ready" as const,
				hasTranscript: false,
				hasFormattedTranscript: false,
				conversation_analysis: null,
			},
			peopleOptions: mockPeopleOptions,
			insights: [],
			salesLens: null,
			analysisJobs: [],
			conversationAnalysis: null,
		},
	},
}

export const MinimalInterview: Story = {
	args: {
		data: {
			interview: {
				...mockInterview,
				title: "Quick Phone Call",
				description: null,
				questions: [],
				participants: [],
				primaryParticipant: null,
				conversation_analysis: null,
			},
			peopleOptions: mockPeopleOptions,
			insights: [],
			salesLens: null,
			analysisJobs: [],
			conversationAnalysis: null,
		},
	},
}
