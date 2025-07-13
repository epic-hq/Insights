import type { TreeNode } from "../charts/TreeMap"
import TreeMap from "../charts/TreeMap"

export interface ThemeHeatMapProps {
	data: TreeNode[]
	height?: number
	className?: string
}

export default function ThemeHeatMap({ data, height, className }: ThemeHeatMapProps) {
	return (
		<div className={`rounded-lg border bg-white p-4 dark:bg-gray-900 ${className ?? ""}`}>
			<h4 className="mb-2 font-semibold text-sm">Theme Dominance</h4>
			<TreeMap data={data} height={height ?? 300} />
		</div>
	)
}
