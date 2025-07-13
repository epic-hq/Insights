import type { CSSProperties } from "react"
import { ResponsiveContainer, Treemap } from "recharts"

// Generic type for heat-map cell data
export type HeatMapDatum = {
	x: string | number
	y: string | number
	value: number
}

export interface HeatMapProps {
	/** 2-D array or flat list of {x,y,value}.  */
	data: HeatMapDatum[]
	/** Optional: pixel height of the chart (defaults ResponsiveContainer height) */
	height?: number
	/** Optional style override for wrapper div */
	style?: CSSProperties
	/** Color range for low / high. */
	colorRange?: [string, string]
}

const interpolateColor = (color1: string, color2: string, factor: number) => {
	const result = color1
		.slice(1)
		.match(/.{2}/g)
		?.map((hex, i) => {
			const color2Slice = color2.slice(1).match(/.{2}/g)
			if (!color2Slice) return hex
			const value1 = Number.parseInt(hex, 16)
			const value2 = Number.parseInt(color2Slice[i], 16)
			const value = Math.round(value1 + factor * (value2 - value1))
				.toString(16)
				.padStart(2, "0")
			return value
		})
		.join("")
	return `#${result}`
}

interface CustomCellProps {
	x?: number
	y?: number
	width?: number
	height?: number
	value?: number
	colorRange: [string, string]
	zDomain: [number, number]
}

const CustomHeatMapCell = (props: CustomCellProps) => {
	const { x, y, width, height, value, colorRange, zDomain } = props

	// Props are injected by Treemap, but we need to satisfy TypeScript
	if (x === undefined || y === undefined || width === undefined || height === undefined || value === undefined) {
		return null
	}

	const factor = (value - zDomain[0]) / (zDomain[1] - zDomain[0])
	const color = interpolateColor(colorRange[0], colorRange[1], factor)

	return (
		<g>
			<rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: "#fff", strokeWidth: 1 }} />
		</g>
	)
}

export default function HeatMap({ data, height = 240, style, colorRange = ["#e0f2fe", "#0284c7"] }: HeatMapProps) {
	const values = data.map((d) => d.value)
	const zDomain: [number, number] = values.length > 0 ? [Math.min(...values), Math.max(...values)] : [0, 0]

	const treeMapData = data.map((d) => ({
		name: `${d.x}/${d.y}`,
		value: d.value,
		size: 1, // Fixed size for equal area cells
	}))

	return (
		<div style={{ width: "100%", height, ...style }}>
			<ResponsiveContainer>
				<Treemap
					data={treeMapData}
					dataKey="size"
					aspectRatio={4 / 3}
					stroke="#fff"
					fill="#8884d8"
					content={<CustomHeatMapCell colorRange={colorRange} zDomain={zDomain} />}
				/>
			</ResponsiveContainer>
		</div>
	)
}
