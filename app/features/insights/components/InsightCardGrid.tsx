import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import type { InsightView } from "~/types"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import InsightCardV2 from "./InsightCardV2Clean"

interface InsightCardGridProps {
	insights?: InsightView[]
	children?: ReactNode
	className?: string
}

export default function InsightCardGrid({ insights, children, className }: InsightCardGridProps) {
	const { accountId, projectId } = useCurrentProject()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	return (
		<div className={`grid gap-6 md:grid-cols-2 ${className ?? ""}`}>
			{insights?.map((insight) => (
				<Link key={insight.id} to={routes.insights.detail(insight.id)} className="no-underline hover:no-underline">
					<InsightCardV2 insight={insight} />
				</Link>
			))}
			{children}
		</div>
	)
}
