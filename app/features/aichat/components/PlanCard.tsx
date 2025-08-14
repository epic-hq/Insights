// Plan card component where the plan based on what the agent
// sets via tool calls.

import { ZoomIn } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"

export function PlanCard({ goal, plan }: { goal?: string; plan?: Record<string, any>[] }) {
	// {/* Next Steps Widget */}
	return (
		<div className="flex flex-col justify-start">
			<div className="pl-4 font-semibold text-green-500 text-sm">Goal: {goal}</div>
			<div className="flex items-center justify-between border-b bg-gray-50 pl-4">
				<div className="flex flex-1 items-center gap-2">
					<span className="font-medium text-gray-700 text-sm">Next Steps:</span>
					<div className="flex flex-1 items-center gap-2">
						{plan?.map((milestone, index) => (
							<div key={index} className="flex items-center">
								<Badge
									variant="outline"
									className={`px-2 py-1 text-xs ${
										milestone.completed
											? "border-blue-500 bg-green-300 text-white"
											: "border-gray-300 bg-white text-gray-600"
									}`}
								>
									{milestone.milestone}
								</Badge>
								{index < plan.length - 1 && <div className="mx-1 h-0.5 w-2 bg-gray-300" />}
							</div>
						))}
					</div>
				</div>
				<Button variant="ghost" size="sm" className="ml-4">
					<ZoomIn className="mr-1 h-4 w-4" />
					Full View
				</Button>
			</div>
		</div>
	)
}
