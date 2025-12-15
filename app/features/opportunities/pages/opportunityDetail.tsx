import consola from "consola"
import { format } from "date-fns"
import {
	AlertTriangle,
	Briefcase,
	Calendar,
	DollarSign,
	Lightbulb,
	MessageSquare,
	Sparkles,
	TrendingUp,
	Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ConfidenceBarChart } from "~/components/ui/ConfidenceBarChart"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import InlineEdit from "~/components/ui/inline-edit"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { isOpportunityAdvice } from "~/features/annotations/types"
import { getOpportunityById } from "~/features/opportunities/db"
import type { OpportunitySalesLensData } from "~/features/opportunities/lib/loadOpportunitySalesLens.server"
import { loadOpportunitySalesLens } from "~/features/opportunities/lib/loadOpportunitySalesLens.server"
import { loadOpportunityStages } from "~/features/opportunities/server/stage-settings.server"
import {
        ensureStageValue,
        normalizeStageId,
        type OpportunityStageConfig,
        stageLabelForValue,
} from "~/features/opportunities/stage-config"
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

// Validation schemas
const amountSchema = z.string().refine(
	(val) => {
		if (!val || val.trim() === "") return true // Allow empty
		const num = Number(val.replace(/,/g, ""))
		return !Number.isNaN(num) && num >= 0
	},
	{ message: "Please enter a valid positive number" }
)

const dateSchema = z.string().refine(
	(val) => {
		if (!val || val.trim() === "") return true // Allow empty
		const date = new Date(val)
		return !Number.isNaN(date.getTime())
	},
	{ message: "Please enter a valid date" }
)

// Format number with commas
function formatCurrency(value: number | string | null): string {
	if (!value) return ""
	const num = typeof value === "string" ? Number(value) : value
	if (Number.isNaN(num)) return ""
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(num)
}

function formatDateDisplay(dateString: string | null): string {
	if (!dateString) return ""
	try {
		return format(new Date(dateString), "MMM d, yyyy")
	} catch {
		return ""
	}
}

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

		const { stages } = await loadOpportunityStages({ supabase, accountId })

		return { opportunity, salesLensData, aiRecommendations, stages }
	} catch (_error) {
		throw new Response("Failed to load opportunity", { status: 500 })
	}
}

const STAGE_BADGE_COLORS = [
	"bg-blue-50 text-blue-700 border-blue-200",
	"bg-amber-50 text-amber-700 border-amber-200",
	"bg-emerald-50 text-emerald-700 border-emerald-200",
	"bg-purple-50 text-purple-700 border-purple-200",
	"bg-rose-50 text-rose-700 border-rose-200",
	"bg-slate-100 text-slate-800 border-slate-200",
]

const getKanbanStatusColor = (kanbanStatus: string | null, stages: OpportunityStageConfig[]) => {
	const normalized = normalizeStageId(kanbanStatus || "")
	const stageIndex = stages.findIndex((stage) => stage.id === normalized)
	if (stageIndex >= 0) {
		return STAGE_BADGE_COLORS[stageIndex % STAGE_BADGE_COLORS.length]
	}
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
	const { opportunity, salesLensData, aiRecommendations, stages } = useLoaderData<typeof loader>()
        const currentProjectContext = useCurrentProject()
        const routes = useProjectRoutes(currentProjectContext?.projectPath)
        const opportunityFetcher = useFetcher()
        const stageLabel = stageLabelForValue(opportunity.stage || opportunity.kanban_status, stages)
        const kanbanLabel = stageLabel || opportunity.kanban_status || "Unknown"
        const shareProjectPath = currentProjectContext?.projectPath || ""

	const handleOpportunityUpdate = (field: string, value: string) => {
		if (!currentProjectContext?.accountId || !currentProjectContext?.projectId) return

		// Validate amount field
		if (field === "amount") {
			const result = amountSchema.safeParse(value)
			if (!result.success) {
				toast.error(result.error.errors[0].message)
				return
			}
			// Strip commas before sending to server
			value = value.replace(/,/g, "")
		}

		// Validate close_date field
		if (field === "close_date") {
			const result = dateSchema.safeParse(value)
			if (!result.success) {
				toast.error(result.error.errors[0].message)
				return
			}
		}

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
						<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
							<InlineEdit
								value={opportunity.title}
								placeholder="Enter opportunity title..."
								onSubmit={(value) => handleOpportunityUpdate("title", value)}
								submitOnBlur
								textClassName="text-foreground font-bold text-4xl tracking-tight"
								inputClassName="text-4xl font-bold tracking-tight"
							/>
						</div>
					</div>
					<div className="mt-3 flex items-center gap-2">
						<Badge variant="outline" className={getKanbanStatusColor(opportunity.kanban_status, stages)}>
							{kanbanLabel}
						</Badge>
					</div>
				</div>
                                <div className="flex items-center gap-2">
                                        {shareProjectPath ? (
                                                <ResourceShareMenu
                                                        projectPath={shareProjectPath}
                                                        resourceId={opportunity.id}
                                                        resourceName={opportunity.title}
                                                        resourceType="opportunity"
                                                        buttonLabel="Share / Invite"
                                                />
                                        ) : null}
                                        <Button asChild variant="outline" size="sm">
                                                <Link to={routes.opportunities.edit(opportunity.id)}>Edit</Link>
                                        </Button>
                                </div>
                        </div>

			{/* Key Metrics */}
			<div className="mb-8 grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">Deal Value</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
							<InlineEdit
								value={opportunity.amount ? formatCurrency(opportunity.amount) : ""}
								placeholder="$0"
								onSubmit={(value) => handleOpportunityUpdate("amount", value.replace(/[$,]/g, ""))}
								submitOnBlur
								textClassName="font-bold text-foreground text-2xl"
								inputClassName="text-2xl font-bold"
							/>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-muted-foreground text-sm">Expected Close</CardTitle>
						<Calendar className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div onClick={(e) => e.stopPropagation()} onFocusCapture={(e) => e.stopPropagation()}>
							<InlineEdit
								value={opportunity.close_date ? new Date(opportunity.close_date).toISOString().split("T")[0] : ""}
								displayValue={formatDateDisplay(opportunity.close_date)}
								placeholder="Select date..."
								onSubmit={(value) => handleOpportunityUpdate("close_date", value)}
								submitOnBlur
								type="date"
								textClassName="font-bold text-foreground text-2xl"
								inputClassName="text-2xl font-bold"
							/>
						</div>
					</CardContent>
				</Card>
				{stageLabel && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-muted-foreground text-sm">Sales Stage</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<Select
								value={
									stages.length > 0
										? ensureStageValue(opportunity.stage || opportunity.kanban_status, stages)
										: opportunity.stage || opportunity.kanban_status || ""
								}
								onValueChange={(value) => handleOpportunityUpdate("stage", value)}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{stages.map((stage) => (
										<SelectItem key={stage.id} value={stage.id}>
											{stage.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
							placeholder="product/service description..."
							onSubmit={(value) => handleOpportunityUpdate("product_description", value)}
							submitOnBlur
							multiline
							textClassName={`text-sm whitespace-pre-wrap ${productDescription ? "text-foreground" : "text-muted-foreground italic"}`}
							inputClassName="text-sm min-h-[80px]"
						/>
					</div>
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
							placeholder="Opportunity notes..."
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
			<Card className="mt-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Stakeholder Matrix
					</CardTitle>
				</CardHeader>
				<CardContent>
					<StakeholderMatrix
						salesLensData={salesLensData || { stakeholders: [], nextSteps: [] }}
						opportunityId={opportunity.id}
						accountId={currentProjectContext?.accountId || ""}
						projectId={currentProjectContext?.projectId || ""}
					/>
				</CardContent>
			</Card>

			{/* Linked Interviews */}
			<Card className="mt-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						Linked Interviews
					</CardTitle>
				</CardHeader>
				<CardContent>
					{salesLensData?.linkedInterviews && salesLensData.linkedInterviews.length > 0 ? (
						<div className="space-y-2">
							{salesLensData.linkedInterviews.map((interview) => (
								<Link
									key={interview.id}
									to={routes.interviews.detail(interview.id)}
									className="flex items-center justify-between rounded-lg border-2 border-border p-3 transition-colors hover:bg-muted"
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
					) : (
						<p className="text-muted-foreground text-sm">No linked interviews yet.</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

function StakeholderMatrix({
	salesLensData,
	opportunityId,
	accountId,
	projectId,
}: {
	salesLensData: OpportunitySalesLensData
	opportunityId: string
	accountId: string
	projectId: string
}) {
	const { stakeholders, nextSteps } = salesLensData
	const stakeholderFetcher = useFetcher()
	const addStakeholderFetcher = useFetcher()
	const peopleFetcher = useFetcher()
	const nextStepFetcher = useFetcher()
	const revalidator = useRevalidator()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

	const [showAddDialog, setShowAddDialog] = useState(false)

	// Load people when dialog opens
	useEffect(() => {
		if (showAddDialog && !peopleFetcher.data) {
			peopleFetcher.load("/api/people/search?limit=50")
		}
	}, [showAddDialog, peopleFetcher])

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
	}, [stakeholderFetcher.state, stakeholderFetcher.data, revalidator.revalidate])

	// Revalidate after adding stakeholder
	useEffect(() => {
		if (addStakeholderFetcher.state === "idle" && addStakeholderFetcher.data) {
			revalidator.revalidate()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [addStakeholderFetcher.state, addStakeholderFetcher.data, revalidator.revalidate])

	const handleAddStakeholder = () => {
		setShowAddDialog(true)
	}

	const handleSelectPerson = (person: { id: string; display_name?: string; name?: string }) => {
		addStakeholderFetcher.submit(
			{
				opportunityId,
				accountId,
				projectId,
				field: "create",
				value: person.display_name || person.name || "Unknown",
				personId: person.id,
			},
			{ method: "post", action: "/api/update-stakeholder" }
		)
		setShowAddDialog(false)
	}

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
		<>
			<div className="mb-4 flex justify-end">
				<Button onClick={handleAddStakeholder} disabled={addStakeholderFetcher.state === "submitting"} size="sm">
					{addStakeholderFetcher.state === "submitting" ? "Adding..." : "Add Stakeholder"}
				</Button>
			</div>
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
												className={`h-7 w-24 text-xs ${
													stakeholder.influence === "high"
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

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Stakeholder</DialogTitle>
						<DialogDescription>
							Select a person from your CRM or company contacts to add as a stakeholder.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-60 space-y-2 overflow-y-auto">
						{peopleFetcher.data?.people?.length > 0 ? (
							peopleFetcher.data.people.map((person: { id: string; display_name?: string; name?: string }) => (
								<Button
									key={person.id}
									variant="ghost"
									className="w-full justify-start"
									onClick={() => handleSelectPerson(person)}
								>
									{person.display_name || person.name || "Unknown"}
								</Button>
							))
						) : (
							<p className="text-muted-foreground text-sm">No people available.</p>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
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
        consola.log("AI Advisor Debug:", {
                fetcherState: advisorFetcher.state,
                fetcherData: advisorFetcher.data,
                recommendations,
                latestRecommendation,
        })

	// Show error if fetcher failed
	const hasError = advisorFetcher.data && !advisorFetcher.data.ok

	return (
		<Card className="mb-8 border-2 border-border bg-card">
			<CardHeader className={latestRecommendation ? "" : "pb-4"}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-indigo-600" />
						<CardTitle>AI Deal Advisor</CardTitle>
						<Badge variant="outline" className="bg-card text-indigo-600 text-xs">
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
						Error: {(advisorFetcher.data as { error?: string })?.error || "Failed to generate recommendation"}
					</p>
				)}
			</CardHeader>
			{latestRecommendation && (
				<CardContent>
					<div className="space-y-6">
						{/* Status Assessment */}
						<div className="rounded-lg border-2 border-border bg-card p-4">
							<div className="mb-2 flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-indigo-600" />
								<span className="font-semibold text-sm">Status Assessment</span>
								<ConfidenceBarChart level={latestRecommendation.confidence} variant="bars" size="sm" />
							</div>
							<p className="text-foreground">{latestRecommendation.status_assessment}</p>
						</div>

						{/* Recommendations */}
						{latestRecommendation.recommendations && latestRecommendation.recommendations.length > 0 && (
							<div className="rounded-lg border-2 border-border bg-card p-4">
								<div className="mb-3 flex items-center gap-2">
									<Lightbulb className="h-4 w-4 text-emerald-600" />
									<span className="font-semibold text-sm">Recommended Actions</span>
								</div>
								<ul className="space-y-2">
									{latestRecommendation.recommendations.map((rec: string, idx: number) => (
										<li key={`${rec}-${idx}`} className="flex items-start gap-3">
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
							<div className="rounded-lg border-2 border-border bg-card p-4">
								<div className="mb-3 flex items-center gap-2">
									<AlertTriangle className="h-4 w-4 text-amber-600" />
									<span className="font-semibold text-sm">Key Risks</span>
								</div>
								<div className="space-y-2">
									{latestRecommendation.risks.map((risk: string, idx: number) => (
										<li key={`${risk}-${idx}`} className="flex items-start gap-3">
											<span className="mt-0.5 text-amber-600">•</span>
											<span className="flex-1 text-foreground text-sm">{risk}</span>
										</li>
									))}
								</div>
							</div>
						)}

						{/* Timestamp */}
						{latestRecommendation.created_at && (
							<div className="border-border border-t pt-3 text-muted-foreground text-xs">
								Generated{" "}
								{new Date(latestRecommendation.created_at).toLocaleString("en-US", {
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
