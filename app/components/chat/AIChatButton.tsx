import { ArrowLeft, Bot, Send } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"

interface AIChatButtonProps {
	context?: string
}

export default function AIChatButton({ context = "general" }: AIChatButtonProps) {
	const [showChat, setShowChat] = useState(false)
	const [chatMessage, setChatMessage] = useState("")

	const sendMessage = () => {
		if (!chatMessage.trim()) return

		// Here you would implement the actual message sending logic
		console.log("Sending message:", chatMessage)
		setChatMessage("")
	}

	const getSectionColor = (section: string) => {
		const colorMap: Record<string, string> = {
			general: "bg-indigo-600",
			personas: "bg-blue-600",
			insights: "bg-emerald-600",
			encounters: "bg-amber-600",
			projects: "bg-purple-600",
			research: "bg-rose-600",
		}

		return colorMap[section] || "bg-indigo-600"
	}

	return (
		<>
			<button
				className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg bg-indigo-600 text-white transition-all duration-200 hover:scale-[1.02]"
				onClick={() => setShowChat(true)}
			>
				<Bot className="mb-1 h-5 w-5" />
				<span className="font-medium text-xs">AI Chat</span>
			</button>

			{/* Chat sheet */}
			{showChat && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/50" onClick={() => setShowChat(false)} />
					<div
						className={`absolute right-0 bottom-0 left-0 h-1/2 border-t-2 bg-gray-900 ${getSectionColor(context).replace("bg-", "border-")} md:right-0 md:left-auto md:h-full md:w-96 md:border-t-0 md:border-l-2`}
					>
						<div
							className={`flex items-center justify-between border-gray-700 border-b p-4 ${getSectionColor(context)} bg-opacity-20`}
						>
							<div>
								<h3 className="font-semibold text-white">AI Assistant</h3>
								<p className="text-gray-300 text-xs">Context: {context[0].toUpperCase() + context.slice(1)}</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowChat(false)}
								className="text-gray-400 hover:text-white"
							>
								<ArrowLeft className="h-7 w-7 font-semibold" />
							</Button>
						</div>
						<div className="h-full flex-1 overflow-y-auto p-4 pb-20">
							<div className="space-y-3">
								<div className="rounded-lg bg-gray-800 p-3">
									<p className="text-sm">
										Hi! I'm here to help you analyze your {context} data. What would you like to know?
									</p>
								</div>
							</div>
						</div>
						<div className="absolute right-0 bottom-0 left-0 border-gray-700 border-t bg-gray-900 p-4">
							<div className="flex gap-2">
								<Input
									value={chatMessage}
									onChange={(e) => setChatMessage(e.target.value)}
									placeholder="Ask about your research..."
									className="flex-1 border-gray-600 bg-gray-800 text-white"
									onKeyDown={(e) => e.key === "Enter" && sendMessage()}
								/>
								<Button onClick={sendMessage} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
									<Send className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
