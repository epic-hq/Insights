import type { CSSProperties } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

export interface PersonaSlice {
	name: string
	value: number
	color: string // hex or tailwind color
}

interface PersonaDonutProps {
	data: PersonaSlice[]
	/** Optional inner label shown in center (e.g., count) */
	centerLabel?: string | number
	/** Height/width square */
	size?: number
	style?: CSSProperties
}

export default function PersonaDonut({ data, centerLabel, size = 160, style }: PersonaDonutProps) {
	return (
		<div style={{ width: size, height: size, position: "relative", ...style }}>
			<ResponsiveContainer>
				<PieChart>
					<Pie
						data={data}
						dataKey="value"
						nameKey="name"
						innerRadius={size * 0.35}
						outerRadius={size * 0.48}
						paddingAngle={2}
						stroke="none"
					>
						{data.map((entry) => (
							<Cell key={`slice-${entry.name}`} fill={entry.color} />
						))}
					</Pie>
					<Tooltip formatter={(v) => `${v}%`} />
				</PieChart>
			</ResponsiveContainer>
			{centerLabel != null && (
				<div className="absolute inset-0 flex items-center justify-center font-semibold text-gray-800 text-xs dark:text-gray-100">
					{centerLabel}
				</div>
			)}

			{/* Legend */}
			<div className="absolute right-0 bottom-0 left-0 mt-2 flex w-full flex-wrap justify-center text-xs">
				{data.map((slice) => (
					<div key={`legend-${slice.name}`} className="mr-2 flex items-center">
						<div className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
						<span className="text-gray-600 dark:text-gray-300">{slice.name}</span>
					</div>
				))}
			</div>
		</div>
	)
}
