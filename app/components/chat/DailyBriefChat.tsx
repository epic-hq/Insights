import { CopilotSidebar } from "@copilotkit/react-ui"

interface DailyBriefChatProps {
	expandedSection: string | null
}

export function DailyBriefChat({ expandedSection }: DailyBriefChatProps) {
	return (
		<div className="flex h-full flex-col">
			<CopilotSidebar
				instructions={`You are an AI assistant helping analyze ${expandedSection || "dashboard"} data. Help the user understand their project status, personas, questions they're trying to answer through research and interviews.
				You have access to their project data through the mainAgent.
				Ask if you have questions.
				Respond in german.`}
				className="h-full"
			/>
		</div>
	)
}
