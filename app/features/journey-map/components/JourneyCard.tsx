/**
 * JourneyCard - Simplified card for the journey map.
 * Entire card is clickable. Shows icon, title, and arrow. Completed cards show a checkmark.
 */

import { Check } from "lucide-react"
import { Link } from "react-router"
import { cn } from "~/lib/utils"
import type { JourneyCardConfig } from "../journey-config"

interface JourneyCardProps {
	card: JourneyCardConfig
	done: boolean
	href: string
	locked?: boolean
}

export function JourneyCard({ card, done, href, locked }: JourneyCardProps) {
	const Icon = card.icon

	const content = (
		<>
			{/* Top accent bar */}
			{done && <div className="absolute top-0 right-0 left-0 h-[3px] bg-emerald-500" />}
			{!done && !locked && (
				<div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-400 opacity-60" />
			)}

			{/* Card content */}
			<div className="flex items-center gap-3">
				<div
					className={cn(
						"flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl",
						done ? "bg-emerald-500/20" : "bg-gradient-to-br from-indigo-500/20 to-violet-500/20"
					)}
				>
					{done ? (
						<Check className="h-4.5 w-4.5 text-emerald-400" strokeWidth={2.5} />
					) : (
						<Icon className="h-4.5 w-4.5 text-violet-400" />
					)}
				</div>

				<div className="min-w-0 flex-1">
					<div
						className={cn(
							"font-medium text-sm leading-tight",
							done && "text-emerald-300/80 line-through decoration-emerald-500/30",
							locked && "text-slate-500"
						)}
					>
						{card.title}
					</div>
				</div>

				{!done && !locked && <span className="flex-shrink-0 font-semibold text-violet-400 text-xs">&rarr;</span>}
			</div>
		</>
	)

	const cardClasses = cn(
		"relative block overflow-hidden rounded-2xl border p-3.5 backdrop-blur-xl transition-all duration-250",
		"border-indigo-500/20 bg-slate-800/90",
		done && "border-emerald-500/30 bg-emerald-500/[0.08] opacity-80",
		!done &&
			!locked &&
			"hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-[0_8px_25px_rgba(0,0,0,0.3),0_0_20px_rgba(99,102,241,0.1)]",
		locked && "pointer-events-none opacity-50"
	)

	if (locked) {
		return <div className={cardClasses}>{content}</div>
	}

	return (
		<Link to={href} className={cardClasses}>
			{content}
		</Link>
	)
}
