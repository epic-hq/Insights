import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import type { LensMilestone, LensNextStep, LensObjection } from "~/features/lenses/types"
import { LensEvidenceList } from "./EditableLensContent"

type ExecutionPanelProps = {
	nextSteps?: LensNextStep[]
	mapMilestones?: LensMilestone[]
	objections?: LensObjection[]
	className?: string
}

export function LensExecutionPanel({ nextSteps, mapMilestones, objections, className }: ExecutionPanelProps) {
	const hasNextSteps = (nextSteps?.length ?? 0) > 0
	const hasMilestones = (mapMilestones?.length ?? 0) > 0
	const hasObjections = (objections?.length ?? 0) > 0

	if (!hasNextSteps && !hasMilestones && !hasObjections) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="font-semibold text-base">Revenue execution</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">No next steps or deal risks captured yet.</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="font-semibold text-base">Revenue execution</CardTitle>
				<p className="text-muted-foreground text-sm">
					Mutual action plan, outstanding objections, and next steps surfaced from this interview.
				</p>
			</CardHeader>
			<CardContent className="space-y-6">
				{hasNextSteps ? (
					<section className="space-y-3">
						<header className="flex items-center justify-between">
							<h3 className="font-medium text-foreground text-sm uppercase tracking-wide">Next steps</h3>
							<Badge variant="secondary" className="text-xs">
								{nextSteps?.length}
							</Badge>
						</header>
						<ul className="space-y-4">
							{nextSteps?.map((step) => (
								<li key={step.id} className="rounded-lg border bg-muted/30 p-4">
									<p className="font-semibold text-foreground text-sm">{step.description}</p>
									<div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
										{step.ownerName ? <span>Owner: {step.ownerName}</span> : <span>Owner: Unassigned</span>}
										{step.dueDate ? <span>Due: {step.dueDate}</span> : null}
										{typeof step.confidence === "number" ? (
											<span>Confidence: {Math.round(step.confidence * 100)}%</span>
										) : null}
									</div>
									<div className="mt-3">
										<LensEvidenceList evidence={step.evidence} emptyLabel="No evidence linked to this step yet." />
									</div>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{hasMilestones ? (
					<>
						<Separator />
						<section className="space-y-3">
							<header className="flex items-center justify-between">
								<h3 className="font-medium text-foreground text-sm uppercase tracking-wide">Mutual action plan</h3>
								<Badge variant="secondary" className="text-xs">
									{mapMilestones?.length}
								</Badge>
							</header>
							<ul className="space-y-3">
								{mapMilestones?.map((milestone) => (
									<li key={milestone.id} className="rounded-lg border bg-muted/30 p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="font-semibold text-foreground text-sm">{milestone.label}</p>
											<Badge variant="outline" className="text-[0.65rem] uppercase">
												{milestone.status.replace("_", " ")}
											</Badge>
										</div>
										<div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
											{milestone.ownerName ? <span>Owner: {milestone.ownerName}</span> : null}
											{milestone.dueDate ? <span>Due: {milestone.dueDate}</span> : null}
										</div>
										{milestone.evidence.length > 0 ? (
											<div className="mt-3">
												<LensEvidenceList evidence={milestone.evidence} emptyLabel="Evidence pending" />
											</div>
										) : null}
									</li>
								))}
							</ul>
						</section>
					</>
				) : null}

				{hasObjections ? (
					<>
						<Separator />
						<section className="space-y-3">
							<header className="flex items-center justify-between">
								<h3 className="font-medium text-foreground text-sm uppercase tracking-wide">Objections</h3>
								<Badge variant="secondary" className="text-xs">
									{objections?.length}
								</Badge>
							</header>
							<ul className="space-y-3">
								{objections?.map((objection) => (
									<li key={objection.id} className="rounded-lg border bg-muted/30 p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="font-semibold text-foreground text-sm">{titleCase(objection.type)} objection</p>
											<Badge variant="outline" className="text-[0.65rem] uppercase">
												Status: {objection.status}
											</Badge>
										</div>
										<div className="mt-2 flex flex-wrap gap-3 text-muted-foreground text-xs">
											{typeof objection.confidence === "number" ? (
												<span>Confidence: {Math.round(objection.confidence * 100)}%</span>
											) : null}
											{objection.note ? <span>{objection.note}</span> : null}
										</div>
										<div className="mt-3">
											<LensEvidenceList evidence={objection.evidence} emptyLabel="Evidence pending" />
										</div>
									</li>
								))}
							</ul>
						</section>
					</>
				) : null}
			</CardContent>
		</Card>
	)
}

function titleCase(value: string) {
	return value
		.split(/[_\s-]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
}
