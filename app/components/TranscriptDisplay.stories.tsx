import type { Meta, StoryObj } from "@storybook/react"
import type { TranscriptEntry } from "./TranscriptDisplay"
import TranscriptDisplay from "./TranscriptDisplay"

const meta: Meta<typeof TranscriptDisplay> = {
	title: "Components/TranscriptDisplay",
	component: TranscriptDisplay,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof TranscriptDisplay>

const sampleTranscript: TranscriptEntry[] = [
	{
		speaker: "A",
		timeRange: "0:01 - 1:34",
		content:
			"AI to like, augment technology and use it to. To show that someone's learned something rather than like, they're all afraid that people are going to use AI to avoid learning or avoid work. Um, so if, if AI can be part of the process, you know, as it is here with. With, um, you know, collecting knowledge and organizing knowledge, um, and then the next step would be like, what are you going to do with that knowledge you've collected and organized? And um. I think you're the one that talked about like, the. Whoa. Oral report. You know, that's. That's a really big one. Um, and just, uh, you know, if you went one step further, what if. What if you could actively exercise that information in form of like a debate? And that's what I really came to is like the, the probably most complicated or sophisticated way to use your. The knowledge that you organize through a tool like this would be to, you know, participate in a debate where you had to defend the knowledge that you organized. Because if you're just organizing it and repeating it, you know, that's is organizing. It's basically automated. Um, repeating it is memorizing it. But then. And it's kind of like your hierarchy too, you know, if, if you can debate it with someone else who maybe organized it and takes a different stance, um, now you have to really understand it to do that.",
	},
	{
		speaker: "B",
		timeRange: "1:34 - 1:36",
		content: "Exactly. Yeah.",
	},
	{
		speaker: "A",
		timeRange: "1:36 - 1:57",
		content:
			"Yeah. So, um, you know, I, I think what, what teachers would like to see is how, um, you could. You could, you know, design with that in. In mind. You know, how. How can this tool be.",
	},
	{
		speaker: "B",
		timeRange: "1:58 - 1:58",
		content: "Um.",
	},
	{
		speaker: "A",
		timeRange: "1:58 - 2:38",
		content:
			"So right now the tool lets them do what they want, right? You can make a report with it, you can get ready for your oral report, you can make, you know, your notes, stuff like that. But how can it help the teacher by saying, like, by preparing them for a debate, you know, um, or preparing them to, uh, to defend this information, um, or to exercise it. Um, and I don't know if that becomes, you know, um, a description, a feature or a perspective, you know, like, like, um, a way of viewing the information.",
	},
	{
		speaker: "B",
		timeRange: "2:38 - 2:39",
		content: "Yeah, um.",
	},
]

const shortTranscript: TranscriptEntry[] = [
	{
		speaker: "A",
		timeRange: "0:01 - 0:15",
		content: "Thanks for joining us today. Can you tell us about your experience with AI learning tools?",
	},
	{
		speaker: "B",
		timeRange: "0:15 - 0:45",
		content:
			"Sure! I've been using various AI tools for about six months now, primarily for research and note-taking. The biggest challenge I face is ensuring I actually understand the material rather than just organizing it.",
	},
	{
		speaker: "A",
		timeRange: "0:45 - 1:00",
		content: "That's interesting. Can you elaborate on what you mean by 'actually understanding' versus organizing?",
	},
]

export const Default: Story = {
	args: {
		transcript: sampleTranscript,
	},
}

export const WithCustomSpeakerNames: Story = {
	args: {
		transcript: sampleTranscript,
		speakerNames: {
			speakerA: "Joe",
			speakerB: "Rick/Interviewer",
		},
	},
}

export const ShortTranscript: Story = {
	args: {
		transcript: shortTranscript,
		speakerNames: {
			speakerA: "Interviewer",
			speakerB: "Participant",
		},
	},
}

export const SingleSpeaker: Story = {
	args: {
		transcript: [
			{
				speaker: "A",
				timeRange: "0:01 - 2:30",
				content:
					"This is a monologue example where only one speaker is talking for an extended period. This could be useful for presentations, lectures, or when one participant dominates the conversation. The component should handle this gracefully and maintain good visual hierarchy.",
			},
		],
		speakerNames: {
			speakerA: "Presenter",
			speakerB: "Audience",
		},
	},
}

export const LongContent: Story = {
	args: {
		transcript: [
			{
				speaker: "A",
				timeRange: "0:01 - 3:45",
				content:
					"This is an example of a very long transcript entry that might occur in real interviews. Sometimes participants go into great detail about their experiences, thoughts, and processes. The component should handle this gracefully with proper text wrapping and spacing. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
			},
			{
				speaker: "B",
				timeRange: "3:45 - 3:50",
				content: "I see, that's very comprehensive.",
			},
		],
		speakerNames: {
			speakerA: "Expert",
			speakerB: "Interviewer",
		},
	},
}
