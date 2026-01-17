import { Calendar, CreditCard, ExternalLink, Mic, Sparkles, TrendingUp, Users, Zap } from "lucide-react"
import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { PLANS } from "~/config/plans"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"

type PlanKey = keyof typeof PLANS

type UsageSummaryRow = {
	feature_source: string
	event_count: number
	total_tokens: number
	total_cost_usd: number
	total_credits: number
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)

	// Get account info
	const { data: membership } = await supabase
		.from("account_members")
		.select("account_id, role, accounts(name, metadata)")
		.eq("user_id", user.sub)
		.single()

	const accountId = membership?.account_id

	// TODO: Get actual plan from billing provider
	// For now, everyone is on free tier
	const currentPlan: PlanKey = "free"

	// Get monthly usage summary from billing schema
	let usageSummary: UsageSummaryRow[] = []
	let totalAiEvents = 0
	let totalVoiceMinutes = 0
	let totalCredits = 0

	if (accountId) {
		const { data: usageData } = await supabase.rpc("get_monthly_usage_summary", {
			p_account_id: accountId,
		})

		if (usageData) {
			usageSummary = usageData as UsageSummaryRow[]
			// Calculate totals from usage summary
			for (const row of usageSummary) {
				totalCredits += row.total_credits
				// Count AI analysis events (non-voice sources)
				if (row.feature_source !== "voice_chat") {
					totalAiEvents += row.event_count
				}
			}
		}

		// Get voice minutes from entitlements
		const { data: voiceEntitlement } = await supabase.rpc("get_active_entitlement", {
			p_account_id: accountId,
			p_feature_key: "voice_chat",
		})

		if (voiceEntitlement && voiceEntitlement.length > 0) {
			totalVoiceMinutes = voiceEntitlement[0].quantity_used ?? 0
		}
	}

	// Map to the usage object structure
	const usage = {
		ai_analyses: totalAiEvents,
		voice_minutes: totalVoiceMinutes,
		survey_responses: 0, // TODO: count from surveys table
	}

	return {
		currentPlan,
		usage,
		usageSummary,
		totalCredits,
		accountName: (membership?.accounts as { name?: string })?.name ?? "Your Account",
		renewalDate: null as string | null, // TODO: Get from billing provider
	}
}

function formatFeatureSource(source: string): string {
	const labels: Record<string, string> = {
		interview_analysis: "Interview Analysis",
		project_status_agent: "Project Status Agent",
		voice_chat: "Voice Chat",
		survey_analysis: "Survey Analysis",
		lens_analysis: "Lens Analysis",
		chat_completion: "Chat Messages",
	}
	return labels[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function BillingPage() {
	const { currentPlan, usage, usageSummary, totalCredits, accountName, renewalDate } = useLoaderData<typeof loader>()
	const plan = PLANS[currentPlan]
	const limits = plan.limits

	// Calculate usage percentages
	const analysisPercent =
		limits.ai_analyses === Number.POSITIVE_INFINITY ? 0 : (usage.ai_analyses / limits.ai_analyses) * 100
	const voicePercent = limits.voice_minutes === 0 ? 0 : (usage.voice_minutes / limits.voice_minutes) * 100
	const surveyPercent = (usage.survey_responses / limits.survey_responses) * 100

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="font-semibold text-3xl">Billing & Usage</h1>
				<p className="text-muted-foreground">Manage your plan and track usage for {accountName}.</p>
			</div>

			{/* Current Plan Card */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							Current Plan
							<Badge variant={currentPlan === "free" ? "secondary" : "default"}>{plan.name}</Badge>
						</CardTitle>
						<CardDescription>
							{currentPlan === "free" ? (
								"You're on the free tier. Upgrade to unlock more features."
							) : renewalDate ? (
								<>Next billing date: {renewalDate}</>
							) : (
								"Active subscription"
							)}
						</CardDescription>
					</div>
					<div className="text-right">
						<div className="font-bold text-3xl">
							${plan.price.monthly}
							{plan.price.monthly > 0 && <span className="font-normal text-muted-foreground text-sm">/mo</span>}
						</div>
						{plan.perUser && <p className="text-muted-foreground text-sm">per user</p>}
					</div>
				</CardHeader>
				<CardFooter className="flex gap-3">
					{currentPlan === "free" ? (
						<Button asChild>
							<Link to="/pricing">Upgrade Plan</Link>
						</Button>
					) : (
						<>
							<Button variant="outline" asChild>
								<a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
									<CreditCard className="mr-2 h-4 w-4" />
									Manage Billing
									<ExternalLink className="ml-2 h-3 w-3" />
								</a>
							</Button>
							<Button variant="ghost" asChild>
								<Link to="/pricing">Change Plan</Link>
							</Button>
						</>
					)}
				</CardFooter>
			</Card>

			{/* Usage Stats */}
			<div className="grid gap-6 md:grid-cols-3">
				{/* AI Analyses */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<Sparkles className="h-4 w-4 text-amber-500" />
							AI Analyses
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl">{usage.ai_analyses}</span>
								<span className="text-muted-foreground text-sm">
									{limits.ai_analyses === Number.POSITIVE_INFINITY ? "Unlimited" : `of ${limits.ai_analyses}`}
								</span>
							</div>
							{limits.ai_analyses !== Number.POSITIVE_INFINITY && <Progress value={analysisPercent} className="h-2" />}
							{limits.ai_analyses === Number.POSITIVE_INFINITY && (
								<p className="text-muted-foreground text-xs">Unlimited on your plan</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Voice Minutes */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<Mic className="h-4 w-4 text-blue-500" />
							Voice Chat
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl">{usage.voice_minutes}</span>
								<span className="text-muted-foreground text-sm">
									{limits.voice_minutes === 0 ? "Not included" : `of ${limits.voice_minutes} min`}
								</span>
							</div>
							{limits.voice_minutes > 0 ? (
								<Progress value={voicePercent} className="h-2" />
							) : (
								<p className="text-muted-foreground text-xs">
									<Link to="/pricing" className="text-primary underline underline-offset-2">
										Upgrade
									</Link>{" "}
									to unlock voice chat
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Survey Responses */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<TrendingUp className="h-4 w-4 text-green-500" />
							Survey Responses
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="flex items-baseline justify-between">
								<span className="font-bold text-2xl">{usage.survey_responses}</span>
								<span className="text-muted-foreground text-sm">of {limits.survey_responses}</span>
							</div>
							<Progress value={surveyPercent} className="h-2" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Usage Breakdown */}
			{usageSummary.length > 0 && (
				<>
					<Separator />
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-xl">Usage This Month</h2>
							<Badge variant="secondary" className="gap-1">
								<Zap className="h-3 w-3" />
								{totalCredits} credits used
							</Badge>
						</div>
						<Card>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Feature</TableHead>
										<TableHead className="text-right">Events</TableHead>
										<TableHead className="text-right">Tokens</TableHead>
										<TableHead className="text-right">Cost (USD)</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{usageSummary.map((row) => (
										<TableRow key={row.feature_source}>
											<TableCell className="font-medium">{formatFeatureSource(row.feature_source)}</TableCell>
											<TableCell className="text-right">{(row.event_count ?? 0).toLocaleString()}</TableCell>
											<TableCell className="text-right">{(row.total_tokens ?? 0).toLocaleString()}</TableCell>
											<TableCell className="text-right">${(row.total_cost_usd ?? 0).toFixed(4)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</Card>
					</div>
				</>
			)}

			<Separator />

			{/* Plan Comparison */}
			<div className="space-y-4">
				<h2 className="font-semibold text-xl">Compare Plans</h2>
				<div className="grid gap-4 md:grid-cols-4">
					{(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, p]) => (
						<Card key={key} className={key === currentPlan ? "border-primary ring-1 ring-primary" : ""}>
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">{p.name}</CardTitle>
									{key === currentPlan && <Badge variant="outline">Current</Badge>}
								</div>
								<CardDescription>
									${p.price.monthly}
									{p.price.monthly > 0 && "/mo"}
									{p.perUser && " per user"}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">AI Analyses</span>
									<span>{p.limits.ai_analyses === Number.POSITIVE_INFINITY ? "Unlimited" : p.limits.ai_analyses}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Voice Chat</span>
									<span>{p.limits.voice_minutes === 0 ? "—" : `${p.limits.voice_minutes} min`}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Surveys</span>
									<span>{p.limits.survey_responses.toLocaleString()}</span>
								</div>
							</CardContent>
							<CardFooter>
								{key === currentPlan ? (
									<Button variant="outline" className="w-full" disabled>
										Current Plan
									</Button>
								) : key === "team" ? (
									<Button variant="outline" className="w-full" asChild>
										<a href="https://cal.com/rickmoy" target="_blank" rel="noopener noreferrer">
											<Users className="mr-2 h-4 w-4" />
											Contact Sales
										</a>
									</Button>
								) : (
									<Button variant={key === "pro" ? "default" : "outline"} className="w-full" asChild>
										<Link to={`/sign-up?plan=${key}`}>{currentPlan === "free" ? "Upgrade" : "Switch"}</Link>
									</Button>
								)}
							</CardFooter>
						</Card>
					))}
				</div>
			</div>

			{/* Help Section */}
			<Card className="bg-muted/50">
				<CardContent className="flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
					<div>
						<h3 className="font-semibold">Need help choosing a plan?</h3>
						<p className="text-muted-foreground text-sm">Talk to our team to find the best fit for your needs.</p>
					</div>
					<Button variant="outline" asChild>
						<a href="https://cal.com/rickmoy" target="_blank" rel="noopener noreferrer">
							<Calendar className="mr-2 h-4 w-4" />
							Schedule a Call
						</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
