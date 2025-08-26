import { Lightbulb, MessageSquare, RefreshCw, Target, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

interface ProjectStatus {
	keyFindings: string[]
	nextSteps: string[]
	totalInsights: number
	totalInterviews: number
	totalOpportunities: number
	totalPeople: number
	totalPersonas: number
	lastUpdated: string
	currentProject?: string
	currentAccount?: string
}

interface AgentStatusDisplayProps {
	agentId?: string
	className?: string
	onRefresh?: () => void
}

export function AgentStatusDisplay({ agentId = "mainAgent", className, onRefresh }: AgentStatusDisplayProps) {
	const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchAgentState = async () => {
		setLoading(true)
		setError(null)

		try {
			// Call Mastra agent state API to get current working memory
			const response = await fetch(`/api/agent-state/${agentId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch agent state: ${response.statusText}`)
			}

			const agentState = await response.json()

			if (agentState.projectStatus) {
				setProjectStatus(agentState.projectStatus)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch agent state")
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchAgentState()
	}, [fetchAgentState])

	const handleRefresh = () => {
		fetchAgentState()
		onRefresh?.()
	}

	if (loading && !projectStatus) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RefreshCw className="h-4 w-4 animate-spin" />
						Loading Project Status...
					</CardTitle>
				</CardHeader>
			</Card>
		)
	}

	if (error && !projectStatus) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="text-destructive">Error Loading Status</CardTitle>
					<CardDescription>{error}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={handleRefresh} variant="outline" size="sm">
						<RefreshCw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				</CardContent>
			</Card>
		)
	}

	if (!projectStatus) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Project Status</CardTitle>
					<CardDescription>No project status available</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={handleRefresh} variant="outline" size="sm">
						<RefreshCw className="mr-2 h-4 w-4" />
						Load Status
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Project Status
						</CardTitle>
						<CardDescription>Last updated: {new Date(projectStatus.lastUpdated).toLocaleString()}</CardDescription>
					</div>
					<Button onClick={handleRefresh} variant="ghost" size="sm" disabled={loading}>
						<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Data Overview */}
				<div>
					<h4 className="mb-3 flex items-center gap-2 font-semibold">
						<Target className="h-4 w-4" />
						Data Overview
					</h4>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
						<div className="text-center">
							<div className="font-bold text-2xl text-blue-600">{projectStatus.totalInsights}</div>
							<div className="text-muted-foreground text-sm">Insights</div>
						</div>
						<div className="text-center">
							<div className="font-bold text-2xl text-green-600">{projectStatus.totalInterviews}</div>
							<div className="text-muted-foreground text-sm">Interviews</div>
						</div>
						<div className="text-center">
							<div className="font-bold text-2xl text-purple-600">{projectStatus.totalOpportunities}</div>
							<div className="text-muted-foreground text-sm">Opportunities</div>
						</div>
						<div className="text-center">
							<div className="font-bold text-2xl text-orange-600">{projectStatus.totalPeople}</div>
							<div className="text-muted-foreground text-sm">People</div>
						</div>
						<div className="text-center">
							<div className="font-bold text-2xl text-pink-600">{projectStatus.totalPersonas}</div>
							<div className="text-muted-foreground text-sm">Personas</div>
						</div>
					</div>
				</div>

				<Separator />

				{/* Key Findings */}
				{projectStatus.keyFindings.length > 0 && (
					<div>
						<h4 className="mb-3 flex items-center gap-2 font-semibold">
							<Lightbulb className="h-4 w-4" />
							Key Findings
						</h4>
						<div className="space-y-2">
							{projectStatus.keyFindings.map((finding, index) => (
								<div key={index} className="flex items-start gap-2">
									<Badge variant="secondary" className="mt-0.5">
										{index + 1}
									</Badge>
									<span className="text-sm">{finding}</span>
								</div>
							))}
						</div>
					</div>
				)}

				<Separator />

				{/* Next Steps */}
				{projectStatus.nextSteps.length > 0 && (
					<div>
						<h4 className="mb-3 flex items-center gap-2 font-semibold">
							<MessageSquare className="h-4 w-4" />
							Recommended Next Steps
						</h4>
						<div className="space-y-2">
							{projectStatus.nextSteps.map((step, index) => (
								<div key={index} className="flex items-start gap-2">
									<Badge variant="outline" className="mt-0.5">
										{index + 1}
									</Badge>
									<span className="text-sm">{step}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Project Context */}
				{(projectStatus.currentProject || projectStatus.currentAccount) && (
					<>
						<Separator />
						<div className="space-y-1 text-muted-foreground text-xs">
							{projectStatus.currentAccount && <div>Account: {projectStatus.currentAccount}</div>}
							{projectStatus.currentProject && <div>Project: {projectStatus.currentProject}</div>}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
