import { type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import PersonaCard from "~/components/dashboard/PersonaCard"

export const meta: MetaFunction = () => {
	return [
		{ title: "Personas | Insights" },
		{ name: "description", content: "User personas based on research insights" },
	]
}

// Mock data for demonstration purposes
export function loader() {
	return {
		personas: [
			{ name: "Students", percentage: 45, count: 19, color: "#4f46e5", href: "/personas/students" },
			{ name: "Teachers", percentage: 35, count: 15, color: "#10b981", href: "/personas/teachers" },
			{ name: "Admins", percentage: 20, count: 8, color: "#f59e0b", href: "/personas/admins" },
			{ name: "Parents", percentage: 15, count: 6, color: "#ef4444", href: "/personas/parents" },
			{ name: "IT Staff", percentage: 10, count: 4, color: "#8b5cf6", href: "/personas/it-staff" },
		],
		personaDetails: {
			students: {
				demographics: "18-24 years old, undergraduate and graduate students",
				goals: "Complete coursework efficiently, collaborate with peers, track progress",
				painPoints: "Complex navigation, inconsistent notifications, difficulty finding resources",
				quotes: [
					"I need to be able to quickly find my assignments and due dates.",
					"Group collaboration features are essential for my project work.",
				],
			},
			teachers: {
				demographics: "30-55 years old, varying technical proficiency",
				goals: "Create and grade assignments, communicate with students, track class progress",
				painPoints: "Time-consuming grading process, limited customization options",
				quotes: [
					"I spend too much time setting up assignments in the system.",
					"I need better analytics to understand how my students are performing.",
				],
			},
			admins: {
				demographics: "35-60 years old, education administration professionals",
				goals: "Manage user accounts, generate reports, ensure system compliance",
				painPoints: "Limited reporting capabilities, complex user management",
				quotes: ["Generating custom reports is too complicated.", "User management should be more streamlined."],
			},
		},
	}
}

export default function Personas() {
	const { personas } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Personas</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Persona Distribution</h2>
				<div className="flex flex-wrap gap-4">
					{personas.map((persona) => (
						<div key={persona.name} className="flex items-center gap-2">
							<div className="h-4 w-4 rounded-full" style={{ backgroundColor: persona.color }} />
							<span>
								{persona.name}: {persona.percentage}%
							</span>
						</div>
					))}
				</div>
				<div className="mt-4 flex h-8 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					{personas.map((persona) => (
						<div
							key={persona.name}
							className="h-full"
							style={{
								backgroundColor: persona.color,
								width: `${persona.percentage}%`,
							}}
						/>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{personas.map((persona) => (
					<Link key={persona.name} to={persona.href || `/personas/${persona.name.toLowerCase()}`} className="block">
						<div className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900">
							<PersonaCard {...persona} />
							<div className="mt-4 border-gray-200 border-t pt-4 dark:border-gray-700">
								<p className="text-gray-500 text-sm dark:text-gray-400">
									Click to view detailed insights about this persona
								</p>
							</div>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}
