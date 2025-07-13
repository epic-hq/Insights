import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import type { InsightCardProps } from "~/components/insights/InsightCard"
import InsightCard from "~/components/insights/InsightCard"
import InsightCardGrid from "~/components/insights/InsightCardGrid"

export const meta: MetaFunction = ({ params }) => {
	const personaName = params.personaId?.replace(/-/g, " ")
	return [
		{ title: `${personaName ? personaName.charAt(0).toUpperCase() + personaName.slice(1) : "Persona"} | Insights` },
		{ name: "description", content: `Insights related to ${personaName || "this persona"}` },
	]
}

// Mock data for demonstration purposes
export function loader({ params }: { params: { personaId: string } }) {
	const personaId = params.personaId
	const personaName = personaId.replace(/-/g, " ")

	const personaDetails = {
		students: {
			name: "Students",
			color: "#4f46e5",
			percentage: 45,
			count: 19,
			demographics: "18-24 years old, undergraduate and graduate students",
			goals: "Complete coursework efficiently, collaborate with peers, track progress",
			painPoints: "Complex navigation, inconsistent notifications, difficulty finding resources",
			quotes: [
				"I need to be able to quickly find my assignments and due dates.",
				"Group collaboration features are essential for my project work.",
			],
		},
		teachers: {
			name: "Teachers",
			color: "#10b981",
			percentage: 35,
			count: 15,
			demographics: "30-55 years old, varying technical proficiency",
			goals: "Create and grade assignments, communicate with students, track class progress",
			painPoints: "Time-consuming grading process, limited customization options",
			quotes: [
				"I spend too much time setting up assignments in the system.",
				"I need better analytics to understand how my students are performing.",
			],
		},
		admins: {
			name: "Admins",
			color: "#f59e0b",
			percentage: 20,
			count: 8,
			demographics: "35-60 years old, education administration professionals",
			goals: "Manage user accounts, generate reports, ensure system compliance",
			painPoints: "Limited reporting capabilities, complex user management",
			quotes: ["Generating custom reports is too complicated.", "User management should be more streamlined."],
		},
		parents: {
			name: "Parents",
			color: "#ef4444",
			percentage: 15,
			count: 6,
			demographics: "35-50 years old, parents of K-12 students",
			goals: "Monitor child's progress, communicate with teachers, stay informed",
			painPoints: "Difficulty accessing information, inconsistent communication",
			quotes: [
				"I want to easily see my child's upcoming assignments and grades.",
				"I need a simple way to message teachers when I have questions.",
			],
		},
		"it-staff": {
			name: "IT Staff",
			color: "#8b5cf6",
			percentage: 10,
			count: 4,
			demographics: "25-45 years old, technical support professionals",
			goals: "Maintain system, troubleshoot issues, support users",
			painPoints: "Limited admin tools, complex deployment process",
			quotes: ["The admin interface needs more powerful tools.", "Deployment and updates should be more streamlined."],
		},
	}

	// Get the current persona details or use default values
	const currentPersona = personaDetails[personaId as keyof typeof personaDetails] || {
		name: personaName.charAt(0).toUpperCase() + personaName.slice(1),
		color: "#6b7280",
		percentage: 0,
		count: 0,
		demographics: "No demographic information available",
		goals: "No goals information available",
		painPoints: "No pain points information available",
		quotes: [],
	}

	// Mock insights related to this persona
	const insights: InsightCardProps[] = [
		{
			id: "ins-001",
			title: `${currentPersona.name} struggle with navigation`,
			description: "Multiple participants expressed confusion about how to navigate the interface.",
			sentiment: "negative",
			impact: "high",
			confidence: 85,
			tags: [currentPersona.name.toLowerCase(), "usability", "navigation"],
			source: {
				type: "interview",
				id: "int-001",
				participant: "Alex Johnson",
				date: "2025-07-10",
			},
			evidence: "I couldn't figure out where to find the settings for this feature.",
		},
		{
			id: "ins-002",
			title: `${currentPersona.name} need better notifications`,
			description: "Participants mentioned issues with the notification system.",
			sentiment: "neutral",
			impact: "medium",
			confidence: 75,
			tags: [currentPersona.name.toLowerCase(), "notifications", "improvements"],
			source: {
				type: "interview",
				id: "int-002",
				participant: "Maria Garcia",
				date: "2025-07-08",
			},
			evidence: "I often miss important updates because notifications are inconsistent.",
		},
		{
			id: "ins-003",
			title: `${currentPersona.name} appreciate recent UI changes`,
			description: "Some participants appreciated the recent updates to the interface.",
			sentiment: "positive",
			impact: "medium",
			confidence: 80,
			tags: [currentPersona.name.toLowerCase(), "feedback", "ui"],
			source: {
				type: "interview",
				id: "int-003",
				participant: "Sam Taylor",
				date: "2025-07-05",
			},
			evidence: "The new layout makes much more sense to me now.",
		},
	]

	return {
		persona: currentPersona,
		insights,
	}
}

export default function PersonaDetail() {
	const { persona, insights } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link to="/personas" className="text-blue-600 hover:text-blue-800">
							Personas
						</Link>
						<span className="text-gray-500">/</span>
						<h1 className="font-bold text-2xl">{persona.name}</h1>
					</div>
				</div>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<div className="mb-4 flex items-center gap-3">
					<div className="h-6 w-6 rounded-full" style={{ backgroundColor: persona.color }} />
					<h2 className="font-semibold text-xl">{persona.name} Profile</h2>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<h3 className="mb-2 font-medium">Demographics</h3>
						<p className="text-gray-600 dark:text-gray-400">{persona.demographics}</p>

						<h3 className="mt-4 mb-2 font-medium">Goals</h3>
						<p className="text-gray-600 dark:text-gray-400">{persona.goals}</p>

						<h3 className="mt-4 mb-2 font-medium">Pain Points</h3>
						<p className="text-gray-600 dark:text-gray-400">{persona.painPoints}</p>
					</div>

					<div>
						<h3 className="mb-2 font-medium">Representative Quotes</h3>
						{persona.quotes.length > 0 ? (
							<div className="space-y-3">
								{persona.quotes.map((quote) => (
									<div
										key={quote}
										className="rounded-lg border-l-4 bg-gray-50 p-3 dark:bg-gray-800"
										style={{ borderColor: persona.color }}
									>
										<p className="text-gray-600 italic dark:text-gray-400">"{quote}"</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-600 dark:text-gray-400">No quotes available</p>
						)}

						<div className="mt-4">
							<h3 className="mb-2 font-medium">Distribution</h3>
							<p className="text-gray-600 dark:text-gray-400">
								{persona.percentage}% of participants ({persona.count} interviews)
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="mb-6">
				<h2 className="mb-4 font-semibold text-xl">Related Insights</h2>
				<InsightCardGrid>
					{insights.map((insight) => (
						<InsightCard key={insight.id} {...insight} />
					))}
				</InsightCardGrid>
			</div>
		</div>
	)
}
