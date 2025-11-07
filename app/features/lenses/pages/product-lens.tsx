/**
 * Product Lens - Pain × User Matrix Analysis
 * Aggregates pain points and creates a 2x2 matrix of Pain Intensity vs Willingness to Pay
 */

import { useState } from "react"
import { LoaderFunctionArgs, useLoaderData } from "react-router"
import { userContext } from "~/server/user-context"
import { generatePainMatrix, type PainMatrixCell } from "../services/generatePainMatrix.server"
import { PainMatrixComponent } from "../components/PainMatrix"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const projectId = params.projectId as string

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	try {
		const matrix = await generatePainMatrix({
			supabase: supabase as any,
			projectId,
			minEvidencePerPain: 2,
			minGroupSize: 1,
		})

		return { matrix, projectId }
	} catch (error) {
		console.error("Product Lens loader error:", error)
		throw new Response("Failed to generate pain matrix", { status: 500 })
	}
}

export default function ProductLens() {
	const { matrix } = useLoaderData<typeof loader>()
	const [selectedCell, setSelectedCell] = useState<PainMatrixCell | null>(null)

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
								<MetricDisplay label="Intensity" value={selectedCell.metrics.intensity || "N/A"} />
								<MetricDisplay label="WTP" value={selectedCell.metrics.willingness_to_pay || "N/A"} />
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
