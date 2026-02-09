/**
 * EvidenceVerificationDrawer — side drawer for verifying AI-extracted evidence
 * against the source transcript. Three display modes:
 *   1. Focused: evidence snippet + tags + "Open in Evidence Detail" link
 *   2. In Context: evidence highlighted within surrounding transcript paragraphs
 *   3. Full Transcript: all evidence highlighted, scrolled to relevant passage
 *
 * No CRUD on this surface — edit links go to the evidence detail page.
 */
import { ArrowUpRight, Clock, Eye, FileText, Maximize2, Minimize2, Quote, ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { useCurrentProject } from "~/contexts/current-project-context";
import { cn } from "~/lib/utils";
import type { NormalizedUtterance } from "~/utils/transcript/normalizeUtterances";
import { normalizeTranscriptUtterances } from "~/utils/transcript/normalizeUtterances";
import {
	buildUtteranceEvidenceMap,
	extractEvidenceTimeRange,
	findBestUtteranceIndex,
	findOverlappingUtterances,
} from "../lib/evidenceTranscriptMap";

type DrawerView = "focused" | "context" | "transcript";

interface EvidenceItem {
	id: string;
	verbatim: string | null;
	gist: string | null;
	topic: string | null;
	support: string | null;
	confidence: string | null;
	anchors: unknown;
}

interface Participant {
	id: number;
	role: string | null;
	transcript_key: string | null;
	display_name: string | null;
	people?: { id?: string; name?: string | null };
}

interface EvidenceVerificationDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The currently selected evidence item */
	selectedEvidence: EvidenceItem | null;
	/** All evidence for this interview (for full transcript highlights) */
	allEvidence: EvidenceItem[];
	/** Interview metadata */
	interview: {
		id: string;
		duration_sec: number | null;
		hasTranscript?: boolean;
		hasFormattedTranscript?: boolean;
		participants: Participant[];
	};
	/** Route builder for evidence detail links */
	evidenceDetailRoute: (id: string) => string;
}

function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return h > 0
		? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
		: `${m}:${s.toString().padStart(2, "0")}`;
}

function getSpeakerName(speakerKey: string, participants: Participant[]): string {
	const normalizedKey = speakerKey.toUpperCase();

	const match = participants.find((p) => {
		if (!p.transcript_key) return false;
		const tk = p.transcript_key.toUpperCase();
		return tk === normalizedKey || tk === `SPEAKER ${normalizedKey}` || `SPEAKER ${tk}` === normalizedKey;
	});

	if (match) {
		return match.people?.name || match.display_name || `Speaker ${normalizedKey}`;
	}

	if (normalizedKey === "A") {
		const interviewer = participants.find((p) => p.role === "interviewer");
		if (interviewer?.people?.name) return interviewer.people.name;
	} else if (normalizedKey === "B") {
		const participant = participants.find((p) => p.role === "participant");
		if (participant?.people?.name) return participant.people.name;
	}

	if (!/^[A-Z]$/.test(normalizedKey) && !/^SPEAKER\s+[A-Z0-9]+$/.test(normalizedKey)) {
		return speakerKey;
	}

	return `Speaker ${normalizedKey}`;
}

export function EvidenceVerificationDrawer({
	open,
	onOpenChange,
	selectedEvidence,
	allEvidence,
	interview,
	evidenceDetailRoute,
}: EvidenceVerificationDrawerProps) {
	const [view, setView] = useState<DrawerView>("context");
	const [utterances, setUtterances] = useState<NormalizedUtterance[]>([]);
	const [loading, setLoading] = useState(false);
	const [transcriptLoaded, setTranscriptLoaded] = useState(false);
	const [auditMode, setAuditMode] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);
	const currentProject = useCurrentProject();

	// Reset view when evidence changes
	useEffect(() => {
		if (selectedEvidence) {
			setView("context");
		}
	}, [selectedEvidence?.id]);

	// Load transcript when drawer opens (if not already loaded)
	useEffect(() => {
		if (!open || transcriptLoaded || loading) return;
		if (!interview.hasTranscript && !interview.hasFormattedTranscript) return;
		if (!currentProject?.accountId || !currentProject?.projectId) return;

		const loadTranscript = async () => {
			setLoading(true);
			try {
				const params = new URLSearchParams({
					interviewId: interview.id,
				});
				const response = await fetch(
					`/a/${currentProject.accountId}/${currentProject.projectId}/api/interview-transcript?${params}`
				);
				if (!response.ok) return;

				const data = await response.json();
				const audioDurationRaw = data.transcript_formatted?.audio_duration;
				const audioDurationParsed =
					typeof audioDurationRaw === "string" ? Number.parseFloat(audioDurationRaw) : audioDurationRaw;
				const audioDurationSec =
					typeof audioDurationParsed === "number" && Number.isFinite(audioDurationParsed)
						? audioDurationParsed
						: (interview.duration_sec ?? null);

				const normalized = normalizeTranscriptUtterances(data.transcript_formatted?.speaker_transcripts || [], {
					audioDurationSec,
				});
				setUtterances(normalized);
				setTranscriptLoaded(true);
			} finally {
				setLoading(false);
			}
		};

		loadTranscript();
	}, [open, transcriptLoaded, loading, interview, currentProject]);

	// Scroll to highlighted utterance when view changes or evidence changes
	useEffect(() => {
		if (view !== "context" && view !== "transcript") return;
		if (!highlightRef.current) return;

		const timer = setTimeout(() => {
			highlightRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}, 100);
		return () => clearTimeout(timer);
	}, [view, selectedEvidence?.id, transcriptLoaded]);

	// Evidence time range for the selected item
	const selectedRange = useMemo(() => {
		if (!selectedEvidence) return null;
		return extractEvidenceTimeRange(selectedEvidence.id, selectedEvidence.anchors);
	}, [selectedEvidence]);

	// Overlapping utterances for selected evidence
	const overlappingIndices = useMemo(() => {
		if (!selectedRange || utterances.length === 0) return new Set<number>();
		return new Set(findOverlappingUtterances(selectedRange, utterances));
	}, [selectedRange, utterances]);

	// Best utterance to scroll to
	const bestIndex = useMemo(() => {
		if (!selectedRange || utterances.length === 0) return 0;
		return findBestUtteranceIndex(selectedRange, utterances);
	}, [selectedRange, utterances]);

	// All evidence highlights map (for full transcript view + audit stats)
	const allHighlightsMap = useMemo(() => {
		if (view !== "transcript" || utterances.length === 0) {
			return new Map<number, string[]>();
		}
		return buildUtteranceEvidenceMap(allEvidence, utterances);
	}, [view, allEvidence, utterances]);

	// Coverage stats for audit mode
	const coverageStats = useMemo(() => {
		if (view !== "transcript" || utterances.length === 0) return { coded: 0, total: 0, pct: 0 };
		const coded = allHighlightsMap.size;
		const total = utterances.length;
		return { coded, total, pct: Math.round((coded / total) * 100) };
	}, [view, allHighlightsMap, utterances]);

	// Context range: 3 utterances before and after the highlighted ones
	const contextRange = useMemo(() => {
		if (overlappingIndices.size === 0) return { start: 0, end: 0 };
		const indices = Array.from(overlappingIndices);
		const min = Math.min(...indices);
		const max = Math.max(...indices);
		return {
			start: Math.max(0, min - 3),
			end: Math.min(utterances.length - 1, max + 3),
		};
	}, [overlappingIndices, utterances.length]);

	const renderUtterance = useCallback(
		(u: NormalizedUtterance, idx: number, isHighlighted: boolean, isSelected: boolean, isUncoded?: boolean) => {
			const speakerName = getSpeakerName(u.speaker, interview.participants);
			const isRefTarget = isSelected && idx === bestIndex;

			return (
				<div
					key={`u-${idx}`}
					ref={isRefTarget ? highlightRef : undefined}
					className={cn(
						"rounded-md px-3 py-2 transition-colors",
						isHighlighted && isSelected && "border-primary border-l-4 bg-primary/10",
						isHighlighted && !isSelected && "border-amber-400 border-l-4 bg-amber-50 dark:bg-amber-900/20",
						!isHighlighted && !isUncoded && "hover:bg-muted/30",
						isUncoded && "border-muted-foreground/20 border-l-4 border-dashed bg-muted/10 opacity-60"
					)}
				>
					<div className="mb-1 flex items-center gap-2">
						<span className="font-medium text-foreground text-xs">{speakerName}</span>
						<span className="text-[10px] text-muted-foreground">{formatTimestamp(u.start)}</span>
					</div>
					<p className="text-foreground text-sm leading-relaxed">{u.text}</p>
				</div>
			);
		},
		[interview.participants, bestIndex]
	);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg md:max-w-xl lg:max-w-2xl"
			>
				<SheetHeader className="shrink-0 border-border border-b bg-muted/40 p-4">
					<div className="flex items-center justify-between">
						<SheetTitle className="flex items-center gap-2 text-base">
							<Eye className="h-4 w-4 text-primary" />
							Verify Evidence
						</SheetTitle>
						{/* View toggle + audit mode */}
						<div className="flex items-center gap-2">
							{view === "transcript" && (
								<button
									onClick={() => setAuditMode((prev) => !prev)}
									className={cn(
										"flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
										auditMode
											? "border-primary bg-primary/10 text-primary"
											: "border-border text-muted-foreground hover:text-foreground"
									)}
									title="Toggle audit mode — show coverage gaps"
								>
									<ScanLine className="h-3 w-3" />
									Audit
								</button>
							)}
							<div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
								<button
									onClick={() => setView("focused")}
									className={cn(
										"rounded px-2 py-1 text-xs transition-colors",
										view === "focused"
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									<Quote className="h-3 w-3" />
								</button>
								<button
									onClick={() => setView("context")}
									className={cn(
										"rounded px-2 py-1 text-xs transition-colors",
										view === "context"
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									<Minimize2 className="h-3 w-3" />
								</button>
								<button
									onClick={() => setView("transcript")}
									className={cn(
										"rounded px-2 py-1 text-xs transition-colors",
										view === "transcript"
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									<Maximize2 className="h-3 w-3" />
								</button>
							</div>
						</div>
					</div>
				</SheetHeader>

				{/* Content area */}
				<div ref={scrollRef} className="flex-1 overflow-y-auto">
					{!selectedEvidence ? (
						<div className="flex h-full items-center justify-center p-8">
							<p className="text-muted-foreground text-sm">
								Select an evidence item to verify it against the transcript.
							</p>
						</div>
					) : (
						<div className="space-y-0">
							{/* Evidence card (always visible at top) */}
							<div className="border-border border-b bg-muted/20 p-4">
								<div className="space-y-2">
									{selectedEvidence.topic && (
										<Badge variant="outline" className="text-xs">
											{selectedEvidence.topic}
										</Badge>
									)}
									{selectedEvidence.verbatim && (
										<blockquote className="border-primary/40 border-l-2 pl-3 text-foreground text-sm italic">
											&ldquo;{selectedEvidence.verbatim}&rdquo;
										</blockquote>
									)}
									{selectedEvidence.gist && <p className="text-muted-foreground text-sm">{selectedEvidence.gist}</p>}
									<div className="flex flex-wrap items-center gap-2">
										{selectedRange && (
											<span className="flex items-center gap-1 text-muted-foreground text-xs">
												<Clock className="h-3 w-3" />
												{formatTimestamp(selectedRange.startSec)}
											</span>
										)}
										{selectedEvidence.support && (
											<Badge
												variant="outline"
												className={cn(
													"text-[10px]",
													selectedEvidence.support === "supports" && "border-green-300 text-green-700",
													selectedEvidence.support === "opposes" && "border-red-300 text-red-700"
												)}
											>
												{selectedEvidence.support}
											</Badge>
										)}
										{selectedEvidence.confidence && (
											<span className="text-[10px] text-muted-foreground">
												{selectedEvidence.confidence} confidence
											</span>
										)}
									</div>
									<Link
										to={evidenceDetailRoute(selectedEvidence.id)}
										className="inline-flex items-center gap-1 text-primary text-xs hover:text-primary/80"
									>
										Open in Evidence Detail
										<ArrowUpRight className="h-3 w-3" />
									</Link>
								</div>
							</div>

							{/* Transcript section */}
							{loading && (
								<div className="flex items-center justify-center p-8">
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
										<span className="text-muted-foreground text-sm">Loading transcript...</span>
									</div>
								</div>
							)}

							{!loading && !transcriptLoaded && (interview.hasTranscript || interview.hasFormattedTranscript) && (
								<div className="flex items-center justify-center p-8">
									<p className="text-muted-foreground text-sm">Transcript loading...</p>
								</div>
							)}

							{!loading && !interview.hasTranscript && !interview.hasFormattedTranscript && (
								<div className="flex flex-col items-center gap-2 p-8 text-center">
									<FileText className="h-8 w-8 text-muted-foreground/50" />
									<p className="text-muted-foreground text-sm">No transcript available to verify against.</p>
								</div>
							)}

							{transcriptLoaded && utterances.length > 0 && (
								<div className="p-3">
									{view === "focused" && (
										<div className="space-y-1">
											{overlappingIndices.size > 0 ? (
												Array.from(overlappingIndices)
													.sort((a, b) => a - b)
													.map((idx) => renderUtterance(utterances[idx], idx, true, true))
											) : (
												<p className="py-4 text-center text-muted-foreground text-sm">
													Could not locate this evidence in the transcript. Timestamps may not match.
												</p>
											)}
										</div>
									)}

									{view === "context" && (
										<div className="space-y-1">
											{utterances.slice(contextRange.start, contextRange.end + 1).map((u, relIdx) => {
												const absIdx = contextRange.start + relIdx;
												return renderUtterance(
													u,
													absIdx,
													overlappingIndices.has(absIdx),
													overlappingIndices.has(absIdx)
												);
											})}
											{overlappingIndices.size === 0 && (
												<p className="py-4 text-center text-muted-foreground text-sm">
													Could not locate this evidence in the transcript.
												</p>
											)}
										</div>
									)}

									{view === "transcript" && (
										<div className="space-y-1">
											{auditMode && (
												<div className="mb-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
													<div className="flex items-center justify-between text-xs">
														<span className="font-medium text-foreground">Evidence Coverage</span>
														<span className="text-muted-foreground">
															{coverageStats.coded}/{coverageStats.total} utterances coded ({coverageStats.pct}%)
														</span>
													</div>
													<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
														<div
															className="h-full rounded-full bg-primary transition-all"
															style={{
																width: `${coverageStats.pct}%`,
															}}
														/>
													</div>
													<div className="flex items-center gap-4 text-[10px] text-muted-foreground">
														<span className="flex items-center gap-1">
															<span className="inline-block h-2 w-2 rounded-sm border-amber-400 border-l-2 bg-amber-50" />
															Coded
														</span>
														<span className="flex items-center gap-1">
															<span className="inline-block h-2 w-2 rounded-sm border-muted-foreground/20 border-l-2 border-dashed bg-muted/10" />
															Uncoded (gap)
														</span>
													</div>
												</div>
											)}
											{utterances.map((u, idx) => {
												const highlightEvidenceIds = allHighlightsMap.get(idx) || [];
												const isSelectedHighlight = overlappingIndices.has(idx);
												const isAnyHighlight = highlightEvidenceIds.length > 0;
												const isUncoded = auditMode && !isAnyHighlight && !isSelectedHighlight;

												return renderUtterance(u, idx, isAnyHighlight, isSelectedHighlight, isUncoded);
											})}
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer with stats */}
				{transcriptLoaded && selectedEvidence && (
					<div className="shrink-0 border-border border-t bg-muted/20 px-4 py-2">
						<div className="flex items-center justify-between text-muted-foreground text-xs">
							<span>
								{utterances.length} utterances &middot; {allEvidence.length} evidence items
								{auditMode && view === "transcript" && ` · ${coverageStats.pct}% coded`}
							</span>
							<span>
								{view === "focused"
									? "Showing matched utterances"
									: view === "context"
										? "Showing surrounding context"
										: auditMode
											? "Audit: showing coverage"
											: "Full transcript"}
							</span>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
