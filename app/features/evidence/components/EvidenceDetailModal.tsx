/**
 * Evidence Detail Modal
 *
 * Displays a single evidence item in a dialog overlay, fetching data
 * from the API endpoint. Used from the evidence list page for quick preview.
 * Includes full grooming toolbar (vote, star, archive, delete).
 */
import { Archive, Loader2, Star, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router-dom";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useEntityFlags, useVoting } from "~/features/annotations/hooks";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import EvidenceCard from "./EvidenceCard";

interface EvidenceDetailModalProps {
	evidenceId: string | null;
	onClose: () => void;
}

interface EvidenceData {
	id: string;
	verbatim: string | null;
	gist: string | null;
	chunk: string | null;
	topic: string | null;
	support: string | null;
	confidence: string | null;
	journey_stage: string | null;
	method: string | null;
	anchors: any[] | null;
	interview_id: string | null;
	interview: {
		id: string;
		title?: string | null;
		media_url?: string | null;
		thumbnail_url?: string | null;
	} | null;
	people: Array<{
		id: string;
		name: string | null;
		role: string | null;
	}>;
	facets: Array<{
		kind_slug: string;
		label: string;
		person: { id: string; name: string | null } | null;
	}>;
}

export function EvidenceDetailModal({ evidenceId, onClose }: EvidenceDetailModalProps) {
	const [evidence, setEvidence] = useState<EvidenceData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isArchived, setIsArchived] = useState(false);
	const currentProject = useCurrentProject();
	const routes = useProjectRoutes(currentProject?.projectPath || "");
	const navigate = useNavigate();
	const deleteFetcher = useFetcher();
	const archiveFetcher = useFetcher();

	// Voting & flags hooks
	const { voteCounts, upvote, downvote, removeVote } = useVoting({
		entityType: "evidence",
		entityId: evidenceId ?? "",
	});
	const { flags, toggleFlag } = useEntityFlags({
		entityType: "evidence",
		entityId: evidenceId ?? "",
	});
	const userVote = voteCounts.user_vote;

	// Close modal after successful delete
	useEffect(() => {
		if (deleteFetcher.state === "idle" && deleteFetcher.data) {
			const data = deleteFetcher.data as { ok?: boolean; success?: boolean };
			if (data.ok || data.success) {
				onClose();
			}
		}
	}, [deleteFetcher.state, deleteFetcher.data, onClose]);

	const fetchEvidence = useCallback(
		async (id: string) => {
			if (!currentProject?.projectPath) return;
			setIsLoading(true);
			setError(null);
			try {
				const response = await fetch(`${currentProject.projectPath}/api/evidence/${id}`, { credentials: "include" });
				if (!response.ok) {
					setError("Failed to load evidence");
					return;
				}
				const data = await response.json();
				setEvidence(data.evidence);
			} catch {
				setError("Failed to load evidence");
			} finally {
				setIsLoading(false);
			}
		},
		[currentProject?.projectPath]
	);

	useEffect(() => {
		if (evidenceId) {
			fetchEvidence(evidenceId);
		} else {
			setEvidence(null);
		}
	}, [evidenceId, fetchEvidence]);

	const handleOpenFullPage = () => {
		if (evidenceId) {
			navigate(routes.evidence.detail(evidenceId));
		}
	};

	return (
		<Dialog open={!!evidenceId} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				)}

				{error && <div className="py-12 text-center text-muted-foreground text-sm">{error}</div>}

				{evidence && !isLoading && (
					<>
						{/* Grooming Toolbar */}
						<TooltipProvider delayDuration={300}>
							<div className="flex items-center gap-1.5 border-b pb-3">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={userVote === 1 ? "default" : "outline"}
											size="sm"
											onClick={() => (userVote === 1 ? removeVote() : upvote())}
											className="gap-1.5"
										>
											<ThumbsUp className="h-3.5 w-3.5" />
											{voteCounts.upvotes > 0 && <span className="text-xs">{voteCounts.upvotes}</span>}
										</Button>
									</TooltipTrigger>
									<TooltipContent>Verify — confirm this evidence is accurate</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={userVote === -1 ? "destructive" : "outline"}
											size="sm"
											onClick={() => (userVote === -1 ? removeVote() : downvote())}
											className="gap-1.5"
										>
											<ThumbsDown className="h-3.5 w-3.5" />
											{voteCounts.downvotes > 0 && <span className="text-xs">{voteCounts.downvotes}</span>}
										</Button>
									</TooltipTrigger>
									<TooltipContent>Reject — flag this evidence as inaccurate</TooltipContent>
								</Tooltip>

								<div className="mx-1 h-5 w-px bg-border" />

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={flags.starred ? "secondary" : "outline"}
											size="sm"
											onClick={() => toggleFlag("starred")}
											className="gap-1.5"
										>
											<Star className={cn("h-3.5 w-3.5", flags.starred && "fill-amber-400 text-amber-400")} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Star — mark as important</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={isArchived ? "secondary" : "outline"}
											size="sm"
											onClick={() => {
												const newValue = !isArchived;
												setIsArchived(newValue);
												archiveFetcher.submit(
													{
														_action: "toggle-archive",
														archived: String(newValue),
													},
													{
														method: "post",
														action: routes.evidence.detail(evidenceId!),
													}
												);
											}}
											className="gap-1.5"
										>
											<Archive className="h-3.5 w-3.5" />
											{isArchived ? "Archived" : "Archive"}
										</Button>
									</TooltipTrigger>
									<TooltipContent>Archive — remove from views</TooltipContent>
								</Tooltip>

								<AlertDialog>
									<Tooltip>
										<TooltipTrigger asChild>
											<AlertDialogTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</AlertDialogTrigger>
										</TooltipTrigger>
										<TooltipContent>Delete this evidence</TooltipContent>
									</Tooltip>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Delete evidence?</AlertDialogTitle>
											<AlertDialogDescription>
												This will remove this evidence from all views and analysis. You can recover it from Recently
												Deleted within 30 days.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												onClick={() => {
													if (!evidenceId) return;
													deleteFetcher.submit(
														{ _action: "delete-evidence" },
														{
															method: "post",
															action: routes.evidence.detail(evidenceId),
														}
													);
												}}
											>
												Delete
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>

								{isArchived && (
									<Badge variant="secondary" className="ml-1 text-xs">
										Archived
									</Badge>
								)}

								<div className="ml-auto">
									<Button variant="outline" size="sm" onClick={handleOpenFullPage}>
										Open full page
									</Button>
								</div>
							</div>
						</TooltipProvider>

						<EvidenceCard
							evidence={evidence as any}
							people={
								evidence.people?.map((p) => ({
									...p,
									personas: [],
								})) || []
							}
							interview={evidence.interview}
							variant="expanded"
							showInterviewLink={true}
							projectPath={currentProject?.projectPath || undefined}
						/>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
