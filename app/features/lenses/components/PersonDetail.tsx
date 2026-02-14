import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { LensStakeholder } from "~/features/lenses/types";
import { LensEvidenceList } from "./EditableLensContent";

const influenceBadgeClasses: Record<string, string> = {
	low: "border-slate-200 bg-slate-50 text-slate-700",
	medium: "border-amber-200 bg-amber-50 text-amber-700",
	high: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

type StakeholderListProps = {
	stakeholders: LensStakeholder[];
	className?: string;
};

export function StakeholderList({ stakeholders, className }: StakeholderListProps) {
	if (!stakeholders.length) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="font-semibold text-base">Stakeholders</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">No stakeholders linked to this interview yet.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="font-semibold text-base">Stakeholders</CardTitle>
				<p className="text-muted-foreground text-sm">Mapped contacts and their inferred roles in the deal.</p>
			</CardHeader>
			<CardContent className="space-y-3">
				<Accordion type="multiple" className="space-y-3">
					{stakeholders.map((stakeholder) => (
						<AccordionItem key={stakeholder.id} value={stakeholder.id} className="rounded-lg border px-3">
							<AccordionTrigger className="px-1 text-left hover:no-underline">
								<div className="flex flex-1 flex-col gap-1 text-left">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-semibold text-foreground text-sm">{stakeholder.displayName}</p>
										{stakeholder.personName ? (
											<Badge variant="outline" className="text-[0.65rem] uppercase">
												Linked: {stakeholder.personName}
											</Badge>
										) : null}
										{stakeholder.influence ? (
											<Badge
												variant="outline"
												className={
													influenceBadgeClasses[stakeholder.influence] ?? "border-border text-muted-foreground"
												}
											>
												Influence: {stakeholder.influence}
											</Badge>
										) : null}
										{stakeholder.confidence ? (
											<Badge variant="outline" className="text-[0.65rem]">
												{Math.round(stakeholder.confidence * 100)}% sure
											</Badge>
										) : null}
									</div>
									<p className="text-muted-foreground text-xs">
										{stakeholder.role ?? "Role unknown"}
										{stakeholder.organizationName ? ` · ${stakeholder.organizationName}` : ""}
										{stakeholder.email ? ` · ${stakeholder.email}` : ""}
									</p>
									{stakeholder.labels.length > 0 ? (
										<div className="flex flex-wrap gap-1">
											{stakeholder.labels.map((label) => (
												<Badge
													key={`${stakeholder.id}-${label}`}
													variant="secondary"
													className="text-[0.65rem] uppercase"
												>
													{label.replace(/_/g, " ")}
												</Badge>
											))}
										</div>
									) : null}
								</div>
							</AccordionTrigger>
							<AccordionContent className="pb-4">
								<LensEvidenceList
									evidence={stakeholder.evidence}
									emptyLabel="No specific evidence tagged to this stakeholder yet."
								/>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</CardContent>
		</Card>
	);
}
