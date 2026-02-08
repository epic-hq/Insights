/**
 * Evidence Detail Page
 *
 * Displays a single piece of evidence with a YouTube-chapters-style layout:
 * - Main display area showing the currently selected evidence
 * - Horizontal carousel of related evidence as chapter cards
 */
import consola from "consola";
import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { BackButton } from "~/components/ui/back-button";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { cn } from "~/lib/utils";
import { userContext } from "~/server/user-context";
import { getAnchorStartSeconds, type MediaAnchor } from "~/utils/media-url.client";
import EvidenceCard from "../components/EvidenceCard";

type EvidencePersonRow = {
	role: string | null;
	people: {
		id: string;
		name: string | null;
	};
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

	// Fetch people separately to avoid duplicate rows
	const { data: peopleData } = await supabase
		.from("evidence_people")
		.select(
			`
			role,
			people:person_id!inner(
				id,
				name
			)
		`
		)
		.eq("evidence_id", evidenceId);

	const { data: facetData, error: facetError } = await supabase
		.from("evidence_facet")
		.select(
			`
			kind_slug,
			label,
			facet_account_id,
			person:person_id(id, name)
		`
		)
		.eq("evidence_id", evidenceId);

	if (facetError) throw new Error(`Failed to load evidence facets: ${facetError.message}`);

	const primaryFacets = (facetData ?? []).map((row: any) => ({
		kind_slug: row.kind_slug,
		label: row.label,
		facet_account_id: row.facet_account_id ?? 0,
		person: row.person ? { id: row.person.id, name: row.person.name } : null,
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
		people: peopleRows.map((row) => ({
			id: row.people.id,
			name: row.people.name,
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
			.order("created_at", { ascending: true })
			.limit(20);
		if (!relatedError && Array.isArray(related)) relatedEvidence = related;

		if (Array.isArray(relatedEvidence) && relatedEvidence.length > 0) {
			const relatedIds = relatedEvidence.map((ev: any) => ev.id).filter(Boolean);
			if (relatedIds.length > 0) {
				// Load facets for related evidence with owner info
				const { data: relatedFacets, error: relatedFacetError } = await supabase
					.from("evidence_facet")
					.select(
						`
            evidence_id,
            kind_slug,
            label,
            facet_account_id,
            person:person_id(id, name)
          `
					)
					.in("evidence_id", relatedIds);
				if (relatedFacetError) throw new Error(`Failed to load related evidence facets: ${relatedFacetError.message}`);

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
					const person = (row as any).person as {
						id: string;
						name: string | null;
					} | null;
					if (!evidence_id || !kind_slug || !label || !facetAccountId) continue;
					const list = facetMap.get(evidence_id) ?? [];
					list.push({
						kind_slug,
						label,
						facet_account_id: facetAccountId,
						person,
					});
					facetMap.set(evidence_id, list);
				}

				// Load people for related evidence
				const { data: relatedPeople, error: relatedPeopleError } = await supabase
					.from("evidence_people")
					.select(
						`
						evidence_id,
						role,
						people:person_id!inner(
							id,
							name
						)
					`
					)
					.in("evidence_id", relatedIds);
				if (relatedPeopleError)
					throw new Error(`Failed to load related evidence people: ${relatedPeopleError.message}`);

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
					const people = (row as any).people as { id: string; name: string | null } | undefined;
					if (!evidence_id || !people) continue;
					const list = peopleMap.get(evidence_id) ?? [];
					list.push({ id: people.id, name: people.name, role, personas: [] });
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
	};
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

export default function EvidenceDetail() {
	const { evidence, relatedEvidence, projectPath, anchorFromUrl, accountId } = useLoaderData<typeof loader>();
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
		// If anchorFromUrl exists, let the EvidenceCard handle scrolling to the timestamp
	}, [anchorFromUrl]);

	const hasChapters = allEvidence.length > 1;

	return (
		<div className="space-y-6 p-4 sm:p-6">
			<PageContainer size="sm" padded={false} className="max-w-2xl">
				{/* Header */}
				<div className="mb-6 flex items-center justify-between gap-3">
					<BackButton />
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

				{/* Interview context */}
				{interview && (
					<p className="mb-4 text-muted-foreground text-sm">
						From: <span className="font-medium text-foreground">{interview.title}</span>
					</p>
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
