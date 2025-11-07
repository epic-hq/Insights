import type { BantMatrix, BantMatrixCell } from "../services/generateBantMatrix.server"

export interface BantMatrixProps {
	matrix: BantMatrix
	onCellClick?: (cell: BantMatrixCell) => void
}

/**
 * Budget × Authority Matrix for BANT Sales Lens
 */
export function BantMatrixComponent({ matrix, onCellClick }: BantMatrixProps) {
	// Get heat map color based on opportunity count
	const getHeatColor = (count: number): string => {
		if (count === 0) return "bg-muted/30 text-muted-foreground"
		if (count < 3) return "bg-blue-50 hover:bg-blue-100 text-blue-900 cursor-pointer"
		if (count < 5) return "bg-blue-100 hover:bg-blue-200 text-blue-900 cursor-pointer"
		if (count < 10) return "bg-blue-200 hover:bg-blue-300 text-blue-900 cursor-pointer"
		return "bg-blue-300 hover:bg-blue-400 text-blue-900 cursor-pointer font-semibold"
	}

	const formatCurrency = (amount: number): string => {
		if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
		if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
		return `$${amount.toFixed(0)}`
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="font-bold text-2xl">BANT Matrix: Budget × Authority</h2>
				<p className="text-muted-foreground text-sm">
					Opportunity distribution by budget range and decision-maker authority
				</p>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-3 gap-4">
				<div className="rounded-lg border bg-card p-4">
					<div className="text-muted-foreground text-sm">Total Opportunities</div>
					<div className="font-bold text-2xl">{matrix.summary.total_opportunities}</div>
				</div>
				<div className="rounded-lg border bg-card p-4">
					<div className="text-muted-foreground text-sm">Total Pipeline Value</div>
					<div className="font-bold text-2xl">{formatCurrency(matrix.summary.total_value)}</div>
				</div>
				<div className="rounded-lg border bg-card p-4">
					<div className="text-muted-foreground text-sm">Qualified Cells</div>
					<div className="font-bold text-2xl">{matrix.summary.cells_with_data}</div>
				</div>
			</div>

			{/* Matrix Grid */}
			<div className="rounded-lg border bg-card p-4">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr>
								<th className="border-b p-3 text-left text-sm font-semibold">Budget Range</th>
								{matrix.authority_levels.map((level) => (
									<th key={level} className="border-b border-l p-3 text-center text-sm font-semibold">
										{level}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{matrix.budget_buckets.map((budget) => (
								<tr key={budget}>
									<td className="border-b p-3 text-sm font-medium">{budget}</td>
									{matrix.authority_levels.map((authority) => {
										const cell = matrix.cells.find(
											(c) => c.budget_bucket === budget && c.authority_level === authority
										)
										if (!cell) return <td key={authority} className="border-b border-l p-3" />

										const hasData = cell.metrics.opportunity_count > 0

										return (
											<td
												key={authority}
												className={`border-b border-l p-3 transition-colors ${getHeatColor(cell.metrics.opportunity_count)}`}
												onClick={() => hasData && onCellClick?.(cell)}
											>
												{hasData ? (
													<div className="text-center">
														<div className="font-bold text-lg">{cell.metrics.opportunity_count}</div>
														<div className="text-xs">
															{formatCurrency(cell.metrics.avg_deal_size)} avg
														</div>
														<div className="text-xs opacity-70">
															{(cell.metrics.confidence_avg * 100).toFixed(0)}% conf
														</div>
													</div>
												) : (
													<div className="text-center text-sm">—</div>
												)}
											</td>
										)
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Legend */}
			<div className="rounded-lg border bg-muted/30 p-4">
				<h3 className="mb-2 font-semibold text-sm">How to Read This Matrix</h3>
				<ul className="space-y-1 text-sm">
					<li>
						<strong>Rows (Budget):</strong> Deal size range extracted from opportunity amount or BANT budget slot
					</li>
					<li>
						<strong>Columns (Authority):</strong> Decision-making power based on stakeholder influence and role
					</li>
					<li>
						<strong>Cell Value:</strong> Number of opportunities | Average deal size | BANT confidence %
					</li>
					<li>
						<strong>Color Intensity:</strong> Darker blue = more opportunities in this bucket
					</li>
				</ul>
			</div>
		</div>
	)
}
