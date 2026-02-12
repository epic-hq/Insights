/**
 * PersonScorecard - Hero section for the person detail page.
 * Displays identity, ICP match, activity stats, and quick actions
 * in a compact, scannable card layout.
 */

import { formatDistance } from "date-fns";
import {
	ClipboardList,
	Globe,
	Loader2,
	MessageCircle,
	MoreHorizontal,
	Pencil,
	RefreshCw,
	Search,
	StickyNote,
	Trash2,
	Upload,
	Video,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { IcpBadge } from "~/components/ui/icp-badge";
import { StatChip } from "~/components/ui/stat-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { EditableNameField } from "../components/EditableNameField";

interface PersonScorecardProps {
	person: {
		id: string;
		name: string | null;
		firstname: string | null;
		lastname: string | null;
		title: string | null;
		image_url: string | null;
		job_function: string | null;
		seniority_level: string | null;
		industry: string | null;
		description: string | null;
		people_personas?: Array<{
			persona_id: string;
			personas: { id: string; name: string; color_hex: string };
		}>;
	};
	primaryOrg: { id: string; name: string | null } | null;
	icpMatch: {
		band: string | null;
		score: number | null;
		confidence: number | null;
	} | null;
	icpScored?: boolean;
	interviewCount: number;
	surveyCount: number;
	noteCount: number;
	chatCount: number;
	lastContactDate: Date | null;
	routes: {
		personas: { detail: (id: string) => string };
		organizations: { detail: (id: string) => string };
		interviews: { upload: () => string };
		people: { edit: (id: string) => string };
		evidence: { index: () => string };
	};
	onRefreshDescription: () => void;
	onScoreICP?: () => void;
	isScoringICP?: boolean;
	showAutoScoringHint?: boolean;
	onDelete: () => void;
	onLogNote?: () => void;
	onEnrichPerson?: () => void;
	isEnriching?: boolean;
	isRefreshing?: boolean;
}

/** Number of days after which "last contact" is considered overdue. */
const OVERDUE_THRESHOLD_DAYS = 14;

function getInitials(name: string | null): string {
	if (!name) return "?";
	return name
		.split(" ")
		.map((word) => word[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function buildIdentityLine(
	jobFunction: string | null,
	seniorityLevel: string | null,
	industry: string | null
): string | null {
	const parts = [jobFunction, seniorityLevel, industry].filter(Boolean);
	return parts.length > 0 ? parts.join(" \u00B7 ") : null;
}

function isOverdue(date: Date): boolean {
	const diffMs = Date.now() - date.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays > OVERDUE_THRESHOLD_DAYS;
}

export function PersonScorecard({
	person,
	primaryOrg,
	icpMatch,
	icpScored = false,
	interviewCount,
	surveyCount,
	noteCount,
	chatCount,
	lastContactDate,
	routes,
	onRefreshDescription,
	onScoreICP,
	isScoringICP = false,
	showAutoScoringHint = false,
	onDelete,
	onLogNote,
	onEnrichPerson,
	isEnriching = false,
	isRefreshing = false,
}: PersonScorecardProps) {
	const persona = person.people_personas?.[0]?.personas;
	const themeColor = persona?.color_hex || "#6366f1";
	const initials = getInitials(person.name);
	const identityLine = buildIdentityLine(person.job_function, person.seniority_level, person.industry);

	const titleAndOrg = buildTitleOrgLine(person.title, primaryOrg, routes);
	const overdue = lastContactDate ? isOverdue(lastContactDate) : false;

	return (
		<div className="space-y-3">
			{/* Back navigation */}
			<BackButton />

			{/* Main card */}
			<div className="rounded-xl border border-border/60 bg-card p-6">
				{/* Top row: avatar + identity + ICP badge */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-4">
						{/* Avatar */}
						<Avatar className="size-16 shrink-0 border-2" style={{ borderColor: themeColor }}>
							{person.image_url && <AvatarImage src={person.image_url} alt={person.name ?? ""} />}
							<AvatarFallback className="font-semibold text-lg text-white" style={{ backgroundColor: themeColor }}>
								{initials}
							</AvatarFallback>
						</Avatar>

						{/* Identity block */}
						<div className="min-w-0 space-y-1">
							{/* Editable name */}
							<EditableNameField
								firstname={person.firstname}
								lastname={person.lastname}
								personId={person.id}
								variant="header"
								className="font-bold text-2xl"
							/>

							{/* Title @ Org */}
							{titleAndOrg && <p className="text-muted-foreground text-sm">{titleAndOrg}</p>}

							{/* Identity facets */}
							{identityLine && <p className="text-muted-foreground/70 text-sm">{identityLine}</p>}

							{/* Persona pill */}
							{persona && (
								<div className="pt-0.5">
									<Link to={routes.personas.detail(persona.id)}>
										<span
											className="inline-block rounded-full px-2.5 py-0.5 font-medium text-xs transition-opacity hover:opacity-80"
											style={{
												backgroundColor: `${persona.color_hex}18`,
												color: persona.color_hex,
											}}
										>
											{persona.name}
										</span>
									</Link>
								</div>
							)}
						</div>
					</div>

					{/* ICP badge + actionability */}
					<div className="flex shrink-0 flex-col items-end gap-2">
						<IcpBadge
							band={icpMatch?.band ?? null}
							score={icpMatch?.score}
							confidence={icpMatch?.confidence}
							className="shrink-0"
						/>
						{!icpScored && onScoreICP && (
							<Button size="sm" variant="secondary" onClick={onScoreICP} disabled={isScoringICP} className="h-7 px-2.5">
								{isScoringICP && <Loader2 className="mr-1.5 size-3 animate-spin" />}
								{isScoringICP ? "Scoring..." : "Score ICP"}
							</Button>
						)}
						{showAutoScoringHint && (
							<p className="max-w-[12rem] text-right text-muted-foreground text-xs">
								Analyzing ICP fit for this person...
							</p>
						)}
					</div>
				</div>

				{/* Activity stats row */}
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<StatChip icon={Video} count={interviewCount} label="Convos" />
						<StatChip icon={ClipboardList} count={surveyCount} label="Surveys" />
						<StatChip icon={StickyNote} count={noteCount} label="Notes" />
						<StatChip icon={MessageCircle} count={chatCount} label="Chats" />
					</div>

					{/* Last contact */}
					{lastContactDate && (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<span className={cn("inline-block size-2 rounded-full", overdue ? "bg-amber-500" : "bg-emerald-500")} />
							<span>
								Last:{" "}
								{formatDistance(lastContactDate, new Date(), {
									addSuffix: true,
								})}
							</span>
							{overdue && (
								<Badge
									variant="outline"
									className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
								>
									Overdue
								</Badge>
							)}
						</div>
					)}
				</div>

				{/* Quick actions row */}
				<div className="mt-5 flex flex-wrap items-center gap-2">
					{/* Quick Note */}
					<Button variant="outline" size="sm" onClick={onLogNote}>
						<StickyNote className="size-4" />
						Quick Note
					</Button>

					{/* Enrich via web search */}
					<Button variant="outline" size="sm" onClick={onEnrichPerson} disabled={isEnriching}>
						{isEnriching ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
						{isEnriching ? "Enriching…" : "Enrich"}
					</Button>

					{/* Send Survey - Phase 2 placeholder */}
					<Tooltip>
						<TooltipTrigger asChild>
							<span tabIndex={0}>
								<Button variant="outline" size="sm" disabled>
									<ClipboardList className="size-4" />
									Send Survey
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent>Coming soon</TooltipContent>
					</Tooltip>

					{/* Overflow menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon-sm" aria-label="More actions">
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem asChild>
								<Link to={routes.people.edit(person.id)}>
									<Pencil />
									Edit Person
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={routes.evidence.index()}>
									<Search />
									View Evidence
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onRefreshDescription} disabled={isRefreshing}>
								{isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
								Refresh Description
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={routes.interviews.upload()}>
									<Upload />
									Attach Recording
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={onDelete}>
								<Trash2 />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}

/**
 * Builds the "Title @ Org" line as a React node.
 * Returns null if neither title nor org is available.
 */
function buildTitleOrgLine(
	title: string | null,
	primaryOrg: PersonScorecardProps["primaryOrg"],
	routes: PersonScorecardProps["routes"]
): React.ReactNode | null {
	if (!title && !primaryOrg?.name) return null;

	return (
		<>
			{title && <span>{title}</span>}
			{title && primaryOrg?.name && <span> @ </span>}
			{primaryOrg?.name && (
				<Link to={routes.organizations.detail(primaryOrg.id)} className="text-primary hover:underline">
					{primaryOrg.name}
				</Link>
			)}
		</>
	);
}
