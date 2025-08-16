import { CopilotChat } from "@copilotkit/react-ui"
import consola from "consola"
import { useEffect, useState } from "react"
import { useParams } from "react-router"

interface DailyBriefChatProps {
	expandedSection: string | null
}

export function DailyBriefChat({ expandedSection }: DailyBriefChatProps) {
	const params = useParams()
	const [briefContent, setBriefContent] = useState<string>("")
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const fetchDailyBrief = async () => {
			try {
				setIsLoading(true)
				consola.log("🔄 Fetching daily brief for:", {
					accountId: params.accountId,
					projectId: params.projectId,
				})

				// Call workflow via API route instead of direct execution
				const response = await fetch("/api/daily-brief", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						account_id: String(params.accountId ?? ""),
						project_id: String(params.projectId ?? ""),
					}),
				})

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`)
				}

				const result = await response.json()
				consola.log("📊 Daily brief result:", result)

				// Extract the brief text from the response
				const briefText = result?.brief || result?.message || "Daily brief completed successfully"
				setBriefContent(briefText)
			} catch (error) {
				consola.error("💥 Error fetching daily brief:", error)
				setBriefContent("Failed to load daily brief. Please try again.")
			} finally {
				setIsLoading(false)
			}
		}

		if (params.accountId && params.projectId) {
			fetchDailyBrief()
		}
	}, [params.accountId, params.projectId])

	const _initialMessages = briefContent
		? [
				{
					role: "assistant" as const,
					content: isLoading
						? "Loading your daily brief..."
						: `**Daily Brief**\n\n${briefContent}\n\nHow can I help you analyze this ${expandedSection} data further?`,
				},
			]
		: []

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-gray-500">Loading daily brief...</div>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto bg-gray-50 p-4">
				<div className="rounded-lg bg-white p-4 shadow-sm">
					<h3 className="mb-3 font-semibold text-gray-900">Daily Brief</h3>
					<div className="prose prose-sm max-w-none">
						{briefContent.split("\n").map((line, index) => (
							<p key={index} className="mb-2 text-gray-700">
								{line}
							</p>
						))}
					</div>
				</div>
			</div>
			<div className="border-t bg-white p-4">
				<CopilotChat instructions={`Help analyze ${expandedSection} data. The daily brief has been loaded above.`} />
			</div>
		</div>
	)
}
