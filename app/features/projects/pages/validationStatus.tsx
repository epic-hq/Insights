import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	CreditCard,
	Eye,
	Flame,
	LayoutList,
	LineChart,
	MinusCircle,
	Rocket,
	Search,
	Settings,
	Sparkles,
	Target,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"

interface ValidationParticipant {
	id: string
	name: string
	company: string
	outcome: 1 | 2 | 3 | 4 | 5
	stage: "Qualify" | "Discover" | "Behavior" | "Pain" | "Value" | "Pay"
	keyInsight: string
	validationDetails?: {
		painExists: string
		awareness: string
		quantified: string
		acting: string
	}
}

const mockParticipants: ValidationParticipant[] = [
	{
		id: "1",
		name: "Sarah Chen",
		company: "TechStart Inc",
		outcome: 5,
		stage: "Pay",
		keyInsight: "Currently paying $500/mo for partial solution, willing to pay more for complete fix",
		validationDetails: {
			painExists: "Spending 12+ hours/week on manual project tracking across 3 tools",
			awareness: "Tracks time spent, calculated $60k/year in lost productivity",
			quantified: "Documented $60k annual cost + $500/mo in current tool subscriptions",
			acting: "Currently paying $500/mo for Asana + Monday.com, willing to consolidate",
		},
	},
	{
		id: "2",
		name: "Michael Rodriguez",
		company: "Growth Labs",
		outcome: 5,
		stage: "Value",
		keyInsight: "Quantified problem costs 15 hours/week, actively seeking solutions",
		validationDetails: {
			painExists: "Team of 8 loses 15 hours/week to status update meetings and Slack threads",
			awareness: "Knows exact time cost, frustrated with current async communication gaps",
			quantified: "Calculated 120 hours/week team time = $45k/year in meeting overhead",
			acting: "Actively demoing 4 different tools, budget approved for $800/mo solution",
		},
	},
	{
		id: "3",
		name: "Jennifer Park",
		company: "Startup Co",
		outcome: 4,
		stage: "Pain",
		keyInsight: "Aware of inefficiency but current workaround is acceptable for now",
	},
	{
		id: "4",
		name: "David Thompson",
		company: "Enterprise Corp",
		outcome: 5,
		stage: "Behavior",
		keyInsight: "Built internal tool, costs $2K/mo to maintain, looking for better option",
		validationDetails: {
			painExists: "Off-the-shelf tools don't integrate with internal systems, causing data silos",
			awareness: "Engineering team complains monthly about maintaining custom solution",
			quantified: "Internal tool costs $2K/mo in developer time + $300/mo in infrastructure",
			acting: "Built custom Notion + Airtable integration, actively seeking replacement",
		},
	},
	{
		id: "5",
		name: "Lisa Wang",
		company: "Digital Agency",
		outcome: 3,
		stage: "Discover",
		keyInsight: "Acknowledges problem exists but has not prioritized solving it",
	},
	{
		id: "6",
		name: "James Miller",
		company: "Consulting Group",
		outcome: 2,
		stage: "Qualify",
		keyInsight: "In target market but unaware of the specific pain point",
	},
	{
		id: "7",
		name: "Amanda Foster",
		company: "Innovation Hub",
		outcome: 5,
		stage: "Pay",
		keyInsight: "Paid for 3 different solutions, none fully solved problem, budget approved",
		validationDetails: {
			painExists: "Managing 15 concurrent projects with 30+ stakeholders, constant context switching",
			awareness: "Tried 3 tools in past year, none solved cross-functional visibility problem",
			quantified: "Spent $18k last year on failed tool implementations, willing to pay more for right solution",
			acting: "Currently paying $750/mo for ClickUp + Miro, still supplementing with spreadsheets",
		},
	},
	{
		id: "8",
		name: "Robert Kim",
		company: "Scale Ventures",
		outcome: 1,
		stage: "Qualify",
		keyInsight: "Does not experience this problem, different workflow",
	},
]

const outcomeConfig = {
	1: {
		label: "Not Target",
		description: "Pain does not exist",
		color: "bg-gray-100 text-gray-700 border-gray-200",
		icon: XCircle,
	},
	2: {
		label: "Unaware",
		description: "Pain exists. Prospect does not know.",
		color: "bg-orange-50 text-orange-700 border-orange-200",
		icon: AlertCircle,
	},
	3: {
		label: "Aware, Inactive",
		description: "Pain exists. They know. Has not been quantified. Will do nothing about it.",
		color: "bg-yellow-50 text-yellow-700 border-yellow-200",
		icon: MinusCircle,
	},
	4: {
		label: "Quantified, Inactive",
		description: "Pain exists. Knows about it. Has quantified it. Can afford to do nothing.",
		color: "bg-blue-50 text-blue-700 border-blue-200",
		icon: AlertCircle,
	},
	5: {
		label: "Opportunities",
		description: "Pain exists. Knows about it. Has quantified it. Is doing something about it.",
		color: "bg-emerald-50 text-emerald-700 border-emerald-200",
		icon: CheckCircle2,
	},
}

const stageDescriptions = {
	Qualify: "Target customer",
	Discover: "Feels the pain",
	Behavior: "Actively trying to solve (not yet paying)",
	Pain: "Current solution insufficient",
	Value: "Cares enough to change",
	Pay: "Already paying for solution",
}

const _stageIcons = {
	Qualify: Search,
	Discover: Eye,
	Behavior: Zap,
	Pain: Flame,
	Value: Sparkles,
	Pay: CreditCard,
}

const _validationIcons = {
	painExists: Flame,
	awareness: Eye,
	quantified: LineChart,
	acting: Rocket,
}

export function AnalyzeStageValidation() {
	const [selectedOutcome, setSelectedOutcome] = useState<number>(5)

	const totalInterviews = 15
	const completedInterviews = mockParticipants.length
	const progressPercentage = Math.round((completedInterviews / totalInterviews) * 100)

	const outcomeCounts = mockParticipants.reduce(
		(acc, p) => {
			acc[p.outcome] = (acc[p.outcome] || 0) + 1
			return acc
		},
		{} as Record<number, number>
	)

	const getParticipantsByOutcome = (outcome: number) => mockParticipants.filter((p) => p.outcome === outcome)

	const qualifiedProspects = getParticipantsByOutcome(5)
	const payingCustomers = qualifiedProspects.filter((p) => p.stage === "Pay").length
	const activelySolving = qualifiedProspects.filter((p) => p.stage === "Behavior").length

	const renderParticipantCard = (participant: ValidationParticipant, showOutcomeBadge = false) => {
		const initials = participant.name
			.split(" ")
			.map((n) => n[0])
			.join("")

		const isOpportunity = participant.outcome === 5 && participant.validationDetails

		return (
			<Link to={`/prospect/${participant.id}`} key={participant.id}>
				<Card className="group h-full cursor-pointer overflow-hidden border shadow-sm transition-all hover:border-gray-400 hover:shadow-lg dark:border-gray-700 dark:hover:border-gray-500">
					<div
						className={`h-1 ${isOpportunity ? "bg-emerald-500 dark:bg-emerald-600" : "bg-gray-300 dark:bg-gray-600"}`}
					/>

					<CardContent className="p-6">
						<div className="mb-6 flex items-start gap-4">
							<Avatar className="h-14 w-14 flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700">
								<AvatarImage src={`/.jpg?key=lvbvw&height=56&width=56&query=${participant.name}`} />
								<AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 font-semibold text-lg text-white">
									{initials}
								</AvatarFallback>
							</Avatar>

							<div className="min-w-0 flex-1">
								<h3 className="mb-1 font-bold text-foreground text-xl transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
									{participant.name}
								</h3>
								<p className="mb-3 font-medium text-muted-foreground text-sm">{participant.company}</p>

								<div className="flex flex-wrap items-center gap-2">
									{showOutcomeBadge && (
										<Badge
											variant="outline"
											className={`font-semibold text-xs ${outcomeConfig[participant.outcome].color} border-current`}
										>
											{outcomeConfig[participant.outcome].label}
										</Badge>
									)}
									<Badge
										variant="outline"
										className="border-blue-200 bg-blue-50 font-medium text-blue-700 text-xs"
										title={stageDescriptions[participant.stage]}
									>
										{participant.stage}
									</Badge>
								</div>
							</div>

							<ChevronRight className="mt-2 h-6 w-6 flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-blue-600 dark:text-gray-600 dark:group-hover:text-blue-400" />
						</div>

						{isOpportunity ? (
							<div className="space-y-3 border-gray-200 border-t pt-4 dark:border-gray-700">
								<div className="grid gap-3">
									<div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/30">
										<div className="flex-shrink-0">
											<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-700">
												<Flame className="h-4 w-4 text-gray-700 dark:text-gray-300" />
											</div>
										</div>
										<div className="min-w-0 flex-1">
											<div className="mb-1.5 font-semibold text-gray-900 text-xs uppercase tracking-wide dark:text-gray-100">
												Pain Exists
											</div>
											<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
												{participant.validationDetails.painExists}
											</p>
										</div>
									</div>

									<div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/30">
										<div className="flex-shrink-0">
											<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-700">
												<Eye className="h-4 w-4 text-gray-700 dark:text-gray-300" />
											</div>
										</div>
										<div className="min-w-0 flex-1">
											<div className="mb-1.5 font-semibold text-gray-900 text-xs uppercase tracking-wide dark:text-gray-100">
												Awareness
											</div>
											<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
												{participant.validationDetails.awareness}
											</p>
										</div>
									</div>

									<div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/30">
										<div className="flex-shrink-0">
											<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-700">
												<LineChart className="h-4 w-4 text-gray-700 dark:text-gray-300" />
											</div>
										</div>
										<div className="min-w-0 flex-1">
											<div className="mb-1.5 font-semibold text-gray-900 text-xs uppercase tracking-wide dark:text-gray-100">
												Quantified
											</div>
											<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
												{participant.validationDetails.quantified}
											</p>
										</div>
									</div>

									<div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700 dark:bg-gray-800/30">
										<div className="flex-shrink-0">
											<div className="rounded-md bg-gray-100 p-2 dark:bg-gray-700">
												<Rocket className="h-4 w-4 text-gray-700 dark:text-gray-300" />
											</div>
										</div>
										<div className="min-w-0 flex-1">
											<div className="mb-1.5 font-semibold text-gray-900 text-xs uppercase tracking-wide dark:text-gray-100">
												Acting
											</div>
											<p className="text-gray-700 text-sm leading-relaxed dark:text-gray-300">
												{participant.validationDetails.acting}
											</p>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="border-gray-100 border-t-2 pt-4 dark:border-gray-700">
								<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
									<p className="font-medium text-muted-foreground text-sm leading-relaxed">{participant.keyInsight}</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</Link>
		)
	}

	return (
		<div className="space-y-6">
			{/* Goal Card - Enhanced Styling */}
			<Card className="relative overflow-hidden border-2 shadow-sm transition-shadow hover:shadow-md">
				<div className="absolute top-4 right-4 flex gap-2">
					<Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600">
						<Settings className="mr-2 h-4 w-4" />
						Edit
					</Button>
					<Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600">
						<LayoutList className="mr-2 h-4 w-4" />
						Plan
					</Button>
				</div>

				<CardContent className="p-6">
					<div className="mb-6 flex items-start gap-3">
						<div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
							<Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						</div>
						<div className="flex-1">
							<h2 className="mb-2 font-semibold text-foreground text-xl">Goal</h2>
							<p className="text-foreground text-md leading-relaxed">
								Demo: Validate demand for AI-powered project management tool among startup founders and product
								managers.
							</p>
						</div>
					</div>

					<div className="space-y-2 md:max-w-md">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium text-foreground">Interview Progress {progressPercentage}%</span>
							<span className="text-muted-foreground">
								{completedInterviews} of {totalInterviews}
							</span>
						</div>
						<Progress value={progressPercentage} className="h-2" />
					</div>
				</CardContent>
			</Card>

			<div>
				<h2 className="mb-4 font-semibold text-2xl text-foreground">Validation Status</h2>

				<div className="mb-6 flex flex-wrap gap-2">
					{[5, 4, 3, 2, 1].map((outcome) => {
						const config = outcomeConfig[outcome as keyof typeof outcomeConfig]
						const count = outcomeCounts[outcome] || 0
						const isSelected = selectedOutcome === outcome

						return (
							<button
								key={outcome}
								onClick={() => setSelectedOutcome(outcome)}
								className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 font-medium text-sm transition-all ${
									isSelected
										? `${config.color} shadow-md`
										: "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
								} `}
							>
								<span>{config.label}</span>
								<Badge variant="secondary" className={`text-xs ${isSelected ? "bg-white/50 dark:bg-black/20" : ""}`}>
									{count}
								</Badge>
							</button>
						)
					})}
				</div>

				<div className="max-w-7xl">
					{selectedOutcome === 5 && (
						<div className="space-y-6">
							<Card className="border-2 border-emerald-200 bg-emerald-50/30 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20">
								<CardContent className="p-5">
									<div className="flex items-start gap-3">
										<div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
											<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
										</div>
										<div className="flex-1">
											<h3 className="mb-2 font-semibold text-foreground">Opportunity Summary</h3>
											<p className="text-foreground text-md leading-relaxed">
												{qualifiedProspects.length} qualified prospects are actively addressing this problem.{" "}
												{payingCustomers} are already paying for solutions (average $500-2K/mo), and {activelySolving}{" "}
												have built internal tools or workarounds. All prospects have quantified the pain and are
												motivated to find better solutions, indicating strong product-market fit potential.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								{qualifiedProspects.map((participant) => renderParticipantCard(participant))}
							</div>
						</div>
					)}

					{selectedOutcome !== 5 && (
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{getParticipantsByOutcome(selectedOutcome).map((participant) => renderParticipantCard(participant))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
