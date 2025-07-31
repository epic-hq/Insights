import consola from "consola"
import { motion } from "framer-motion"
import { FileText, Palette, Percent, Users } from "lucide-react"
import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import InsightCardGrid from "~/features/insights/components/InsightCardGrid"
import InsightCardV2 from "~/features/insights/components/InsightCardV2"
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
	const accountId = ctx.account_id
	const supabase = ctx.supabase

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
		.eq("account_id", accountId)
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
	consola.log("personaDetail: ", persona)
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
	consola.log("people: ", peopleIds)
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
			.select("*")
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
				*
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

	consola.log("personaDetail: ", persona)
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
		<div className="mx-auto max-w-7xl px-4 py-6">
			{/* Enhanced Persona Header */}
			<motion.div
				className="relative mb-8 overflow-hidden rounded-xl border border-border bg-background shadow-lg"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				{/* Theme color accent bar */}
				<div className="h-2 w-full" style={{ backgroundColor: themeColor }} />

				{/* Gradient overlay */}
				<div
					className="pointer-events-none absolute inset-0 opacity-20"
					style={{
						background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
					}}
				/>

				<Card className="border-0 bg-transparent shadow-none">
					<CardHeader className="pb-4">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-6">
								{/* Bigger Avatar */}
								<motion.div className="relative" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
									<Avatar className="h-36 w-36 border-4" style={{ borderColor: themeColor }}>
										{persona.image_url ? (
											<img
												src={persona.image_url}
												alt={persona.name}
												className="h-full w-full object-cover"
												onError={(e) => {
													// Fallback to initials if image fails to load
													e.currentTarget.style.display = "none"
													const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
													if (fallback) {
														fallback.style.display = "flex"
													}
												}}
											/>
										) : null}
										<AvatarFallback className="font-bold text-2xl text-white" style={{ backgroundColor: themeColor }}>
											{initials}
										</AvatarFallback>
									</Avatar>
									{/* <motion.div
										className="-bottom-2 -right-2 absolute flex h-8 w-8 items-center justify-center rounded-full shadow-lg"
										style={{ backgroundColor: themeColor }}
										whileHover={{ rotate: 180 }}
										transition={{ duration: 0.3 }}
									>
										<Palette className="h-4 w-4 text-white" />
									</motion.div> */}
								</motion.div>

								{/* Title and Description */}
								<div className="flex-1">
									<motion.h1
										className="mb-2 font-bold text-4xl text-foreground leading-tight"
										style={{ color: themeColor }}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.2, duration: 0.5 }}
									>
										{name}
									</motion.h1>
									<motion.p
										className="text-lg text-muted-foreground leading-relaxed"
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.3, duration: 0.5 }}
									>
										{description}
									</motion.p>
								</div>
							</div>

							{/* Action Buttons */}
							<motion.div
								className="flex gap-2"
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.4, duration: 0.3 }}
							>
								<Button asChild variant="outline" size="sm">
									<Link to={`/personas/${persona.id}/edit`}>Edit</Link>
								</Button>
								<Button
									variant="default"
									size="sm"
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
						</div>

						{/* Metadata */}
						{/* <div className="flex items-center gap-6 text-muted-foreground text-sm">
							<div className="flex items-center gap-2">
								<Users className="h-4 w-4" />
								<span className="font-medium">Created:</span> {new Date(persona.created_at).toLocaleDateString()}
							</div>
							<div>
								<span className="font-medium">Updated:</span> {new Date(persona.updated_at).toLocaleDateString()}
							</div>
						</div> */}
					</CardHeader>
					<CardContent>
						{/* KPIs */}
						<motion.div
							className="mb-6 grid grid-cols-3 gap-4"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.6, duration: 0.5 }}
						>
							<Badge variant="outline" className="flex items-center gap-2 p-2 transition-all hover:bg-accent">
								<div
									className="flex h-8 w-8 items-center justify-center rounded-full"
									style={{ backgroundColor: `${themeColor}15` }}
								>
									<Users className="h-4 w-4" style={{ color: themeColor }} />
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Interviews</p>
									<p className="font-bold text-lg" style={{ color: themeColor }}>
										{interviews.length}
									</p>
								</div>
							</Badge>
							<Badge variant="outline" className="flex items-center gap-2 p-2 transition-all hover:bg-accent">
								<div
									className="flex h-8 w-8 items-center justify-center rounded-full"
									style={{ backgroundColor: `${themeColor}15` }}
								>
									<Palette className="h-4 w-4" style={{ color: themeColor }} />
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Insights</p>
									<p className="font-bold text-lg" style={{ color: themeColor }}>
										{insights.length}
									</p>
								</div>
							</Badge>
							<Badge variant="outline" className="flex items-center gap-2 p-2 transition-all hover:bg-accent">
								<div
									className="flex h-8 w-8 items-center justify-center rounded-full"
									style={{ backgroundColor: `${themeColor}15` }}
								>
									<Percent className="h-4 w-4" style={{ color: themeColor }} />
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Avg. per Interview</p>
									<p className="font-bold text-lg" style={{ color: themeColor }}>
										{interviews.length > 0 ? (insights.length / interviews.length).toFixed(1) : "0"}
									</p>
								</div>
							</Badge>
						</motion.div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Persona Details Card */}
			<Card className="mb-8">
				<CardHeader>
					<h2 className="font-semibold text-xl">Details</h2>
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
										? persona.quotes.map((q) => `“${q}”`).join(" ")
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

			{/* Persona Insights Section */}
			{(persona.demographics || persona.summarized_insights) && (
				<div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
					{persona.demographics && (
						<div className="mb-4">
							<h2 className="mb-2 font-semibold text-xl">Common Demographics</h2>
							<ul className="ml-6 list-disc text-muted-foreground">
								{persona.demographics.age_range && (
									<li>
										<span className="font-medium text-foreground">Age Range:</span> {persona.demographics.age_range}
									</li>
								)}
								{persona.demographics.gender_distribution && (
									<li>
										<span className="font-medium text-foreground">Gender Distribution:</span>{" "}
										{Object.entries(persona.demographics.gender_distribution)
											.map(([k, v]) => `${k}: ${v}%`)
											.join(", ")}
									</li>
								)}
								{persona.demographics.locations && persona.demographics.locations.length > 0 && (
									<li>
										<span className="font-medium text-foreground">Locations:</span>{" "}
										{persona.demographics.locations.join(", ")}
									</li>
								)}
								{persona.demographics.education_levels && persona.demographics.education_levels.length > 0 && (
									<li>
										<span className="font-medium text-foreground">Education Levels:</span>{" "}
										{persona.demographics.education_levels.join(", ")}
									</li>
								)}
								{persona.demographics.occupations && persona.demographics.occupations.length > 0 && (
									<li>
										<span className="font-medium text-foreground">Occupations:</span>{" "}
										{persona.demographics.occupations.join(", ")}
									</li>
								)}
								{persona.demographics.other_demographics && (
									<li>
										<span className="font-medium text-foreground">Other:</span>{" "}
										{persona.demographics.other_demographics}
									</li>
								)}
							</ul>
						</div>
					)}
					{persona.summarized_insights &&
						Array.isArray(persona.summarized_insights) &&
						persona.summarized_insights.length > 0 && (
							<div>
								<h2 className="mb-2 font-semibold text-xl">Summarized Insights</h2>
								<ul className="space-y-2">
									{persona.summarized_insights.map((insight: any, idx: number) => (
										<li key={insight.id ?? idx} className="rounded border bg-gray-50 p-3">
											<div className="font-medium text-foreground">{insight.name}</div>
											{insight.details && <div className="text-muted-foreground text-sm">{insight.details}</div>}
										</li>
									))}
								</ul>
							</div>
						)}
				</div>
			)}

			{/* Two-column layout for People and Interviews */}
			<div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* People with this Persona Section */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.7, duration: 0.5 }}
				>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div
									className="flex h-10 w-10 items-center justify-center rounded-lg"
									style={{ backgroundColor: `${themeColor}15` }}
								>
									<Users className="h-5 w-5" style={{ color: themeColor }} />
								</div>
								<h2 className="font-semibold text-xl">People with this Persona</h2>
								<Badge variant="secondary" className="ml-auto">
									{people.length} total
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							{people.length > 0 ? (
								<div className="space-y-2">
									{people.slice(0, 5).map((person) => (
										<motion.div
											key={person.id}
											className="flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent hover:shadow-sm"
											whileHover={{ scale: 1.01 }}
										>
											<Link to={`/people/${person.id}`} className="font-medium hover:text-primary">
												{person.name || "Unnamed"}
											</Link>
											{person.segment && <Badge variant="outline">{person.segment}</Badge>}
										</motion.div>
									))}
									{people.length > 5 && (
										<div className="mt-3 text-center">
											<Button asChild variant="ghost" size="sm">
												<Link to="/people" className="text-muted-foreground text-sm hover:text-primary">
													View all {people.length} people
												</Link>
											</Button>
										</div>
									)}
								</div>
							) : (
								<div className="py-8 text-center">
									<Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
									<p className="text-muted-foreground">No people associated with this persona</p>
								</div>
							)}
						</CardContent>
					</Card>
				</motion.div>

				{/* Interviews Section */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.8, duration: 0.5 }}
				>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div
									className="flex h-10 w-10 items-center justify-center rounded-lg"
									style={{ backgroundColor: `${themeColor}15` }}
								>
									<FileText className="h-5 w-5" style={{ color: themeColor }} />
								</div>
								<h2 className="font-semibold text-xl">Interviews</h2>
								<Badge variant="secondary" className="ml-auto">
									{interviews.length} total
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							{interviews.length > 0 ? (
								<div className="space-y-2">
									{interviews.slice(0, 5).map((interview: any) => (
										<motion.div
											key={interview.id}
											className="group flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent hover:shadow-sm"
											whileHover={{ scale: 1.01 }}
										>
											<div className="flex-1">
												<Link to={`/interviews/${interview.id}`} className="font-medium hover:text-primary">
													{interview.title || "Untitled Interview"}
												</Link>
												{interview.interview_date && (
													<p className="text-muted-foreground text-xs">
														{new Date(interview.interview_date).toLocaleDateString()}
													</p>
												)}
											</div>
											{interview.participant_pseudonym && (
												<Badge variant="outline" style={{ borderColor: themeColor, color: themeColor }}>
													{interview.participant_pseudonym}
												</Badge>
											)}
										</motion.div>
									))}
									{interviews.length > 5 && (
										<div className="mt-3 text-center">
											<Button asChild variant="ghost" size="sm">
												<Link to="/interviews" className="text-muted-foreground text-sm hover:text-primary">
													View all {interviews.length} interviews
												</Link>
											</Button>
										</div>
									)}
								</div>
							) : (
								<div className="py-8 text-center">
									<FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
									<p className="text-muted-foreground">No interviews with this persona</p>
								</div>
							)}
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Related Insights Section */}
			{insights.length > 0 && (
				<div className="rounded-lg bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-semibold text-xl">Related Insights</h2>
						<Link to="/insights" className="text-blue-600 text-sm hover:text-blue-800">
							View all insights
						</Link>
					</div>
					<InsightCardGrid>
						{insights.slice(0, 6).map((insight: any) => (
							<InsightCardV2 key={insight.id} insight={insight} />
						))}
					</InsightCardGrid>
				</div>
			)}
		</div>
	)
}
