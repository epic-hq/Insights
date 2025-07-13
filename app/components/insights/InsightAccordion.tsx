import { useState } from "react"
import type { InsightCardProps } from "./InsightCard"
import InsightCard from "./InsightCard"

interface InsightAccordionProps {
	insights: InsightCardProps[]
	className?: string
}

export default function InsightAccordion({ insights, className }: InsightAccordionProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(0)

	return (
		<div className={className}>
			{insights.map((insight, idx) => {
				const isOpen = openIndex === idx
				return (
					<div key={insight.tag} className="mb-4 overflow-hidden rounded-lg border">
						<button
							type="button"
							className="flex w-full items-center justify-between bg-gray-100 px-4 py-2 font-medium text-sm hover:bg-gray-200 focus:outline-none dark:bg-gray-800 dark:hover:bg-gray-700"
							onClick={() => setOpenIndex(isOpen ? null : idx)}
						>
							<span>{insight.tag}</span>
							<span>{isOpen ? "−" : "+"}</span>
						</button>
						{isOpen && (
							<div className="bg-white p-4 dark:bg-gray-900">
								<InsightCard {...insight} />
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
