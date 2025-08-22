import consola from "consola"
import { motion } from "framer-motion"
import { Palette, Percent, Users } from "lucide-react"
import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData, useParams } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import InsightCardV2 from "~/features/insights/components/InsightCardV2"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Database, Insight, Interview } from "~/types"

export const meta: MetaFunction = ({ params }) => {
	return [
		{ title: `Persona ${params.personaId || ""} | Insights` },
		{ name: "description", content: "Insights related to this persona" },
	]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const _accountId = params.accountId
	const _projectId = params.projectId
	const personaId = params.personaId

	if (!personaId) {
		throw new Response("Persona ID not found", { status: 404 })
	}

	// Use Supabase types directly like interviews pattern
	type PersonaRowExtended = Database["public"]["Tables"]["personas"]["Row"] & {
		demographics?: any
		summarized_insights?: any[]
	}
	// type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	// type Insight = Database["public"]["Tables"]["insights"]["Row"]

	// Fetch the current persona directly by ID with account filtering for RLS
	const { data: currentPersonaData, error: personaError } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.single()

	if (personaError) {
		throw new Response(`Error fetching persona: ${personaError.message}`, { status: 500 })
	}

	if (!currentPersonaData) {
		throw new Response("Persona not found", { status: 404 })
	}
	let demographics
	let summarized_insights
	try {
		if ((currentPersonaData as any)?.demographics) {
			demographics =
				typeof (currentPersonaData as any).demographics === "string"
					? JSON.parse((currentPersonaData as any).demographics)
					: (currentPersonaData as any).demographics
		}
	} catch (e) {
		consola.error("Failed to parse demographics field", e)
		demographics = undefined
	}
	try {
		if ((currentPersonaData as any)?.summarized_insights) {
			summarized_insights =
				typeof (currentPersonaData as any).summarized_insights === "string"
					? JSON.parse((currentPersonaData as any).summarized_insights)
					: (currentPersonaData as any).summarized_insights
		}
	} catch (e) {
		consola.error("Failed to parse summarized_insights field", e)
		summarized_insights = undefined
	}
	const persona: PersonaRowExtended = {
		...(currentPersonaData as any),
		demographics,
		summarized_insights,
	}

	// Fetch people linked via junction table
	const { data: peopleData, error: peopleError } = await supabase
		.from("people_personas")
		.select("people ( * )")
		.eq("persona_id", personaId)
	// .eq("account_id", accountId)

	if (peopleError) {
		throw new Response(`Error fetching people: ${peopleError.message}`, { status: 500 })
	}

	const people: Array<{ id: string; name: string | null; segment: string | null; description: string | null }> =
		peopleData?.map((pp: any) => pp.people) ?? []

	// Fetch interviews where people with this persona participated
	const peopleIds = people.map((p) => p.id)
	if (peopleIds.length === 0) {
		return {
			persona,
			interviews: [],
			insights: [],
			relatedPersonas: [],
			people: [],
		}
	}
	// Fetch interviews where people with this persona participated
	// Fetch interview_people rows for these people
	const { data: interviewPeopleData, error: interviewPeopleError } = await supabase
		.from("interview_people")
		.select("interview_id")
		.in("person_id", peopleIds)

	if (interviewPeopleError) {
		consola.error("Error fetching interview_people:", interviewPeopleError)
	}

	const interviewIds = interviewPeopleData?.map((ip: any) => ip.interview_id).filter(Boolean) || []

	let interviews: Interview[] = []
	if (interviewIds.length > 0) {
		const { data: interviewsData, error: interviewsError } = await supabase
			.from("interviews")
			.select("id,created_at,participant_pseudonym,status,updated_at")
			.in("id", interviewIds)

		if (interviewsError) {
			consola.error("Error fetching interviews:", interviewsError)
		}
		interviews = interviewsData || []
	}

	// Fetch insights related to this persona via junction table
	const { data: insightsData, error: insightsError } = await supabase
		.from("persona_insights")
		.select(`
			insights (
				id,
				name,
				category,
				pain,
				journey_stage,
				emotional_response,
				insight_tags (
					tags (
						tag
					)
				)
			)
		`)
		.eq("persona_id", personaId)

	if (insightsError) {
		consola.error("Error fetching insights:", insightsError)
	}

	const insights: Insight[] = insightsData?.map((pi: any) => pi.insights).filter(Boolean) || []

	// Get related personas (same account, different persona)
	// const { data: relatedPersonas } = await supabase
	// 	.from("personas")
	// 	.select("id, name, color_hex, updated_at")
	// 	.eq("account_id", accountId)
	// 	.neq("id", personaId)
	// 	.limit(5)

	return {
		persona,
		interviews,
		insights,
		relatedPersonas: [],
		people,
	}
}

export default function PersonaDetailRoute() {
	const { persona, interviews, insights, people } = useLoaderData<typeof loader>()
	const params = useParams()
	
	// Extract accountId and projectId directly from URL params
	const accountId = params.accountId || ""
	const projectId = params.projectId || ""
	
	// Single source of truth for all route generation
	const routes = useProjectRoutesFromIds(accountId, projectId)

	if (!persona) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<h1 className="mb-2 font-bold text-2xl text-gray-900">Persona Not Found</h1>
					<p className="text-gray-600">The persona you're looking for doesn't exist or has been removed.</p>
				</div>
			</div>
		)
	}

	const themeColor = persona.color_hex || "#6b7280"
	const name = persona.name || "Untitled Persona"
	const description = persona.description || "No description available"

	// Get initials for avatar
	const initials =
		name
			.split(" ")
			.map((word: string) => word[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"

	return (
		<div className="relative min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Clean Metro-Style Header */}
			<div className="border-gray-200 dark:border-gray-800 border-b bg-white dark:bg-gray-950 px-6 py-12">
				<div className="mx-auto max-w-6xl">
					<motion.div
						className="mb-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
					>
						{/* Avatar Section - Separated */}
						<div className="flex items-center justify-center md:justify-start">
							<motion.div
								className="relative"
								whileHover={{ scale: 1.02 }}
								transition={{ duration: 0.2 }}
							>
								<Avatar className="h-16 w-16 border-2 border-white shadow-lg dark:border-gray-800" style={{ borderColor: `${themeColor}30` }}>
									<AvatarFallback
										className="font-bold text-white text-xl"
										style={{ backgroundColor: themeColor }}
									>
										{initials}
									</AvatarFallback>
								</Avatar>
							</motion.div>
						</div>

						{/* Title Section - Clean Typography */}
						<div className="flex-1 text-center md:text-left">
							<motion.h1
								className="font-light text-4xl md:text-5xl text-gray-900 dark:text-white tracking-tight leading-tight mb-4"
								style={{ color: themeColor }}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2, duration: 0.5 }}
							>
								{name}
							</motion.h1>

							{/* Theme Color Accent Line */}
							<motion.div
								className="h-1 w-24 rounded-full mb-6 mx-auto md:mx-0"
								style={{ backgroundColor: themeColor }}
								initial={{ width: 0 }}
								animate={{ width: "6rem" }}
								transition={{ delay: 0.4, duration: 0.6 }}
							/>

							<motion.p
								className="text-gray-600 dark:text-gray-400 text-xl leading-relaxed max-w-2xl"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3, duration: 0.5 }}
							>
								{description}
							</motion.p>
						</div>

						{/* Action Buttons */}
						<motion.div
							className="flex gap-3 justify-center md:justify-start"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.5, duration: 0.3 }}
						>
							<Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
								<Link to={routes.personas.edit(persona.id)}>Edit Persona</Link>
							</Button>
							<Button
								variant="default"
								style={{ backgroundColor: themeColor }}
								className="text-white hover:opacity-90"
								onClick={async () => {
									const formData = new FormData()
									formData.append("personaId", persona.id)
									try {
										const res = await fetch("/api/generate-persona-insights", {
											method: "POST",
											body: formData,
										})
										if (res.ok) {
											window.location.reload()
										} else {
											alert("Failed to generate insights")
										}
									} catch (_e) {
										alert("Error generating insights")
									}
								}}
							>
								Generate Insights
							</Button>
						</motion.div>
					</motion.div>

					{/* KPI Stats Section */}
					<motion.div
						className="grid grid-cols-3 gap-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.6, duration: 0.5 }}
					>
						<div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
							<div
								className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
								style={{ backgroundColor: `${themeColor}15` }}
							>
								<Users className="h-6 w-6" style={{ color: themeColor }} />
							</div>
							<p className="text-gray-500 text-sm dark:text-gray-400">Interviews</p>
							<p className="font-light text-2xl" style={{ color: themeColor }}>
								{interviews.length}
							</p>
						</div>
						<div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
							<div
								className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
								style={{ backgroundColor: `${themeColor}15` }}
							>
								<Palette className="h-6 w-6" style={{ color: themeColor }} />
							</div>
							<p className="text-gray-500 text-sm dark:text-gray-400">Insights</p>
							<p className="font-light text-2xl" style={{ color: themeColor }}>
								{insights.length}
							</p>
						</div>
						<div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
							<div
								className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
								style={{ backgroundColor: `${themeColor}15` }}
							>
								<Percent className="h-6 w-6" style={{ color: themeColor }} />
							</div>
							<p className="text-gray-500 text-sm dark:text-gray-400">Avg. per Interview</p>
							<p className="font-light text-2xl" style={{ color: themeColor }}>
								{interviews.length > 0 ? (insights.length / interviews.length).toFixed(1) : "0"}
							</p>
						</div>
					</motion.div>
				</div>
			</div>

			{/* Main Content */}
			<div className="mx-auto max-w-6xl px-6 py-12">
				{/* Persona Details Card */}
				<Card className="mb-8">
					<CardHeader>
						<h2 className="font-semibold text-xl">Details</h2>
						<p className="text-muted-foreground text-xs">Only showing available fields</p>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
							{[
								{ label: "Age", value: persona.age },
								{ label: "Gender", value: persona.gender },
								{ label: "Location", value: persona.location },
								{ label: "Education", value: persona.education },
								{ label: "Occupation", value: persona.occupation },
								{ label: "Income", value: persona.income },
								{ label: "Languages", value: persona.languages },
								{ label: "Segment", value: persona.segment },
								{ label: "Role", value: persona.role },
							{
								label: "Motivations",
								value:
									Array.isArray(persona.motivations) && persona.motivations.length > 0
										? persona.motivations.join(", ")
										: null,
							},
							{
								label: "Values",
								value: Array.isArray(persona.values) && persona.values.length > 0 ? persona.values.join(", ") : null,
							},
							{
								label: "Frustrations",
								value:
									Array.isArray(persona.frustrations) && persona.frustrations.length > 0
										? persona.frustrations.join(", ")
										: null,
							},
							{ label: "Preferences", value: persona.preferences },
							{ label: "Learning Style", value: persona.learning_style },
							{ label: "Tech Comfort Level", value: persona.tech_comfort_level },
							{ label: "Frequency of Purchase", value: persona.frequency_of_purchase },
							{ label: "Frequency of Use", value: persona.frequency_of_use },
							{
								label: "Key Tasks",
								value:
									Array.isArray(persona.key_tasks) && persona.key_tasks.length > 0
										? persona.key_tasks.join(", ")
										: null,
							},
							{
								label: "Tools Used",
								value:
									Array.isArray(persona.tools_used) && persona.tools_used.length > 0
										? persona.tools_used.join(", ")
										: null,
							},
							{ label: "Primary Goal", value: persona.primary_goal },
							{
								label: "Secondary Goals",
								value:
									Array.isArray(persona.secondary_goals) && persona.secondary_goals.length > 0
										? persona.secondary_goals.join(", ")
										: null,
							},
							{
								label: "Sources",
								value: Array.isArray(persona.sources) && persona.sources.length > 0 ? persona.sources.join(", ") : null,
							},
							{
								label: "Quotes",
								value:
									Array.isArray(persona.quotes) && persona.quotes.length > 0
										? persona.quotes.map((q: string) => `"${q}"`).join(" ")
										: null,
							},
							{
								label: "Percentage",
								value:
									typeof persona.percentage === "number" && !Number.isNaN(persona.percentage)
										? `${persona.percentage}%`
										: null,
							},
						]
							.filter((item) => item.value && String(item.value).trim() !== "")
							.map((item, _idx) => (
								<div key={item.label} className="flex">
									<span className="w-40 font-medium text-foreground">{item.label}:</span>
									<span className="text-muted-foreground">{item.value}</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>


				{/* People Section */}
				{people && people.length > 0 && (
					<Card className="mb-8">
						<CardHeader>
							<h3 className="font-semibold text-lg">People ({people.length})</h3>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{people.map((person) => (
									<div key={person.id} className="rounded-lg border p-4">
										<h4 className="font-medium">{person.name}</h4>
										{person.segment && <p className="text-muted-foreground text-sm">{person.segment}</p>}
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Insights Section */}
				{insights && insights.length > 0 && (
					<div className="space-y-6">
						<h3 className="font-semibold text-xl">Related Insights ({insights.length})</h3>
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{insights.map((insight) => (
								<InsightCardV2 key={insight.id} insight={insight} />
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
