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
		<div className="sticky top-0 z-10 mb-6 rounded-lg bg-white p-4 shadow-md dark:bg-gray-900">
			<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
				{kpis.map((kpi) => (
					<StatCard key={kpi.label} {...kpi} compact={compact} />
				))}
			</div>
		</div>
	)
}
