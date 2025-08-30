// Plan card component where the plan based on what the agent
// sets via tool calls.

import { Badge } from "~/components/ui/badge"

export function JsonDataCard({ title, jsonData }: { title?: string; jsonData?: Record<string, any> }) {
	// {/* Next Steps Widget */}
	return (
		<div className="m-2 flex flex-col justify-start rounded-md border border-gray-600 p-2">
			<div className="pl-4 font-semibold text-foreground text-sm">{title}</div>
			<div className="flex items-center justify-between border-b pl-4">
				<div className="flex flex-1 items-center gap-2">
					<div className="grid grid-cols-2 gap-2">
						{Object.entries(jsonData || {}).map(([key, value]) => (
							<div key={key} className="">
								<Badge
									variant="outline"
									className={`col-span-1 px-2 py-1 text-xs ${
										value ? "border-slate-500 bg-slate-300 text-slate-600" : "border-gray-300 bg-white text-gray-600"
									}`}
								>
									{key}
								</Badge>
								<div className="col-span-1 ml-2 text-xs text-foreground">{value}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
