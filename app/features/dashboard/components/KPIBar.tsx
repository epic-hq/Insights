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
}

export default function KPIBar({ kpis }: KPIBarProps) {
	return (
		<div className="sticky top-0 z-10 mb-6 rounded-lg bg-white p-4 shadow-md dark:bg-gray-900">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{kpis.map((kpi) => (
					<StatCard key={kpi.label} {...kpi} />
				))}
			</div>
		</div>
	)
}
