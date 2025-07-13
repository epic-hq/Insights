import type { Meta, StoryObj } from "@storybook/react"
import InsightAccordion from "./insights/InsightAccordion"
import type { InsightCardProps } from "./insights/InsightCard"
import InterviewMetadata from "./interviews/InterviewMetadata"
import ObservationsNotes from "./ObservationsNotes"
import OpenQuestionsNextSteps from "./OpenQuestionsNextSteps"
import ParticipantSnapshot from "./ParticipantSnapshot"
import StudyContextCard from "./StudyContextCard"
import HighImpactThemesList from "./themes/HighImpactThemesList"

const meta: Meta = {
	title: "Interview Record/FullRecord",
}
export default meta

type Story = StoryObj

const sampleInsights: InsightCardProps[] = [
	{
		tag: "#dialogue_learning",
		category: "Assessment",
		journeyStage: "Learning → Assessing",
		impact: 4,
		novelty: 3,
		jtbD: "When I finish gathering information, I want to prove I actually understand it so I can satisfy teachers and internal confidence.",
		underlyingMotivation: "Mastery, recognition",
		pain: "Tools stop at organise & repeat, leaving teachers fearful of AI-enabled shortcuts and students without a way to demonstrate depth.",
		desiredOutcome: "Structured support for debates, oral defenses, or dialogue-based tasks built into the product.",
		evidence:
			"Probably the most sophisticated way… would be to participate in a debate where you had to defend the knowledge you organised.",
		opportunityIdeas: [
			"Add a 'Debate prep' mode that pairs learners with AI or peers to challenge assertions.",
			"Auto-generate opposing viewpoints and question lists from the knowledge base.",
		],
		confidence: "High",
		relatedTags: ["peer_teaching", "teacher_enablement"],
		contradictions: "None noted; Jed repeatedly reinforces dialogue as end-goal.",
	},
]

export const Default: Story = {
	render: () => (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			<StudyContextCard
				researchGoal="Understand how students use AI tools to learn dialogues"
				studyCode="DLG_2025_Q3"
				recruitmentChannel="University email list"
				scriptVersion="v2.1"
			/>
			<InterviewMetadata
				interviewId="INT-001"
				date="2025-07-01"
				interviewer="Jane D."
				participant="Pseudonym P01"
				segment="Returning adult STEM student"
				duration={42}
				transcriptLink="https://example.com/int-001.pdf"
			/>
			<ParticipantSnapshot
				narrative={`Alex is a fourth-year CS student balancing part-time work and studies. They rely heavily on recorded lectures and AI summarizers to review material quickly. Top frustrations: information overload and lack of interactive checks for understanding. Aspirations: graduate with honours and land a ML engineering role. Stand-out quote: "AI tools are great at giving answers, but not at showing I truly get it."`}
			/>
			<HighImpactThemesList
				themes={[
					{
						tag: "#dialogue_learning",
						text: "Students need debate-style checks to prove understanding.",
						impact: 4,
						novelty: 3,
					},
					{
						tag: "#peer_teaching",
						text: "Learners retain more when they explain topics to peers.",
						impact: 3,
						novelty: 4,
					},
				]}
			/>
			<InsightAccordion insights={sampleInsights} className="max-w-full" />
			<OpenQuestionsNextSteps
				items={[
					"Validate whether debate mode improves retention by 20%",
					"Prototype AI adversary for dialogue assessment",
					"Interview teachers about rubric needs for oral defenses",
				]}
			/>
			<ObservationsNotes
				notes={
					"Participant was animated when discussing peer feedback, leaning forward and gesturing. Background noise minimal; interview conducted over Zoom."
				}
			/>
		</div>
	),
}
