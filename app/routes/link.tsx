import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ExternalLink, FileText, MessageSquare, Presentation } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

const RESOURCE_LINKS = [
	{
		title: "KYC Presentation",
		description: "Know Your Customer slides and framework",
		icon: Presentation,
		url: "#kyc-slides",
		type: "slides" as const,
	},
	{
		title: "Research Guide",
		description: "Best practices for user research",
		icon: FileText,
		url: "#research-guide",
		type: "document" as const,
	},
	{
		title: "Lead Magnet",
		description: "Download our comprehensive research toolkit",
		icon: ExternalLink,
		url: "#lead-magnet",
		type: "download" as const,
	},
]

export default function LinkPage() {
	const [input, setInput] = useState("")
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({
			api: "http://localhost:4111/chat/web-lead",
		}),
		initialMessages: [
			{
				id: "welcome",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: "Hello! 👋 Welcome to UpSight. I'm here to help you understand how our customer insights platform can transform the way you understand your users. Whether you're looking to find product-market fit faster, identify your ideal customer profiles, or make data-driven decisions, I'm here to guide you. What brings you here today?",
					},
				],
			},
		],
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (!input.trim()) return
		sendMessage({ text: input })
		setInput("")
	}
	return (
		<div className="flex h-screen flex-col bg-background md:flex-row">
			{/* Sidebar */}
			<aside className="w-full border-b bg-muted/30 md:w-80 md:border-r md:border-b-0">
				<div className="flex h-full flex-col">
					<div className="border-b p-6">
						<h1 className="font-bold text-2xl">Welcome!</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Explore our resources and chat with our AI assistant to get started.
						</p>
					</div>

					<ScrollArea className="flex-1 p-6">
						<div className="space-y-4">
							<h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">Resources</h2>
							{RESOURCE_LINKS.map((resource) => {
								const Icon = resource.icon
								return (
									<Card key={resource.title} className="transition-shadow hover:shadow-md">
										<CardHeader className="pb-3">
											<div className="flex items-start gap-3">
												<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
													<Icon className="h-5 w-5 text-primary" />
												</div>
												<div className="flex-1">
													<CardTitle className="text-base">{resource.title}</CardTitle>
													<CardDescription className="mt-1 text-xs">{resource.description}</CardDescription>
												</div>
											</div>
										</CardHeader>
										<CardContent className="pt-0">
											<Button asChild variant="outline" size="sm" className="w-full">
												<a href={resource.url} target="_blank" rel="noopener noreferrer">
													View Resource
													<ExternalLink className="ml-2 h-3 w-3" />
												</a>
											</Button>
										</CardContent>
									</Card>
								)
							})}
						</div>

						<div className="mt-8">
							<h2 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wider">Quick Links</h2>
							<div className="space-y-2">
								<Button variant="ghost" className="w-full justify-start" asChild>
									<a href="/login">Sign In</a>
								</Button>
								<Button variant="ghost" className="w-full justify-start" asChild>
									<a href="/register">Create Account</a>
								</Button>
								<Button variant="ghost" className="w-full justify-start" asChild>
									<a href="/home">Go to Dashboard</a>
								</Button>
							</div>
						</div>
					</ScrollArea>
				</div>
			</aside>

			{/* Main Chat Area */}
			<main className="flex min-h-0 flex-1 flex-col">
				<div className="border-b p-6">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
							<MessageSquare className="h-6 w-6 text-primary" />
						</div>
						<div>
							<h2 className="font-semibold text-xl">UpSight Assistant</h2>
						</div>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto p-6">
					<div className="mx-auto max-w-3xl space-y-4">
						{messages.map((message) => {
							// Extract text from AI SDK v5 parts format
							const textContent =
								message.parts
									?.filter((part: any) => part.type === "text")
									.map((part: any) => part.text)
									.join("") || ""

							return (
								<div
									key={message.id}
									className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
								>
									{message.role === "assistant" && (
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
											<MessageSquare className="h-4 w-4 text-primary" />
										</div>
									)}
									<div
										className={cn(
											"max-w-[80%] rounded-lg px-4 py-3",
											message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
										)}
									>
										<p className="whitespace-pre-wrap text-sm">{textContent}</p>
									</div>
									{message.role === "user" && (
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
											<span className="font-semibold text-primary-foreground text-xs">You</span>
										</div>
									)}
								</div>
							)
						})}
						{status === "streaming" && (
							<div className="flex gap-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
									<MessageSquare className="h-4 w-4 animate-pulse text-primary" />
								</div>
								<div className="max-w-[80%] rounded-lg bg-muted px-4 py-3">
									<div className="flex items-center gap-2">
										<div className="flex gap-1">
											<div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0s]" />
											<div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
											<div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
										</div>
										<span className="text-muted-foreground text-sm">Thinking...</span>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Input Area */}
				<div className="border-t bg-muted/30 p-6">
					<div className="mx-auto max-w-3xl">
						<form onSubmit={handleSubmit} className="flex gap-2">
							<Input
								placeholder="Ask about UpSight and customer research..."
								value={input}
								onChange={(e) => setInput(e.target.value)}
								disabled={status === "streaming"}
								className="flex-1"
							/>
							<Button type="submit" disabled={status === "streaming" || !input.trim()}>
								Send
							</Button>
						</form>
						<p className="mt-2 text-muted-foreground text-xs">Press Enter to send, Shift+Enter for new line</p>
					</div>
				</div>
			</main>
		</div>
	)
}
