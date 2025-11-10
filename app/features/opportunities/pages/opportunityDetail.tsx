import { AlertTriangle, Briefcase, Calendar, DollarSign, Lightbulb, MessageSquare, Sparkles, TrendingUp, Users } from "lucide-react"
import { useEffect } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import InlineEdit from "~/components/ui/inline-edit"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { isOpportunityAdvice } from "~/features/annotations/types"
import { getOpportunityById } from "~/features/opportunities/db"
import type { OpportunitySalesLensData } from "~/features/opportunities/lib/loadOpportunitySalesLens.server"
import { loadOpportunitySalesLens } from "~/features/opportunities/lib/loadOpportunitySalesLens.server"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.opportunity?.title || "Opportunity"} | Insights` },
		{ name: "description", content: "Opportunity details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const { opportunityId } = params

	if (!accountId || !projectId || !opportunityId) {
		throw new Response("Account ID, Project ID, and Opportunity ID are required", { status: 400 })
	}

	try {
		const { data: opportunity, error } = await getOpportunityById({
			supabase,
			accountId,
			projectId,
			id: opportunityId,
		})

		if (error || !opportunity) {
			throw new Response("Opportunity not found", { status: 404 })
		}

		// Load sales lens data (stakeholders, next steps, etc.)
		const salesLensData = await loadOpportunitySalesLens({
			supabase,
			opportunityId,
			accountId,
			projectId,
		})

		// Load AI recommendations from annotations
		const { data: annotations } = await supabase
			.from("annotations")
			.select("*")
			.eq("entity_type", "opportunity")
			.eq("entity_id", opportunityId)
			.eq("annotation_type", "ai_suggestion")
			.eq("status", "active")
			.order("created_at", { ascending: false })
			.limit(5)

		const aiRecommendations = (annotations || [])
			.map((ann) => {
				// Type guard filters and narrows the type
				if (!isOpportunityAdvice(ann.content_jsonb)) return null

				const content = ann.content_jsonb
				return {
					id: ann.id,
					status_assessment: content.status_assessment,
					recommendations: content.recommendations,
					risks: content.risks,
					confidence: content.confidence,
					created_at: ann.created_at,
				}
			})
			.filter((rec): rec is NonNullable<typeof rec> => rec !== null)

		return { opportunity, salesLensData, aiRecommendations }
	} catch (_error) {
		throw new Response("Failed to load opportunity", { status: 500 })
	}
}

const getKanbanStatusColor = (kanbanStatus: string | null) => {
	switch (kanbanStatus) {
		case "Explore":
			return "bg-blue-50 text-blue-700 border-blue-200"
		case "Validate":
			return "bg-yellow-50 text-yellow-700 border-yellow-200"
		case "Build":
			return "bg-green-50 text-green-700 border-green-200"
		default:
			return "bg-muted text-muted-foreground border-border"
	}
}

export default function OpportunityDetail() {
	const { opportunity, salesLensData, aiRecommendations } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)
	const opportunityFetcher = useFetcher()

	const handleOpportunityUpdate = (field: string, value: string) => {
		if (!currentProjectContext?.accountId || !currentProjectContext?.projectId) return

		opportunityFetcher.submit(
			{
				opportunityId: opportunity.id,
				accountId: currentProjectContext.accountId,
				projectId: currentProjectContext.projectId,
				field,
				value,
			},
			{ method: "post", action: "/api/update-opportunity" }
		)
	}

	interface OpportunityMetadata {
		notes?: string
		product_description?: string
	}

	const metadata = (opportunity.metadata as OpportunityMetadata) || {}
	const notes = metadata.notes || ""
	const productDescription = metadata.product_description || ""

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Back Button */}
			<BackButton />

			{/* Header */}
			<div className="mb-8 flex items-start justify-between">
				<div className="flex-1">
					<div className="mb-3 flex items-center gap-3">
						<Briefcase className="h-8 w-8 text-primary" />
						<h1 className="text-balance font-bold text-4xl tracking-tight">{opportunity.title}</h1>
					</div>
						<div className="mt-3 flex items-center gap-2">
						<Badge variant="outline" className={getKanbanStatusColor(opportunity.kanban_status)}>
							{opportunity.kanban_status || "Unknown"}
						</Badge>
						{opportunity.stage && (
							<Badge variant="outline" className="bg-muted text-muted-foreground">
								{opportunity.stage}
							</Badge>
						)}
					</div>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to={routes.opportunities.edit(opportunity.id)}>Edit</Link>
					</Button>
				</div>
			</div>

			{/* Key Metrics */}
			<div className="mb-8 grid gap-4 md:grid-cols-3">
				{opportunity.amount && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Deal Value</CardTitle>
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">${Number(opportunity.amount).toLocaleString()}</div>
						</CardContent>
					</Card>
				)}
				{opportunity.close_date && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Expected Close</CardTitle>
							<Calendar className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{new Date(opportunity.close_date).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</div>
						</CardContent>
					</Card>
				)}
				{opportunity.stage && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Sales Stage</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{opportunity.stage}</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* AI Advisor Section */}
			<AIAdvisorSection
				opportunityId={opportunity.id}
				accountId={currentProjectContext?.accountId || ""}
				projectId={currentProjectContext?.projectId || ""}
				recommendations={aiRecommendations}
			/>

			{/* Description Section */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Description</CardTitle>
				</CardHeader>
				<CardContent>
					<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
						<InlineEdit
							value={opportunity.description || ""}
							placeholder="Add a description for this opportunity..."
							onSubmit={(value) => handleOpportunityUpdate("description", value)}
							submitOnBlur
							multiline
							textClassName={`text-sm whitespace-pre-wrap ${opportunity.description ? "text-foreground" : "text-muted-foreground italic"}`}
							inputClassName="text-sm min-h-[80px]"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Product Section */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Product</CardTitle>
					{/* <p className="text-muted-foreground text-sm">What is the customer buying?</p> */}
				</CardHeader>
				<CardContent>
					<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
						<InlineEdit
							value={productDescription}
							placeholder="Describe what the customer is purchasing in plain English..."
							onSubmit={(value) => handleOpportunityUpdate("product_description", value)}
							submitOnBlur
							multiline
							textClassName={`text-sm whitespace-pre-wrap ${productDescription ? "text-foreground" : "text-muted-foreground italic"}`}
							inputClassName="text-sm min-h-[80px]"
						/>
					</div>
					<p className="mt-3 text-muted-foreground text-xs italic">
						Future: Auto-generate detailed spec from API/catalog according to template
					</p>
				</CardContent>
			</Card>

			{/* Notes Section */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Notes</CardTitle>
				</CardHeader>
				<CardContent>
					<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
						<InlineEdit
							value={notes}
							placeholder="Add notes about this opportunity..."
							onSubmit={(value) => handleOpportunityUpdate("notes", value)}
							submitOnBlur
							multiline
							textClassName={`text-sm whitespace-pre-wrap ${notes ? "text-foreground" : "text-muted-foreground italic"}`}
							inputClassName="text-sm min-h-[120px]"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Stakeholder Matrix */}
			{salesLensData && salesLensData.stakeholders.length > 0 && (
				<Card className="mt-8">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Stakeholder Matrix
						</CardTitle>
					</CardHeader>
					<CardContent>
						<StakeholderMatrix salesLensData={salesLensData} />
					</CardContent>
				</Card>
			)}

			{/* Linked Interviews */}
			{salesLensData?.linkedInterviews && salesLensData.linkedInterviews.length > 0 && (
				<Card className="mt-8">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5" />
							Linked Interviews
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{salesLensData.linkedInterviews.map((interview) => (
								<Link
									key={interview.id}
									to={routes.interviews.detail(interview.id)}
									className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
								>
									<div className="flex items-center gap-3">
										<MessageSquare className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="font-medium text-sm">{interview.title}</p>
											{interview.interviewDate && (
												<p className="text-muted-foreground text-xs">
													{new Date(interview.interviewDate).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
													})}
												</p>
											)}
										</div>
									</div>
								</Link>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

function StakeholderMatrix({ salesLensData }: { salesLensData: OpportunitySalesLensData }) {
	const { stakeholders, nextSteps } = salesLensData
	const stakeholderFetcher = useFetcher()
	const nextStepFetcher = useFetcher()
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

	// Map next steps to stakeholders by owner name
	const nextStepsByOwner = new Map<string, typeof nextSteps>()
	for (const step of nextSteps || []) {
		if (step.ownerName) {
			const existing = nextStepsByOwner.get(step.ownerName) || []
			existing.push(step)
			nextStepsByOwner.set(step.ownerName, existing)
		}
	}

	// Unassigned next steps
	const unassignedSteps = (nextSteps || []).filter((step) => !step.ownerName)

	// Revalidate after stakeholder updates
	useEffect(() => {
		if (stakeholderFetcher.state === "idle" && stakeholderFetcher.data) {
			revalidator.revalidate()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stakeholderFetcher.state, stakeholderFetcher.data])

	const handleStakeholderUpdate = (stakeholderId: string, field: string, value: string) => {
		stakeholderFetcher.submit(
			{
				stakeholderId,
				field,
				value,
			},
			{ method: "post", action: "/api/update-stakeholder" }
		)
	}

	const handleNextStepUpdate = (stepId: string, field: string, value: string) => {
		// Strip "-next" suffix to get actual slot ID
		const slotId = stepId.replace(/-next$/, "")
		nextStepFetcher.submit(
			{
				slotId,
				field,
				value,
			},
			{ method: "post", action: "/api/update-next-step" }
		)
	}

	const getStakeholderType = (stakeholder: (typeof stakeholders)[0]) => {
		if (!stakeholder.labels || stakeholder.labels.length === 0) {
			return "—"
		}
		// Check for exact type labels first (DM, I, B)
		if (stakeholder.labels.includes("DM")) return "DM"
		if (stakeholder.labels.includes("I")) return "I"
		if (stakeholder.labels.includes("B")) return "B"

		// Check for decision maker labels (legacy/descriptive)
		if (stakeholder.labels.some((l) => l.toLowerCase().includes("decision") || l.toLowerCase().includes("buyer"))) {
			return "DM"
		}
		// Check for influencer labels (legacy/descriptive)
		if (
			stakeholder.labels.some((l) => l.toLowerCase().includes("influencer") || l.toLowerCase().includes("champion"))
		) {
			return "I"
		}
		// Check for blocker/objector (legacy/descriptive)
		if (stakeholder.labels.some((l) => l.toLowerCase().includes("blocker") || l.toLowerCase().includes("objection"))) {
			return "B"
		}
		// If labels exist but no type is found, return unknown
		return "—"
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Person</TableHead>
						<TableHead>Role</TableHead>
						<TableHead className="w-36 text-center">Type</TableHead>
						<TableHead className="w-32 text-center">Influence</TableHead>
						<TableHead>Next Steps</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{stakeholders.map((stakeholder) => {
						const stakeholderSteps = nextStepsByOwner.get(stakeholder.displayName) || []
						const currentType = getStakeholderType(stakeholder)
						return (
							<TableRow key={stakeholder.id}>
								<TableCell className="font-medium">
									<div className="flex flex-col gap-1">
										{stakeholder.personId ? (
											<Link
												to={routes.people.detail(stakeholder.personId)}
												className="font-medium text-sm hover:text-primary hover:underline"
											>
												{stakeholder.displayName}
											</Link>
										) : (
											<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
												<InlineEdit
													value={stakeholder.displayName}
													placeholder="Enter name..."
													onSubmit={(value) => handleStakeholderUpdate(stakeholder.id, "display_name", value)}
													submitOnBlur
													textClassName="text-sm font-medium"
													inputClassName="text-sm"
												/>
											</div>
										)}
										{stakeholder.email && <span className="text-muted-foreground text-xs">{stakeholder.email}</span>}
									</div>
								</TableCell>
								<TableCell>
									<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
										<InlineEdit
											value={stakeholder.role || ""}
											placeholder="Add role..."
											onSubmit={(value) => handleStakeholderUpdate(stakeholder.id, "role", value)}
											submitOnBlur
											textClassName="text-sm"
											inputClassName="text-sm"
										/>
									</div>
								</TableCell>
								<TableCell className="text-center">
									<Select
										value={currentType === "—" ? "unknown" : currentType}
										onValueChange={(value) => {
											if (value === "unknown") {
												handleStakeholderUpdate(stakeholder.id, "stakeholder_type", "")
											} else {
												handleStakeholderUpdate(stakeholder.id, "stakeholder_type", value)
											}
										}}
									>
										<SelectTrigger className="h-8 w-24 border-0 hover:bg-muted">
											<SelectValue>
												{currentType === "—" ? (
													<Badge variant="outline" className="font-normal">
														Unknown
													</Badge>
												) : currentType === "DM" ? (
													<Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">DM</Badge>
												) : currentType === "I" ? (
													<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">I</Badge>
												) : (
													<Badge className="bg-red-100 text-red-700 hover:bg-red-100">B</Badge>
												)}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="DM">
												<div className="flex items-center gap-2">
													<Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">DM</Badge>
													<span className="text-muted-foreground text-xs">Decision Maker</span>
												</div>
											</SelectItem>
											<SelectItem value="I">
												<div className="flex items-center gap-2">
													<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">I</Badge>
													<span className="text-muted-foreground text-xs">Influencer</span>
												</div>
											</SelectItem>
											<SelectItem value="B">
												<div className="flex items-center gap-2">
													<Badge className="bg-red-100 text-red-700 hover:bg-red-100">B</Badge>
													<span className="text-muted-foreground text-xs">Blocker</span>
												</div>
											</SelectItem>
											<SelectItem value="unknown">
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="font-normal">
														Unknown
													</Badge>
													<span className="text-muted-foreground text-xs">Not yet determined</span>
												</div>
											</SelectItem>
										</SelectContent>
									</Select>
								</TableCell>
								<TableCell className="text-center">
									<Select
										value={stakeholder.influence || ""}
										onValueChange={(value) => handleStakeholderUpdate(stakeholder.id, "influence", value)}
									>
										<SelectTrigger
											className={`h-7 w-24 text-xs ${stakeholder.influence === "high"
													? "border-emerald-600 bg-emerald-50 text-emerald-700"
													: stakeholder.influence === "medium"
														? "border-amber-600 bg-amber-50 text-amber-700"
														: stakeholder.influence === "low"
															? "border-gray-400 bg-gray-50 text-gray-700"
															: ""
												}`}
										>
											<SelectValue placeholder="Select" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="high">High</SelectItem>
											<SelectItem value="medium">Medium</SelectItem>
											<SelectItem value="low">Low</SelectItem>
										</SelectContent>
									</Select>
								</TableCell>
								<TableCell>
									{stakeholderSteps.length > 0 ? (
										<div className="space-y-2">
											{stakeholderSteps.map((step) => (
												<div key={step.id} className="flex items-start gap-2">
													<span className="text-muted-foreground">•</span>
													<div className="flex-1 space-y-1">
														<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
															<InlineEdit
																value={step.description}
																placeholder="Add next step..."
																onSubmit={(value) => handleNextStepUpdate(step.id, "description", value)}
																submitOnBlur
																textClassName="text-sm"
																inputClassName="text-sm"
															/>
														</div>
														{step.dueDate && (
															<span className="text-muted-foreground text-xs">
																Due:{" "}
																{new Date(step.dueDate).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																})}
															</span>
														)}
													</div>
												</div>
											))}
										</div>
									) : (
										<span className="text-muted-foreground text-sm">—</span>
									)}
								</TableCell>
							</TableRow>
						)
					})}
					{unassignedSteps.length > 0 && (
						<TableRow className="bg-muted/30">
							<TableCell className="font-medium text-muted-foreground">Unassigned</TableCell>
							<TableCell>—</TableCell>
							<TableCell className="text-center">—</TableCell>
							<TableCell className="text-center">—</TableCell>
							<TableCell>
								<div className="space-y-2">
									{unassignedSteps.map((step) => (
										<div key={step.id} className="flex items-start gap-2">
											<span className="text-muted-foreground">•</span>
											<div className="flex-1 space-y-1">
												<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
													<InlineEdit
														value={step.description}
														placeholder="Add next step..."
														onSubmit={(value) => handleNextStepUpdate(step.id, "description", value)}
														submitOnBlur
														textClassName="text-sm"
														inputClassName="text-sm"
													/>
												</div>
												{step.dueDate && (
													<span className="text-muted-foreground text-xs">
														Due:{" "}
														{new Date(step.dueDate).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
														})}
													</span>
												)}
											</div>
										</div>
									))}
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	)
}

function AIAdvisorSection({
	opportunityId,
	accountId,
	projectId,
	recommendations,
}: {
	opportunityId: string
	accountId: string
	projectId: string
	recommendations: Array<{
		id: string
		status_assessment: string
		recommendations: string[]
		risks: string[]
		confidence: string
		created_at: string | null
	}>
}) {
	const advisorFetcher = useFetcher<{ ok: boolean; recommendation: any }>()

	const handleGenerateRecommendation = () => {
		advisorFetcher.submit(
			{
				opportunityId,
				accountId,
				projectId,
			},
			{ method: "post", action: "/api/opportunity-advisor" }
		)
	}

	const isGenerating = advisorFetcher.state === "submitting" || advisorFetcher.state === "loading"

	// Show newly generated recommendation if available
	const latestRecommendation =
		advisorFetcher.data?.ok && advisorFetcher.data.recommendation
			? advisorFetcher.data.recommendation
			: recommendations?.[0]

	// Debug logging
	console.log("AI Advisor Debug:", {
		fetcherState: advisorFetcher.state,
		fetcherData: advisorFetcher.data,
		recommendations,
		latestRecommendation,
	})

	// Show error if fetcher failed
	const hasError = advisorFetcher.data && !advisorFetcher.data.ok

	return (
		<Card className="mb-8 border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/30">
			<CardHeader className={latestRecommendation ? "" : "pb-4"}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-indigo-600" />
						<CardTitle>AI Deal Advisor</CardTitle>
						<Badge variant="outline" className="bg-white text-indigo-600 text-xs">
							AI
						</Badge>
					</div>
					<Button onClick={handleGenerateRecommendation} disabled={isGenerating} size="sm" className="gap-2">
						{isGenerating ? (
							<>
								<Sparkles className="h-4 w-4 animate-pulse" />
								Analyzing...
							</>
						) : (
							<>
								<Lightbulb className="h-4 w-4" />
								{latestRecommendation ? "Refresh" : "Get Advice"}
							</>
						)}
					</Button>
				</div>
				{!latestRecommendation && !hasError && (
					<p className="mt-2 text-muted-foreground text-sm">
						Get AI-powered strategic guidance for advancing this deal
					</p>
				)}
				{hasError && (
					<p className="mt-2 text-red-600 text-sm">
						Error: {(advisorFetcher.data as any)?.error || "Failed to generate recommendation"}
					</p>
				)}
			</CardHeader>
			{latestRecommendation && (
				<CardContent>
					<div className="space-y-6">
						{/* Status Assessment */}
						<div className="rounded-lg border border-indigo-100 bg-white p-4">
							<div className="mb-2 flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-indigo-600" />
								<span className="font-semibold text-sm">Status Assessment</span>
								<Badge
									variant={
										latestRecommendation.confidence === "high"
											? "default"
											: latestRecommendation.confidence === "medium"
												? "outline"
												: "secondary"
									}
									className="text-xs"
								>
									{latestRecommendation.confidence} confidence
								</Badge>
							</div>
							<p className="text-foreground">{latestRecommendation.status_assessment}</p>
						</div>

						{/* Recommendations */}
						{latestRecommendation.recommendations && latestRecommendation.recommendations.length > 0 && (
							<div className="rounded-lg border border-emerald-100 bg-white p-4">
								<div className="mb-3 flex items-center gap-2">
									<Lightbulb className="h-4 w-4 text-emerald-600" />
									<span className="font-semibold text-sm">Recommended Actions</span>
								</div>
								<ul className="space-y-2">
									{latestRecommendation.recommendations.map((rec: string, idx: number) => (
										<li key={idx} className="flex items-start gap-3">
											<span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700 text-xs">
												{idx + 1}
											</span>
											<span className="flex-1 text-foreground text-sm">{rec}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Risks */}
						{latestRecommendation.risks && latestRecommendation.risks.length > 0 && (
							<div className="rounded-lg border border-amber-100 bg-white p-4">
								<div className="mb-3 flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-amber-600" />
									<span className="font-semibold text-sm">Key Risks</span>
								</div>
								<ul className="space-y-2">
									{latestRecommendation.risks.map((risk: string, idx: number) => (
										<li key={idx} className="flex items-start gap-3">
											<span className="mt-0.5 text-amber-600">•</span>
											<span className="flex-1 text-foreground text-sm">{risk}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Timestamp */}
						{latestRecommendation.created_at && (
							<div className="border-indigo-100 border-t pt-3 text-muted-foreground text-xs">
								Generated {new Date(latestRecommendation.created_at).toLocaleString("en-US", {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
								})}
							</div>
						)}
					</div>
				</CardContent>
			)}
		</Card>
	)
}
