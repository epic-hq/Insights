import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { PainMatrixComponent } from "../components/PainMatrix"
import type { PainMatrix, PainMatrixCell } from "../services/generatePainMatrix.server"

export default function ProductLensPage() {
	const { projectId } = useParams()
	const [matrix, setMatrix] = useState<PainMatrix | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedCell, setSelectedCell] = useState<PainMatrixCell | null>(null)

	// Load pain matrix on mount
	useEffect(() => {
		if (!projectId) return

		async function loadMatrix() {
			setLoading(true)
			setError(null)

			try {
				const formData = new FormData()
				formData.append("projectId", projectId!)
				formData.append("minEvidence", "1")
				formData.append("minGroupSize", "1")

				const response = await fetch("/api/test-pain-matrix", {
					method: "POST",
					body: formData,
				})

				const data = await response.json()

				if (!data.success) {
					throw new Error(data.error || "Failed to load pain matrix")
				}

				// Transform API response to PainMatrix type
				const painMatrix: PainMatrix = {
					pain_themes: data.pain_themes,
					user_groups: data.user_groups,
					cells: (data.cells || data.top_cells).map((cell: any) => ({
						pain_theme_id: cell.pain_id || cell.pain,
						pain_theme_name: cell.pain,
						user_group: {
							type: "segment",
							name: cell.user_group,
							member_count: data.user_groups.find((g: any) => g.name === cell.user_group)?.member_count || 0,
							member_ids: [],
							criteria: {},
						},
						metrics: {
							frequency: cell.frequency / 100,
							intensity: cell.intensity,
							intensity_score: cell.intensity_score || 0,
							willingness_to_pay: cell.wtp,
							wtp_score: cell.wtp_score || 0,
							impact_score: cell.impact_score,
						},
						evidence: {
							count: cell.evidence_count,
							sample_verbatims: cell.sample_quote ? [cell.sample_quote] : [],
							person_ids: [],
							person_count: cell.person_count,
						},
					})),
					summary: data.summary,
				}

				setMatrix(painMatrix)
			} catch (err) {
				console.error("Failed to load pain matrix:", err)
				setError(err instanceof Error ? err.message : "Unknown error")
			} finally {
				setLoading(false)
			}
		}

		loadMatrix()
	}, [projectId])

	if (loading) {
		return (
			<div className="flex h-96 items-center justify-center">
				<div className="text-center">
					<div className="mb-2 font-semibold text-lg">Loading Pain Matrix...</div>
					<div className="text-muted-foreground text-sm">Analyzing evidence and user groups</div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-lg border border-destructive bg-destructive/10 p-6">
				<h3 className="mb-2 font-semibold text-destructive">Failed to Load Pain Matrix</h3>
				<p className="text-muted-foreground text-sm">{error}</p>
			</div>
		)
	}

	if (!matrix) {
		return (
			<div className="rounded-lg border bg-muted p-6 text-center">
				<p className="text-muted-foreground">No pain matrix data available</p>
			</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div>
				<h1 className="font-bold text-3xl">Product Lens</h1>
				<p className="text-muted-foreground">Pain × User Type matrix to prioritize product features</p>
			</div>

			{/* Pain Matrix */}
			<PainMatrixComponent matrix={matrix} onCellClick={setSelectedCell} />

			{/* Selected Cell Detail Modal */}
			{selectedCell && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setSelectedCell(null)}
				>
					<div
						className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-6 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-start justify-between">
							<div>
								<h2 className="font-bold text-2xl">{selectedCell.pain_theme_name}</h2>
								<p className="text-muted-foreground">
									{selectedCell.user_group.name} ({selectedCell.user_group.member_count} people)
								</p>
							</div>
							<button onClick={() => setSelectedCell(null)} className="rounded p-2 hover:bg-muted">
								×
							</button>
						</div>

						<div className="space-y-4">
							{/* Metrics */}
							<div className="grid grid-cols-2 gap-4">
								<MetricDisplay label="Impact Score" value={selectedCell.metrics.impact_score.toFixed(2)} />
								<MetricDisplay label="Frequency" value={`${Math.round(selectedCell.metrics.frequency * 100)}%`} />
								<MetricDisplay label="Intensity" value={selectedCell.metrics.intensity} />
								<MetricDisplay label="WTP" value={selectedCell.metrics.willingness_to_pay} />
							</div>

							{/* Evidence */}
							<div>
								<h3 className="mb-2 font-semibold">Evidence</h3>
								<p className="text-muted-foreground text-sm">
									{selectedCell.evidence.count} items from {selectedCell.evidence.person_count} people
								</p>
								<div className="mt-4 space-y-3">
									{selectedCell.evidence.sample_verbatims.map((quote, idx) => (
										<blockquote key={idx} className="border-primary border-l-2 pl-4 italic">
											"{quote}"
										</blockquote>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-2">
								<button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary/90">
									Create Feature Request
								</button>
								<button className="rounded-lg border px-4 py-2 font-semibold text-sm hover:bg-muted">
									View All Evidence
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

function MetricDisplay({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="text-muted-foreground text-sm">{label}</div>
			<div className="mt-1 font-bold text-2xl">{value}</div>
		</div>
	)
}
