/**
 * SimpleBANT - Streamable BANT scorecard
 *
 * Simplified version that works with useObject streaming
 */

import { motion } from "framer-motion"
import { Clock, DollarSign, Target, TrendingUp, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { cn } from "~/lib/utils"

export interface SimpleBANTData {
	budget?: { score: number; note?: string }
	authority?: { score: number; note?: string }
	need?: { score: number; note?: string }
	timeline?: { score: number; note?: string }
	overall?: number
}

interface SimpleBANTProps {
	data: SimpleBANTData
	isStreaming?: boolean
}

const FACETS = [
	{
		key: "budget",
		label: "Budget",
		icon: DollarSign,
		color: "text-emerald-500",
	},
	{ key: "authority", label: "Authority", icon: User, color: "text-blue-500" },
	{ key: "need", label: "Need", icon: Target, color: "text-orange-500" },
	{ key: "timeline", label: "Timeline", icon: Clock, color: "text-purple-500" },
] as const

export function SimpleBANT({ data, isStreaming }: SimpleBANTProps) {
	const overall = data.overall ?? 0
	const temp = overall >= 70 ? "Hot" : overall >= 40 ? "Warm" : "Cold"

	return (
		<div className="space-y-4">
			{/* Overall Score */}
			<Card className={cn("border-2", isStreaming && "animate-pulse")}>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center justify-between">
						<span className="flex items-center gap-2 text-base">
							<TrendingUp className="h-4 w-4" />
							BANT Score
						</span>
						<span className="font-bold text-2xl">{overall}</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Progress value={overall} className="h-2" />
					<p className="mt-1 text-muted-foreground text-xs">
						{temp} Deal {isStreaming && "- Analyzing..."}
					</p>
				</CardContent>
			</Card>

			{/* Facets */}
			<div className="grid grid-cols-2 gap-3">
				{FACETS.map(({ key, label, icon: Icon, color }) => {
					const facet = data[key]
					const score = facet?.score ?? 0

					return (
						<motion.div
							key={key}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="rounded-lg border bg-card p-3"
						>
							<div className="mb-2 flex items-center justify-between">
								<span className="flex items-center gap-1.5 font-medium text-sm">
									<Icon className={cn("h-4 w-4", color)} />
									{label}
								</span>
								<span className="font-semibold text-sm">{score}</span>
							</div>
							<Progress value={score} className="h-1.5" />
							{facet?.note && <p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs">{facet.note}</p>}
						</motion.div>
					)
				})}
			</div>
		</div>
	)
}
