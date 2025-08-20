import { useCoAgent } from "@copilotkit/react-core"
import { CopilotSidebar as BaseCopilotSidebar } from "@copilotkit/react-ui"
import "@copilotkit/react-ui/styles.css"
import { X } from "lucide-react"
import { useEffect } from "react"
import { Button } from "~/components/ui/button"

interface CopilotSidebarProps {
	expandedSection?: string | null
	onClose?: () => void
	className?: string
	projectData?: {
		projectName?: string
		personas?: any[]
		insights?: any[]
		interviews?: any[]
		opportunities?: any[]
		people?: any[]
		projectStatusData?: any
	}
}

export function CopilotSidebar({ expandedSection, onClose, className, projectData }: CopilotSidebarProps) {
	// Connect to the mainAgent from Mastra with enhanced state
	const { state, setState } = useCoAgent({
		name: "mainAgent",
		initialState: {
			plan: [],
			projectStatus: {
				keyFindings: [],
				nextSteps: [],
				totalInsights: 0,
				totalInterviews: 0,
				totalOpportunities: 0,
				totalPeople: 0,
				totalPersonas: 0,
				projectName: undefined,
				currentPhase: undefined,
				progressPercent: 0,
				must_do: undefined,
			},
		},
	})

	// Update agent state when project data changes
	useEffect(() => {
		if (projectData) {
			setState(prev => ({
				...prev,
				projectStatus: {
					...prev.projectStatus,
					totalInsights: projectData.insights?.length || 0,
					totalInterviews: projectData.interviews?.length || 0,
					totalOpportunities: projectData.opportunities?.length || 0,
					totalPeople: projectData.people?.length || 0,
					totalPersonas: projectData.personas?.length || 0,
					projectName: projectData.projectName,
					currentPhase: projectData.projectStatusData?.currentPhase || "Research",
					progressPercent: projectData.projectStatusData?.progressPercent || 0,
					lastUpdated: new Date().toISOString(),
				}
			}))
		}
	}, [projectData])

	const sectionContext = expandedSection 
		? `currently viewing the ${expandedSection} section of their dashboard`
		: `viewing the main dashboard`

	const projectStatusSummary = state.projectStatus ? `
PROJECT STATUS:
- Project: ${state.projectStatus.projectName || 'Current Project'}
- Phase: ${state.projectStatus.currentPhase || 'Research'}
- Progress: ${state.projectStatus.progressPercent || 0}%
- Insights: ${state.projectStatus.totalInsights}
- Interviews: ${state.projectStatus.totalInterviews}
- Opportunities: ${state.projectStatus.totalOpportunities}
- People: ${state.projectStatus.totalPeople}
- Personas: ${state.projectStatus.totalPersonas}
${state.projectStatus.must_do ? `- MUST DO: ${state.projectStatus.must_do}` : ''}
` : ''

	const instructions = `You are an expert business analyst and user research consultant helping analyze project data.

CONTEXT: The user is ${sectionContext}.
${projectStatusSummary}

YOUR ROLE:
- Help users understand their project insights, interviews, personas, and opportunities
- Provide actionable recommendations based on data patterns  
- Identify key findings and suggest next steps
- Answer questions about their research data and project status
- Track and highlight critical "must do" items that need immediate attention

CAPABILITIES:
- You have access to search through all project data via the upsight_search tool
- You can analyze patterns in insights (high-impact items, categories, trends)
- You can review interview data for recency and coverage
- You can assess opportunities for prioritization
- You maintain project status information in your working memory
- You can identify and track critical tasks as "must_do" items

COMMUNICATION STYLE:
- Be concise and actionable
- Focus on data-driven insights
- Provide specific next steps when possible
- Ask clarifying questions to better help the user
- Use clear, business-friendly language
- Highlight critical "must do" items prominently

When the user asks about their project, use your tools to gather comprehensive data and provide meaningful analysis. Always consider the current project phase and progress when making recommendations.`

	return (
		<div className={`relative h-full ${className || ""}`}>
			{onClose && (
				<div className="absolute top-2 right-2 z-10">
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6 text-gray-500 hover:text-gray-700"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
			)}
			<BaseCopilotSidebar
				instructions={instructions}
				className="h-full"
				defaultOpen={true}
			/>
		</div>
	)
}