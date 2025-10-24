import { HeartHandshake, Puzzle } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"

type EmpathyMapItem = {
	text: string
	evidenceId: string
	anchors?: unknown
}

type EmpathyMapData = {
	pains: EmpathyMapItem[]
	gains: EmpathyMapItem[]
	says: EmpathyMapItem[]
	does: EmpathyMapItem[]
	thinks: EmpathyMapItem[]
	feels: EmpathyMapItem[]
}

interface EmpathyMapTabsProps {
	empathyMap: EmpathyMapData
	activeTab: "pains-gains" | "user-actions"
	setActiveTab: (tab: "pains-gains" | "user-actions") => void
	createEvidenceLink: (item: { evidenceId: string; anchors?: unknown }) => string
}

function EmpathySection({
	title,
	emoji,
	items,
	createEvidenceLink,
	emptyMessage,
}: {
	title: string
	emoji: string
	items: EmpathyMapItem[]
	createEvidenceLink: (item: EmpathyMapItem) => string
	emptyMessage: string
}) {
	return (
		<div className="rounded-lg border border-gray-200/50 bg-white/50 p-4 dark:border-gray-700/30 dark:bg-black/10">
			<div className="mb-3 flex items-center gap-2">
				<span className="text-lg">{emoji}</span>
				<div className="font-semibold text-foreground">{title}</div>
				<Badge variant="secondary" className="ml-auto text-xs">
					{items.length}
				</Badge>
			</div>
			{items.length === 0 ? (
				<div className="text-muted-foreground text-sm italic">{emptyMessage}</div>
			) : (
				<div className="space-y-2">
					{items.map((item, i) => (
						<Link
							key={`${title.toLowerCase()}-${item.evidenceId}-${i}`}
							to={createEvidenceLink(item)}
							className="block w-full rounded-md bg-black/5 px-3 py-2 text-left text-foreground text-sm hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
						>
							{item.text}
						</Link>
					))}
				</div>
			)}
		</div>
	)
}

export function EmpathyMapTabs({ empathyMap, activeTab, setActiveTab, createEvidenceLink }: EmpathyMapTabsProps) {
	return (
		<div className="w-full">
			{/* Tab Navigation */}
			<div className="mb-6 flex space-x-1 rounded-lg bg-gray-100/50 p-1 dark:bg-gray-900/50">
				<button
					type="button"
					onClick={() => setActiveTab("pains-gains")}
					className={`flex-1 rounded-md px-3 py-2 font-medium text-sm transition-colors ${
						activeTab === "pains-gains"
							? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
							: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<Puzzle className="h-5 w-5 text-accent" />
						<span>Pains & Goals</span>
					</div>
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("user-actions")}
					className={`flex-1 rounded-md px-3 py-2 font-medium text-sm transition-colors ${
						activeTab === "user-actions"
							? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
							: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
					}`}
				>
					<div className="flex items-center justify-center gap-2">
						<HeartHandshake className="h-5 w-5 text-accent" />
						<span>Empathy Map</span>
					</div>
				</button>
			</div>

			{/* Tab Content - Fixed height to prevent layout shift */}
			<div className="grid min-h-[400px] gap-6">
				{activeTab === "pains-gains" && (
					<div className="grid gap-6 md:grid-cols-2">
						<EmpathySection
							title="Pain Points"
							items={empathyMap.pains}
							createEvidenceLink={createEvidenceLink}
							emptyMessage="No pain points identified"
						/>
						<EmpathySection
							title="Goals"
							items={empathyMap.gains}
							createEvidenceLink={createEvidenceLink}
							emptyMessage="No gains identified"
						/>
					</div>
				)}

				{activeTab === "user-actions" && (
					<>
						<div className="grid gap-4 md:grid-cols-2">
							<EmpathySection
								title="Says"
								emoji="💬"
								items={empathyMap.says}
								createEvidenceLink={createEvidenceLink}
								emptyMessage="No quotes captured"
							/>
							<EmpathySection
								title="Does"
								emoji="🏃"
								items={empathyMap.does}
								createEvidenceLink={createEvidenceLink}
								emptyMessage="No actions captured"
							/>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<EmpathySection
								title="Thinks"
								emoji="💭"
								items={empathyMap.thinks}
								createEvidenceLink={createEvidenceLink}
								emptyMessage="No thoughts captured"
							/>
							<EmpathySection
								title="Feels"
								emoji="❤️"
								items={empathyMap.feels}
								createEvidenceLink={createEvidenceLink}
								emptyMessage="No feelings captured"
							/>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
