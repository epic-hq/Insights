import consola from "consola"
import {
	Grid3X3,
	LayoutGrid,
	Loader2,
	MoreVertical,
	PieChart as PieChartIcon,
	RefreshCw,
	Rows,
	Sparkles,
	Trash2,
	TrendingUp,
	Wand2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { Outlet, useFetcher, useLoaderData, useLocation, useNavigate, useRevalidator } from "react-router-dom"
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap } from "recharts"
import { toast } from "sonner"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ConsolidateProgressBar } from "~/features/insights/components/ConsolidateProgressBar"
import { InsightsExplainerCard } from "~/features/insights/components/InsightsExplainerCard"
import { InsightsSettingsModal } from "~/features/insights/components/InsightsSettingsModal"
import { useConsolidateProgress } from "~/features/insights/hooks/useConsolidateProgress"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

// Colors for pie chart
const PIE_COLORS = [
	"#6366f1", // indigo
	"#8b5cf6", // violet
	"#a855f7", // purple
	"#d946ef", // fuchsia
	"#ec4899", // pink
	"#f43f5e", // rose
	"#f97316", // orange
	"#eab308", // yellow
]

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const ctx_project = context.get(currentProjectContext)
	// Use context projectId, fallback to URL params (same pattern as table.tsx)
	const projectId = ctx_project.projectId || params.projectId || ""

	if (!projectId || !supabase) {
		consola.warn("[InsightsLayout] Missing projectId or supabase:", {
			projectId: !!projectId,
			supabase: !!supabase,
		})
		return { insightCount: 0, evidenceCount: 0 }
	}

	// Get counts for the header and explainer card
	const [themesResult, evidenceResult, interviewsResult, projectResult] = await Promise.all([
		supabase
			.from("themes")
			.select("id, name, statement")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
		supabase
			.from("evidence")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)
			.or("is_question.is.null,is_question.eq.false"),
		supabase
			.from("interviews")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)
			.eq("status", "ready"),
		supabase.from("projects").select("project_settings").eq("id", projectId).single(),
	])

	const themes = themesResult.data ?? []
	const themeIds = themes.map((t) => t.id)

	// Get theme_evidence links and person counts using evidence_facet.person_id
	let themesRanked: Array<{
		id: string
		name: string
		statement: string | null
		evidence_count: number
		person_count: number
		frequency: number
	}> = []

	if (themeIds.length > 0) {
		// Get theme_evidence links
		const { data: themeEvidenceLinks } = await supabase
			.from("theme_evidence")
			.select("theme_id, evidence_id")
			.eq("project_id", projectId)

		// Build theme -> evidence IDs map
		const themeEvidenceMap = new Map<string, Set<string>>()
		for (const link of themeEvidenceLinks ?? []) {
			if (!themeEvidenceMap.has(link.theme_id)) {
				themeEvidenceMap.set(link.theme_id, new Set())
			}
			themeEvidenceMap.get(link.theme_id)!.add(link.evidence_id)
		}

		// Get all evidence IDs across all themes
		const allEvidenceIds = new Set<string>()
		for (const evSet of themeEvidenceMap.values()) {
			for (const evId of evSet) allEvidenceIds.add(evId)
		}

		// Get person attribution from evidence_facet
		const themePersonCounts = new Map<string, Set<string>>()
		if (allEvidenceIds.size > 0) {
			const { data: facetPersons } = await supabase
				.from("evidence_facet")
				.select("evidence_id, person_id")
				.eq("project_id", projectId)
				.in("evidence_id", Array.from(allEvidenceIds))
				.not("person_id", "is", null)

			// Build evidence -> person mapping
			const evidenceToPersons = new Map<string, Set<string>>()
			for (const fp of facetPersons ?? []) {
				if (!fp.person_id) continue
				if (!evidenceToPersons.has(fp.evidence_id)) {
					evidenceToPersons.set(fp.evidence_id, new Set())
				}
				evidenceToPersons.get(fp.evidence_id)!.add(fp.person_id)
			}

			// Calculate person counts per theme
			for (const [themeId, evidenceIds] of themeEvidenceMap) {
				const personSet = new Set<string>()
				for (const evId of evidenceIds) {
					const persons = evidenceToPersons.get(evId)
					if (persons) {
						for (const p of persons) personSet.add(p)
					}
				}
				themePersonCounts.set(themeId, personSet)
			}
		}

		// Get total people count for frequency
		const { count: totalPeopleCount } = await supabase
			.from("people")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		// Build ranked themes
		themesRanked = themes.map((t) => {
			const evidenceIds = themeEvidenceMap.get(t.id)
			const personSet = themePersonCounts.get(t.id)
			const evidenceCount = evidenceIds?.size ?? 0
			const personCount = personSet?.size ?? 0
			const frequency = totalPeopleCount && totalPeopleCount > 0 ? personCount / totalPeopleCount : 0
			return {
				id: t.id,
				name: t.name,
				statement: t.statement,
				evidence_count: evidenceCount,
				person_count: personCount,
				frequency,
			}
		})

		// Sort by person count descending
		themesRanked.sort((a, b) => b.person_count - a.person_count)
	}

	consola.log("[InsightsLayout] Count query results:", {
		projectId,
		themesCount: themes.length,
		themesError: themesResult.error?.message,
		evidenceCount: evidenceResult.count,
		evidenceError: evidenceResult.error?.message,
	})

	// Extract analysis settings and consolidation state from project_settings
	const projectSettings = projectResult.data?.project_settings as {
		analysis?: {
			theme_dedup_threshold?: number
			evidence_link_threshold?: number
		}
		insights_consolidated_at?: string
	} | null

	return {
		insightCount: themes.length,
		evidenceCount: evidenceResult.count ?? 0,
		interviewCount: interviewsResult.count ?? 0,
		analysisSettings: projectSettings?.analysis,
		hasConsolidated: Boolean(projectSettings?.insights_consolidated_at),
		themesRanked,
	}
}

export default function InsightsLayout() {
	const { insightCount, evidenceCount, interviewCount, analysisSettings, hasConsolidated, themesRanked } =
		useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const location = useLocation()
	const revalidator = useRevalidator()
	const { projectPath, projectId, accountId } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const consolidateFetcher = useFetcher()
	const enrichFetcher = useFetcher()
	const deleteFetcher = useFetcher()

	// Track refresh all flow: consolidate → delete → enrich
	const [refreshStep, setRefreshStep] = useState<"idle" | "consolidate" | "delete" | "enrich">("idle")
	const [chartType, setChartType] = useState<"pie" | "treemap">("treemap")

	// Prepare data for chart (top 5 themes)
	const topThemes = useMemo(() => themesRanked.slice(0, 5), [themesRanked])
	const totalPeopleInChart = useMemo(() => topThemes.reduce((sum, t) => sum + t.person_count, 0), [topThemes])
	const pieData = useMemo(
		() =>
			topThemes.map((t) => ({
				name: t.name.length > 25 ? `${t.name.slice(0, 22)}...` : t.name,
				fullName: t.name,
				value: t.person_count,
				percent: totalPeopleInChart > 0 ? Math.round((t.person_count / totalPeopleInChart) * 100) : 0,
				id: t.id,
			})),
		[topThemes, totalPeopleInChart]
	)

	// Real-time consolidation progress tracking
	const [consolidateRunId, setConsolidateRunId] = useState<string | null>(null)
	const [consolidateToken, setConsolidateToken] = useState<string | null>(null)

	// Continue Refresh All flow after consolidation completes
	const continueRefreshFlow = useCallback(() => {
		revalidator.revalidate()
		if (refreshStep === "consolidate") {
			setRefreshStep("delete")
			deleteFetcher.submit({ project_id: projectId! }, { method: "POST", action: "/api/delete-empty-themes" })
		}
	}, [revalidator, refreshStep, projectId, deleteFetcher])

	// Handle consolidation complete - revalidate page data and continue Refresh flow
	const handleConsolidateComplete = useCallback(() => {
		continueRefreshFlow()
	}, [continueRefreshFlow])

	// Subscribe to consolidation progress
	const { progressInfo: consolidateProgress } = useConsolidateProgress({
		runId: consolidateRunId,
		accessToken: consolidateToken,
		onComplete: handleConsolidateComplete,
	})

	// Derived state
	const isConsolidatingTask =
		consolidateRunId !== null && !consolidateProgress.isComplete && !consolidateProgress.hasError
	const isConsolidating = consolidateFetcher.state !== "idle" || isConsolidatingTask
	const isEnriching = enrichFetcher.state !== "idle"
	const isDeleting = deleteFetcher.state !== "idle"
	const isRefreshing = refreshStep !== "idle"
	const isAnyLoading = isConsolidating || isEnriching || isDeleting

	// Handle consolidation API response from Actions menu (returns runId)
	// Note: ExplainerCard handles its own consolidation UI
	useEffect(() => {
		if (consolidateFetcher.data && consolidateFetcher.state === "idle") {
			const data = consolidateFetcher.data as {
				ok?: boolean
				runId?: string
				error?: string
			}
			if (data.ok && data.runId) {
				// Set up realtime subscription for progress bar
				fetch("/api/trigger-run-token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ runId: data.runId }),
				})
					.then((res) => res.json())
					.then(({ token }) => {
						if (token) {
							setConsolidateRunId(data.runId!)
							setConsolidateToken(token)
						} else {
							// No realtime - use fallback with delay, still continue Refresh flow
							setTimeout(() => continueRefreshFlow(), 5000)
						}
					})
					.catch(() => {
						// Fallback - still continue Refresh flow
						setTimeout(() => continueRefreshFlow(), 5000)
					})
			} else if (data.error) {
				toast.error(data.error)
				setRefreshStep("idle")
			}
		}
	}, [consolidateFetcher.data, consolidateFetcher.state, continueRefreshFlow])

	// Handle delete response
	useEffect(() => {
		if (deleteFetcher.data && deleteFetcher.state === "idle") {
			const data = deleteFetcher.data as {
				ok?: boolean
				deleted?: number
				message?: string
				error?: string
			}
			if (data.ok) {
				toast.success(data.message || `Deleted ${data.deleted} empty themes`)
				// If in refresh flow, move to next step
				if (refreshStep === "delete") {
					setRefreshStep("enrich")
					enrichFetcher.submit(
						{
							project_id: projectId!,
							account_id: accountId!,
							max_themes: "50",
						},
						{ method: "POST", action: "/api/enrich-themes" }
					)
				}
			} else if (data.error) {
				toast.error(data.error)
				setRefreshStep("idle")
			}
		}
	}, [deleteFetcher.data, deleteFetcher.state, refreshStep, projectId, accountId])

	// Handle enrich response
	useEffect(() => {
		if (enrichFetcher.data && enrichFetcher.state === "idle") {
			const data = enrichFetcher.data as {
				success?: boolean
				message?: string
				error?: string
			}
			if (data.success) {
				toast.success(data.message || "Theme enrichment started.")
				// End refresh flow
				if (refreshStep === "enrich") {
					setRefreshStep("idle")
					toast.success("Refresh complete!")
				}
			} else if (data.error) {
				toast.error(data.error)
				setRefreshStep("idle")
			}
		}
	}, [enrichFetcher.data, enrichFetcher.state, refreshStep])

	const handleConsolidateThemes = () => {
		if (!projectId || !accountId) return
		const threshold = analysisSettings?.theme_dedup_threshold ?? 0.85
		consolidateFetcher.submit(
			{
				project_id: projectId,
				account_id: accountId,
				similarity_threshold: threshold.toString(),
			},
			{ method: "POST", action: "/api/consolidate-themes" }
		)
	}

	const handleEnrichThemes = () => {
		if (!projectId || !accountId) return
		enrichFetcher.submit(
			{ project_id: projectId, account_id: accountId, max_themes: "50" },
			{ method: "POST", action: "/api/enrich-themes" }
		)
	}

	const handleDeleteEmptyThemes = () => {
		if (!projectId) return
		if (!confirm("Delete all themes with 0 linked evidence? This cannot be undone.")) return
		deleteFetcher.submit({ project_id: projectId }, { method: "POST", action: "/api/delete-empty-themes" })
	}

	// Refresh All: runs consolidate → delete → enrich in sequence
	const handleRefreshAll = () => {
		if (!projectId || !accountId) return
		setRefreshStep("consolidate")
		const threshold = analysisSettings?.theme_dedup_threshold ?? 0.85
		consolidateFetcher.submit(
			{
				project_id: projectId,
				account_id: accountId,
				similarity_threshold: threshold.toString(),
			},
			{ method: "POST", action: "/api/consolidate-themes" }
		)
	}

	// Determine the active view based on the current URL path
	const getActiveView = () => {
		const path = location.pathname
		if (path.endsWith("/insights/table")) return "table"
		return "cards" // Default to cards view (quick)
	}

	// Handle view change by navigating to the appropriate route
	const handleViewChange = (value: string) => {
		switch (value) {
			case "cards":
				navigate(routes.insights.quick())
				break
			case "table":
				navigate(routes.insights.table())
				break
			default:
				navigate(routes.insights.quick())
		}
	}

	// Dismiss progress bar and reset state
	const handleDismissProgress = useCallback(() => {
		setConsolidateRunId(null)
		setConsolidateToken(null)
	}, [])

	return (
		<PageContainer className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1.5">
					<div className="flex items-center gap-3">
						<h1 className="font-semibold text-3xl text-foreground">Insights</h1>
						<Badge variant="secondary" className="text-sm">
							{insightCount} themes
						</Badge>
						<Badge variant="outline" className="text-muted-foreground text-sm">
							{evidenceCount} evidence
						</Badge>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" disabled={isAnyLoading || !projectId} className="gap-2">
								{isAnyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
								Actions
								{isRefreshing && (
									<span className="text-muted-foreground text-xs">
										({refreshStep === "consolidate" ? "1/3" : refreshStep === "delete" ? "2/3" : "3/3"})
									</span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuItem onClick={handleRefreshAll} disabled={isAnyLoading} className="gap-2">
								<RefreshCw className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Refresh All</span>
									<span className="text-muted-foreground text-xs">Consolidate → Clean → Enrich</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleConsolidateThemes} disabled={isConsolidating} className="gap-2">
								<Sparkles className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Consolidate Themes</span>
									<span className="text-muted-foreground text-xs">Merge similar themes</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleDeleteEmptyThemes} disabled={isDeleting} className="gap-2">
								<Trash2 className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Delete Empty</span>
									<span className="text-muted-foreground text-xs">Remove themes with 0 evidence</span>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleEnrichThemes} disabled={isEnriching} className="gap-2">
								<Wand2 className="h-4 w-4" />
								<div className="flex flex-col">
									<span>Enrich Themes</span>
									<span className="text-muted-foreground text-xs">Add pain points, JTBD, categories</span>
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Settings Modal */}
					{projectId && accountId && (
						<InsightsSettingsModal projectId={projectId} accountId={accountId} currentSettings={analysisSettings} />
					)}
					<ToggleGroup
						type="single"
						value={getActiveView()}
						onValueChange={(next) => next && handleViewChange(next)}
						size="sm"
						className="shrink-0"
					>
						<ToggleGroupItem value="cards" aria-label="Cards view" className="gap-2">
							<LayoutGrid className="h-4 w-4" />
							Cards
						</ToggleGroupItem>
						<ToggleGroupItem value="table" aria-label="Table view" className="gap-2">
							<Rows className="h-4 w-4" />
							Table
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			{/* Real-time consolidation progress */}
			{consolidateRunId && <ConsolidateProgressBar progress={consolidateProgress} onDismiss={handleDismissProgress} />}

			{/* Explainer Card - Shows guidance based on insights state */}
			{projectId && accountId && (
				<InsightsExplainerCard
					interviewCount={interviewCount ?? 0}
					themeCount={insightCount}
					evidenceCount={evidenceCount}
					projectId={projectId}
					accountId={accountId}
					hasConsolidated={hasConsolidated}
					similarityThreshold={analysisSettings?.theme_dedup_threshold ?? 0.85}
				/>
			)}

			{/* Insights Overview Chart */}
			{themesRanked.length > 0 && (
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-4">
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Top Insights Overview
						</CardTitle>
						<div className="flex items-center gap-1 rounded-lg border p-1">
							<Button
								variant={chartType === "pie" ? "secondary" : "ghost"}
								size="sm"
								className="h-7 px-2"
								onClick={() => setChartType("pie")}
							>
								<PieChartIcon className="h-4 w-4" />
							</Button>
							<Button
								variant={chartType === "treemap" ? "secondary" : "ghost"}
								size="sm"
								className="h-7 px-2"
								onClick={() => setChartType("treemap")}
							>
								<Grid3X3 className="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{chartType === "pie" ? (
							<div className="flex justify-center">
								<div className="w-[500px]">
									<ResponsiveContainer width="100%" height={320}>
										<PieChart>
											<Pie
												data={pieData}
												cx="50%"
												cy="50%"
												innerRadius={45}
												outerRadius={70}
												paddingAngle={2}
												dataKey="value"
												label={({ name, value, cx, cy, midAngle, outerRadius, index }) => {
													const RADIAN = Math.PI / 180
													const radius = outerRadius + 35
													const x = cx + radius * Math.cos(-midAngle * RADIAN)
													const y = cy + radius * Math.sin(-midAngle * RADIAN)
													const truncatedName = name.length > 20 ? `${name.slice(0, 18)}...` : name
													const pct = pieData[index]?.percent ?? 0
													return (
														<text
															x={x}
															y={y}
															fill="currentColor"
															textAnchor={x > cx ? "start" : "end"}
															dominantBaseline="central"
															className="fill-foreground text-xs"
														>
															{truncatedName} ({value}) {pct}%
														</text>
													)
												}}
												labelLine={{
													stroke: "currentColor",
													strokeWidth: 1,
													className: "stroke-muted-foreground/50",
												}}
											>
												{pieData.map((entry, index) => (
													<Cell
														key={entry.id}
														fill={PIE_COLORS[index % PIE_COLORS.length]}
														className="cursor-pointer transition-opacity hover:opacity-80"
														onClick={() => navigate(routes.insights.detail(entry.id))}
													/>
												))}
												<Label
													value={`${totalPeopleInChart} people`}
													position="center"
													className="fill-foreground font-medium text-foreground text-sm"
												/>
											</Pie>
											<Tooltip
												content={({ payload }) => {
													if (!payload?.[0]) return null
													const data = payload[0].payload
													return (
														<div className="rounded-lg border bg-background px-3 py-2 shadow-md">
															<p className="font-medium text-sm">{data.fullName}</p>
															<p className="text-muted-foreground text-xs">
																{data.value} people ({data.percent}%)
															</p>
														</div>
													)
												}}
											/>
										</PieChart>
									</ResponsiveContainer>
								</div>
							</div>
						) : (
							<div className="w-full">
								<ResponsiveContainer width="100%" height={280}>
									<Treemap
										data={pieData}
										dataKey="value"
										aspectRatio={4 / 3}
										stroke="#fff"
										isAnimationActive={false}
										content={({ x, y, width, height, name, value, index }) => {
											const entry = pieData[index as number]
											if (!entry || width < 50 || height < 40) return null

											// Calculate how many characters fit per line (roughly)
											const charsPerLine = Math.floor(width / 9)
											const fullName = entry.fullName || (name as string)
											const lines: string[] = []

											// Word wrap the name
											const words = fullName.split(" ")
											let currentLine = ""
											for (const word of words) {
												if (currentLine.length + word.length + 1 <= charsPerLine) {
													currentLine += (currentLine ? " " : "") + word
												} else {
													if (currentLine) lines.push(currentLine)
													currentLine = word
												}
											}
											if (currentLine) lines.push(currentLine)

											// Limit to 2 lines max
											if (lines.length > 2) {
												lines.length = 2
												lines[1] = lines[1].length > 3 ? lines[1].slice(0, -3) + "..." : "..."
											}

											const lineHeight = 18
											const totalTextHeight = lines.length * lineHeight + 20
											const startY = y + height / 2 - totalTextHeight / 2 + 10

											return (
												<g>
													<rect
														x={x}
														y={y}
														width={width}
														height={height}
														fill={PIE_COLORS[(index as number) % PIE_COLORS.length]}
														className="cursor-pointer transition-opacity hover:opacity-80"
														onClick={() => navigate(routes.insights.detail(entry.id))}
													/>
													{lines.map((line, i) => (
														<text
															key={i}
															x={x + width / 2}
															y={startY + i * lineHeight}
															textAnchor="middle"
															fill="white"
															className="font-medium text-sm"
															style={{
																textShadow: "0 1px 2px rgba(0,0,0,0.5)",
															}}
														>
															{line}
														</text>
													))}
													<text
														x={x + width / 2}
														y={startY + lines.length * lineHeight + 4}
														textAnchor="middle"
														fill="white"
														className="text-xs opacity-90"
														style={{
															textShadow: "0 1px 2px rgba(0,0,0,0.5)",
														}}
													>
														{value} ({entry.percent}%)
													</text>
												</g>
											)
										}}
									/>
								</ResponsiveContainer>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Outlet content */}
			<Outlet />
		</PageContainer>
	)
}
