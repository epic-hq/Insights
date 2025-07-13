import type { CSSProperties } from "react"
import { ResponsiveContainer, Tooltip, Treemap } from "recharts"

export interface TreeNode {
	name: string
	value: number
	fill: string
	children?: TreeNode[]
	// For internal use
	displayName?: string
	displayPercentage?: string
	[key: string]: unknown
}

interface TreeMapProps {
	data?: TreeNode[] // root-level nodes array
	/** By default width 100% & height 300 */
	height?: number
	style?: CSSProperties
	onClick?: (node: TreeNode) => void
}

// Helper function to calculate percentage with 0 decimal places
const calculatePercentage = (value: number, total: number): string => {
	return `${Math.round((value / total) * 100)}%`
}

// Process data to prepare for display
const processData = (data: TreeNode[], totalValue: number): TreeNode[] => {
	return data.map((node) => {
		// Calculate percentage
		const percentage = calculatePercentage(node.value, totalValue)

		// Create a new node with display properties
		const newNode: TreeNode = {
			...node,
			// Store original name and percentage for display
			displayName: node.name,
			displayPercentage: percentage,
			// Format name to include both name and percentage on separate lines
			name: `${node.name}\n${percentage}`,
		}

		// Process children recursively if they exist
		if (node.children && node.children.length > 0) {
			const childrenTotal = node.children.reduce((sum, child) => sum + child.value, 0)
			newNode.children = processData(node.children, childrenTotal)
		}

		return newNode
	})
}

/*
 * Simple wrapper around Recharts <Treemap /> to visualize hierarchical theme dominance.
 * Supports proportional areas & nested drill-down. When a node has `children`, Treemap groups them.
 * Now displays percentages in the node labels on separate lines.
 */
export default function TreeMap({ data, height = 300, style, onClick }: TreeMapProps) {
	// Use the data or empty array
	const rawData = data ?? []

	// Calculate total value for percentage calculations
	const totalValue = rawData.reduce((sum, node) => sum + node.value, 0)

	// Process data to include percentage information
	const processedData = processData(rawData, totalValue)

	return (
		<div style={{ width: "100%", height, ...style }}>
			<ResponsiveContainer>
				<Treemap
					data={[
						{
							name: "root",
							value: totalValue,
							children: processedData,
						},
					]}
					dataKey="value"
					nameKey="name"
					stroke="#fff"
					animationDuration={400}
					onClick={(node) => {
						if (onClick && node) {
							// The node from recharts' onClick doesn't include all our custom properties.
							// We need to find the original node in our processed data to pass to the callback.
							const findNode = (nodes: TreeNode[], name: string): TreeNode | undefined => {
								for (const n of nodes) {
									if (n.name === name) return n
									if (n.children) {
										const found = findNode(n.children, name)
										if (found) return found
									}
								}
								return undefined
							}
							const originalNode = findNode(processedData, node.name)
							if (originalNode) {
								onClick(originalNode)
							}
						}
					}}
					isAnimationActive={true}
				>
					<Tooltip formatter={(value: number) => [`${value} (${calculatePercentage(value, totalValue)})`, "Value"]} />
				</Treemap>
			</ResponsiveContainer>
		</div>
	)
}
