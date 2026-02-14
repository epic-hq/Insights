/**
 * FullEvidenceCard - Rich evidence display for insight detail pages
 *
 * Shows gist as headline, collapsible verbatim quote, context, facets,
 * and deep-link to interview timestamp via anchors.
 */

import { ChevronDown, ChevronUp, ExternalLink, PlayCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import type { InsightEvidence } from "../pages/insight-detail";

interface FullEvidenceCardProps {
	evidence: InsightEvidence;
	projectPath: string;
	/** Show expanded by default */
	defaultExpanded?: boolean;
}

/** Format milliseconds to MM:SS or HH:MM:SS */
function formatTimestamp(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function FullEvidenceCard({ evidence, projectPath, defaultExpanded = false }: FullEvidenceCardProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const routes = useProjectRoutes(projectPath);

	const hasVerbatim = evidence.verbatim && evidence.verbatim !== evidence.gist;
	const hasFacets = (evidence.pains && evidence.pains.length > 0) || (evidence.gains && evidence.gains.length > 0);

	// Get first anchor for deep-link
	const anchor = evidence.anchors?.[0];
	const hasTimestamp = anchor?.start != null;

	// Build interview link with timestamp
	const interviewLink = evidence.interview_id
		? hasTimestamp
			? `${routes.interviews.detail(evidence.interview_id)}?t=${anchor.start}`
			: routes.interviews.detail(evidence.interview_id)
		: null;

	return (
		<Card className="transition-shadow hover:shadow-sm">
			<CardContent className="p-4">
				{/* Gist headline */}
				<div className="mb-2 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						{evidence.gist ? (
							<p className="font-medium text-foreground leading-snug">{evidence.gist}</p>
						) : (
							<p className="line-clamp-2 text-foreground text-sm leading-snug">"{evidence.verbatim}"</p>
						)}
					</div>

					{/* Timestamp badge with play icon */}
					{hasTimestamp && interviewLink && (
						<Link
							to={interviewLink}
							className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary text-xs transition-colors hover:bg-primary/20"
						>
							<PlayCircle className="h-3.5 w-3.5" />
							{formatTimestamp(anchor.start!)}
						</Link>
					)}
				</div>

				{/* Context summary if available */}
				{evidence.context_summary && <p className="mb-3 text-muted-foreground text-sm">{evidence.context_summary}</p>}

				{/* Collapsible verbatim quote */}
				{hasVerbatim && (
					<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="mb-2 h-auto gap-1 px-2 py-1 text-muted-foreground text-xs hover:text-foreground"
							>
								{isExpanded ? (
									<>
										<ChevronUp className="h-3 w-3" />
										Hide verbatim
									</>
								) : (
									<>
										<ChevronDown className="h-3 w-3" />
										Show verbatim quote
									</>
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<blockquote className="border-primary/30 border-l-2 py-1 pl-3 text-muted-foreground text-sm italic">
								"{evidence.verbatim}"
							</blockquote>
						</CollapsibleContent>
					</Collapsible>
				)}

				{/* Facets: pains and gains */}
				{hasFacets && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{evidence.pains?.map((pain, idx) => (
							<Badge
								key={`pain-${idx}`}
								variant="outline"
								className="border-red-200 bg-red-50 text-red-700 text-xs dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"
							>
								{pain}
							</Badge>
						))}
						{evidence.gains?.map((gain, idx) => (
							<Badge
								key={`gain-${idx}`}
								variant="outline"
								className="border-green-200 bg-green-50 text-green-700 text-xs dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-400"
							>
								{gain}
							</Badge>
						))}
					</div>
				)}

				{/* Footer: attribution and confidence */}
				<div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
					<span className="text-muted-foreground">— {evidence.attribution}</span>

					<div className="flex items-center gap-2">
						{evidence.confidence != null && (
							<span
								className={cn(
									"rounded px-1.5 py-0.5",
									evidence.confidence >= 0.8
										? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
										: evidence.confidence >= 0.6
											? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
											: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
								)}
							>
								{Math.round(evidence.confidence * 100)}%
							</span>
						)}

						{interviewLink && (
							<Link
								to={interviewLink}
								className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
							>
								<ExternalLink className="h-3 w-3" />
								View
							</Link>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
