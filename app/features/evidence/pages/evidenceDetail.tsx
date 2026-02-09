/**
 * Evidence Detail Page
 *
 * Displays a single piece of evidence with a YouTube-chapters-style layout:
 * - Main display area showing the currently selected evidence
 * - Horizontal carousel of related evidence as chapter cards
 * - Grooming toolbar for verify/reject/edit/archive
 */
import consola from "consola";
import { Archive, Check, Clock, Edit2, Star, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
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
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useEntityFlags, useVoting } from "~/features/annotations/hooks";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { cn } from "~/lib/utils";
import { userContext } from "~/server/user-context";
import { getAnchorStartSeconds, type MediaAnchor } from "~/utils/media-url.client";
import { createProjectRoutes } from "~/utils/routes.server";
import EvidenceCard from "../components/EvidenceCard";

type EvidencePersonRow = {
	role: string | null;
	person_id: string | null;
};

type TransformedEvidence = {
	id: string;
	verbatim: string | null;
	gist: string | null;
	chunk: string | null;
	topic: string | null;
	support: string | null;
	confidence: string | null;
	created_at: string | null;
	journey_stage: string | null;
	method: string | null;
	anchors: MediaAnchor[] | null;
	interview_id: string | null;
	source_type?: string | null;
	facets: Array<{
		kind_slug: string;
		label: string;
		facet_account_id: number;
		person?: { id: string; name: string | null } | null;
	}>;
	people: Array<{
		id: string;
		name: string | null;
		role: string | null;
		personas: Array<{ id: string; name: string }>;
	}>;
	interview?: {
		id: string;
		title?: string | null;
		media_url?: string | null;
		thumbnail_url?: string | null;
		transcript?: any;
		transcript_formatted?: any;
		duration_sec?: number | null;
	} | null;
};

function isValidUuid(value: string): boolean {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext);
	const { evidenceId, accountId, projectId } = params;

	consola.log("Evidence loader params:", { evidenceId, accountId, projectId });

	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 });
	if (!isValidUuid(evidenceId)) {
		throw new Response("Invalid evidence identifier", { status: 400 });
	}

	// Build projectPath for nested routes
	const projectPath = accountId && projectId ? `/a/${accountId}/${projectId}` : null;

	// Parse simple ?t=seconds parameter (like YouTube)
	const url = new URL(request.url);
	const timeParam = url.searchParams.get("t");

	let anchorOverride = null;
	if (timeParam) {
		const seconds = Number.parseFloat(timeParam);
		if (!Number.isNaN(seconds) && seconds > 0) {
			// Create a simple anchor with the time
			// Use "media" type so EvidenceCard recognizes it as a playable timestamp
			anchorOverride = {
				type: "media",
				start_ms: seconds * 1000, // Store as milliseconds (standard format)
				start_seconds: seconds, // Also provide seconds for compatibility
			};
		}
	}

	// Fetch evidence with interview data (excluding evidence_tag to avoid multiple rows issue)
	// Note: RLS policies handle access control, so we only filter by ID
	const query = supabase
		.from("evidence")
		.select(
			`
			*,
			interview:interview_id(
				id,
				title,
				media_url,
				thumbnail_url,
				transcript,
				transcript_formatted,
				duration_sec
			)
		`,
			{ count: "exact" }
		)
		.eq("id", evidenceId);

	const { data: evidenceData, error: evidenceError, count } = await query;

	consola.log("Evidence query result:", {
		evidenceId,
		accountId,
		projectId,
		count,
		isArray: Array.isArray(evidenceData),
		length: Array.isArray(evidenceData) ? evidenceData.length : "not array",
		hasData: !!evidenceData,
		dataType: typeof evidenceData,
		error: evidenceError,
	});

	if (evidenceError) {
		consola.error("Evidence query error:", evidenceError);
		throw new Error(`Failed to load evidence: ${evidenceError.message}`);
	}

	// Supabase .select() without .single() returns an array
	if (!evidenceData || !Array.isArray(evidenceData) || evidenceData.length === 0) {
		consola.error("Evidence not found - filters may be too restrictive", {
			evidenceId,
			accountId,
			projectId,
			count,
		});
		throw new Error(`Evidence not found (ID: ${evidenceId})`);
	}

	// Get first row
	const evidence = evidenceData[0];

	// Fetch linked people and facets without relational joins so evidence still renders if join metadata is stale.
	const { data: peopleData, error: peopleError } = await supabase
		.from("evidence_people")
		.select("role, person_id")
		.eq("evidence_id", evidenceId);
	if (peopleError) {
		consola.warn(`[evidence/detail] Failed to load evidence people: ${peopleError.message}`);
	}

	const { data: facetData, error: facetError } = await supabase
		.from("evidence_facet")
		.select("kind_slug, label, facet_account_id, person_id")
		.eq("evidence_id", evidenceId);
	if (facetError) {
		consola.warn(`[evidence/detail] Failed to load evidence facets: ${facetError.message}`);
	}

	const linkedPersonIds = new Set<string>();
	for (const row of (peopleData ?? []) as Array<{ person_id: string | null }>) {
		if (row.person_id) linkedPersonIds.add(row.person_id);
	}
	for (const row of (facetData ?? []) as Array<{ person_id: string | null }>) {
		if (row.person_id) linkedPersonIds.add(row.person_id);
	}

	const personNameById = new Map<string, string | null>();
	if (linkedPersonIds.size > 0) {
		let peopleQuery = supabase.from("people").select("id, name").in("id", Array.from(linkedPersonIds));
		if (projectId) {
			peopleQuery = peopleQuery.eq("project_id", projectId);
		}
		const { data: personRows, error: personErr } = await peopleQuery;
		if (personErr) {
			consola.warn(`[evidence/detail] Failed to load people names: ${personErr.message}`);
		}
		for (const row of (personRows ?? []) as Array<{
			id: string;
			name: string | null;
		}>) {
			personNameById.set(row.id, row.name ?? null);
		}
	}

	const primaryFacets = (facetData ?? []).map((row: any) => ({
		kind_slug: row.kind_slug,
		label: row.label,
		facet_account_id: row.facet_account_id ?? 0,
		person: row.person_id ? { id: row.person_id, name: personNameById.get(row.person_id) ?? null } : null,
	}));

	const data = {
		...evidence,
		people: peopleData || [],
	};

	// Transform the data to match EvidenceCard expectations
	const peopleRows = (data.people ?? []) as EvidencePersonRow[];
	const transformedEvidence = {
		...data,
		// If anchor override is provided, use it instead of stored anchors
		anchors: anchorOverride
			? [anchorOverride, ...(Array.isArray(data.anchors) ? (data.anchors as any[]) : [])]
			: data.anchors,
		people: peopleRows
			.filter((row) => Boolean(row.person_id))
			.map((row) => ({
				id: row.person_id as string,
				name: personNameById.get(row.person_id as string) ?? null,
				role: row.role,
				personas: [], // No personas data needed for now
			})),
		facets: primaryFacets,
	};

	// Related evidence in the same scene/topic
	let relatedEvidence: Array<any> = [];
	const topic = transformedEvidence.topic as string | null;
	const interviewId = transformedEvidence.interview_id as string | null;
	if (topic && interviewId) {
		const { data: related, error: relatedError } = await supabase
			.from("evidence")
			.select(
				"id, verbatim, gist, chunk, topic, support, confidence, created_at, journey_stage, method, anchors, interview_id"
			)
			.eq("interview_id", interviewId)
			.eq("topic", topic)
			.neq("id", evidenceId)
			.is("deleted_at", null)
			.eq("is_archived", false)
			.order("created_at", { ascending: true })
			.limit(20);
		if (!relatedError && Array.isArray(related)) relatedEvidence = related;

		if (Array.isArray(relatedEvidence) && relatedEvidence.length > 0) {
			const relatedIds = relatedEvidence.map((ev: any) => ev.id).filter(Boolean);
			if (relatedIds.length > 0) {
				// Load facets and people for related evidence without relational joins.
				const { data: relatedFacets, error: relatedFacetError } = await supabase
					.from("evidence_facet")
					.select("evidence_id, kind_slug, label, facet_account_id, person_id")
					.in("evidence_id", relatedIds);
				if (relatedFacetError) {
					consola.warn(`[evidence/detail] Failed to load related facets: ${relatedFacetError.message}`);
				}

				const { data: relatedPeople, error: relatedPeopleError } = await supabase
					.from("evidence_people")
					.select("evidence_id, role, person_id")
					.in("evidence_id", relatedIds);
				if (relatedPeopleError) {
					consola.warn(`[evidence/detail] Failed to load related people: ${relatedPeopleError.message}`);
				}

				const relatedPersonIds = new Set<string>();
				for (const row of (relatedFacets ?? []) as Array<{
					person_id: string | null;
				}>) {
					if (row.person_id) relatedPersonIds.add(row.person_id);
				}
				for (const row of (relatedPeople ?? []) as Array<{
					person_id: string | null;
				}>) {
					if (row.person_id) relatedPersonIds.add(row.person_id);
				}

				const relatedPersonNames = new Map<string, string | null>();
				if (relatedPersonIds.size > 0) {
					let relatedPeopleQuery = supabase.from("people").select("id, name").in("id", Array.from(relatedPersonIds));
					if (projectId) {
						relatedPeopleQuery = relatedPeopleQuery.eq("project_id", projectId);
					}
					const { data: relatedPersonRows, error: relatedPersonErr } = await relatedPeopleQuery;
					if (relatedPersonErr) {
						consola.warn(`[evidence/detail] Failed to load related people names: ${relatedPersonErr.message}`);
					}
					for (const row of (relatedPersonRows ?? []) as Array<{
						id: string;
						name: string | null;
					}>) {
						relatedPersonNames.set(row.id, row.name ?? null);
					}
				}

				const facetMap = new Map<
					string,
					Array<{
						kind_slug: string;
						label: string;
						facet_account_id: number;
						person: { id: string; name: string | null } | null;
					}>
				>();
				for (const row of relatedFacets ?? []) {
					if (!row || typeof row !== "object") continue;
					const evidence_id = (row as any).evidence_id as string | undefined;
					const kind_slug = (row as any).kind_slug as string | undefined;
					const label = (row as any).label as string | undefined;
					const facetAccountId = (row as any).facet_account_id as number | null | undefined;
					const personId = (row as any).person_id as string | null | undefined;
					if (!evidence_id || !kind_slug || !label || !facetAccountId) continue;
					const list = facetMap.get(evidence_id) ?? [];
					list.push({
						kind_slug,
						label,
						facet_account_id: facetAccountId,
						person: personId ? { id: personId, name: relatedPersonNames.get(personId) ?? null } : null,
					});
					facetMap.set(evidence_id, list);
				}

				const peopleMap = new Map<
					string,
					Array<{
						id: string;
						name: string | null;
						role: string | null;
						personas: any[];
					}>
				>();
				for (const row of relatedPeople ?? []) {
					if (!row || typeof row !== "object") continue;
					const evidence_id = (row as any).evidence_id as string | undefined;
					const role = (row as any).role as string | null;
					const personId = (row as any).person_id as string | null | undefined;
					if (!evidence_id || !personId) continue;
					const list = peopleMap.get(evidence_id) ?? [];
					list.push({
						id: personId,
						name: relatedPersonNames.get(personId) ?? null,
						role,
						personas: [],
					});
					peopleMap.set(evidence_id, list);
				}

				relatedEvidence = relatedEvidence.map((ev: any) => ({
					...ev,
					facets: facetMap.get(ev.id) ?? [],
					people: peopleMap.get(ev.id) ?? [],
				}));
			}
		}
	}

	return {
		evidence: transformedEvidence,
		relatedEvidence,
		anchorFromUrl: anchorOverride,
		projectPath,
		accountId: accountId || null,
		projectId: projectId || null,
	};
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const { supabase } = context.get(userContext);
	const { accountId, projectId, evidenceId } = params;

	if (!accountId || !projectId || !evidenceId) {
		throw new Response("Missing required params", { status: 400 });
	}

	const formData = await request.formData();
	const intent = formData.get("_action");

	if (intent === "delete-evidence") {
		const { error } = await supabase
			.from("evidence")
			.update({ deleted_at: new Date().toISOString() })
			.eq("id", evidenceId)
			.eq("project_id", projectId);

		if (error) {
			consola.error("Failed to soft-delete evidence:", error);
			return { error: "Failed to delete evidence" };
		}

		const routes = createProjectRoutes(accountId, projectId);
		return redirect(routes.evidence.index());
	}

	if (intent === "toggle-archive") {
		const archived = formData.get("archived") === "true";
		const { error } = await supabase
			.from("evidence")
			.update({ is_archived: archived })
			.eq("id", evidenceId)
			.eq("project_id", projectId);

		if (error) {
			consola.error("Failed to toggle archive:", error);
			return { error: "Failed to update archive status" };
		}

		return { ok: true };
	}

	return { error: "Unknown action" };
}

// ────────────────────────────────────────────────────────────────────────────
// Chapter Card Component
// ────────────────────────────────────────────────────────────────────────────

interface EvidenceChapterCardProps {
	evidence: TransformedEvidence;
	isSelected: boolean;
	onClick: () => void;
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

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
}

function getJourneyStageColor(stage?: string | null): string {
	if (!stage) return "bg-blue-500";
	switch (stage.toLowerCase()) {
		case "awareness":
			return "bg-amber-500";
		case "consideration":
			return "bg-violet-500";
		case "decision":
			return "bg-emerald-500";
		case "onboarding":
			return "bg-cyan-500";
		case "retention":
			return "bg-indigo-500";
		default:
			return "bg-blue-500";
	}
}

function EvidenceChapterCard({ evidence, isSelected, onClick }: EvidenceChapterCardProps) {
	const anchors = Array.isArray(evidence.anchors) ? (evidence.anchors as MediaAnchor[]) : [];
	const firstAnchor = anchors[0];
	const seconds = firstAnchor ? getAnchorStartSeconds(firstAnchor) : 0;
	const gist = evidence.gist || evidence.verbatim || "Evidence";
	const accentColor = getJourneyStageColor(evidence.journey_stage);

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group relative flex h-20 w-48 shrink-0 flex-col overflow-hidden rounded-lg border bg-background text-left transition-all",
				"hover:border-primary/50 hover:shadow-sm",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20"
			)}
		>
			{/* Accent bar */}
			<div className={cn("h-1 w-full", accentColor)} />

			{/* Content */}
			<div className="flex flex-1 flex-col justify-between p-2.5">
				{/* Gist - primary content */}
				<p
					className={cn(
						"line-clamp-2 text-sm leading-tight",
						isSelected ? "font-medium text-foreground" : "text-muted-foreground"
					)}
				>
					{truncateText(gist, 50)}
				</p>

				{/* Timestamp - secondary, below text */}
				<div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
					<Clock className="h-3 w-3" />
					<span>{seconds > 0 ? formatTimestamp(seconds) : "0:00"}</span>
				</div>
			</div>

			{/* Selection indicator */}
			{isSelected && <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />}
		</button>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Inline Editable Field
// ────────────────────────────────────────────────────────────────────────────

const SUPPORT_OPTIONS = [
	{ value: "supports", label: "Supports" },
	{ value: "neutral", label: "Neutral" },
	{ value: "opposes", label: "Opposes" },
];

const CONFIDENCE_OPTIONS = [
	{ value: "high", label: "High" },
	{ value: "medium", label: "Medium" },
	{ value: "low", label: "Low" },
];

const JOURNEY_STAGE_OPTIONS = [
	{ value: "awareness", label: "Awareness" },
	{ value: "consideration", label: "Consideration" },
	{ value: "decision", label: "Decision" },
	{ value: "onboarding", label: "Onboarding" },
	{ value: "retention", label: "Retention" },
];

function EditableField({
	label,
	fieldName,
	value,
	onSave,
	multiline = false,
	options,
}: {
	label: string;
	fieldName: string;
	value: string | null;
	onSave: (fieldName: string, value: string) => void;
	multiline?: boolean;
	options?: Array<{ value: string; label: string }>;
}) {
	const [localValue, setLocalValue] = useState(value || "");
	const [isDirty, setIsDirty] = useState(false);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	// Reset when the source value changes (e.g. selecting a different evidence)
	useEffect(() => {
		setLocalValue(value || "");
		setIsDirty(false);
	}, [value]);

	const handleChange = useCallback(
		(newValue: string) => {
			setLocalValue(newValue);
			setIsDirty(true);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			// For selects, save immediately since there's no typing
			const delay = options ? 100 : 1000;
			debounceRef.current = setTimeout(() => {
				onSave(fieldName, newValue);
				setIsDirty(false);
			}, delay);
		},
		[fieldName, onSave, options]
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const inputClassName =
		"w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

	return (
		<div className="space-y-1">
			<div className="flex items-center gap-2">
				<label className="font-medium text-muted-foreground text-xs">{label}</label>
				{isDirty && <span className="text-muted-foreground/60 text-xs">saving...</span>}
			</div>
			{options ? (
				<select value={localValue} onChange={(e) => handleChange(e.target.value)} className={inputClassName}>
					<option value="">—</option>
					{options.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			) : multiline ? (
				<Textarea
					value={localValue}
					onChange={(e) => handleChange(e.target.value)}
					className="min-h-[60px] resize-y text-sm"
					rows={3}
				/>
			) : (
				<input
					type="text"
					value={localValue}
					onChange={(e) => handleChange(e.target.value)}
					className={inputClassName}
				/>
			)}
		</div>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

export default function EvidenceDetail() {
	const { evidence, relatedEvidence, projectPath, anchorFromUrl, accountId, projectId } =
		useLoaderData<typeof loader>();
	const interview = evidence.interview;

	// Combine main evidence with related evidence for the carousel
	const allEvidence = useMemo(() => {
		const related = Array.isArray(relatedEvidence) ? relatedEvidence : [];
		const combined = [evidence, ...related] as TransformedEvidence[];

		// Sort by timestamp (from anchors)
		return combined.sort((a, b) => {
			const aAnchors = Array.isArray(a.anchors) ? (a.anchors as MediaAnchor[]) : [];
			const bAnchors = Array.isArray(b.anchors) ? (b.anchors as MediaAnchor[]) : [];
			const aTime = aAnchors[0] ? getAnchorStartSeconds(aAnchors[0]) : 0;
			const bTime = bAnchors[0] ? getAnchorStartSeconds(bAnchors[0]) : 0;
			return aTime - bTime;
		});
	}, [evidence, relatedEvidence]);

	// Track which evidence is currently selected
	const [selectedId, setSelectedId] = useState<string>(evidence.id);

	const selectedEvidence = useMemo(() => {
		return allEvidence.find((ev) => ev.id === selectedId) || evidence;
	}, [allEvidence, selectedId, evidence]);

	const evidenceName =
		(selectedEvidence as any)?.title ||
		selectedEvidence.gist ||
		selectedEvidence.chunk ||
		selectedEvidence.verbatim ||
		"Evidence";

	// If there's a timestamp anchor from URL, inject it into evidence.anchors
	const evidenceWithAnchor = useMemo(() => {
		if (anchorFromUrl && selectedEvidence.id === evidence.id) {
			return {
				...selectedEvidence,
				anchors: [anchorFromUrl, ...(Array.isArray(selectedEvidence.anchors) ? selectedEvidence.anchors : [])],
			};
		}
		return selectedEvidence;
	}, [anchorFromUrl, selectedEvidence, evidence.id]);

	// Scroll to top when navigating to this page, UNLESS there's a timestamp anchor
	useEffect(() => {
		if (!anchorFromUrl) {
			window.scrollTo(0, 0);
		}
	}, [anchorFromUrl]);

	const hasChapters = allEvidence.length > 1;

	// ── Grooming: voting, flags, editing ──────────────────────────────────
	const { voteCounts, upvote, downvote, removeVote } = useVoting({
		entityType: "evidence",
		entityId: selectedEvidence.id,
	});
	const { flags, toggleFlag } = useEntityFlags({
		entityType: "evidence",
		entityId: selectedEvidence.id,
	});

	const [isEditing, setIsEditing] = useState(false);
	const [isArchived, setIsArchived] = useState(() => (selectedEvidence as any).is_archived === true);
	const fieldFetcher = useFetcher();
	const deleteFetcher = useFetcher();
	const archiveFetcher = useFetcher();

	const handleToggleArchive = useCallback(() => {
		const newValue = !isArchived;
		setIsArchived(newValue);
		archiveFetcher.submit({ _action: "toggle-archive", archived: String(newValue) }, { method: "post" });
	}, [isArchived, archiveFetcher]);

	const saveField = useCallback(
		(fieldName: string, fieldValue: string) => {
			if (!accountId || !projectId) return;
			fieldFetcher.submit(
				{
					entity: "evidence",
					entityId: selectedEvidence.id,
					accountId,
					projectId,
					fieldName,
					fieldValue,
				},
				{ method: "POST", action: "/api/update-field" }
			);
		},
		[accountId, projectId, selectedEvidence.id, fieldFetcher]
	);

	const userVote = voteCounts.user_vote;

	return (
		<div className="space-y-6 p-4 sm:p-6">
			<PageContainer size="sm" padded={false} className="max-w-2xl">
				{/* Header */}
				<div className="mb-6 flex items-center justify-between gap-3">
					<BackButton />
					<div className="flex items-center gap-2">
						{projectPath && accountId ? (
							<ResourceShareMenu
								projectPath={projectPath}
								accountId={accountId}
								resourceId={selectedEvidence.id}
								resourceName={evidenceName}
								resourceType="evidence"
							/>
						) : null}
					</div>
				</div>

				{/* Interview context */}
				{interview && (
					<p className="mb-4 text-muted-foreground text-sm">
						From: <span className="font-medium text-foreground">{interview.title}</span>
					</p>
				)}

				{/* Grooming Toolbar */}
				<TooltipProvider delayDuration={300}>
					<div className="mb-4 flex items-center gap-1.5">
						{/* Verify */}
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

						{/* Reject */}
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

						{/* Edit toggle */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={isEditing ? "secondary" : "outline"}
									size="sm"
									onClick={() => setIsEditing(!isEditing)}
									className="gap-1.5"
								>
									{isEditing ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
									{isEditing ? "Done" : "Edit"}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit — modify the gist, verbatim, or metadata</TooltipContent>
						</Tooltip>

						{/* Star */}
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
							<TooltipContent>Star — mark as important for quick reference</TooltipContent>
						</Tooltip>

						{/* Archive */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={isArchived ? "secondary" : "outline"}
									size="sm"
									onClick={handleToggleArchive}
									className="gap-1.5"
								>
									<Archive className="h-3.5 w-3.5" />
									{isArchived ? "Archived" : "Archive"}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Archive — remove from views and analysis for your team</TooltipContent>
						</Tooltip>

						{/* Delete */}
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
								<TooltipContent>Delete — remove this evidence (recoverable for 30 days)</TooltipContent>
							</Tooltip>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete evidence?</AlertDialogTitle>
									<AlertDialogDescription>
										This will remove this evidence from all views and analysis. You can recover it from Recently Deleted
										within 30 days.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										onClick={() => {
											deleteFetcher.submit({ _action: "delete-evidence" }, { method: "post" });
										}}
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>

						{/* Status badges */}
						{isArchived && (
							<Badge variant="secondary" className="ml-1 text-xs">
								Archived
							</Badge>
						)}
					</div>
				</TooltipProvider>

				{/* Edit Panel */}
				{isEditing && (
					<div className="mb-4 space-y-3 rounded-lg border border-border border-dashed bg-muted/30 p-4">
						<EditableField label="Gist" fieldName="gist" value={selectedEvidence.gist} onSave={saveField} />
						<EditableField
							label="Verbatim"
							fieldName="verbatim"
							value={selectedEvidence.verbatim}
							onSave={saveField}
							multiline
						/>
						<div className="grid grid-cols-2 gap-3">
							<EditableField label="Topic" fieldName="topic" value={selectedEvidence.topic} onSave={saveField} />
							<EditableField
								label="Journey Stage"
								fieldName="journey_stage"
								value={selectedEvidence.journey_stage}
								onSave={saveField}
								options={JOURNEY_STAGE_OPTIONS}
							/>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<EditableField
								label="Support"
								fieldName="support"
								value={selectedEvidence.support}
								onSave={saveField}
								options={SUPPORT_OPTIONS}
							/>
							<EditableField
								label="Confidence"
								fieldName="confidence"
								value={selectedEvidence.confidence}
								onSave={saveField}
								options={CONFIDENCE_OPTIONS}
							/>
							<EditableField
								label="Method"
								fieldName="method"
								value={selectedEvidence.method}
								onSave={saveField}
								options={[
									{ value: "interview", label: "Interview" },
									{ value: "survey", label: "Survey" },
									{ value: "secondary", label: "Secondary" },
								]}
							/>
						</div>
					</div>
				)}

				{/* Main Evidence Display */}
				<EvidenceCard
					evidence={evidenceWithAnchor as any}
					people={selectedEvidence.people || []}
					interview={interview}
					variant="expanded"
					showInterviewLink={true}
					projectPath={projectPath || undefined}
				/>

				{/* Chapter Carousel */}
				{hasChapters && (
					<div className="mt-8">
						<h3 className="mb-3 font-medium text-muted-foreground text-sm">Related moments ({allEvidence.length})</h3>

						{/* Horizontal scroll container */}
						<div className="-mx-4 sm:-mx-6 px-4 sm:px-6">
							<div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex gap-3 overflow-x-auto pb-3">
								{allEvidence.map((ev) => (
									<EvidenceChapterCard
										key={ev.id}
										evidence={ev}
										isSelected={ev.id === selectedId}
										onClick={() => setSelectedId(ev.id)}
									/>
								))}
							</div>
						</div>
					</div>
				)}
			</PageContainer>
		</div>
	);
}
