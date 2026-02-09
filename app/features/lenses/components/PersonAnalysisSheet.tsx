/**
 * Person Analysis Sheet - Inline detail panel for a person's analysis
 *
 * Opens as a side sheet when clicking a person in the By Person tab.
 * Shows consolidated lens results, key pains/goals, and action items.
 */

import {
	AlertTriangle,
	ArrowUpRight,
	Briefcase,
	ClipboardList,
	FileText,
	FlaskConical,
	Glasses,
	MessageSquare,
	Package,
	Sparkles,
	Target,
} from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import type { PersonAnalysisSummary, PersonLensHighlight } from "../lib/loadAnalysisData.server";

type SheetProps = {
	person: PersonAnalysisSummary | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	routes: any;
};

function getInitials(name: string): string {
	return (
		name
			.split(" ")
			.map((w) => w[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"
	);
}

function getCategoryIcon(templateKey: string) {
	if (templateKey.includes("sales") || templateKey.includes("bant")) return <Briefcase className="h-3.5 w-3.5" />;
	if (templateKey.includes("research") || templateKey.includes("discovery"))
		return <FlaskConical className="h-3.5 w-3.5" />;
	if (templateKey.includes("product")) return <Package className="h-3.5 w-3.5" />;
	return <Glasses className="h-3.5 w-3.5" />;
}

function LensHighlightCard({ highlight }: { highlight: PersonLensHighlight }) {
	return (
		<Card className="bg-muted/30">
			<CardHeader className="p-3 pb-2">
				<div className="flex items-center gap-2">
					{getCategoryIcon(highlight.templateKey)}
					<CardTitle className="text-sm">{highlight.templateName}</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 p-3 pt-0">
				{/* Executive summary */}
				{highlight.executiveSummary && (
					<p className="text-muted-foreground text-xs leading-relaxed">{highlight.executiveSummary}</p>
				)}

				{/* Key fields */}
				{highlight.fields.length > 0 && (
					<div className="space-y-1.5">
						{highlight.fields.slice(0, 4).map((field) => (
							<div key={field.key} className="flex gap-2 text-xs">
								<span className="min-w-0 flex-shrink-0 font-medium text-muted-foreground">{field.name}:</span>
								<span className="min-w-0 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
									{field.value}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function PersonAnalysisSheet({ person, open, onOpenChange, routes }: SheetProps) {
	if (!person) return null;

	const hasPains = person.keyPains.length > 0;
	const hasGoals = person.keyGoals.length > 0;
	const hasHighlights = person.lensHighlights.length > 0;
	const hasSurveyHighlights = (person.surveyHighlights?.length || 0) > 0;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full p-0 sm:max-w-lg">
				<ScrollArea className="h-full">
					<div className="space-y-6 p-6">
						{/* Header */}
						<SheetHeader className="space-y-3">
							<div className="flex items-start gap-4">
								<Avatar className="h-14 w-14 flex-shrink-0">
									{person.imageUrl && <AvatarImage src={person.imageUrl} alt={person.name} />}
									<AvatarFallback className="bg-primary/10 text-primary">{getInitials(person.name)}</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<SheetTitle className="text-xl">{person.name}</SheetTitle>
									<SheetDescription>
										{person.title || "No title"}
									</SheetDescription>
									<div className="mt-2 flex items-center gap-2">
										{person.interviewCount > 0 && (
											<Badge variant="secondary" className="gap-1 text-xs">
												<MessageSquare className="h-3 w-3" />
												{person.interviewCount} conversation
												{person.interviewCount !== 1 ? "s" : ""}
											</Badge>
										)}
										{person.surveyResponseCount > 0 && (
											<Badge variant="outline" className="text-xs">
												{person.surveyResponseCount} survey
												{person.surveyResponseCount !== 1 ? "s" : ""}
											</Badge>
										)}
									</div>
								</div>
							</div>
						</SheetHeader>

						{/* View full profile link */}
						<Link to={routes.people.detail(person.id)}>
							<Button variant="outline" size="sm" className="w-full gap-2">
								View Full Profile
								<ArrowUpRight className="h-3.5 w-3.5" />
							</Button>
						</Link>

						<Separator />

						{/* AI Summary Section */}
						{person.lensHighlights.some((h) => h.executiveSummary) && (
							<div className="space-y-2">
								<h3 className="flex items-center gap-2 font-medium text-sm">
									<Sparkles className="h-4 w-4 text-primary" />
									AI Summary
								</h3>
								<p className="text-muted-foreground text-sm leading-relaxed">
									{person.lensHighlights.find((h) => h.executiveSummary)?.executiveSummary}
								</p>
							</div>
						)}

						{/* Key Pains */}
						{hasPains && (
							<div className="space-y-2">
								<h3 className="flex items-center gap-2 font-medium text-sm">
									<AlertTriangle className="h-4 w-4 text-red-500" />
									Key Pains
								</h3>
								<ul className="space-y-1.5">
									{person.keyPains.map((pain) => (
										<li key={pain} className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
											<span className="break-words text-muted-foreground [overflow-wrap:anywhere]">{pain}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Key Goals */}
						{hasGoals && (
							<div className="space-y-2">
								<h3 className="flex items-center gap-2 font-medium text-sm">
									<Target className="h-4 w-4 text-green-500" />
									Key Goals
								</h3>
								<ul className="space-y-1.5">
									{person.keyGoals.map((goal) => (
										<li key={goal} className="flex items-start gap-2 text-sm">
											<span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
											<span className="break-words text-muted-foreground [overflow-wrap:anywhere]">{goal}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Lens Highlights */}
						{hasHighlights && (
							<div className="space-y-3">
								<h3 className="flex items-center gap-2 font-medium text-sm">
									<Glasses className="h-4 w-4 text-foreground/60" />
									Analysis by Lens
								</h3>
								{person.lensHighlights.map((highlight) => (
									<LensHighlightCard key={highlight.templateKey} highlight={highlight} />
								))}
							</div>
						)}

						{/* Survey Highlights */}
						{hasSurveyHighlights && (
							<div className="space-y-2">
								<h3 className="flex items-center gap-2 font-medium text-sm">
									<ClipboardList className="h-4 w-4 text-blue-500" />
									Survey Insights
								</h3>
								<ul className="space-y-2">
									{person.surveyHighlights.map((gist, i) => (
										<li
											key={i}
											className="rounded-md border bg-blue-50/50 p-2.5 text-foreground/80 text-sm dark:bg-blue-950/20"
										>
											{gist}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* No analysis state */}
						{!hasHighlights && !hasPains && !hasGoals && !hasSurveyHighlights && (
							<div className="py-8 text-center">
								<FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
								<p className="text-muted-foreground text-sm">No analysis data yet for this person.</p>
								<p className="mt-1 text-muted-foreground/70 text-xs">
									Analysis runs automatically after conversations are processed.
								</p>
							</div>
						)}

						{/* Sentiment */}
						{person.sentiment && (
							<div className="rounded-lg border bg-muted/20 p-3">
								<p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Overall Sentiment
								</p>
								<p className="text-sm">{person.sentiment}</p>
							</div>
						)}
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
