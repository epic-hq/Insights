import type { CSSProperties } from "react"
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts"

interface RadialProgressProps {
	/** Current value */
	current: number
	/** Target/maximum value */
	target: number
	/** Label to show in center */
	label?: string
	/** Size of the chart */
	size?: number
	/** Custom styling */
	style?: CSSProperties
	/** Color of the progress bar */
	color?: string
}

export default function RadialProgress({
	current,
	target,
	label = "interviews",
	size = 200,
	style,
	color = "#16a34a", // green-600
}: RadialProgressProps) {
	// Create data for the chart
	const chartData = [
		{
			name: "progress",
			value: current,
			fill: color,
		},
	]

	return (
		<div style={{ width: size, height: size / 2 + 40, ...style }}>
			<ResponsiveContainer>
				<RadialBarChart data={chartData} startAngle={180} endAngle={0} innerRadius={80} outerRadius={130} barSize={20}>
					<RadialBar
						dataKey="value"
						background={{ fill: "hsl(var(--muted))" }}
						cornerRadius={5}
						className="stroke-2 stroke-transparent"
						label={false}
						max={target}
					/>
					<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
						<Label
							content={({ viewBox }) => {
								if (viewBox && "cx" in viewBox && "cy" in viewBox) {
									return (
										<text x={viewBox.cx} y={(viewBox.cy || 0) - 16} textAnchor="middle">
											<tspan x={viewBox.cx} y={(viewBox.cy || 0) - 16} className="fill-foreground font-bold text-2xl">
												{current}
											</tspan>
											<tspan x={viewBox.cx} y={(viewBox.cy || 0) + 4} className="fill-muted-foreground">
												{label}
											</tspan>
										</text>
									)
								}
								return null
							}}
						/>
					</PolarRadiusAxis>
				</RadialBarChart>
			</ResponsiveContainer>
		</div>
	)
}
