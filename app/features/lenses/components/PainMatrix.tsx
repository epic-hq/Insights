import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import type { PainMatrix, PainMatrixCell } from "../services/generatePainMatrix.server"

export interface PainMatrixProps {
	matrix: PainMatrix
	onCellClick?: (cell: PainMatrixCell) => void
	segments?: Array<{
		kind: string
		label: string
		person_count: number
	}>
	selectedSegmentSlug?: string | null
	onSegmentChange?: (kindSlug: string) => void
}

/**
 * Pain × User Type Matrix Visualization for Product Lens
 * Shows impact scores, frequency, and intensity in a heat map
 */
export function PainMatrixComponent({
	matrix,
	onCellClick,
	segments,
	selectedSegmentSlug,
	onSegmentChange,
}: PainMatrixProps) {
	const [sortBy, setSortBy] = useState<"impact" | "frequency">("impact")
	const [minImpact, setMinImpact] = useState(0)

	// Create lookup map for cells
	const cellLookup = new Map<string, PainMatrixCell>()
	for (const cell of matrix.cells) {
		const key = `${cell.pain_theme_id}::${cell.user_group.name}`
		cellLookup.set(key, cell)
	}

	// Get unique user groups
	const userGroups = matrix.user_groups

	// Sort and filter pain themes based on their max impact across all groups
	const painThemesWithMaxImpact = matrix.pain_themes.map((pain) => {
		// Find max impact score for this pain across all groups
		const cellsForPain = matrix.cells.filter((c) => c.pain_theme_id === pain.id)
		const maxImpact = Math.max(...cellsForPain.map((c) => c.metrics.impact_score), 0)
		const totalAffected = cellsForPain.reduce((sum, c) => sum + c.evidence.person_count, 0)
		return { pain, maxImpact, totalAffected }
	})

	// Filter by minimum impact
	const filteredPainThemes = painThemesWithMaxImpact.filter((p) => p.maxImpact >= minImpact)

	// Sort by selected metric
	const sortedPainThemes = [...filteredPainThemes].sort((a, b) => {
		if (sortBy === "impact") {
			return b.maxImpact - a.maxImpact
		}
		// For frequency, use total affected as proxy
		return b.totalAffected - a.totalAffected
	})

	const painThemes = sortedPainThemes.map((p) => p.pain)

	// Use pre-generated insights from the server (LLM-generated)
	const insights = matrix.insights || "Generating insights from pain matrix data..."

	return (
		<div className="space-y-6">
			{/* Header */}
			{/* <div>
				<h2 className="font-bold text-2xl">Pain × User Type Matrix</h2>
			</div> */}

			{/* Segment Filter Pills */}
			<div className="rounded-lg border bg-card p-4">
				<label className="mb-3 block font-medium text-sm">Filter by Segment</label>
				{segments && onSegmentChange && (
					<div className="flex flex-wrap gap-2">
						{segments
							.filter((s) => s.person_count > 0)
							.map((segment) => (
								<Badge
									key={segment.kind}
									variant={selectedSegmentSlug === segment.kind ? "default" : "outline"}
									className="cursor-pointer transition-colors hover:bg-primary/80"
									onClick={() => onSegmentChange(segment.kind)}
								>
									{segment.label}
									<span className="ml-1.5 text-[10px] opacity-70">({segment.person_count})</span>
								</Badge>
							))}
					</div>
				)}
			</div>

			{/* Key Insights + Controls */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
				{/* AI-Generated Insights */}
				<div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{/* Key Insights */}
						<div>
							<h4 className="mb-2 font-medium text-sm">
								<span>💡</span> Key Insights
							</h4>
							<p className="text-sm leading-relaxed">{insights.split("\n\nTop 3 Actions:")[0] || insights}</p>
						</div>

						{/* Top 3 Actions */}
						<div>
							<h4 className="mb-2 font-medium text-sm">Top 3 Actions</h4>
							<div className="space-y-2">
								{(() => {
									const actionsText = insights.split("\n\nTop 3 Actions:")[1] || ""
									if (!actionsText) return <p className="text-muted-foreground text-sm">No actions available</p>

									const actions = actionsText.split("\n").filter((line) => line.trim())
									return actions.map((action) => (
										<div key={action} className="flex items-start gap-2">
											<span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground text-xs">
												{actions.indexOf(action) + 1}
											</span>
											<p className="text-sm leading-relaxed">{action.replace(/^\d+\.\s*/, "")}</p>
										</div>
									))
								})()}
							</div>
						</div>
					</div>
				</div>

				{/* Controls */}
				<div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
					{/* Sort Control */}
					<div className="flex flex-col gap-2">
						<label className="font-medium text-xs">Sort by:</label>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as "impact" | "frequency")}
							className="rounded border bg-background px-2 py-1 text-sm"
						>
							<option value="impact">Impact Score</option>
							<option value="frequency">Frequency</option>
						</select>
					</div>

					{/* Filter Control */}
					<div className="flex flex-col gap-2">
						<label className="font-medium text-xs">Min Impact:</label>
						<div className="flex items-center gap-2">
							<input
								type="range"
								min="0"
								max="3"
								step="0.1"
								value={minImpact}
								onChange={(e) => setMinImpact(Number.parseFloat(e.target.value))}
								className="flex-1"
							/>
							<span className="w-8 text-right font-medium text-xs">{minImpact.toFixed(1)}</span>
						</div>
						<div className="text-[10px] text-muted-foreground">
							Showing {filteredPainThemes.length} of {matrix.pain_themes.length} pains
						</div>
					</div>
				</div>
			</div>

			{/* Matrix Heat Map */}
			<div className="overflow-x-auto rounded-lg border">
				<table className="w-full">
					<thead className="bg-muted">
						<tr>
							<th className="sticky left-0 z-10 px-4 py-3 text-left font-semibold text-sm">Pain Theme</th>
							{userGroups.map((group) => (
								<th key={group.name} className="px-4 py-3 text-center font-semibold text-sm">
									<div>{group.name}</div>
									<div className="font-normal text-muted-foreground text-xs">
										({group.member_count} {group.member_count === 1 ? "person" : "people"})
									</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{painThemes.map((pain) => (
							<tr key={pain.id} className="border-t hover:bg-muted/50">
								<td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium text-sm">
									<div className="max-w-xs truncate" title={pain.name}>
										{pain.name}
									</div>
									<div className="text-muted-foreground text-xs">{pain.evidence_count} evidence</div>
								</td>
								{userGroups.map((group) => {
									const cell = cellLookup.get(`${pain.id}::${group.name}`)
									return (
										<td key={`${pain.id}::${group.name}`} className="px-2 py-2 text-center">
											{cell ? (
												<MatrixCell cell={cell} onClick={() => onCellClick?.(cell)} />
											) : (
												<div className="text-muted-foreground text-xs">—</div>
											)}
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* How to Interpret - At Bottom */}
			<details className="rounded-lg border bg-muted/50 p-4">
				<summary className="cursor-pointer font-semibold text-sm">📖 How to Interpret This Matrix</summary>
				<div className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
					<div>
						<strong>Impact Score:</strong> Combines (% affected × group size) × intensity × willingness to pay. Adjusted
						for small samples. Higher scores = bigger opportunities.
					</div>
					<div>
						<strong>$ Icon:</strong> Indicates high willingness to pay for a solution
					</div>
					<div>
						<strong>Empty cells (—):</strong> This pain doesn't affect this user segment based on current evidence.
					</div>
					<div>
						<strong>Heat Map Colors:</strong>
						<div className="mt-2 flex flex-wrap gap-2">
							<ColorLegendItem color="rgba(239, 68, 68, 0.3)" label="Critical (2.0+)" />
							<ColorLegendItem color="rgba(249, 115, 22, 0.3)" label="High (1.5-2.0)" />
							<ColorLegendItem color="rgba(234, 179, 8, 0.3)" label="Medium (1.0-1.5)" />
							<ColorLegendItem color="rgba(34, 197, 94, 0.3)" label="Low (0.5-1.0)" />
							<ColorLegendItem color="rgba(148, 163, 184, 0.1)" label="Minimal (<0.5)" />
						</div>
					</div>
				</div>
			</details>
		</div>
	)
}

/**
 * Individual cell in the heat map
 */
function MatrixCell({ cell, onClick }: { cell: PainMatrixCell; onClick?: () => void }) {
	const impactScore = cell.metrics.impact_score
	const frequency = cell.metrics.frequency
	const isHighWTP = cell.metrics.willingness_to_pay === "high"

	// Color intensity based on impact score
	const bgColor = getImpactColor(impactScore)

	return (
		<button
			onClick={onClick}
			className="group relative w-full rounded p-2 transition-all hover:ring-2 hover:ring-primary"
			style={{ backgroundColor: bgColor }}
			title={`${cell.pain_theme_name} × ${cell.user_group.name}\nImpact: ${impactScore.toFixed(2)}\nFrequency: ${Math.round(frequency * 100)}%`}
		>
			<div className="flex flex-col items-center gap-0.5">
				<div className="flex items-center gap-1">
					<div className="font-semibold text-xs">{impactScore.toFixed(1)}</div>
					{isHighWTP && <div className="text-[10px]">💰</div>}
				</div>
				<div className="text-[10px] opacity-75">{Math.round(frequency * 100)}%</div>
			</div>

			{/* Tooltip on hover */}
			<div className="-translate-x-1/2 pointer-events-none absolute top-full left-1/2 z-20 mt-2 hidden w-64 rounded-lg border bg-popover p-3 text-left shadow-lg group-hover:block">
				<div className="mb-2 font-semibold">{cell.pain_theme_name}</div>
				<div className="mb-2 text-muted-foreground text-xs">{cell.user_group.name}</div>
				<div className="space-y-1 text-xs">
					<div>
						<span className="font-medium">Impact:</span> {impactScore.toFixed(2)}
					</div>
					<div>
						<span className="font-medium">Frequency:</span> {Math.round(frequency * 100)}%
					</div>
					<div>
						<span className="font-medium">Intensity:</span> {cell.metrics.intensity}
					</div>
					<div>
						<span className="font-medium">WTP:</span> {cell.metrics.willingness_to_pay}
					</div>
					<div>
						<span className="font-medium">Evidence:</span> {cell.evidence.count} items
					</div>
				</div>
				{cell.evidence.sample_verbatims[0] && (
					<div className="mt-2 border-t pt-2 text-muted-foreground text-xs italic">
						"{cell.evidence.sample_verbatims[0].slice(0, 100)}..."
					</div>
				)}
			</div>
		</button>
	)
}

/**
 * Color legend item
 */
function ColorLegendItem({ color, label }: { color: string; label: string }) {
	return (
		<div className="flex items-center gap-2">
			<div className="h-4 w-8 rounded border" style={{ backgroundColor: color }} />
			<span className="text-xs">{label}</span>
		</div>
	)
}

/**
 * Get background color based on impact score (frequency × group_size × intensity × wtp)
 * Adjusted for small sample sizes where scores typically range 0-3
 */
function getImpactColor(score: number): string {
	if (score >= 2.0) return "rgba(239, 68, 68, 0.3)" // red-500 at 30% - Critical (2.0+)
	if (score >= 1.5) return "rgba(249, 115, 22, 0.3)" // orange-500 at 30% - High (1.5-2.0)
	if (score >= 1.0) return "rgba(234, 179, 8, 0.3)" // yellow-500 at 30% - Medium (1.0-1.5)
	if (score >= 0.5) return "rgba(34, 197, 94, 0.3)" // green-500 at 30% - Low (0.5-1.0)
	return "rgba(148, 163, 184, 0.1)" // slate-400 at 10% - Minimal (<0.5)
}
