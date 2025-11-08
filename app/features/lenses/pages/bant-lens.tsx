/**
 * BANT Lens - Budget × Authority Matrix Analysis
 * Shows opportunity qualification by budget range and decision-maker authority
 */

import consola from "consola"
import { useState } from "react"
import { type LoaderFunctionArgs, useLoaderData } from "react-router"
import { userContext } from "~/server/user-context"
import { BantMatrixComponent } from "../components/BantMatrix"
import { type BantMatrixCell, generateBantMatrix } from "../services/generateBantMatrix.server"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const projectId = params.projectId as string

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 })
	}

	try {
		const matrix = await generateBantMatrix({
			supabase,
			projectId,
		})

		return { matrix, projectId }
	} catch (error) {
		consola.error("BANT Lens loader error:", error)
		throw new Response("Failed to generate BANT matrix", { status: 500 })
	}
}

export default function BantLens() {
	const { matrix } = useLoaderData<typeof loader>()
	const [selectedCell, setSelectedCell] = useState<BantMatrixCell | null>(null)

	if (!matrix || matrix.summary.total_opportunities === 0) {
		return (
			<div className="space-y-6 p-6">
				<div>
					<h1 className="font-bold text-3xl">BANT Lens</h1>
					<p className="text-muted-foreground">Budget × Authority qualification matrix</p>
				</div>
				<div className="rounded-lg border bg-muted p-6 text-center">
					<p className="text-muted-foreground">
						No BANT data available yet. Create opportunities and run sales lens extraction on interviews.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl">BANT Lens</h1>
					<p className="text-muted-foreground">Budget × Authority matrix to prioritize qualified opportunities</p>
				</div>
			</div>

			{/* BANT Matrix */}
			<BantMatrixComponent matrix={matrix} onCellClick={setSelectedCell} />

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
								<h3 className="font-bold text-lg">
									{selectedCell.budget_bucket} × {selectedCell.authority_level}
								</h3>
								<p className="text-muted-foreground text-sm">{selectedCell.metrics.opportunity_count} opportunities</p>
							</div>
							<button onClick={() => setSelectedCell(null)} className="text-muted-foreground hover:text-foreground">
								✕
							</button>
						</div>

						{/* Cell Metrics */}
						<div className="mb-4 grid grid-cols-2 gap-4">
							<div className="rounded-lg border bg-card p-3">
								<div className="text-muted-foreground text-sm">Avg Deal Size</div>
								<div className="font-bold text-xl">${(selectedCell.metrics.avg_deal_size / 1000).toFixed(0)}K</div>
							</div>
							<div className="rounded-lg border bg-card p-3">
								<div className="text-muted-foreground text-sm">BANT Confidence</div>
								<div className="font-bold text-xl">{(selectedCell.metrics.confidence_avg * 100).toFixed(0)}%</div>
							</div>
						</div>

						{/* Sample Opportunities */}
						<div>
							<h4 className="mb-2 font-semibold text-sm">Sample Opportunities</h4>
							<div className="space-y-2">
								{selectedCell.sample_opportunities.map((opp) => (
									<div key={opp.id} className="rounded-lg border bg-muted/30 p-3">
										<div className="font-medium text-sm">{opp.title}</div>
										<div className="mt-1 flex items-center gap-4 text-muted-foreground text-xs">
											{opp.amount && <span>${(opp.amount / 1000).toFixed(0)}K</span>}
											{opp.stage && <span>• {opp.stage}</span>}
											{opp.close_date && <span>• {new Date(opp.close_date).toLocaleDateString()}</span>}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
