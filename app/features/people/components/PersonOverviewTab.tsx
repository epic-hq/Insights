/**
 * PersonOverviewTab - BLUF (Bottom Line Up Front) view of a person
 *
 * Shows the most important strategic information first:
 * 1. Key Takeaways (AI-generated summary)
 * 2. Themes (expandable patterns this person cares about)
 * 3. Related Insights (strategic takeaways)
 * 4. Recent Conversations (preview with link to full list)
 *
 * Organization info is in the header, not duplicated here.
 */

import { ChevronDown, ChevronUp, ExternalLink, Lightbulb, MessageSquareQuote, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3";
import type { Insight } from "~/types";

interface Theme {
	id: string;
	name: string;
	statement: string | null;
	evidence_count: number;
}

interface InterviewLink {
	id: string | number;
	interviews: {
		id: string;
		title: string | null;
		source_type: string | null;
		media_type: string | null;
		created_at: string | null;
	} | null;
}

interface PersonOverviewTabProps {
	/** AI-generated description / key takeaways */
	description: string | null;
	/** Themes this person's evidence supports */
	themes: Theme[];
	/** AI-generated insights related to this person */
	insights: Insight[];
	/** All interview/conversation links for recent conversations */
	allInterviewLinks: InterviewLink[];
	/** Route helpers */
	routes: {
		themes: { detail: (id: string) => string };
		interviews: { detail: (id: string) => string };
		evidence: { index: () => string };
	};
	/** Person ID for filtering evidence link */
	personId: string;
}

/** Get source type icon and label */
function getSourceInfo(sourceType: string | null, mediaType: string | null) {
	if (sourceType === "note" || mediaType === "voice_memo") {
		return { icon: "📝", label: "Note" };
	}
	if (sourceType === "survey_response") {
		return { icon: "📋", label: "Survey" };
	}
	if (sourceType === "public_chat") {
		return { icon: "💬", label: "Chat" };
	}
	if (sourceType === "video_upload" || mediaType === "video") {
		return { icon: "📹", label: "Interview" };
	}
	return { icon: "🎙️", label: "Interview" };
}

export function PersonOverviewTab({
	description,
	themes,
	insights,
	allInterviewLinks,
	routes,
	personId,
}: PersonOverviewTabProps) {
	const [showAllThemes, setShowAllThemes] = useState(false);

	// Get 3 most recent conversations
	const recentEvidence = allInterviewLinks
		.filter((link) => link.interviews?.id)
		.sort((a, b) => {
			const dateA = a.interviews?.created_at ? new Date(a.interviews.created_at).getTime() : 0;
			const dateB = b.interviews?.created_at ? new Date(b.interviews.created_at).getTime() : 0;
			return dateB - dateA;
		})
		.slice(0, 3);

	const hasDescription = description && description.trim().length > 0;
	const hasThemes = themes.length > 0;
	const hasInsights = insights.length > 0;
	const hasEvidence = recentEvidence.length > 0;

	// Show empty state if nothing to display
	if (!hasDescription && !hasThemes && !hasInsights && !hasEvidence) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<Sparkles className="mb-4 h-12 w-12 text-muted-foreground/50" />
				<h3 className="mb-2 font-medium text-lg">No insights yet</h3>
				<p className="max-w-md text-muted-foreground text-sm">
					Add conversations linked to this person to see key takeaways, themes, and insights.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Key Takeaways - AI Summary (BLUF) */}
			{hasDescription && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Lightbulb className="h-4 w-4" />
							Key Takeaways
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="whitespace-pre-wrap text-foreground leading-relaxed">{description}</p>
					</CardContent>
				</Card>
			)}

			{/* Themes - Patterns this person cares about */}
			{hasThemes && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Sparkles className="h-4 w-4" />
							Themes
							<span className="font-normal text-muted-foreground text-sm">({themes.length})</span>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{(showAllThemes ? themes : themes.slice(0, 6)).map((theme) => (
								<Link key={theme.id} to={routes.themes.detail(theme.id)}>
									<Badge
										variant="secondary"
										className="cursor-pointer gap-1.5 px-3 py-1.5 transition-colors hover:bg-secondary/80"
									>
										{theme.name}
										<span className="text-muted-foreground">({theme.evidence_count})</span>
									</Badge>
								</Link>
							))}
						</div>
						{themes.length > 6 && (
							<Button
								variant="ghost"
								size="sm"
								className="mt-3 gap-1 text-muted-foreground"
								onClick={() => setShowAllThemes(!showAllThemes)}
							>
								{showAllThemes ? (
									<>
										<ChevronUp className="h-4 w-4" />
										Show less
									</>
								) : (
									<>
										<ChevronDown className="h-4 w-4" />
										Show {themes.length - 6} more
									</>
								)}
							</Button>
						)}
					</CardContent>
				</Card>
			)}

			{/* Related Insights - Strategic takeaways */}
			{hasInsights && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Lightbulb className="h-4 w-4" />
							Related Insights
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							{insights.slice(0, 4).map((insight) => (
								<InsightCardV3 key={insight.id} insight={insight} />
							))}
						</div>
						{insights.length > 4 && (
							<p className="mt-3 text-muted-foreground text-sm">+{insights.length - 4} more insights</p>
						)}
					</CardContent>
				</Card>
			)}

			{/* Recent Conversations - Preview with link to full list */}
			{hasEvidence && (
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-base">
								<MessageSquareQuote className="h-4 w-4" />
								Recent Conversations
							</CardTitle>
							{allInterviewLinks.length > 3 && (
								<Button variant="ghost" size="sm" className="gap-1 text-sm" asChild>
									<Link to={`${routes.evidence.index()}?person_id=${personId}`}>
										View all ({allInterviewLinks.length})
										<ExternalLink className="h-3 w-3" />
									</Link>
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{recentEvidence.map((link) => {
								const interview = link.interviews;
								if (!interview) return null;
								const { icon, label } = getSourceInfo(interview.source_type, interview.media_type);
								return (
									<Link
										key={link.id}
										to={routes.interviews.detail(interview.id)}
										className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
									>
										<span className="text-lg">{icon}</span>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span className="font-medium text-sm">
													{interview.title || `${label} ${interview.id.slice(0, 8)}`}
												</span>
												<Badge variant="outline" className="text-xs">
													{label}
												</Badge>
											</div>
											{interview.created_at && (
												<p className="mt-0.5 text-muted-foreground text-xs">
													{new Date(interview.created_at).toLocaleDateString()}
												</p>
											)}
										</div>
									</Link>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
