import type { ReactNode } from "react"
import { Link } from "react-router-dom"
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
				<Link 
					key={insight.id || insight.tag} 
					to={`/insights/${insight.id}`} 
					className="no-underline hover:no-underline"
				>
					<InsightCard {...insight} />
				</Link>
			))}
			{children}
		</div>
	)
}
