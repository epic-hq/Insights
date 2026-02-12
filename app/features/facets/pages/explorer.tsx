/**
 * Facet Explorer - Quick & Dirty Tree Browser
 *
 * Shows all facets in the account grouped by kind with search.
 * Helps users understand their vocabulary and see relationships.
 */

import { ChevronDown, ChevronRight, Search, Tag } from "lucide-react";
import { useState } from "react";
import { json, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { userContext } from "~/middleware/userContext.server";

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	if (!ctx) throw new Response("Unauthorized", { status: 401 });

	const { supabase } = ctx;
	const { accountId, projectId } = ctx.sessionData;

	// Get all facets with usage counts
	const { data: facets, error } = await supabase
		.from("facet_account")
		.select(
			`
      id,
      kind_id,
      slug,
      label,
      synonyms,
      is_active,
      facet_kind_global!inner(slug, label),
      evidence_count:evidence_facet(count),
      person_count:person_facet(count)
    `
		)
		.eq("account_id", accountId)
		.eq("is_active", true)
		.order("label");

	if (error) throw error;

	// Group by kind
	const byKind = new Map<string, typeof facets>();
	for (const facet of facets ?? []) {
		const kindSlug = facet.facet_kind_global?.slug ?? "unknown";
		if (!byKind.has(kindSlug)) {
			byKind.set(kindSlug, []);
		}
		byKind.get(kindSlug)?.push(facet);
	}

	const grouped = Array.from(byKind.entries()).map(([kindSlug, facets]) => ({
		kindSlug,
		kindLabel: facets[0]?.facet_kind_global?.label ?? kindSlug,
		facets,
		totalCount: facets.length,
	}));

	// Sort by count descending
	grouped.sort((a, b) => b.totalCount - a.totalCount);

	return { grouped, accountId, projectId };
}

export default function FacetExplorer() {
	const { grouped } = useLoaderData<typeof loader>();
	const [search, setSearch] = useState("");
	const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());

	const toggleKind = (kindSlug: string) => {
		setExpandedKinds((prev) => {
			const next = new Set(prev);
			if (next.has(kindSlug)) {
				next.delete(kindSlug);
			} else {
				next.add(kindSlug);
			}
			return next;
		});
	};

	// Filter facets by search
	const filtered = search
		? grouped
				.map((group) => ({
					...group,
					facets: group.facets.filter(
						(f) =>
							f.label.toLowerCase().includes(search.toLowerCase()) ||
							f.synonyms?.some((s) => s.toLowerCase().includes(search.toLowerCase()))
					),
				}))
				.filter((g) => g.facets.length > 0)
		: grouped;

	// Auto-expand all if searching
	if (search && expandedKinds.size === 0) {
		setExpandedKinds(new Set(filtered.map((g) => g.kindSlug)));
	}

	const totalFacets = grouped.reduce((sum, g) => sum + g.totalCount, 0);

	return (
		<div className="container mx-auto max-w-5xl py-8">
			<div className="mb-8">
				<h1 className="mb-2 font-bold text-3xl">Facet Explorer</h1>
				<p className="text-muted-foreground">
					Browse your account's vocabulary. {totalFacets} facets across {grouped.length} categories.
				</p>
			</div>

			{/* Search */}
			<div className="mb-6">
				<div className="relative">
					<Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search facets... (e.g., faster, cost, workflow)"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10"
					/>
				</div>
			</div>

			{/* Tree */}
			<div className="space-y-2">
				{filtered.map((group) => {
					const isExpanded = expandedKinds.has(group.kindSlug);
					const evidenceTotal = group.facets.reduce((sum, f) => sum + (f.evidence_count?.[0]?.count ?? 0), 0);
					const peopleTotal = group.facets.reduce((sum, f) => sum + (f.person_count?.[0]?.count ?? 0), 0);

					return (
						<Card key={group.kindSlug} className="overflow-hidden">
							{/* Kind Header */}
							<button
								onClick={() => toggleKind(group.kindSlug)}
								className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<div className="flex items-center gap-3">
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
									<Tag className="h-4 w-4 text-primary" />
									<span className="font-semibold capitalize">{group.kindLabel}</span>
									<Badge variant="secondary">{group.facets.length}</Badge>
								</div>
								<div className="flex items-center gap-4 text-muted-foreground text-sm">
									<span>{evidenceTotal} evidence</span>
									<span>{peopleTotal} people</span>
								</div>
							</button>

							{/* Facets List */}
							{isExpanded && (
								<div className="border-t bg-muted/20">
									{group.facets.map((facet) => {
										const evidenceCount = facet.evidence_count?.[0]?.count ?? 0;
										const personCount = facet.person_count?.[0]?.count ?? 0;

										return (
											<div
												key={facet.id}
												className="flex items-center justify-between border-b px-4 py-2.5 last:border-0 hover:bg-background/50"
											>
												<div className="flex-1">
													<div className="font-medium">{facet.label}</div>
													{facet.synonyms && facet.synonyms.length > 0 && (
														<div className="mt-1 text-muted-foreground text-xs">Also: {facet.synonyms.join(", ")}</div>
													)}
												</div>
												<div className="flex items-center gap-6 text-muted-foreground text-sm">
													<span>{evidenceCount} quotes</span>
													<span>{personCount} people</span>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</Card>
					);
				})}

				{filtered.length === 0 && (
					<Card className="p-8 text-center text-muted-foreground">No facets found matching "{search}"</Card>
				)}
			</div>

			{/* Legend */}
			<div className="mt-8 rounded-lg bg-muted/30 p-4 text-muted-foreground text-sm">
				<p className="mb-2 font-medium">What am I looking at?</p>
				<ul className="list-inside list-disc space-y-1">
					<li>
						<strong>Facets</strong> = Labels the AI found in your interviews (e.g., "Move Faster", "Reduce Cost")
					</li>
					<li>
						<strong>Quotes</strong> = Number of evidence snippets tagged with this facet
					</li>
					<li>
						<strong>People</strong> = Number of people associated with this facet
					</li>
					<li>
						<strong>Synonyms</strong> = Alternative terms that map to the same facet
					</li>
				</ul>
			</div>
		</div>
	);
}
