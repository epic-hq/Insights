import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Textarea } from "~/components/ui/textarea"
import { Mic, MicOff, Play, Pause, MessageSquare, Lightbulb, Users } from "lucide-react"
import { QuestionWidget, type Question } from "~/components/questions/QuestionWidget"

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
	const [questions, setQuestions] = useState<Question[]>([])
	const [isRecording, setIsRecording] = useState(false)
	const [captions, setCaptions] = useState<string[]>([])
	const [currentCaption, setCurrentCaption] = useState("")
	const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
	const [interviewNotes, setInterviewNotes] = useState("")
	
	// Mock project data - in real app, fetch from project
	const [projectData, setProjectData] = useState({
		target_orgs: ["Tech Startups", "SaaS Companies"],
		target_roles: ["Product Managers", "Engineering Leaders"],
		research_goal: "Understand leadership challenges in remote teams",
		research_goal_details: "How do leaders maintain team cohesion and productivity in distributed environments?",
		assumptions: ["Remote work creates communication gaps", "Leaders struggle with visibility"],
		unknowns: ["What tools are most effective?", "How do different team sizes affect leadership?"]
	})

	const handleQuestionStatusChange = useCallback((questionId: string, status: Question["status"]) => {
		// In real app, save to backend
		console.log(`Question ${questionId} marked as ${status}`)
		
		// Generate AI suggestion based on status
		if (status === "answered") {
			const suggestion: AISuggestion = {
				id: `suggestion_${Date.now()}`,
				type: "follow_up",
				text: "Great answer! Consider asking: 'Can you give me a specific example of when this happened?'",
				confidence: 0.85,
				timestamp: new Date()
			}
			setAiSuggestions(prev => [suggestion, ...prev.slice(0, 4)]) // Keep last 5
		}
	}, [])

	const toggleRecording = useCallback(() => {
		setIsRecording(prev => !prev)
		if (!isRecording) {
			// Start recording simulation
			const interval = setInterval(() => {
				const mockCaptions = [
					"So in our team, we've been struggling with...",
					"The main challenge is that people feel disconnected...",
					"We tried using Slack but it's not the same as being in person...",
					"I think the biggest issue is trust and accountability..."
				]
				const randomCaption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)]
				setCurrentCaption(randomCaption)
				
				// Add to captions history
				setCaptions(prev => [randomCaption, ...prev.slice(0, 9)]) // Keep last 10
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

	const generateAISuggestion = useCallback(() => {
		const suggestions = [
			{
				type: "probe_deeper" as const,
				text: "Ask them to elaborate on the specific tools they mentioned. What works and what doesn't?",
				confidence: 0.92
			},
			{
				type: "follow_up" as const,
				text: "This sounds like a communication issue. Ask about their current meeting cadence.",
				confidence: 0.78
			},
			{
				type: "redirect" as const,
				text: "They're focusing on tools, but consider asking about team culture and relationships.",
				confidence: 0.85
			}
		]
		
		const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
		const newSuggestion: AISuggestion = {
			id: `suggestion_${Date.now()}`,
			...randomSuggestion,
			timestamp: new Date()
		}
		
		setAiSuggestions(prev => [newSuggestion, ...prev.slice(0, 4)])
	}, [])

	const getSuggestionIcon = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up": return <MessageSquare className="h-4 w-4" />
			case "probe_deeper": return <Lightbulb className="h-4 w-4" />
			case "redirect": return <Users className="h-4 w-4" />
			case "wrap_up": return <Play className="h-4 w-4" />
		}
	}

	const getSuggestionColor = (type: AISuggestion["type"]) => {
		switch (type) {
			case "follow_up": return "bg-blue-100 text-blue-800"
			case "probe_deeper": return "bg-purple-100 text-purple-800"
			case "redirect": return "bg-orange-100 text-orange-800"
			case "wrap_up": return "bg-green-100 text-green-800"
		}
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-screen p-6">
			{/* Left Side - Questions */}
			<div className="space-y-4 overflow-y-auto">
				<QuestionWidget
					questions={questions}
					onQuestionsChange={setQuestions}
					target_orgs={projectData.target_orgs}
					target_roles={projectData.target_roles}
					research_goal={projectData.research_goal}
					research_goal_details={projectData.research_goal_details}
					assumptions={projectData.assumptions}
					unknowns={projectData.unknowns}
					mode="realtime"
					showGenerateButton={true}
					showCustomQuestions={true}
					maxQuestions={10}
					onQuestionStatusChange={handleQuestionStatusChange}
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
						<Button
							onClick={toggleRecording}
							variant={isRecording ? "destructive" : "default"}
							className="w-full"
						>
							{isRecording ? (
								<>
									<Pause className="h-4 w-4 mr-2" />
									Stop Recording
								</>
							) : (
								<>
									<Play className="h-4 w-4 mr-2" />
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
							<div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400 mb-3">
								<p className="text-sm font-medium text-blue-900">{currentCaption}</p>
							</div>
						)}
						<div className="space-y-2 max-h-32 overflow-y-auto">
							{captions.map((caption, index) => (
								<p key={index} className="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
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
									<div className="flex items-start gap-2 mb-2">
										{getSuggestionIcon(suggestion.type)}
										<Badge variant="outline" className={getSuggestionColor(suggestion.type)}>
											{suggestion.type.replace('_', ' ')}
										</Badge>
										<Badge variant="secondary" className="ml-auto text-xs">
											{Math.round(suggestion.confidence * 100)}%
										</Badge>
									</div>
									<p className="text-sm">{suggestion.text}</p>
									<p className="text-xs text-muted-foreground mt-1">
										{suggestion.timestamp.toLocaleTimeString()}
									</p>
								</CardContent>
							</Card>
						))}
						
						{aiSuggestions.length === 0 && (
							<div className="text-center py-4 text-muted-foreground">
								<Lightbulb className="h-6 w-6 mx-auto mb-2 opacity-50" />
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
