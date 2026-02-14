/**
 * Analysis By Person Tab - People-first view of analysis results
 *
 * Shows all people in the project with consolidated lens findings.
 * Click a person to expand an inline detail panel.
 */

import { AlertTriangle, ChevronRight, ClipboardList, MessageSquare, Search, Target, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { PersonAnalysisSummary } from "../lib/loadAnalysisData.server";
import { ICPMatchSection } from "./ICPMatchSection";
import { PersonAnalysisSheet } from "./PersonAnalysisSheet";

export type ICPScoredPerson = {
	person_id: string;
	name: string;
	title: string | null;
	company: string | null;
	job_function: string | null;
	seniority_level: string | null;
	default_organization_id: string | null;
	org_name: string | null;
	org_industry: string | null;
	org_size_range: string | null;
	band: string | null;
	score: number | null;
	confidence: number | null;
	evidence_count: number;
};

type ByPersonTabProps = {
	people: PersonAnalysisSummary[];
	routes: any;
	projectPath: string;
	accountId: string;
	projectId: string;
	icpCriteria: {
		target_orgs: string[];
		target_roles: string[];
		target_size_ranges: string[];
		target_facets: Array<{ facet_account_id: number; label: string }>;
	};
	icpDistribution: {
		HIGH: number;
		MEDIUM: number;
		LOW: number;
		NONE: number;
	};
	icpScoredPeople: ICPScoredPerson[];
	organizations: { id: string; name: string }[];
	dataQuality: {
		totalPeople: number;
		withTitle: number;
		withCompany: number;
	};
	availableFacets: Array<{
		id: number;
		label: string;
		slug: string;
		kindSlug: string;
		kindLabel: string;
		personCount: number;
	}>;
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

function PersonCard({ person, onClick }: { person: PersonAnalysisSummary; onClick: () => void }) {
	const hasLensAnalysis = person.lensHighlights.length > 0;
	const hasSurveyHighlights = (person.surveyHighlights?.length || 0) > 0;
	const hasPains = person.keyPains.length > 0;
	const hasGoals = person.keyGoals.length > 0;

	// Get the first executive summary from lens highlights, or first survey highlight
	const topSummary =
		person.lensHighlights.find((h) => h.executiveSummary)?.executiveSummary ||
		(hasSurveyHighlights ? person.surveyHighlights[0] : null);

	return (
		<Card className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md" onClick={onClick}>
			<CardContent className="p-4">
				<div className="flex gap-4">
					{/* Avatar */}
					<Avatar className="h-12 w-12 flex-shrink-0">
						{person.imageUrl && <AvatarImage src={person.imageUrl} alt={person.name} />}
						<AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(person.name)}</AvatarFallback>
					</Avatar>

					{/* Content */}
					<div className="min-w-0 flex-1 space-y-2">
						{/* Name & metadata row */}
						<div className="flex items-start justify-between gap-2">
							<div>
								<h3 className="font-semibold text-sm leading-tight">{person.name}</h3>
								<p className="text-foreground/60 text-xs">{person.title || "No title"}</p>
							</div>
							<div className="flex flex-shrink-0 items-center gap-1.5">
								{person.interviewCount > 0 && (
									<Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
										<MessageSquare className="h-2.5 w-2.5" />
										{person.interviewCount}
									</Badge>
								)}
								{person.surveyResponseCount > 0 && (
									<Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
										<ClipboardList className="h-2.5 w-2.5" />
										{person.surveyResponseCount}
									</Badge>
								)}
							</div>
						</div>

						{/* Key findings preview (from lens or survey) */}
						{topSummary && <p className="line-clamp-2 text-foreground/60 text-xs leading-relaxed">{topSummary}</p>}

						{/* Pains and goals badges */}
						{(hasPains || hasGoals) && (
							<div className="flex flex-wrap gap-1.5">
								{person.keyPains.slice(0, 2).map((pain) => (
									<Badge
										key={pain}
										variant="outline"
										className="border-red-200 bg-red-50/50 px-1.5 py-0 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300"
									>
										<AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
										{pain.length > 40 ? `${pain.slice(0, 40)}...` : pain}
									</Badge>
								))}
								{person.keyGoals.slice(0, 2).map((goal) => (
									<Badge
										key={goal}
										variant="outline"
										className="border-green-200 bg-green-50/50 px-1.5 py-0 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300"
									>
										<Target className="mr-0.5 h-2.5 w-2.5" />
										{goal.length > 40 ? `${goal.slice(0, 40)}...` : goal}
									</Badge>
								))}
							</div>
						)}

						{/* Lens coverage */}
						{hasLensAnalysis && (
							<div className="flex items-center gap-1">
								{person.lensHighlights.map((h) => (
									<Badge key={h.templateKey} variant="secondary" className="px-1.5 py-0 text-[10px]">
										{h.templateName}
									</Badge>
								))}
							</div>
						)}
					</div>

					{/* Chevron */}
					<ChevronRight className="mt-3 h-4 w-4 flex-shrink-0 text-foreground/50" />
				</div>
			</CardContent>
		</Card>
	);
}

export function AnalysisByPersonTab({
	people,
	routes,
	projectPath,
	accountId,
	projectId,
	icpCriteria,
	icpDistribution,
	icpScoredPeople,
	organizations,
	dataQuality,
	availableFacets,
}: ByPersonTabProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedPerson, setSelectedPerson] = useState<PersonAnalysisSummary | null>(null);

	// Filter people by search
	const filteredPeople = useMemo(() => {
		if (!searchQuery.trim()) return people;
		const q = searchQuery.toLowerCase();
		return people.filter((p) => p.name.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q));
	}, [people, searchQuery]);

	// Split into people with analysis/evidence vs without
	const hasEvidence = (p: PersonAnalysisSummary) =>
		p.lensHighlights.length > 0 ||
		p.keyPains.length > 0 ||
		p.keyGoals.length > 0 ||
		(p.surveyHighlights?.length || 0) > 0;

	const withAnalysis = filteredPeople.filter(hasEvidence);
	const withoutAnalysis = filteredPeople.filter((p) => !hasEvidence(p));

	if (people.length === 0) {
		return (
			<div className="py-20 text-center">
				<User className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
				<h2 className="mb-2 font-semibold text-xl">No people yet</h2>
				<p className="mx-auto max-w-md text-muted-foreground">
					People are automatically identified from your interviews and surveys. Start conversations to see analysis per
					person.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="space-y-6">
				{/* ICP Match Section */}
				<ICPMatchSection
					accountId={accountId}
					projectId={projectId}
					projectPath={projectPath}
					initialCriteria={{
						target_orgs: icpCriteria.target_orgs,
						target_roles: icpCriteria.target_roles,
						target_company_sizes: icpCriteria.target_size_ranges,
						target_facets: icpCriteria.target_facets,
					}}
					distribution={icpDistribution}
					scoredPeople={icpScoredPeople}
					organizations={organizations}
					dataQuality={dataQuality}
					availableFacets={availableFacets}
				/>

				{/* Search */}
				<div className="relative max-w-md">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search people..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* People with analysis results */}
				{withAnalysis.length > 0 && (
					<div className="space-y-3">
						{withAnalysis.map((person) => (
							<PersonCard key={person.id} person={person} onClick={() => setSelectedPerson(person)} />
						))}
					</div>
				)}

				{/* People without analysis (collapsed) */}
				{withoutAnalysis.length > 0 && (
					<div className="space-y-3">
						{withAnalysis.length > 0 && (
							<h3 className="pt-2 font-medium text-muted-foreground text-sm">
								Awaiting analysis ({withoutAnalysis.length})
							</h3>
						)}
						{withoutAnalysis.map((person) => (
							<PersonCard key={person.id} person={person} onClick={() => setSelectedPerson(person)} />
						))}
					</div>
				)}

				{/* No results */}
				{filteredPeople.length === 0 && searchQuery && (
					<div className="py-12 text-center text-muted-foreground">No people matching "{searchQuery}"</div>
				)}
			</div>

			{/* Inline person detail sheet */}
			<PersonAnalysisSheet
				person={selectedPerson}
				open={!!selectedPerson}
				onOpenChange={(open) => !open && setSelectedPerson(null)}
				routes={routes}
			/>
		</>
	);
}
