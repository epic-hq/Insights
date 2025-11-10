import StatCard from "./StatCard"

export interface KPI {
	label: string
	value: string | number
	change?: string
	href?: string
	icon?: string
}

interface KPIBarProps {
	kpis: KPI[]
	/** Whether to use compact mode for stat cards (default: true) */
	compact?: boolean
}

export default function KPIBar({ kpis, compact = true }: KPIBarProps) {
	return (
		<div className="sticky top-0 z-10 mb-2 rounded-md bg-gray-50/50 border border-gray-200/50 p-2 shadow-sm dark:bg-gray-800/50 dark:border-gray-700/50">
			<div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
				{kpis.map((kpi) => (
					<StatCard key={kpi.label} {...kpi} compact={compact} />
				))}
			</div>
		</div>
	)
}
