/**
 * InterviewScorecard — hero card for the interview detail page.
 * Shows title (inline-editable), people, metadata, status, and action buttons.
 */

import consola from "consola";
import {
	AlertTriangle,
	ArrowUpRight,
	Briefcase,
	Edit2,
	Loader2,
	MoreVertical,
	RefreshCw,
	Trash2,
	Users,
	XCircle,
} from "lucide-react";
import { Link, useFetcher, useNavigate, useRevalidator } from "react-router";
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import InlineEdit from "~/components/ui/inline-edit";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { cn } from "~/lib/utils";

interface Participant {
	id: number;
	role: string | null;
	transcript_key: string | null;
	display_name: string | null;
	people?: {
		id?: string;
		name?: string | null;
		segment?: string | null;
		company?: string | null;
		people_personas?: Array<{
			personas?: { id?: string; name?: string | null } | null;
		}>;
	};
}

interface InterviewScorecardProps {
	interview: {
		id: string;
		title: string | null;
		created_at: string;
		duration_sec: number | null;
		media_url: string | null;
		status: string;
		share_enabled?: boolean | null;
		share_token?: string | null;
		share_expires_at?: string | null;
		hasTranscript?: boolean;
		hasFormattedTranscript?: boolean;
		participant_pseudonym?: string | null;
		source_type?: string | null;
		participants: Participant[];
	};
	accountId: string;
	projectId: string;
	evidenceCount: number;
	creatorName: string;
	currentStatus: string;
	isProcessing: boolean;
	isRealtimeLive: boolean;
	hasError: boolean;
	routes: {
		interviews: { edit: (id: string) => string };
		people: { detail: (id: string) => string };
		evidence: { index: () => string };
		opportunities: { detail: (id: string) => string; new: () => string };
	};
	linkedOpportunity: { id: string; title: string } | null;
	shareProjectPath: string;
	onFieldUpdate: (field: string, value: string) => void;
	onOpenParticipantsDialog: () => void;
}

function formatReadable(dateString: string) {
	const d = new Date(dateString);
	const parts = d.toLocaleString("en-US", {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
	const lower = parts.replace(/AM|PM/, (m) => m.toLowerCase());
	return lower.replace(/^(\w{3}) (\d{2}), /, "$1-$2 ");
}

function getStatusLabel(status: string): string {
	switch (status) {
		case "uploading":
			return "Uploading file...";
		case "uploaded":
			return "Upload complete, preparing for transcription";
		case "transcribing":
			return "Transcribing audio";
		case "processing":
			return "Analyzing transcript and generating insights";
		case "ready":
			return "Analysis complete";
		case "error":
			return "Processing failed";
		default:
			return status;
	}
}

export function InterviewScorecard({
	interview,
	accountId,
	projectId,
	evidenceCount,
	creatorName,
	currentStatus,
	isProcessing,
	isRealtimeLive,
	hasError,
	routes,
	linkedOpportunity,
	shareProjectPath,
	onFieldUpdate,
	onOpenParticipantsDialog,
}: InterviewScorecardProps) {
	const fetcher = useFetcher();
	const deleteFetcher = useFetcher<{
		success?: boolean;
		redirectTo?: string;
		error?: string;
	}>();
	const navigate = useNavigate();
	const revalidator = useRevalidator();

	const interviewTitle = interview.title || "Untitled Interview";
	const participants = interview.participants || [];
	const evidenceFilterLink = `${routes.evidence.index()}?interview_id=${encodeURIComponent(interview.id)}`;

	// Handle delete redirect
	const redirectTo = deleteFetcher.data?.redirectTo;
	if (redirectTo && deleteFetcher.state === "idle") {
		navigate(redirectTo);
	}

	// Participant display logic
	const hasUnlinkedParticipants = participants.some((p) => !p.people?.id);
	const hasPlaceholderNames = participants.some((p) => {
		const name = p.people?.name || p.display_name || "";
		return !name || /^(Participant|Interviewer)\s*\d*$/i.test(name);
	});
	const needsAttention = participants.length > 0 && (hasUnlinkedParticipants || hasPlaceholderNames);

	const linkedParticipants = participants.filter((p) => {
		const person = p.people as { id?: string; name?: string | null } | null;
		return person?.id && person?.name && !/^(Participant|Interviewer)\s*\d*$/i.test(person.name ?? "");
	});

	return (
		<div className="space-y-3">
			<BackButton />
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 flex-1">
					<InlineEdit
						value={interviewTitle}
						onSubmit={(value) => {
							try {
								onFieldUpdate("title", value);
							} catch (error) {
								consola.error("Failed to update interview title", error);
							}
						}}
						submitOnBlur={true}
						textClassName="break-words font-semibold text-xl leading-tight sm:text-2xl"
					/>
				</div>
				<div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
					{shareProjectPath && accountId ? (
						<ResourceShareMenu
							projectPath={shareProjectPath}
							accountId={accountId}
							resourceId={interview.id}
							resourceName={interviewTitle}
							resourceType="interview"
							shareEnabled={interview.share_enabled ?? false}
							shareToken={interview.share_token}
							shareExpiresAt={interview.share_expires_at}
							onShareChange={() => revalidator.revalidate()}
						/>
					) : null}
					{isRealtimeLive && (
						<div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5">
							<span className="relative flex h-2.5 w-2.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
								<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
							</span>
							<p className="font-medium text-red-600 text-sm">Live Recording</p>
						</div>
					)}
					{isProcessing && (
						<div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5">
							<Loader2 className="h-5 w-5 animate-spin text-primary" />
							<p className="font-medium text-primary text-sm">{getStatusLabel(currentStatus)}</p>
						</div>
					)}
					{hasError && (
						<div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5">
							<XCircle className="h-3 w-3 text-destructive" />
							<p className="text-destructive text-xs">Failed</p>
						</div>
					)}
					{/* Actions Dropdown */}
					{(interview.hasTranscript ||
						interview.hasFormattedTranscript ||
						interview.status === "error" ||
						interview.status === "uploading" ||
						interview.status === "transcribing" ||
						interview.status === "processing" ||
						interview.status === "uploaded") && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									disabled={fetcher.state !== "idle" || deleteFetcher.state !== "idle"}
									className="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-semibold text-sm shadow-sm hover:bg-foreground/30 disabled:opacity-60"
									title="Actions"
								>
									<MoreVertical className="h-4 w-4" />
									Actions
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={async () => {
										try {
											const response = await fetch("/api/interview-restart", {
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ interviewId: interview.id }),
											});
											const result = await response.json();
											if (result.success) {
												revalidator.revalidate();
											} else {
												consola.error("Restart failed:", result.error || result.message);
											}
										} catch (e) {
											consola.error("Restart processing failed", e);
										}
									}}
									disabled={fetcher.state !== "idle"}
									className="text-orange-600 focus:text-orange-600"
								>
									<RefreshCw className="mr-2 h-4 w-4" />
									Restart Processing
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => {
										try {
											fetcher.submit(
												{ interview_id: interview.id },
												{ method: "post", action: "/api.generate-sales-lens" }
											);
										} catch (e) {
											consola.error("Generate sales lens submit failed", e);
										}
									}}
									disabled={fetcher.state !== "idle" || isProcessing}
									className="text-blue-600 focus:text-blue-600"
								>
									Apply Lenses
								</DropdownMenuItem>
								{linkedOpportunity ? (
									<DropdownMenuItem asChild>
										<Link
											to={routes.opportunities.detail(linkedOpportunity.id)}
											className="flex items-center gap-2 text-emerald-700"
										>
											<Briefcase className="h-4 w-4" />
											View Opportunity: {linkedOpportunity.title}
										</Link>
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem asChild>
										<Link
											to={routes.opportunities.new()}
											state={{
												interviewId: interview.id,
												interviewTitle: interview.title,
											}}
											className="flex items-center gap-2 text-blue-700"
										>
											<Briefcase className="h-4 w-4" />
											Create Opportunity
										</Link>
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									onClick={() => {
										deleteFetcher.submit(
											{ interviewId: interview.id, projectId },
											{ method: "post", action: "/api/interviews/delete" }
										);
									}}
									disabled={deleteFetcher.state !== "idle"}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<Link
						to={routes.interviews.edit(interview.id)}
						className="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-semibold text-sm shadow-sm hover:bg-gray-50"
					>
						<Edit2 className="h-4 w-4" />
						Edit
					</Link>
				</div>
			</div>

			{/* Participant info */}
			<div className="flex flex-wrap items-center gap-2 text-sm">
				{linkedParticipants.length > 0 ? (
					<>
						<span className="text-muted-foreground">People:</span>
						{linkedParticipants.map((participant, index) => {
							const person = participant.people as {
								id: string;
								name: string;
								segment?: string | null;
								company?: string | null;
							};
							return (
								<span key={participant.id} className="inline-flex items-center gap-1.5">
									{index > 0 && <span className="text-muted-foreground">•</span>}
									<Link to={routes.people.detail(person.id)} className="font-medium text-foreground hover:underline">
										{person.name}
									</Link>
									{person.company && <span className="text-muted-foreground">({person.company})</span>}
									{person.segment && person.segment !== "Unknown" && (
										<Badge variant="outline" className="text-xs">
											{person.segment}
										</Badge>
									)}
								</span>
							);
						})}
						<button
							type="button"
							onClick={onOpenParticipantsDialog}
							className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="Edit participants"
						>
							<Edit2 className="h-3 w-3" />
						</button>
					</>
				) : interview.participant_pseudonym &&
					interview.participant_pseudonym !== "Anonymous" &&
					interview.participant_pseudonym !== "Participant 1" ? (
					<>
						<span className="text-muted-foreground">Participant:</span>
						<span className="font-medium text-foreground">{interview.participant_pseudonym}</span>
						<button
							type="button"
							onClick={onOpenParticipantsDialog}
							className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="Link to person"
						>
							<Edit2 className="h-3 w-3" />
						</button>
					</>
				) : (
					<Button
						variant="ghost"
						size="sm"
						onClick={onOpenParticipantsDialog}
						className={cn("h-7 gap-1.5 px-2", needsAttention && "text-amber-600 hover:text-amber-700")}
					>
						{needsAttention && <AlertTriangle className="h-3.5 w-3.5" />}
						<Users className="h-3.5 w-3.5" />
						<span className="text-xs">Link people</span>
					</Button>
				)}
			</div>

			{/* Metadata line */}
			<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
				<span>{formatReadable(interview.created_at)}</span>
				<span>&middot;</span>
				<span>By {creatorName}</span>
				{interview.duration_sec && (
					<>
						<span>&middot;</span>
						<span>
							{Math.floor(interview.duration_sec / 60)}m {interview.duration_sec % 60}s
						</span>
					</>
				)}
				{evidenceCount > 0 && (
					<>
						<span>&middot;</span>
						<Link to={evidenceFilterLink} className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
							<span>
								{evidenceCount} evidence {evidenceCount === 1 ? "point" : "points"}
							</span>
							<ArrowUpRight className="h-3.5 w-3.5" />
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
