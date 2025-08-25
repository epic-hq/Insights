/** biome-ignore-all lint/correctness/noUnusedImports: <explanation> */

import consola from "consola"
import {
	ArrowLeft,
	Bell,
	Bot,
	FolderOpen,
	Lightbulb,
	MessageSquare,
	Plus,
	Search,
	Settings,
	Sparkles,
	Users,
	X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useRouteLoaderData } from "react-router"
import { useNavigate, useParams } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import { Logo, LogoBrand } from "~/components/branding"
import type { TreeNode } from "~/components/charts/TreeMap"
import { BottomActionBar } from "~/features/dashboard/components/BottomActionBar"
import { CopilotSidebar } from "~/features/dashboard/components/CopilotSidebar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
// Hooks for current project routing
import { useCurrentProject } from "~/contexts/current-project-context"
import ProjectStatusScreen from "~/features/onboarding/components/ProjectStatusScreen"
import { getPeople } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { getProjects } from "~/features/projects/db"
import AddInterview from "~/features/upload/components/AddInterview"
// Add Interview
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
// --- DB types ---------------------------------------------------------------
import type { Insight, InsightView, Interview, OpportunityView, Person, Persona, Project } from "~/types"
import { getProjectStatusData } from "~/utils/project-status.server"
import { createProjectRoutes } from "~/utils/routes.server"
import { AgentStatusDisplay } from "~/components/agent/AgentStatusDisplay"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// TODO: use db calls instead unless exception
	// Fetch project
	const { data: project } = await supabase
		.from("projects")
		.select("*")
		.eq("account_id", accountId)
		.eq("id", projectId)
		.single()

	if (!project) {
		throw new Response("Project not found", { status: 404 })
	}

	// Fetch KPIs - count of interviews, insights, and opportunities
	const { count: interviewCount } = await supabase
		.from("interviews")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	const { count: insightCount } = await supabase
		.from("insights")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	const { count: opportunityCount } = await supabase
		.from("opportunities")
		.select("id", { count: "exact", head: true })
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	// Create route helpers for server-side use
	const routes = createProjectRoutes(accountId, projectId)

	// Fetch personas with counts
	const { data, error } = await getPersonas({ supabase, accountId, projectId })

	// Transform personas into the expected format
	const personas = (data || []).map((p, index) => {
		// Generate a color based on index if not available in database
		const colors = ["#2563EB", "#14B8A6", "#E11D48", "#8B5CF6", "#F59E0B"]
		const colorValue = p.color_hex || colors[index % colors.length]

		return {
			...p,
			percentage: p.percentage || 33, // Use DB value or default
			count: 10, // This would ideally be calculated based on actual data
			color: colorValue,
			href: routes.personas.detail(p.id),
			slices: [
				{ name: "Feature Usage", value: 60, color: colorValue },
				{ name: "Feedback", value: 40, color: lightenColor(colorValue, 40) },
			],
		}
	})

	// Fetch recent interviews
	type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]
	const { data: interviewRows } = await supabase
		.from("interviews")
		.select("id,created_at,participant_pseudonym,status,updated_at")
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
		.limit(5)

	// Transform interviews into the expected format
	const interviews = (interviewRows || []).map(
		(interview: Pick<InterviewRow, "id" | "created_at" | "participant_pseudonym" | "status" | "updated_at">) => ({
			id: interview.id,
			date: new Date(interview.created_at).toISOString().split("T")[0],
			participant: interview.participant_pseudonym || "Unknown",
			status: interview.status as "transcribed" | "processing" | "ready",
		})
	)

	// Fetch opportunities
	type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"]
	const { data: opportunityRows } = await supabase.from("opportunities").select("*").eq("account_id", accountId)

	// Transform opportunities into the expected format
	const opportunities: OpportunityView[] = (opportunityRows || []).map((o: OpportunityRow) => ({
		...o,
		owner: o.owner_id || "",
		status: o.kanban_status || "Explore",
		impact: 3, // Default value
		effort: 2, // Default value
		description: "",
	}))

	// Fetch insights for the theme tree
	const { data: insightRows } = await supabase.from("insights").select("*").eq("account_id", accountId).limit(10)

	// Transform insights into the expected format
	const insights: InsightView[] = (insightRows || []).map((insight) => ({
		id: insight.id,
		name: insight.name || "",
		tag: "", // No tag field in DB schema
		category: insight.category || "",
		journeyStage: insight.journey_stage || "",
		impact: insight.impact,
		novelty: insight.novelty,
		jtbd: insight.jtbd,
		underlyingMotivation: "", // No motivation field in DB schema
		pain: insight.pain,
		desiredOutcome: insight.desired_outcome,
		description: "", // No description field in DB schema
		evidence: "", // No evidence field in DB schema
		opportunityIdeas: insight.opportunity_ideas,
		confidence: insight.confidence,
		createdAt: insight.created_at,
		// relatedTags: removed - now using insight_tags junction table
		contradictions: insight.contradictions,
	}))

	// Debug: Check if insight_tags table has any data at all
	const { data: allInsightTags, error: allTagsError } = await supabase.from("insight_tags").select("*").limit(5)

	consola.debug("All insight_tags sample:", { allInsightTags, allTagsError })

	// Debug: Check insight_tags for this account
	const { data: accountInsightTags, error: accountTagsError } = await supabase
		.from("insight_tags")
		.select("*")
		.eq("account_id", accountId)
		.limit(5)

	consola.debug("Account insight_tags:", { accountInsightTags, accountTagsError, accountId })

	// Debug: Check insight_tags for this project
	const { data: projectInsightTags, error: projectTagsError } = await supabase
		.from("insight_tags")
		.select("*")
		.eq("project_id", projectId)
		.limit(5)

	consola.debug("Project insight_tags:", { projectInsightTags, projectTagsError, projectId })

	// Fetch tags with frequency counts from insight_tags junction table
	const { data: tagFrequencyData, error: tagFrequencyError } = await supabase
		.from("insight_tags")
		.select("tag_id, tags(tag)")
		.eq("account_id", accountId)
		.eq("project_id", projectId)

	// consola.log("Tag frequency query:", { tagFrequencyData, tagFrequencyError, accountId, projectId })

	// Process tag frequency data into the format expected by TagDisplay
	type TagFrequency = { name: string; frequency: number }
	const tagFrequencyMap = new Map<string, number>()

	if (tagFrequencyData) {
		tagFrequencyData.forEach((record: { tag_id: string; tags: { tag: string } | null }) => {
			const tagName = record.tags?.tag
			if (tagName) {
				tagFrequencyMap.set(tagName, (tagFrequencyMap.get(tagName) || 0) + 1)
			}
		})
	}

	// Convert to array format expected by TagDisplay component
	const tags: TagFrequency[] = Array.from(tagFrequencyMap.entries())
		.map(([name, frequency]) => ({ name, frequency }))
		.sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending

	// Debug logging
	// consola.log("Dashboard Debug:", {
	// 	insightRowsCount: insightRows?.length || 0,
	// 	tagFrequencyDataCount: tagFrequencyData?.length || 0,
	// 	tagsCount: tags.length,
	// 	personaRowsCount: data?.length || 0,
	// })

	// Group insights by tags for tree map (keeping existing logic)
	const tagMap = new Map<string, TreeNode>()

	// Process tag data for tree map visualization
	tags.forEach((tag) => {
		tagMap.set(tag.name, {
			name: tag.name,
			value: tag.frequency,
			children: [],
			fill: "",
		})
	})

	// Sort and apply colors to top N tags
	const baseColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"]
	const topN = 5

	const themeTree: TreeNode[] = Array.from(tagMap.values())
		.sort((a, b) => b.value - a.value)
		.slice(0, topN)
		.map((node, i) => {
			const color = baseColors[i % baseColors.length]
			node.fill = color
			node.children?.forEach((child, j) => {
				child.fill = lightenColor(color, 20 + j * 10)
			})
			return node
		})

	const { data: people } = await getPeople({ supabase, accountId, projectId })
	const projects = await getProjects({ supabase, accountId })

	// Fetch project status data
	const projectStatusData = await getProjectStatusData(projectId, supabase, accountId)

	return {
		personas,
		interviews,
		opportunities,
		themeTree,
		insights,
		projects,
		project,
		people,
		tags, // Add tags to the return object for TagDisplay
		projectStatusData,
		accountId,
		projectId,
	}
}

// Helper function to lighten a color by a percentage
function lightenColor(hex: string, percent: number): string {
	// Remove the # if it exists
	const cleanHex = hex.replace("#", "")

	// Convert to RGB
	const r = Number.parseInt(cleanHex.substring(0, 2), 16)
	const g = Number.parseInt(cleanHex.substring(2, 4), 16)
	const b = Number.parseInt(cleanHex.substring(4, 6), 16)

	// Lighten
	const lightenAmount = percent / 100
	const lightenR = Math.round(r + (255 - r) * lightenAmount)
	const lightenG = Math.round(g + (255 - g) * lightenAmount)
	const lightenB = Math.round(b + (255 - b) * lightenAmount)

	// Convert back to hex
	const rHex = lightenR.toString(16).padStart(2, "0")
	const gHex = lightenG.toString(16).padStart(2, "0")
	const bHex = lightenB.toString(16).padStart(2, "0")

	return `#${rHex}${gHex}${bHex}`
}

export const meta: MetaFunction = () => [{ title: "Insights • Metro" }]

const mainSections = [
	{
		id: "personas",
		title: "Personas",
		subtitle: "User groups & their needs",
		icon: Users,
		color: "bg-blue-600",
		size: "large" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/personas1.png",
	},
	{
		id: "insights",
		title: "Insights",
		subtitle: "Friction points & problems",
		icon: Lightbulb,
		color: "bg-green-600",
		size: "large" as const,
		image:
			"https://images.unsplash.com/photo-1626808642875-0aa545482dfb?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
	},
	{
		id: "encounters",
		title: "Sources",
		subtitle: "Research conversations",
		icon: MessageSquare,
		color: "bg-red-600",
		size: "medium" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/people-talking-bubbles.png",
	},
	{
		id: "projects",
		title: "Projects",
		subtitle: "Active initiatives",
		icon: FolderOpen,
		color: "bg-purple-600",
		size: "medium" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/project-management-dashboard.png",
	},
	{ id: "people", title: "People", subtitle: "Participants", icon: Users, color: "bg-gray-600", size: "full" as const },
]

export default function MetroIndex() {
	const params = useParams()
	const { accountId, projectId } = params
	const {
		personas = [],
		insights = [],
		interviews = [],
		projects = [],
		people = [],
		projectStatusData,
		project,
	} = useLoaderData<typeof loader>()
	const [showExpandedSection, _setShowExpandedSection] = useState<boolean>(false)

	const navigate = useNavigate()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const sectionData: Record<string, any[]> = useMemo(
		() => ({
			personas,
			insights,
			encounters: interviews, // UI name → DB table
			projects,
			people,
		}),
		[personas, insights, interviews, projects, people]
	)

	const [expandedSection, setExpandedSection] = useState<string | null>(null)
	const [fullScreenContent, _setFullScreenContent] = useState<any>(null)
	const [showSearch, setShowSearch] = useState(false)
	const [showChat, setShowChat] = useState(false)
	const [selectedItem, setSelectedItem] = useState<any>(null)

	const getMainTileClasses = (size: "large" | "medium" | "full", color: string) => {
		const sizeClasses: Record<typeof size, string> = {
			large: "col-span-2 row-span-3 h-72",
			medium: "col-span-1 row-span-3 h-72",
			full: "col-span-2 row-span-3 h-72",
		} as const
		return `${sizeClasses[size]} ${color} text-white rounded-none relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-xl`
	}

	const toggleSection = (sectionId: string) => setExpandedSection(expandedSection === sectionId ? null : sectionId)
	const getSectionColor = (sectionId: string) => mainSections.find((s) => s.id === sectionId)?.color || "bg-gray-800"
	const toggleChat = () => {
		setShowChat(!showChat)
	}

	const handleToggleChat = () => {
		setShowChat(!showChat)
	}

	return (
		<div className="relative flex min-h-screen bg-background text-foreground">
			{/* Main Content */}
			<div className={`flex-1 transition-all duration-300 ${showChat ? "mr-80" : ""}`}>
				{/* Project Status */}
				<ProjectStatusScreen
					projectName={project?.name || ""}
					icp={project?.icp || ""}
					projectId={projectId}
					statusData={projectStatusData}
					onAddMore={() => {
						// TODO find right funciton for new flow
					}}
					onViewResults={() => {}}
				/>

				<AgentStatusDisplay />

				<div className="p-3 pb-24">
					{/* Expanded List */}
					{showExpandedSection && expandedSection && !fullScreenContent && (
						<div className="space-y-3">
							<div className={`-mx-4 mb-4 flex items-center justify-between p-3 ${getSectionColor(expandedSection)}`}>
								<div>
									<h2 className="font-bold text-white text-xl capitalize">{expandedSection}</h2>
									<p className="text-gray-200 text-sm">{sectionData[expandedSection]?.length ?? 0} items</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="text-white hover:bg-black hover:bg-opacity-20"
									onClick={() => setExpandedSection(null)}
									title="Back to main view"
								>
									<ArrowLeft className="h-5 w-5" />
								</Button>
							</div>

							{/* Desktop: Side-by-side layout, Mobile: Stacked */}
							<div className="flex flex-col gap-4 lg:flex-row">
								{/* Items List */}
								<div className="flex-1">
									<div className="grid grid-cols-1 gap-2">
										{(Array.isArray(sectionData[expandedSection]) ? sectionData[expandedSection] : []).map(
											(item: any) => (
												<div
													key={item.id}
													className="flex cursor-pointer items-start gap-3 border border-border bg-card p-4 transition-colors duration-200 hover:bg-muted/60"
													onClick={() => setSelectedItem({ ...item, section: expandedSection })}
												>
													{item.image_url && (
														<div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
															{/* eslint-disable-next-line jsx-a11y/alt-text */}
															<img src={item.image_url} className="h-full w-full object-cover" />
														</div>
													)}
													<div className="min-w-0 flex-1">
														<h3 className="mb-1 line-clamp-2 font-medium text-sm text-foreground">
															{item.title || item.name || item.display_name || item.participant_name}
														</h3>
														<p className="line-clamp-2 text-muted-foreground text-xs">
															{item.description || item.evidence || item.status}
														</p>
														{Array.isArray(item.tags) && item.tags.length > 0 && (
															<div className="mt-2 flex flex-wrap gap-1">
																{(item.tags as string[]).slice(0, 3).map((tag) => (
																	<span
																		key={`${item.id}-tag-${tag}`}
																		className="rounded bg-muted px-2 py-1 text-foreground text-xs"
																	>
																		{tag}
																	</span>
																))}
															</div>
														)}
													</div>
												</div>
											)
										)}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Main tiles */}
					{showExpandedSection && !expandedSection && !fullScreenContent && (
						<div className="mb-4 grid grid-cols-2 gap-1">
							{mainSections.slice(0, 4).map((section) => (
								<div
									key={section.id}
									className={getMainTileClasses(section.size, section.color)}
									onClick={() => toggleSection(section.id)}
								>
									<div className="relative flex h-full p-4">
										{section.image && (
											<div className="absolute top-0 right-0 h-full w-1/2 overflow-hidden">
												<img
													src={section.image || "/placeholder.svg"}
													alt=""
													className="h-full w-full object-cover opacity-30"
												/>
											</div>
										)}
										<div className="relative z-10 flex flex-1 flex-col justify-between">
											<div>
												<section.icon className="mb-4 h-10 w-10 opacity-90" />
												<h2 className="mb-2 font-bold text-3xl">{section.title}</h2>
												<p className="hidden text-base leading-tight opacity-80 lg:block" title={section.subtitle}>
													{section.subtitle}
												</p>
												<div className="mt-3 rounded-lg bg-black/20 p-2 backdrop-blur-sm">
													<div className="flex items-start justify-between gap-2">
														<div className="flex flex-1 items-start gap-2">
															<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
															<p className="flex-1 text-white/90 text-xs leading-relaxed">Tap to explore</p>
														</div>
													</div>
												</div>
											</div>
											<div className="flex justify-end">
												<div className="font-medium text-sm opacity-75">
													{sectionData[section.id]?.length ?? 0} items
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
							<div className="col-span-2">
								{mainSections.slice(4).map((section) => (
									<div
										key={section.id}
										className={getMainTileClasses(section.size, section.color)}
										onClick={() => toggleSection(section.id)}
										title={section.subtitle}
									>
										<div className="relative flex h-full p-4">
											{section.image && (
												<div className="absolute top-0 right-0 h-full w-1/2 overflow-hidden">
													<img
														src={section.image || "/placeholder.svg"}
														alt=""
														className="h-full w-full object-cover opacity-30"
													/>
												</div>
											)}
											<div className="relative z-10 flex flex-1 flex-col justify-between">
												<div>
													<section.icon className="mb-4 h-10 w-10 opacity-90" />
													<h2 className="mb-2 font-bold text-3xl">{section.title}</h2>
													<p className="hidden text-base leading-tight opacity-80 lg:block">{section.subtitle}</p>
													<div className="mt-3 rounded-lg bg-black/20 p-2 backdrop-blur-sm">
														<div className="flex items-start justify-between gap-2">
															<div className="flex flex-1 items-start gap-2">
																<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
																<p className="flex-1 text-white/90 text-xs leading-relaxed">Tap to explore</p>
															</div>
														</div>
													</div>
												</div>
												<div className="flex justify-end">
													<div className="font-medium text-sm opacity-75">
														{sectionData[section.id]?.length ?? 0} items
													</div>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Bottom action bar */}
				<BottomActionBar onToggleChat={handleToggleChat} />
			</div>

			{/* CopilotSidebar - Right side overlay */}
			{showChat && (
				<div className="fixed bottom-16 right-0 top-0 z-30 w-80 bg-card text-foreground shadow-2xl border-l border-border">
					<CopilotSidebar
						expandedSection={expandedSection}
						onClose={() => setShowChat(false)}
						className="h-full"
						projectData={{
							projectName: project?.name,
							personas,
							insights,
							interviews,
							opportunities: [],
							people,
							projectStatusData,
						}}
					/>
				</div>
			)}

			{/* Selected item drawer */}
			{selectedItem && (
				<div className="fixed inset-0 z-40 bg-background">
					<div className={`h-16 ${getSectionColor(selectedItem.section)} flex items-center justify-between px-4`}>
						<div className="flex items-center gap-3">
							<h2 className="font-bold text-lg text-white">
								{selectedItem.section?.[0]?.toUpperCase() + selectedItem.section?.slice(1)}:{" "}
								{selectedItem.title || selectedItem.name}
							</h2>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSelectedItem(null)}
							className="text-white hover:bg-white hover:bg-opacity-20"
						>
							<X className="h-6 w-6" />
						</Button>
					</div>

					<div className="h-[calc(100vh-8rem)] overflow-y-auto p-4 pb-20">
						{/* Desktop: Side-by-side layout, Mobile: Stacked */}
						<div className="flex flex-col gap-6 lg:flex-row">
							{/* Item Details */}
							<div className="flex-1 space-y-6">
								{selectedItem.image_url && (
									<div className="h-48 w-full overflow-hidden rounded-lg bg-muted">
										{/* eslint-disable-next-line jsx-a11y/alt-text */}
										<img src={selectedItem.image_url} className="h-full w-full object-cover" />
									</div>
								)}
								<div className="space-y-4">
									<p className="text-muted-foreground leading-relaxed">{selectedItem.description || selectedItem.evidence}</p>
									{Array.isArray(selectedItem.tags) && (
										<div className="flex flex-wrap gap-2">
											{selectedItem.tags.map((tag: string) => (
												<Badge key={`selected-tag-${tag}`} variant="secondary" className="bg-muted text-foreground">
													{tag}
												</Badge>
											))}
										</div>
									)}
									<div className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
										<div className="mb-3 flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Bot className="h-4 w-4 text-white" />
												<h3 className="font-medium text-white">AI Assistant</h3>
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setShowChat(false)}
												className="h-6 w-6 text-white hover:bg-white hover:bg-opacity-20"
											>
												<X className="h-3 w-3" />
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
