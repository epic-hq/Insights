import consola from "consola"
import { Lightbulb, MessageSquare, Mic, MicOff, Pause, Play, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { InterviewQuestionsManager } from "~/components/questions/InterviewQuestionsManager"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Textarea } from "~/components/ui/textarea"
import { createClient } from "~/lib/supabase/client"

interface InterviewCopilotProps {
	projectId: string
	interviewId?: string
}

interface AISuggestion {
	id: string
	type: "follow_up" | "probe_deeper" | "redirect" | "wrap_up"
	text: string
	confidence: number
	timestamp: Date
}

export function InterviewCopilot({ projectId, interviewId }: InterviewCopilotProps) {
	const [selectedQuestions, setSelectedQuestions] = useState<{ id: string; text: string }[]>([])
	const [isRecording, setIsRecording] = useState(false)
	const [captions, setCaptions] = useState<string[]>([])
	const [currentCaption, setCurrentCaption] = useState("")
	const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
	const [interviewNotes, setInterviewNotes] = useState("")
	const supabase = createClient()

	// Save interview notes to database (debounced)
	const saveInterviewNotes = useCallback(
		async (notes: string) => {
			if (!interviewId || !notes.trim()) return
			try {
				const { error } = await supabase
					.from("interviews")
					.update({ observations_and_notes: notes })
					.eq("id", interviewId)

				if (error) {
					consola.error("Error saving interview notes:", error)
				}
			} catch (error) {
				consola.error("Error saving interview notes:", error)
			}
		},
		[interviewId, supabase]
	)

	// Save AI suggestion as annotation
	const saveAISuggestionAsAnnotation = useCallback(
		async (suggestion: AISuggestion) => {
			if (!interviewId) return
			try {
				const { error } = await supabase.from("annotations").insert({
					entity_type: "interview",
					entity_id: interviewId,
					project_id: projectId,
					annotation_type: "ai_suggestion",
					content: suggestion.text,
					metadata: {
						suggestion_type: suggestion.type,
						confidence: suggestion.confidence,
						timestamp: suggestion.timestamp.toISOString(),
					},
					created_by_ai: true,
					ai_model: "copilot",
					status: "active",
					visibility: "team",
				})

				if (error) {
					consola.error("Error saving AI suggestion:", error)
				}
			} catch (error) {
				consola.error("Error saving AI suggestion:", error)
			}
		},
		[interviewId, projectId, supabase]
	)

	// Load existing interview notes
	useEffect(() => {
		const loadInterviewNotes = async () => {
			if (!interviewId) return
			try {
				const { data, error } = await supabase
					.from("interviews")
					.select("observations_and_notes")
					.eq("id", interviewId)
					.single()

				if (error) {
					consola.error("Error loading interview notes:", error)
					return
				}

				if (data?.observations_and_notes) {
					setInterviewNotes(data.observations_and_notes)
				}
			} catch (error) {
				consola.error("Error loading interview notes:", error)
			}
		}

		loadInterviewNotes()
	}, [interviewId, supabase])

	// Debounce notes saving
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (interviewNotes.trim()) {
				saveInterviewNotes(interviewNotes)
			}
		}, 1000) // Save after 1 second of inactivity

		return () => clearTimeout(timeoutId)
	}, [interviewNotes, saveInterviewNotes])

	// Mock project data - in real app, fetch from project
	const [projectData, _setProjectData] = useState({
		target_orgs: ["Tech Startups", "SaaS Companies"],
		target_roles: ["Product Managers", "Engineering Leaders"],
		research_goal: "Understand leadership challenges in remote teams",
		research_goal_details: "How do leaders maintain team cohesion and productivity in distributed environments?",
		assumptions: ["Remote work creates communication gaps", "Leaders struggle with visibility"],
		unknowns: ["What tools are most effective?", "How do different team sizes affect leadership?"],
	})

	const handleQuestionStatusChange = useCallback(
		async (_questionId: string, status: "proposed" | "asked" | "answered" | "skipped") => {
			// Generate AI suggestion based on status
			if (status === "answered") {
				const suggestion: AISuggestion = {
					id: `suggestion_${Date.now()}`,
					type: "follow_up",
					text: "Great answer! Consider asking: 'Can you give me a specific example of when this happened?'",
					confidence: 0.85,
					timestamp: new Date(),
				}
				setAiSuggestions((prev) => [suggestion, ...prev.slice(0, 4)]) // Keep last 5

				// Save AI suggestion as annotation
				await saveAISuggestionAsAnnotation(suggestion)
			}
		},
		[saveAISuggestionAsAnnotation]
	)

	const toggleRecording = useCallback(() => {
		setIsRecording((prev) => !prev)
		if (!isRecording) {
			// Start recording simulation
			const interval = setInterval(() => {
				const mockCaptions = [
					"So in our team, we've been struggling with...",
					"The main challenge is that people feel disconnected...",
					"We tried using Slack but it's not the same as being in person...",
					"I think the biggest issue is trust and accountability...",
				]
				const randomCaption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)]
				setCurrentCaption(randomCaption)

				// Add to captions history
				setCaptions((prev) => [randomCaption, ...prev.slice(0, 9)]) // Keep last 10
			}, 3000)

			// Store interval ID for cleanup
			;(window as any).recordingInterval = interval
		} else {
			// Stop recording
			if ((window as any).recordingInterval) {
				clearInterval((window as any).recordingInterval)
			}
			setCurrentCaption("")
		}
	}, [isRecording])

	const generateAISuggestion = useCallback(async () => {
		const suggestions = [
			{
				type: "probe_deeper" as const,
				text: "Ask them to elaborate on the specific tools they mentioned. What works and what doesn't?",
				confidence: 0.92,
			},
			{
				type: "follow_up" as const,
				text: "This sounds like a communication issue. Ask about their current meeting cadence.",
				confidence: 0.78,
			},
			{
				type: "redirect" as const,
				text: "They're focusing on tools, but consider asking about team culture and relationships.",
				confidence: 0.85,
			},
		]

		const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
		const newSuggestion: AISuggestion = {
			id: `suggestion_${Date.now()}`,
			...randomSuggestion,
			timestamp: new Date(),
		}

		setAiSuggestions((prev) => [newSuggestion, ...prev.slice(0, 4)])

		// Save AI suggestion as annotation
		await saveAISuggestionAsAnnotation(newSuggestion)
	}, [saveAISuggestionAsAnnotation])

	const getSuggestionIcon = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up":
				return <MessageSquare className="h-4 w-4" />
			case "probe_deeper":
				return <Lightbulb className="h-4 w-4" />
			case "redirect":
				return <Users className="h-4 w-4" />
			case "wrap_up":
				return <Play className="h-4 w-4" />
		}
	}

	const getSuggestionColor = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up":
				return "bg-blue-100 text-blue-800"
			case "probe_deeper":
				return "bg-purple-100 text-purple-800"
			case "redirect":
				return "bg-orange-100 text-orange-800"
			case "wrap_up":
				return "bg-green-100 text-green-800"
		}
	}

	return (
		<div className="grid h-screen grid-cols-1 gap-6 p-6 lg:grid-cols-2">
			{/* Left Side - Questions */}
			<div className="space-y-4 overflow-y-auto">
				<InterviewQuestionsManager
					projectId={projectId}
					target_orgs={projectData.target_orgs}
					target_roles={projectData.target_roles}
					research_goal={projectData.research_goal}
					research_goal_details={projectData.research_goal_details}
					assumptions={projectData.assumptions}
					unknowns={projectData.unknowns}
					onSelectedQuestionsChange={setSelectedQuestions}
				/>
			</div>

			{/* Right Side - AI Suggestions & Captions */}
			<div className="space-y-4 overflow-y-auto">
				{/* Recording Controls */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							{isRecording ? <Mic className="h-5 w-5 text-red-500" /> : <MicOff className="h-5 w-5" />}
							Interview Recording
							{isRecording && (
								<Badge variant="destructive" className="ml-auto animate-pulse">
									LIVE
								</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Button onClick={toggleRecording} variant={isRecording ? "destructive" : "default"} className="w-full">
							{isRecording ? (
								<>
									<Pause className="mr-2 h-4 w-4" />
									Stop Recording
								</>
							) : (
								<>
									<Play className="mr-2 h-4 w-4" />
									Start Recording
								</>
							)}
						</Button>
					</CardContent>
				</Card>

				{/* Live Captions */}
				<Card>
					<CardHeader>
						<CardTitle>Live Captions</CardTitle>
					</CardHeader>
					<CardContent>
						{currentCaption && (
							<div className="mb-3 rounded-lg border-blue-400 border-l-4 bg-blue-50 p-3">
								<p className="font-medium text-blue-900 text-sm">{currentCaption}</p>
							</div>
						)}
						<div className="max-h-32 space-y-2 overflow-y-auto">
							{captions.map((caption, index) => (
								<p key={index} className="rounded bg-gray-50 p-2 text-muted-foreground text-xs">
									{caption}
								</p>
							))}
						</div>
					</CardContent>
				</Card>

				{/* AI Suggestions */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span className="flex items-center gap-2">
								<Lightbulb className="h-5 w-5" />
								AI Suggestions
							</span>
							<Button onClick={generateAISuggestion} variant="outline" size="sm">
								Refresh
							</Button>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{aiSuggestions.map((suggestion) => (
							<Card key={suggestion.id} className="border-l-4 border-l-blue-400">
								<CardContent className="p-3">
									<div className="mb-2 flex items-start gap-2">
										{getSuggestionIcon(suggestion.type)}
										<Badge variant="outline" className={getSuggestionColor(suggestion.type)}>
											{suggestion.type.replace("_", " ")}
										</Badge>
										<Badge variant="secondary" className="ml-auto text-xs">
											{Math.round(suggestion.confidence * 100)}%
										</Badge>
									</div>
									<p className="text-sm">{suggestion.text}</p>
									<p className="mt-1 text-muted-foreground text-xs">{suggestion.timestamp.toLocaleTimeString()}</p>
								</CardContent>
							</Card>
						))}

						{aiSuggestions.length === 0 && (
							<div className="py-4 text-center text-muted-foreground">
								<Lightbulb className="mx-auto mb-2 h-6 w-6 opacity-50" />
								<p className="text-sm">AI suggestions will appear here during the interview</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Interview Notes */}
				<Card>
					<CardHeader>
						<CardTitle>Interview Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<Textarea
							placeholder="Jot down key insights, quotes, or observations..."
							value={interviewNotes}
							onChange={(e) => setInterviewNotes(e.target.value)}
							rows={6}
							className="resize-none"
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
