import { Badge } from "~/components/ui/badge"
import { Separator } from "~/components/ui/separator"
import type { LensEvidencePointer } from "~/features/lenses/types"

type LensEvidenceListProps = {
	title?: string
	evidence: LensEvidencePointer[]
	emptyLabel?: string
}

export function LensEvidenceList({ title = "Supporting evidence", evidence, emptyLabel }: LensEvidenceListProps) {
	if (!evidence.length) {
		return (
			<div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-muted-foreground text-sm">
				{emptyLabel ?? "No evidence captured yet"}
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<p className="font-medium text-muted-foreground text-sm">{title}</p>
			<ul className="space-y-3">
				{evidence.map((item) => (
					<li key={item.evidenceId} className="rounded-md border bg-muted/30 p-3 text-sm">
						<p className="text-foreground">{item.transcriptSnippet ?? "Evidence snippet pending"}</p>
						<div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
							<span>Evidence #{item.evidenceId.slice(0, 8)}</span>
							{typeof item.startMs === "number" ? (
								<Badge variant="outline" className="text-[0.65rem] uppercase">
									{Math.round(item.startMs / 1000)}s
								</Badge>
							) : null}
						</div>
						{typeof item.endMs === "number" ? (
							<>
								<Separator className="my-2" />
								<p className="text-muted-foreground text-xs">Ends at {Math.round(item.endMs / 1000)}s</p>
							</>
						) : null}
					</li>
				))}
			</ul>
		</div>
	)
}
