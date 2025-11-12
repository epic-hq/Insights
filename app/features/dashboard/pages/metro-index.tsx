/** biome-ignore-all lint/correctness/noUnusedImports: needed for component imports */

import { useChat } from "@ai-sdk/react"
import { convertMessages } from "@mastra/core/agent"
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
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
	useLoaderData,
	useNavigate,
	useRouteLoaderData,
} from "react-router"
import type { Database } from "~/../supabase/types"
import { AgentStatusDisplay } from "~/components/agent/AgentStatusDisplay"
import { Logo, LogoBrand } from "~/components/branding"
import type { TreeNode } from "~/components/charts/TreeMap"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
// Hooks for current project routing
import { useCurrentProject } from "~/contexts/current-project-context"
import { BottomActionBar } from "~/features/dashboard/components/BottomActionBar"
import { CopilotSidebar } from "~/features/dashboard/components/CopilotSidebar"
import ProjectStatusScreen from "~/features/onboarding/components/ProjectStatusScreen"
import { getPeople } from "~/features/people/db"
import { getPersonas } from "~/features/personas/db"
import { getProjects } from "~/features/projects/db"
import AddInterview from "~/features/upload/components/AddInterview"
// Add Interview
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { userContext } from "~/server/user-context"
// --- DB types ---------------------------------------------------------------
import type { Insight, InsightView, Interview, OpportunityView, Person, Persona, Project } from "~/types"
import { getProjectStatusData } from "~/utils/project-status.server"
import { createProjectRoutes } from "~/utils/routes.server"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// Note: Allow visiting dashboard without requiring setup completion

	// TODO: use db calls instead unless exception
	// Fetch project
	const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single()

	if (!project) {
		throw new Response("Project not found", { status: 404 })
	}

	// Batch KPI counts for better performance
	await Promise.all([
		supabase.from("interviews").select("id", { count: "exact", head: true }).eq("project_id", projectId),
		supabase
			.from("themes")
			.select("id", { count: "exact", head: true })

			.eq("project_id", projectId),
		supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("project_id", projectId),
	])

	// Create route helpers for server-side use
	const routes = createProjectRoutes(accountId, projectId)

	// Fetch personas with counts
	const { data } = await getPersonas({ supabase, accountId, projectId })

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
	const { data: insightRows } = await supabase.from("themes").select("*").eq("account_id", accountId).limit(10)

	// Transform insights into the expected format - InsightView extends Insight, so use the DB row directly
	const insights: InsightView[] = (insightRows || []).map((insight) => ({
		...insight, // Spread all database fields
		// Add any UI-specific aliases if needed
		title: insight.name,
		impact_score: insight.impact,
		content: insight.details,
	}))

	// Remove debug queries - they're causing performance issues

	// Fetch tags with frequency counts from insight_tags junction table
	const { data: tagFrequencyData } = await supabase
		.from("insight_tags")
		.select("tag_id, tags(tag)")
		.eq("account_id", accountId)
		.eq("project_id", projectId)

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
	const baseColors = ["var(--primary)", "var(--secondary)", "var(--accent)", "var(--muted)", "var(--card)"]
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
	const projectStatusData = await getProjectStatusData(projectId, supabase)

	let assistantMessages: UpsightMessage[] = []
	const userId = ctx.claims?.sub
	if (userId) {
		const resourceId = `projectStatusAgent-${userId}-${projectId}`
		try {
			const threads = await memory.getThreadsByResourceIdPaginated({
				resourceId,
				orderBy: "createdAt",
				sortDirection: "DESC",
				page: 0,
				perPage: 1,
			})
			const threadId = threads?.threads?.[0]?.id
			if (threadId) {
				const { messagesV2 } = await memory.query({
					threadId,
					selectBy: { last: 50 },
				})
				assistantMessages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]
			}
		} catch (error) {
			consola.warn("Failed to load project assistant history", { resourceId, error })
		}
	} else {
		consola.warn("No UserId found")
	}

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
		assistantMessages,
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

export const meta: MetaFunction = () => [{ title: "UpSight Intel" }]

const mainSections = [
	{
		id: "personas",
		title: "Personas",
		subtitle: "User groups & their needs",
		icon: Users,
		color: "bg-primary",
		size: "large" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/personas1.png",
	},
	{
		id: "insights",
		title: "Insights",
		subtitle: "Friction points & problems",
		icon: Lightbulb,
		color: "bg-secondary",
		size: "large" as const,
		image:
			"https://images.unsplash.com/photo-1626808642875-0aa545482dfb?q=80&w=774&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
	},
	{
		id: "encounters",
		title: "Sources",
		subtitle: "Research conversations",
		icon: MessageSquare,
		color: "bg-accent",
		size: "medium" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/people-talking-bubbles.png",
	},
	{
		id: "projects",
		title: "Projects",
		subtitle: "Active initiatives",
		icon: FolderOpen,
		color: "bg-muted",
		size: "medium" as const,
		image: "https://pub-1b22566a2cb84e9eb583920bfaeb9a99.r2.dev/project-management-dashboard.png",
	},
	{ id: "people", title: "People", subtitle: "Participants", icon: Users, color: "bg-card", size: "full" as const },
]

export default function MetroIndex() {
	const {
		accountId,
		projectId,
		personas = [],
		insights = [],
		interviews = [],
		projects = [],
		people = [],
		projectStatusData,
		project,
		assistantMessages = [],
	} = useLoaderData<typeof loader>()
	const [showExpandedSection, _setShowExpandedSection] = useState<boolean>(false)

	const { projectPath } = useCurrentProject()
	const _routes = useProjectRoutes(projectPath || "")

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
	const [_showSearch, _setShowSearch] = useState(false)
	const [showChat, setShowChat] = useState(false)
	const [selectedItem, setSelectedItem] = useState<any>(null)

	const getMainTileClasses = (size: "large" | "medium" | "full", color: string) => {
		const sizeClasses: Record<typeof size, string> = {
			large: "col-span-2 row-span-3 h-72",
			medium: "col-span-1 row-span-3 h-72",
			full: "col-span-2 row-span-3 h-72",
		} as const
		return `${sizeClasses[size]} ${color} text-primary-foreground rounded-none relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-xl`
	}

	const toggleSection = (sectionId: string) => setExpandedSection(expandedSection === sectionId ? null : sectionId)
	const getSectionColor = (sectionId: string) =>
		mainSections.find((s) => s.id === sectionId)?.color || "bg-muted-foreground"
	const _toggleChat = () => {
		setShowChat(!showChat)
	}

	const _handleToggleChat = () => {
		setShowChat(!showChat)
	}

	// Check if any interviews are currently uploading/processing
	const _isUploading = interviews.some((interview) =>
		["uploading", "processing", "transcribing"].includes(interview.status)
	)

	return (
		<div className="relative flex min-h-screen bg-background text-foreground">
			{/* Main Content */}
			<div className={`flex-1 transition-all duration-300 ${showChat ? "mr-80" : ""}`}>
				<PageContainer className="mx-auto flex flex-col justify-center">
					{/* Project Status */}
					<ProjectStatusScreen
						projectName={project?.name || ""}
						icp={project?.icp || ""}
						projectId={projectId}
						accountId={accountId}
						statusData={projectStatusData}
						personas={personas}
						insights={insights}
						initialChatMessages={assistantMessages}
					/>

					{/* TODO: Fix how to use this with chat agent  <AgentStatusDisplay /> */}

					<div className="p-3 pb-24">
						{/* Expanded List */}
						{showExpandedSection && expandedSection && !fullScreenContent && (
							<div className="space-y-3">
								<div className={`-mx-4 mb-4 flex items-center justify-between p-3 ${getSectionColor(expandedSection)}`}>
									<div>
										<h2 className="font-bold text-primary-foreground text-xl capitalize">{expandedSection}</h2>
										<p className="text-primary-foreground text-sm">{sectionData[expandedSection]?.length ?? 0} items</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="text-primary-foreground hover:bg-background/20"
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
															<h3 className="mb-1 line-clamp-2 font-medium text-foreground text-sm">
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
													<div className="mt-3 rounded-lg bg-background/20 p-2 backdrop-blur-sm">
														<div className="flex items-start justify-between gap-2">
															<div className="flex flex-1 items-start gap-2">
																<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
																<p className="flex-1 text-primary-foreground/90 text-xs leading-relaxed">
																	Tap to explore
																</p>
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
														<div className="mt-3 rounded-lg bg-background/20 p-2 backdrop-blur-sm">
															<div className="flex items-start justify-between gap-2">
																<div className="flex flex-1 items-start gap-2">
																	<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
																	<p className="flex-1 text-primary-foreground/90 text-xs leading-relaxed">
																		Tap to explore
																	</p>
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
					{/* <BottomActionBar onToggleChat={handleToggleChat} isUploading={isUploading} /> */}
				</PageContainer>
			</div>

			{/* CopilotSidebar - Right side overlay */}
			{showChat && (
				<div className="fixed top-0 right-0 bottom-16 z-30 w-80 border-border border-l bg-card text-foreground shadow-2xl">
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
				<div className="fixed inset-0 z-40 bg-background text-foreground">
					<div className={`h-16 ${getSectionColor(selectedItem.section)} flex items-center justify-between px-4`}>
						<div className="flex items-center gap-3">
							<h2 className="font-bold text-lg text-primary-foreground">
								{selectedItem.section?.[0]?.toUpperCase() + selectedItem.section?.slice(1)}:{" "}
								{selectedItem.title || selectedItem.name}
							</h2>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSelectedItem(null)}
							className="text-primary-foreground hover:bg-primary-foreground/20"
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
									<p className="text-muted-foreground leading-relaxed">
										{selectedItem.description || selectedItem.evidence}
									</p>
									{Array.isArray(selectedItem.tags) && (
										<div className="flex flex-wrap gap-2">
											{selectedItem.tags.map((tag: string) => (
												<Badge key={`selected-tag-${tag}`} variant="secondary" className="bg-muted text-foreground">
													{tag}
												</Badge>
											))}
										</div>
									)}
									<div className="rounded-lg bg-gradient-to-r from-primary to-accent p-4">
										<div className="mb-3 flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Bot className="h-4 w-4 text-primary-foreground" />
												<h3 className="font-medium text-primary-foreground">AI Assistant</h3>
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setShowChat(false)}
												className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
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
