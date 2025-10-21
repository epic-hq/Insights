import type { Meta, StoryObj } from "@storybook/react"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import InterviewDetail from "./detail"

const meta = {
	title: "Features/Interviews/InterviewDetail",
	component: InterviewDetail,
	decorators: [withRouter],
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof InterviewDetail>

export default meta
type Story = StoryObj<typeof meta>

// Mock data for the interview
const mockInterview = {
	id: "interview-1",
	title: "User Research Interview - Product Discovery",
	date: "2024-01-15",
	duration: 3600,
	status: "completed",
	transcript: "This is a sample transcript...",
	hasTranscript: true,
	hasFormattedTranscript: true,
	participants: [
		{
			id: "participant-1",
			person_id: "person-1",
			role: "Participant",
			display_name: "Sarah Johnson",
			transcript_key: "speaker_1",
		},
	],
	primaryParticipant: {
		id: "person-1",
		name: "Sarah Johnson",
		segment: "Power User",
		image_url: null,
	},
}

const mockInsights = [
	{
		id: "insight-1",
		name: "Users struggle with onboarding",
		details: "Multiple participants mentioned difficulty understanding the initial setup process",
		category: "Pain Point",
		confidence: "high",
	},
	{
		id: "insight-2",
		name: "Feature request: Dark mode",
		details: "Users expressed interest in a dark mode option for better accessibility",
		category: "Feature Request",
		confidence: "medium",
	},
]

const mockEvidence = [
	{
		id: "evidence-1",
		interview_id: "interview-1",
		says: ["The setup process was confusing", "I had to restart twice"],
		does: ["Clicks through menus repeatedly", "Searches for help documentation"],
		thinks: ["This should be simpler", "Maybe I'm missing something"],
		feels: ["Frustrated", "Uncertain"],
		pains: ["Time wasted on setup", "Lack of clear guidance"],
		gains: ["Eventually figured it out", "Learned the system"],
		created_at: "2024-01-15T10:30:00Z",
	},
]

const mockEmpathyMap = {
	says: [
		{ text: "The setup process was confusing", evidenceId: "evidence-1" },
		{ text: "I had to restart twice", evidenceId: "evidence-1" },
	],
	does: [
		{ text: "Clicks through menus repeatedly", evidenceId: "evidence-1" },
		{ text: "Searches for help documentation", evidenceId: "evidence-1" },
	],
	thinks: [
		{ text: "This should be simpler", evidenceId: "evidence-1" },
		{ text: "Maybe I'm missing something", evidenceId: "evidence-1" },
	],
	feels: [
		{ text: "Frustrated", evidenceId: "evidence-1" },
		{ text: "Uncertain", evidenceId: "evidence-1" },
	],
	pains: [
		{ text: "Time wasted on setup", evidenceId: "evidence-1" },
		{ text: "Lack of clear guidance", evidenceId: "evidence-1" },
	],
	gains: [
		{ text: "Eventually figured it out", evidenceId: "evidence-1" },
		{ text: "Learned the system", evidenceId: "evidence-1" },
	],
}

const mockPeopleOptions = [
	{ id: "person-1", name: "Sarah Johnson", segment: "Power User" },
	{ id: "person-2", name: "Mike Chen", segment: "New User" },
	{ id: "person-3", name: "Emma Davis", segment: "Enterprise" },
]

// Default story with full interview data
export const Default: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {
					accountId: "account-1",
					projectId: "project-1",
					interviewId: "interview-1",
				},
			},
			routing: {
				path: "/a/:accountId/:projectId/interviews/:interviewId",
				loader: () => ({
					accountId: "account-1",
					projectId: "project-1",
					interview: mockInterview,
					insights: mockInsights,
					evidence: mockEvidence,
					empathyMap: mockEmpathyMap,
					peopleOptions: mockPeopleOptions,
				}),
			},
		}),
	},
}

// Story without transcript
export const NoTranscript: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {
					accountId: "account-1",
					projectId: "project-1",
					interviewId: "interview-2",
				},
			},
			routing: {
				path: "/a/:accountId/:projectId/interviews/:interviewId",
				loader: () => ({
					accountId: "account-1",
					projectId: "project-1",
					interview: {
						...mockInterview,
						id: "interview-2",
						hasTranscript: false,
						hasFormattedTranscript: false,
						transcript: null,
					},
					insights: [],
					evidence: [],
					empathyMap: {
						says: [],
						does: [],
						thinks: [],
						feels: [],
						pains: [],
						gains: [],
					},
					peopleOptions: mockPeopleOptions,
				}),
			},
		}),
	},
}

// Story with minimal data
export const MinimalData: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {
					accountId: "account-1",
					projectId: "project-1",
					interviewId: "interview-3",
				},
			},
			routing: {
				path: "/a/:accountId/:projectId/interviews/:interviewId",
				loader: () => ({
					accountId: "account-1",
					projectId: "project-1",
					interview: {
						id: "interview-3",
						title: "Quick Interview",
						date: "2024-01-20",
						status: "in_progress",
						hasTranscript: false,
						hasFormattedTranscript: false,
						participants: [],
						primaryParticipant: null,
					},
					insights: [],
					evidence: [],
					empathyMap: {
						says: [],
						does: [],
						thinks: [],
						feels: [],
						pains: [],
						gains: [],
					},
					peopleOptions: [],
				}),
			},
		}),
	},
}

// Story with recording enabled
export const WithRecording: Story = {
	args: {
		enableRecording: true,
	},
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {
					accountId: "account-1",
					projectId: "project-1",
					interviewId: "interview-1",
				},
			},
			routing: {
				path: "/a/:accountId/:projectId/interviews/:interviewId",
				loader: () => ({
					accountId: "account-1",
					projectId: "project-1",
					interview: mockInterview,
					insights: mockInsights,
					evidence: mockEvidence,
					empathyMap: mockEmpathyMap,
					peopleOptions: mockPeopleOptions,
				}),
			},
		}),
	},
}
