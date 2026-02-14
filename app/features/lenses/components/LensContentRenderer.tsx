import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import type { LensSlotValue } from "~/features/lenses/types";

type LensContentRendererProps = {
	slot: LensSlotValue;
	title?: string;
};

export function LensContentRenderer({ slot, title }: LensContentRendererProps) {
	return (
		<Card className="border border-border/60 shadow-sm">
			<CardHeader className="flex flex-col gap-1 py-3">
				<CardTitle className="font-semibold text-base">
					{title ?? slot.label ?? slot.fieldKey.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
				</CardTitle>
				{slot.summary ? <p className="text-muted-foreground text-sm">{slot.summary}</p> : null}
				{slot.hygiene.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{slot.hygiene.map((item) => (
							<Badge key={`${slot.id}-${item.code}`} variant="outline" className="text-[0.65rem] uppercase">
								{item.code}
							</Badge>
						))}
					</div>
				) : null}
			</CardHeader>
			<CardContent className="space-y-4">
				<section className="space-y-2 text-sm">
					{slot.textValue ? <p className="font-medium text-foreground">{slot.textValue}</p> : null}
					{typeof slot.numericValue === "number" ? (
						<p className="text-muted-foreground">Numeric value: {slot.numericValue}</p>
					) : null}
					{slot.dateValue ? <p className="text-muted-foreground">Date: {slot.dateValue}</p> : null}
					{slot.status ? <p className="text-muted-foreground">Status: {slot.status}</p> : null}
				</section>

				{slot.evidence.length > 0 ? (
					<>
						<Separator />
						<section className="space-y-3">
							<p className="font-medium text-muted-foreground text-sm">Evidence</p>
							<ul className="space-y-3">
								{slot.evidence.map((item) => (
									<li key={item.evidenceId} className="rounded-md border bg-muted/30 p-3">
										<p className="text-foreground text-sm">{item.transcriptSnippet ?? "Evidence snippet pending"}</p>
										<p className="mt-2 text-muted-foreground text-xs">
											#{item.evidenceId.slice(0, 8)}
											{typeof item.startMs === "number" ? ` · ${Math.round(item.startMs / 1000)}s` : ""}
										</p>
									</li>
								))}
							</ul>
						</section>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}
