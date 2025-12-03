import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import {
	DEFAULT_OPPORTUNITY_STAGES,
	normalizeStageId,
	type OpportunityStageConfig,
} from "~/features/opportunities/stage-config"

type OpportunityStagesEditorProps = {
	initialStages: OpportunityStageConfig[]
}

export function OpportunityStagesEditor({ initialStages }: OpportunityStagesEditorProps) {
	const [stages, setStages] = useState<OpportunityStageConfig[]>(() => initialStages)

	const serializedStages = useMemo(() => JSON.stringify(stages), [stages])

	const updateStage = (index: number, patch: Partial<OpportunityStageConfig>) => {
		setStages((prev) => {
			const next = [...prev]
			const current = next[index]
			const label = (patch.label ?? current.label)?.toString() || `Stage ${index + 1}`
			const id = normalizeStageId(patch.id || current.id || label)
			next[index] = {
				...current,
				...patch,
				id,
				label,
			}
			return next
		})
	}

	const moveStage = (index: number, direction: -1 | 1) => {
		setStages((prev) => {
			const targetIndex = index + direction
			if (targetIndex < 0 || targetIndex >= prev.length) return prev
			const next = [...prev]
			const [removed] = next.splice(index, 1)
			next.splice(targetIndex, 0, removed)
			return next
		})
	}

	const addStage = () => {
		setStages((prev) => {
			const nextId = `custom-${prev.length + 1}`
			return [
				...prev,
				{
					id: normalizeStageId(nextId),
					label: `Custom Stage ${prev.length + 1}`,
					description: "",
				},
			]
		})
	}

	const removeStage = (index: number) => {
		setStages((prev) => {
			if (prev.length <= 1) return prev
			return prev.filter((_, i) => i !== index)
		})
	}

	const resetStages = () => setStages(DEFAULT_OPPORTUNITY_STAGES)

	return (
		<Card>
			<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<CardTitle className="text-2xl">Opportunity Stages</CardTitle>
					<CardDescription>
						Ordered stages power the kanban columns and dropdowns for this project. Defaults follow a B2B pipeline.
					</CardDescription>
				</div>
				<Button variant="ghost" size="sm" className="gap-2" type="button" onClick={resetStages}>
					<RotateCcw className="h-4 w-4" />
					Reset to default
				</Button>
			</CardHeader>
			<CardContent className="space-y-4">
				<input type="hidden" name="intent" value="update_opportunity_stages" />
				<input type="hidden" name="stages" value={serializedStages} />

				<div className="space-y-3">
					{stages.map((stage, index) => (
						<div
							key={stage.id || index}
							className="group rounded-md border border-border/60 bg-card/70 p-3 shadow-sm transition hover:border-primary/50"
						>
							<div className="mb-3 flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="bg-muted/60">
										{index + 1}
									</Badge>
									<span className="text-muted-foreground text-xs">/{stages.length}</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => moveStage(index, -1)}
										disabled={index === 0}
									>
										<GripVertical className="h-4 w-4 rotate-90" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										onClick={() => moveStage(index, 1)}
										disabled={index === stages.length - 1}
									>
										<GripVertical className="-rotate-90 h-4 w-4" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive"
										onClick={() => removeStage(index)}
										disabled={stages.length <= 1}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-2">
									<label className="font-medium text-foreground text-sm">Label</label>
									<Input
										value={stage.label}
										onChange={(e) => updateStage(index, { label: e.target.value })}
										placeholder="Discovery"
										required
									/>
								</div>
								<div className="space-y-2">
									<label className="font-medium text-foreground text-sm">Description</label>
									<Textarea
										value={stage.description || ""}
										onChange={(e) => updateStage(index, { description: e.target.value })}
										placeholder="What progress does this stage represent?"
										rows={2}
									/>
								</div>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								Stored as <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{stage.id}</code>
							</p>
						</div>
					))}
				</div>

				<div className="flex items-center gap-3">
					<Button type="button" variant="outline" className="gap-2" onClick={addStage}>
						<Plus className="h-4 w-4" />
						Add stage
					</Button>
					<Button type="submit" className="gap-2">
						<GripVertical className="h-4 w-4" />
						Save stages
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
