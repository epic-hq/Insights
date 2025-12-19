import type { ReactNode } from "react"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { InsightView } from "~/types"
import InsightCardV2 from "./InsightCardV2Clean"

interface InsightCardGridProps {
	insights?: InsightView[]
	comment_counts_by_id?: Record<string, number>
	flags_by_id?: Record<
		string,
		{
			hidden: boolean
			archived: boolean
			starred: boolean
			priority: boolean
		}
	>
	children?: ReactNode
	className?: string
}

export default function InsightCardGrid({ insights, comment_counts_by_id, flags_by_id, children, className }: InsightCardGridProps) {
	const { accountId, projectId } = useCurrentProject()
	const routes = useProjectRoutes(`/a/${accountId}/${projectId}`)

	return (
		<div className={`grid gap-6 md:grid-cols-2 ${className ?? ""}`}>
			{insights?.map((insight) => (
				<InsightCardV2
					key={insight.id}
					insight={insight}
					detail_href={routes.insights.detail(insight.id)}
					comment_count={comment_counts_by_id?.[insight.id] ?? 0}
					prefetched_flags={flags_by_id?.[insight.id]}
				/>
			))}
			{children}
		</div>
	)
}
