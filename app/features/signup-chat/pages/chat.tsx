// CopilotKit removed

// CopilotKit UI removed
import {
	ChevronDown,
	ChevronUp,
	Edit3,
	Eye,
	EyeOff,
	Lightbulb,
	MessageCircle,
	MessageSquare,
	Mic,
	Plus,
	Search,
	Send,
	Settings,
	ThumbsUp,
	Upload,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import type { z } from "zod"
import type { AgentState as AgentStateSchema } from "@/mastra/agents"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Textarea } from "~/components/ui/textarea"
import { getInsights } from "~/features/insights/db"
import { getProjects } from "~/features/projects/db"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"
import type { Insight, Project } from "~/types"
import { PlanCard } from "../components/PlanCard"

type PainPoint = {
	id: string
	name: string
	emotion: string
	emotionEmoji: string
	emotionColor: string
	desiredOutcome: string
	evidence: string
	category: string
	upvotes: number
	isHidden: boolean
	annotations: string[]
	originalInsight: Insight
}

type AgentState = z.infer<typeof AgentStateSchema>

// Transform insights data into pain points format
function transformInsightsToPainPoints(insights: Insight[]) {
	const emotionMap: Record<string, { emoji: string; color: string }> = {
		frustrated: { emoji: "😤", color: "bg-red-100 text-red-800" },
		betrayed: { emoji: "😠", color: "bg-orange-100 text-orange-800" },
		angry: { emoji: "😡", color: "bg-red-200 text-red-900" },
		overwhelmed: { emoji: "😵‍💫", color: "bg-purple-100 text-purple-800" },
		disappointed: { emoji: "😞", color: "bg-blue-100 text-blue-800" },
		confused: { emoji: "😕", color: "bg-yellow-100 text-yellow-800" },
		neutral: { emoji: "😐", color: "bg-gray-100 text-gray-800" },
	}

	return insights.map((insight) => {
		const emotion = insight.emotional_response || "neutral"
		const emotionData = emotionMap[emotion] || emotionMap.neutral

		return {
			id: insight.id,
			name: insight.name || "Untitled Insight",
			emotion,
			emotionEmoji: emotionData.emoji,
			emotionColor: emotionData.color,
			desiredOutcome: insight.desired_outcome || "Improve experience",
			evidence: insight.evidence || "No evidence provided",
			category: insight.category || "General",
			upvotes: 0, // No upvotes in schema; set to 0 or remove if not needed
			isHidden: false,
			annotations: insight.pain ? [insight.pain] : [],
			originalInsight: insight,
		}
	})
}

// Transform project sections into AI suggestions
function transformProjectSectionsToSuggestions(
	projectSections: Array<{ title?: string; content?: string; id: string }>
) {
	const typeMap = ["insight", "question", "opportunity"]

	return projectSections.slice(0, 5).map((section, index) => ({
		id: index + 1,
		type: typeMap[index % typeMap.length],
		title: section.title || `AI Suggestion ${index + 1}`,
		description: section.content || "AI-generated recommendation based on your data.",
		relatedPainIds: [Math.floor(Math.random() * 4) + 1], // Random for now
		originalSection: section,
	}))
}

// Loader function to fetch real data
export async function loader({ request, params }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)

	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { client: supabase } = getServerClient(request)
	const accountId = user.sub
	const projectId = params.projectId || "default-project"

	try {
		// Fetch insights and projects data
		const [insightsResult, projectsResult] = await Promise.all([
			getInsights({ supabase, accountId, projectId }),
			getProjects({ supabase, accountId }),
		])

		// Fetch project sections (simplified for now)
		const { data: projectSections } = await supabase
			.from("project_sections")
			.select("id, title, content, kind")
			.eq("project_id", projectId)
			.limit(10)

		return {
			insights: insightsResult.data || [],
			projects: projectsResult.data || [],
			projectSections: projectSections || [],
		}
	} catch (_error) {
		// Log error for debugging
		return {
			insights: [],
			projects: [],
			projectSections: [],
		}
	}
}

const chatMessages = [
	{
		id: 1,
		sender: "ai",
		message:
			"I noticed a pattern in your recent interviews - mobile performance issues appear in 75% of pain points. Would you like me to analyze this further?",
		timestamp: "2m ago",
	},
	{
		id: 2,
		sender: "user",
		message: "Yes, what specific mobile issues are most critical?",
		timestamp: "1m ago",
	},
	{
		id: 3,
		sender: "ai",
		message:
			"The top 3 mobile issues are: 1) Search functionality (40% abandon rate), 2) App crashes during peak hours, 3) Complex checkout flow. I recommend prioritizing search improvements first.",
		timestamp: "30s ago",
	},
]

export function MobileInsightsApp() {
	const loaderData = useLoaderData<{
		insights: Insight[]
		projects: Project[]
		projectSections: Array<{ title?: string; content?: string; id: string; kind?: string }>
	}>()
	const [selectedPain, setSelectedPain] = useState<PainPoint | null>(null)
	const [showCapture, setShowCapture] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [captureStep, setCaptureStep] = useState(1)
	const [_captureMode, setCaptureMode] = useState("")
	const [searchQuery, setSearchQuery] = useState("")
	const [newMessage, setNewMessage] = useState("")
	const [showSuggestions, setShowSuggestions] = useState(true)
	const [activeFilter, setActiveFilter] = useState("all") // "all", "upvoted", "hidden"

	// Transform real data into UI format
	const [painPoints, setPainPoints] = useState<PainPoint[]>(() =>
		transformInsightsToPainPoints(loaderData?.insights || [])
	)
	const [aiSuggestions] = useState(() => transformProjectSectionsToSuggestions(loaderData?.projectSections || []))

	// 🪁 Shared State: https://docs.copilotkit.ai/coagents/shared-state
	const { state, setState } = useCoAgent<AgentState>({
		name: "weatherAgent",
		initialState: {
			goal: ["Make it work"],
			plan: ["research", "build", "test", "deploy", "celebrate"],
			questions: [
				"What's the best way to get to know someone?",
				"What questions should I ask to build a deeper connection with someone?",
				"What's the most interesting thing you've learned about someone recently?",
			],
		},
	})

	//🪁 Generative UI: https://docs.copilotkit.ai/coagents/generative-ui
	useCopilotAction({
		name: "planTool",
		description: "Update the plan based on user's goal and questions.",
		available: "frontend",
		parameters: [
			{ name: "plan", type: "string[]", required: true },
			{ name: "goal", type: "string", required: true },
		],
		render: ({ args }) => {
			return <PlanCard plan={args.plan} goal={args.goal} />
		},
	})

	// Update pain points when insights data changes
	useEffect(() => {
		if (loaderData?.insights) {
			setPainPoints(transformInsightsToPainPoints(loaderData.insights))
		}
	}, [loaderData?.insights])

	// Research configuration
	const [researchConfig, setResearchConfig] = useState({
		goal: "Understand user frustrations with our checkout process",
		keyQuestions: [
			"What causes users to abandon their cart?",
			"How do mobile vs desktop experiences differ?",
			"What would make the process feel more trustworthy?",
		],
		backgroundKnowledge: "E-commerce platform with 2M monthly users, 65% mobile traffic, current conversion rate 2.3%",
	})

	const [painPointsState, setPainPointsState] = useState<PainPoint[]>(painPoints)
	const [_draggedCard, _setDraggedCardd] = useState<PainPoint | null>(null)
	const [_dragOffset, _setDragOffsett] = useState(0)

	const [_captureData, setCaptureData] = useState({
		struggle: "",
		emotion: "",
		outcome: "",
		blocking: "",
		firstStep: "",
	})

	const _captureQuestions = [
		{ key: "struggle", question: "What's the biggest struggle you're facing right now?" },
		{ key: "emotion", question: "How does that make you feel?", type: "emotion" },
		{ key: "outcome", question: "What outcome would solve this for you?" },
		{ key: "blocking", question: "What's blocking you from achieving it today?" },
		{ key: "firstStep", question: "If a guide appeared, what first step would you want from them?" },
	]

	const _emotions = [
		{ name: "frustrated", emoji: "😤", color: "bg-red-100 text-red-800" },
		{ name: "anxious", emoji: "😰", color: "bg-yellow-100 text-yellow-800" },
		{ name: "angry", emoji: "😡", color: "bg-red-200 text-red-900" },
		{ name: "confused", emoji: "😕", color: "bg-orange-100 text-orange-800" },
		{ name: "disappointed", emoji: "😞", color: "bg-blue-100 text-blue-800" },
		{ name: "overwhelmed", emoji: "😵‍💫", color: "bg-purple-100 text-purple-800" },
		{ name: "betrayed", emoji: "😠", color: "bg-orange-100 text-orange-800" },
		{ name: "hopeful", emoji: "🤞", color: "bg-green-100 text-green-800" },
	]

	const filteredPainPoints = painPointsState.filter((pain) => {
		// Apply search filter
		const matchesSearch =
			pain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			pain.category.toLowerCase().includes(searchQuery.toLowerCase())

		// Apply status filter
		let matchesFilter = true
		if (activeFilter === "upvoted") {
			matchesFilter = pain.upvotes > 0
		} else if (activeFilter === "hidden") {
			matchesFilter = pain.isHidden
		} else if (activeFilter === "all") {
			matchesFilter = !pain.isHidden
		}

		return matchesSearch && matchesFilter
	})

	const handleSwipe = (painId: string, direction: "left" | "right") => {
		setPainPointsState((prev) =>
			prev.map((pain) => {
				if (pain.id === painId) {
					if (direction === "right") {
						return { ...pain, upvotes: pain.upvotes + 1 }
					}
					if (direction === "left") {
						return { ...pain, isHidden: true }
					}
				}
				return pain
			})
		)
	}

	const handleCardClick = (pain: PainPoint) => {
		setSelectedPain(pain)
	}

	const sendMessage = () => {
		// Add message logic here if needed
		setNewMessage("")
	}

	const _handleCaptureNext = () => {
		if (captureStep < 5) {
			setCaptureStep(captureStep + 1)
		} else {
			setShowCapture(false)
			setCaptureStep(1)
			setCaptureMode("")
			setCaptureData({
				struggle: "",
				emotion: "",
				outcome: "",
				blocking: "",
				firstStep: "",
			})
		}
	}

	return (
		<CopilotSidebar>
			<div className="flex bg-gray-50">
				{/* Left Panel - Insights (Narrower) */}
				<div className="flex w-1/3 flex-col border-r bg-white">
					{/* Header */}
					<div className="border-b p-4">
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
									<Eye className="h-3 w-3 text-white" />
								</div>
								<h1 className="font-bold text-gray-900 text-lg">Insights</h1>
							</div>
							<Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
								<Settings className="h-4 w-4" />
							</Button>
						</div>

						{/* Search */}
						<div className="relative">
							<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
							<Input
								placeholder="Search insights..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 pl-10"
							/>
						</div>

						{/* Filter Bar */}
						<div className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1">
							{[
								{ key: "all", label: "All", count: painPointsState.filter((p) => !p.isHidden).length },
								// Upvoted filter is disabled as upvotes are not in schema
								// {
								// 	key: "upvoted",
								// 	label: "Upvoted",
								// 	count: painPointsState.filter((p) => p.upvotes > 0 && !p.isHidden).length,
								// },
								{ key: "hidden", label: "Hidden", count: painPointsState.filter((p) => p.isHidden).length },
							].map(({ key, label, count }) => (
								<Button
									key={key}
									variant={activeFilter === key ? "default" : "ghost"}
									size="sm"
									onClick={() => setActiveFilter(key)}
									className={`h-7 flex-1 text-xs ${activeFilter === key ? "bg-white shadow-sm" : ""}`}
								>
									{label} ({count})
								</Button>
							))}
						</div>
					</div>

					{/* Pain Points List */}
					<ScrollArea className="flex-1 overflow-y-auto p-4">
						<div className="space-y-3">
							{filteredPainPoints.map((pain) => (
								<Card
									key={pain.id}
									className="group relative cursor-pointer bg-white transition-all hover:shadow-sm"
									onClick={() => handleCardClick(pain)}
								>
									<CardContent className="p-3">
										{/* Swipe indicators */}
										<div className="absolute inset-0 flex">
											<div className="flex w-1/2 items-center justify-start bg-green-100 pl-4 opacity-0 transition-opacity group-hover:opacity-20">
												<ThumbsUp className="h-4 w-4 text-green-600" />
											</div>
											<div className="flex w-1/2 items-center justify-end bg-red-100 pr-4 opacity-0 transition-opacity group-hover:opacity-20">
												<EyeOff className="h-4 w-4 text-red-600" />
											</div>
										</div>

										{/* Content */}
										<div className="relative z-10">
											<div className="mb-2 flex items-start justify-between">
												<h3 className="line-clamp-2 flex-1 pr-2 font-medium text-gray-900 text-sm">{pain.name}</h3>
												<div className="flex flex-shrink-0 items-center gap-1">
													<span className="text-lg">{pain.emotionEmoji}</span>
													{/* No upvotes in schema; remove or show static */}
												</div>
											</div>

											<p className="mb-2 line-clamp-1 text-gray-600 text-xs">{pain.evidence}</p>

											<div className="flex items-center justify-between">
												<Badge variant="outline" className="h-5 text-xs">
													{pain.category}
												</Badge>
												<div className="flex gap-1">
													{pain.annotations.length > 0 && <Edit3 className="h-3 w-3 text-gray-400" />}
													<MessageCircle className="h-3 w-3 text-gray-400" />
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>

					{/* Add Button */}
					<div className="border-t p-4">
						<Button className="h-9 w-full" onClick={() => setShowCapture(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Interview
						</Button>
					</div>
				</div>

				{/* Right Panel - AI Chat */}

				<div className="flex flex-1 flex-col bg-white">
					<PlanCard plan={state.plan} goal={state.goal} />

					{/* AI Suggestions Header */}
					<div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
						<div className="p-4">
							<div className="mb-3 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Lightbulb className="h-5 w-5 text-blue-600" />
									<h2 className="font-semibold text-gray-900">AI Insights</h2>
								</div>
								<Button variant="ghost" size="sm" onClick={() => setShowSuggestions(!showSuggestions)}>
									{showSuggestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
								</Button>
							</div>

							{showSuggestions && (
								<div className="space-y-2">
									{aiSuggestions.map((suggestion) => (
										<Card key={suggestion.id} className="border-blue-200 bg-white/80">
											<CardContent className="p-3">
												<div className="flex items-start gap-2">
													<div
														className={`mt-2 h-2 w-2 rounded-full ${
															suggestion.type === "insight"
																? "bg-blue-500"
																: suggestion.type === "question"
																	? "bg-orange-500"
																	: "bg-green-500"
														}`}
													/>
													<div className="flex-1">
														<h4 className="mb-1 font-medium text-gray-900 text-sm">{suggestion.title}</h4>
														<p className="text-gray-600 text-xs">{suggestion.description}</p>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Chat Messages */}
					<div className="flex-1 overflow-y-auto p-4">
						<div className="space-y-4">
							{chatMessages.map((msg) => (
								<div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
									<div
										className={`max-w-[80%] rounded-lg p-3 ${
											msg.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
										}`}
									>
										<p className="text-sm">{msg.message}</p>
										<p className={`mt-1 text-xs ${msg.sender === "user" ? "text-blue-100" : "text-gray-500"}`}>
											{msg.timestamp}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Chat Input */}

					<CopilotChat />

					<div className="hidden border-t p-4">
						<div className="flex gap-2">
							<Input
								placeholder="Ask AI about your insights..."
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								onKeyPress={(e) => e.key === "Enter" && sendMessage()}
								className="flex-1"
							/>
							<Button size="icon" onClick={sendMessage}>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>

				{/* Settings Dialog */}
				<Dialog open={showSettings} onOpenChange={setShowSettings}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Research Configuration</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label className="font-medium text-sm">Research Goal</Label>
								<Textarea
									value={researchConfig.goal}
									onChange={(e) => setResearchConfig({ ...researchConfig, goal: e.target.value })}
									className="mt-1"
									rows={2}
								/>
							</div>

							<div>
								<Label className="font-medium text-sm">Key Questions</Label>
								<Textarea
									value={researchConfig.keyQuestions.join("\n")}
									onChange={(e) =>
										setResearchConfig({
											...researchConfig,
											keyQuestions: e.target.value.split("\n").filter((q) => q.trim()),
										})
									}
									className="mt-1"
									rows={3}
									placeholder="One question per line"
								/>
							</div>

							<div>
								<Label className="font-medium text-sm">Background Knowledge</Label>
								<Textarea
									value={researchConfig.backgroundKnowledge}
									onChange={(e) => setResearchConfig({ ...researchConfig, backgroundKnowledge: e.target.value })}
									className="mt-1"
									rows={3}
								/>
							</div>

							<Button className="w-full">Save Configuration</Button>
						</div>
					</DialogContent>
				</Dialog>

				{/* Pain Point Detail Modal */}
				<Dialog open={!!selectedPain} onOpenChange={() => setSelectedPain(null)}>
					<DialogContent className="max-w-md">
						{selectedPain && (
							<>
								<DialogHeader>
									<DialogTitle className="pr-8 text-left">{selectedPain.name}</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div className="rounded-lg bg-gray-50 p-4">
										<div className="mb-3 flex items-center gap-3">
											<span className="text-2xl">{selectedPain.emotionEmoji}</span>
											<div>
												<Badge className={selectedPain.emotionColor}>{selectedPain.emotion}</Badge>
												<p className="mt-1 text-gray-500 text-xs">{selectedPain.category}</p>
											</div>
										</div>
										<p className="font-medium text-gray-800 text-sm">{selectedPain.desiredOutcome}</p>
									</div>

									<div>
										<h4 className="mb-2 font-medium">Evidence</h4>
										<p className="text-gray-600 text-sm">{selectedPain.evidence}</p>
									</div>

									{selectedPain.annotations.length > 0 && (
										<div>
											<h4 className="mb-2 font-medium">Annotations</h4>
											<div className="space-y-1">
												{selectedPain.annotations.map((annotation) => (
													<p key={annotation} className="rounded bg-yellow-50 p-2 text-gray-600 text-sm">
														{annotation}
													</p>
												))}
											</div>
										</div>
									)}

									<div className="flex gap-2 border-t pt-4">
										<Button
											variant="outline"
											className="flex-1 bg-transparent"
											onClick={() => handleSwipe(selectedPain.id, "right")}
										>
											<ThumbsUp className="mr-2 h-4 w-4" />
											Upvote
										</Button>
										<Button
											variant="outline"
											className="flex-1 bg-transparent"
											onClick={() => handleSwipe(selectedPain.id, "left")}
										>
											<EyeOff className="mr-2 h-4 w-4" />
											Hide
										</Button>
									</div>
								</div>
							</>
						)}
					</DialogContent>
				</Dialog>

				{/* Capture Modal - Simplified */}
				<Dialog open={showCapture} onOpenChange={setShowCapture}>
					<DialogContent className="mx-auto max-w-sm">
						<DialogHeader>
							<DialogTitle>Add Interview Data</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<div className="grid grid-cols-3 gap-2">
								<Button variant="outline" className="flex h-20 flex-col gap-2 bg-transparent">
									<Upload className="h-5 w-5" />
									<span className="text-xs">Upload</span>
								</Button>
								<Button variant="outline" className="flex h-20 flex-col gap-2 bg-transparent">
									<Mic className="h-5 w-5" />
									<span className="text-xs">Record</span>
								</Button>
								<Button variant="outline" className="flex h-20 flex-col gap-2 bg-transparent">
									<MessageSquare className="h-5 w-5" />
									<span className="text-xs">Manual</span>
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</CopilotSidebar>
	)
}

export default function Index() {
	return <MobileInsightsApp />
}
