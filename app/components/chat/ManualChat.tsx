import { ArrowLeft, Bot, Maximize2, Minimize2, Send, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

interface Message {
	id: string
	role: "user" | "assistant"
	content: string
	timestamp: Date
}

interface CopilotChatProps {
	context?: string
	contextData?: Record<string, unknown>
	onClose: () => void
	className?: string
}

export default function CopilotChat({ context = "general", contextData, onClose, className }: CopilotChatProps) {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "assistant",
			content: `Hi! I'm your AI research assistant. I can help you analyze your ${context} data, find patterns, generate insights, and answer questions about your research. What would you like to explore?`,
			timestamp: new Date(),
		},
	])
	const [inputMessage, setInputMessage] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [isMinimized, setIsMinimized] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	useEffect(() => {
		// Focus input when component mounts
		inputRef.current?.focus()
	}, [])

	const getSectionColor = (section: string) => {
		const colorMap: Record<string, string> = {
			general: "bg-indigo-600",
			personas: "bg-blue-600",
			insights: "bg-emerald-600",
			encounters: "bg-amber-600",
			projects: "bg-purple-600",
			research: "bg-rose-600",
			dashboard: "bg-violet-600",
		}
		return colorMap[section] || "bg-indigo-600"
	}

	const getBorderColor = (section: string) => {
		return getSectionColor(section).replace("bg-", "border-")
	}

	const sendMessage = async () => {
		if (!inputMessage.trim() || isLoading) return

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: inputMessage.trim(),
			timestamp: new Date(),
		}

		setMessages((prev) => [...prev, userMessage])
		setInputMessage("")
		setIsLoading(true)

		try {
			// Simulate AI response - replace with actual API call
			setTimeout(
				() => {
					const assistantMessage: Message = {
						id: (Date.now() + 1).toString(),
						role: "assistant",
						content: generateContextualResponse(userMessage.content, context, contextData),
						timestamp: new Date(),
					}
					setMessages((prev) => [...prev, assistantMessage])
					setIsLoading(false)
				},
				1000 + Math.random() * 1000
			)
		} catch {
			// Error handling for message sending
			setIsLoading(false)
		}
	}

	const generateContextualResponse = (_message: string, context: string, _data: Record<string, unknown>): string => {
		// This is a mock response generator - replace with actual AI integration
		const responses = {
			general: [
				"Based on your research data, I can see several interesting patterns. What specific aspect would you like me to analyze further?",
				"I've analyzed your data and found some key insights. Would you like me to break down the findings by category?",
				"Your research shows promising trends. Let me help you identify the most actionable opportunities.",
			],
			personas: [
				"Looking at your persona data, I can identify key behavioral patterns and preferences. Which persona segment interests you most?",
				"Your personas show distinct characteristics. I can help you understand their motivations and pain points better.",
				"Based on the persona analysis, there are clear opportunities for targeted strategies. What would you like to explore?",
			],
			insights: [
				"I've processed your insights and found several recurring themes. Would you like me to prioritize them by impact?",
				"Your insights reveal important user needs and pain points. I can help you connect these to actionable opportunities.",
				"There are interesting correlations in your insight data. Let me help you uncover the most significant patterns.",
			],
		}

		const contextResponses = responses[context as keyof typeof responses] || responses.general
		return contextResponses[Math.floor(Math.random() * contextResponses.length)]
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	}

	return (
		<div className={cn("fixed inset-0 z-50", className)}>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50 lg:hidden" onClick={onClose} />

			{/* Chat Panel */}
			<div
				className={cn(
					"absolute border-gray-700 bg-gray-900 transition-all duration-300",
					// Mobile: bottom panel
					"right-0 bottom-0 left-0 h-1/2 border-t-2",
					// Desktop: right sidebar
					"lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:h-full lg:w-96 lg:border-t-0 lg:border-l-2",
					getBorderColor(context),
					isMinimized && "lg:w-16"
				)}
			>
				{/* Header */}
				<div
					className={cn(
						"flex items-center justify-between border-gray-700 border-b p-4",
						getSectionColor(context),
						"bg-opacity-20"
					)}
				>
					{!isMinimized && (
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<Bot className="h-5 w-5 text-white" />
								<h3 className="font-semibold text-white">AI Copilot</h3>
							</div>
							<div className="mt-1 flex items-center gap-2">
								<Badge variant="secondary" className="text-xs">
									{context.charAt(0).toUpperCase() + context.slice(1)}
								</Badge>
								<span className="text-gray-300 text-xs">{messages.length - 1} messages</span>
							</div>
						</div>
					)}

					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsMinimized(!isMinimized)}
							className="hidden text-gray-400 hover:text-white lg:flex"
						>
							{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
						</Button>
						<Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{!isMinimized && (
					<>
						{/* Messages */}
						<ScrollArea className="h-[calc(100%-8rem)] flex-1">
							<div className="space-y-4 p-4">
								{messages.map((message) => (
									<div
										key={message.id}
										className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
									>
										{message.role === "assistant" && (
											<div
												className={cn(
													"flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
													getSectionColor(context)
												)}
											>
												<Bot className="h-4 w-4 text-white" />
											</div>
										)}

										<div
											className={cn(
												"max-w-[80%] rounded-lg p-3 text-sm",
												message.role === "user" ? "ml-auto bg-indigo-600 text-white" : "bg-gray-800 text-gray-100"
											)}
										>
											<p className="whitespace-pre-wrap">{message.content}</p>
											<p className="mt-2 text-xs opacity-70">
												{message.timestamp.toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</p>
										</div>

										{message.role === "user" && (
											<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-700">
												<User className="h-4 w-4 text-white" />
											</div>
										)}
									</div>
								))}

								{isLoading && (
									<div className="flex gap-3">
										<div
											className={cn(
												"flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
												getSectionColor(context)
											)}
										>
											<Bot className="h-4 w-4 text-white" />
										</div>
										<div className="rounded-lg bg-gray-800 p-3 text-gray-100 text-sm">
											<div className="flex items-center gap-2">
												<div className="flex gap-1">
													<div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
													<div
														className="h-2 w-2 animate-bounce rounded-full bg-gray-500"
														style={{ animationDelay: "0.1s" }}
													/>
													<div
														className="h-2 w-2 animate-bounce rounded-full bg-gray-500"
														style={{ animationDelay: "0.2s" }}
													/>
												</div>
												<span className="text-gray-400 text-xs">AI is thinking...</span>
											</div>
										</div>
									</div>
								)}

								<div ref={messagesEndRef} />
							</div>
						</ScrollArea>

						{/* Input */}
						<div className="border-gray-700 border-t p-4">
							<div className="flex gap-2">
								<Input
									ref={inputRef}
									value={inputMessage}
									onChange={(e) => setInputMessage(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask about your research data..."
									className="flex-1 border-gray-600 bg-gray-800 text-white placeholder:text-gray-400 focus:border-indigo-500"
									disabled={isLoading}
								/>
								<Button
									onClick={sendMessage}
									disabled={!inputMessage.trim() || isLoading}
									size="icon"
									className={cn("shrink-0", getSectionColor(context), "hover:opacity-90")}
								>
									<Send className="h-4 w-4" />
								</Button>
							</div>
							<p className="mt-2 text-gray-500 text-xs">Press Enter to send, Shift+Enter for new line</p>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
