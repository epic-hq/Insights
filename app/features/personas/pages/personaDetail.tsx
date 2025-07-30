import consola from "consola"
import { motion } from "framer-motion"
import { Palette, Users } from "lucide-react"
import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import InsightCardGrid from "~/features/insights/components/InsightCardGrid"
import InsightCardV2 from "~/features/insights/components/InsightCardV2"
import { userContext } from "~/server/user-context"
import type { Database } from "~/types"

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
	type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]
	type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]

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

	const persona: PersonaRow = currentPersonaData

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
			interviews: [],
			insights: [],
			relatedPersonas: [],
			people: [],
		}
	}
	// Fetch interviews where people with this persona participated
	const { data: interviewsData, error: interviewsError } = await supabase
		.from("interview_people")
		.select(`
			interviews (
				*
			)
		`)
		.in("person_id", peopleIds)

	if (interviewsError) {
		consola.error("Error fetching interviews:", interviewsError)
	}

	const interviews: InterviewRow[] = interviewsData?.map((ip: any) => ip.interviews).filter(Boolean) || []

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

	const insights: InsightRow[] = insightsData?.map((pi: any) => pi.insights).filter(Boolean) || []

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
	const { persona, interviews, insights, relatedPersonas, people } = useLoaderData<typeof loader>()

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
									<motion.div
										className="-bottom-2 -right-2 absolute flex h-8 w-8 items-center justify-center rounded-full shadow-lg"
										style={{ backgroundColor: themeColor }}
										whileHover={{ rotate: 180 }}
										transition={{ duration: 0.3 }}
									>
										<Palette className="h-4 w-4 text-white" />
									</motion.div>
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
				</Card>
			</motion.div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="lg:col-span-3">
					{/* Enhanced Stats Cards */}
					<motion.div
						className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.6, duration: 0.5 }}
					>
						<Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: themeColor }}>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-muted-foreground text-sm">Interviews</p>
										<p className="font-bold text-3xl" style={{ color: themeColor }}>
											{interviews.length}
										</p>
									</div>
									<Users className="h-8 w-8 text-muted-foreground" />
								</div>
							</CardContent>
						</Card>
						<Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: themeColor }}>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-muted-foreground text-sm">Insights</p>
										<p className="font-bold text-3xl" style={{ color: themeColor }}>
											{insights.length}
										</p>
									</div>
									<Palette className="h-8 w-8 text-muted-foreground" />
								</div>
							</CardContent>
						</Card>
						<Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: themeColor }}>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-muted-foreground text-sm">Avg. per Interview</p>
										<p className="font-bold text-3xl" style={{ color: themeColor }}>
											{interviews.length > 0 ? (insights.length / interviews.length).toFixed(1) : "0"}
										</p>
									</div>
									<div
										className="flex h-8 w-8 items-center justify-center rounded-full"
										style={{ backgroundColor: `${themeColor}20` }}
									>
										<span className="font-bold text-sm" style={{ color: themeColor }}>
											%
										</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</motion.div>

					{/* Enhanced Interviews Section */}
					<motion.div
						className="mb-6"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8, duration: 0.5 }}
					>
						<Card>
							<CardHeader>
								<div className="flex items-center gap-3">
									<div
										className="flex h-10 w-10 items-center justify-center rounded-lg"
										style={{ backgroundColor: `${themeColor}20` }}
									>
										<Users className="h-5 w-5" style={{ color: themeColor }} />
									</div>
									<h2 className="font-semibold text-2xl">Interviews</h2>
									<Badge variant="secondary" className="ml-auto">
										{interviews.length} total
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								{interviews.length > 0 ? (
									<div className="space-y-3">
										{interviews.map((interview: any, index: number) => (
											<motion.div
												key={interview.id}
												className="group flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-all hover:shadow-md"
												initial={{ opacity: 0, x: -20 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ delay: 0.9 + index * 0.1, duration: 0.3 }}
												whileHover={{ scale: 1.02 }}
											>
												<div className="flex-1">
													<Link
														to={`/interviews/${interview.id}`}
														className="font-semibold text-foreground transition-colors group-hover:text-primary"
													>
														{interview.title || "Untitled Interview"}
													</Link>
													<div className="mt-1 flex items-center gap-3 text-muted-foreground text-sm">
														{interview.participant_pseudonym && (
															<Badge variant="outline" style={{ borderColor: themeColor, color: themeColor }}>
																{interview.participant_pseudonym}
															</Badge>
														)}
														{interview.interview_date && (
															<span>{new Date(interview.interview_date).toLocaleDateString()}</span>
														)}
													</div>
												</div>
												<Button asChild variant="ghost" size="sm">
													<Link to={`/interviews/${interview.id}`}>View</Link>
												</Button>
											</motion.div>
										))}
									</div>
								) : (
									<div className="py-12 text-center">
										<Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
										<p className="font-medium text-lg text-muted-foreground">No interviews found</p>
										<p className="mt-1 text-muted-foreground text-sm">
											Upload interviews with this persona segment to see them here.
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</motion.div>

					{/* Linked People Section */}
					{people.length > 0 && (
						<div className="rounded-lg bg-white p-6 shadow-sm">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="flex items-center gap-2 font-semibold text-xl">
									<Users className="h-5 w-5" />
									People with this Persona
								</h2>
							</div>
							<ul className="space-y-2">
								{people.map((person) => (
									<li key={person.id} className="flex items-center justify-between rounded border p-2">
										<Link to={`/people/${person.id}`} className="font-medium text-blue-600 hover:text-blue-800">
											{person.name || "Unnamed"}
										</Link>
										{person.segment && <Badge variant="outline">{person.segment}</Badge>}
									</li>
								))}
							</ul>
						</div>
					)}

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

				{/* Sidebar with Related Personas */}
				{/* <aside className="space-y-4">
					<div className="rounded-lg bg-white p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-lg">Related Personas</h2>
						{relatedPersonas.length > 0 ? (
							<ul className="space-y-2">
								{relatedPersonas.map((related: any) => (
									<li key={related.id} className="rounded border bg-gray-50 p-2 transition hover:bg-gray-100">
										<Link to={`/personas/${related.id}`} className="font-medium text-gray-900 text-sm">
											{related.name || "Untitled"}
										</Link>
										<div className="mt-1 flex items-center justify-between text-xs">
											<div
												className="h-3 w-3 rounded-full"
												style={{ backgroundColor: related.color_hex || "#6b7280" }}
											/>
											<span className="text-gray-500">{new Date(related.updated_at).toLocaleDateString()}</span>
										</div>
									</li>
								))}
							</ul>
						) : (
							<div className="text-gray-400 text-sm italic">No related personas found.</div>
						)}
					</div>
				</aside> */}
			</div>
		</div>
	)
}
