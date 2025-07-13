import type { ReactNode } from "react"
import type { InsightCardProps } from "./InsightCard"
import { InsightCard } from "./InsightCard"

interface InsightCardGridProps {
	insights?: InsightCardProps[]
	children?: ReactNode
	className?: string
}

export default function InsightCardGrid({ insights, children, className }: InsightCardGridProps) {
	return (
		<div className={`grid gap-6 md:grid-cols-2 ${className ?? ""}`}>
			{insights?.map((insight) => (
				<InsightCard key={insight.tag} {...insight} />
			))}
			{children}
		</div>
	)
}
