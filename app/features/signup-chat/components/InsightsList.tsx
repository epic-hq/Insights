import { useMemo, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";
import type { Emotion } from "~/components/ui/emotion-badge";
import { CategoryFilterChip } from "~/features/signup-chat/components/FilterChips";
import { InsightCard } from "~/features/signup-chat/components/InsightCardSmall";
import { applyFilters, type SortKey, sortInsights } from "~/features/signup-chat/lib/filters";
import type { Insight } from "~/types";

export function InsightsList() {
	const { insights } = useLoaderData() as { insights: Insight[] };
	const categories = useMemo(
		() => Array.from(new Set(insights.map((i) => i.category).filter(Boolean))) as string[],
		[insights]
	);

	const [params, setParams] = useSearchParams();
	const [sortBy, setSortBy] = useState<SortKey>((params.get("sort") as SortKey) || "newest");

	const filters = {
		q: params.get("q") || "",
		category: params.get("category") || undefined,
		emotion: (params.get("emotion") || undefined) as Emotion | undefined,
		pinned: params.get("pinned") ? params.get("pinned") === "1" : undefined,
		hasEvidence: params.get("evidence") === "1",
	};

	const update = (patch: Record<string, string | null>) => {
		const next = new URLSearchParams(params);
		Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)));
		setParams(next, { replace: true });
	};

	const data = useMemo(() => sortInsights(applyFilters(insights, filters), sortBy), [insights, filters, sortBy]);

	return (
		<div className="space-y-3">
			{/* Command bar */}
			<div className="flex flex-wrap items-center gap-2">
				<input
					id="q"
					className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
					placeholder="Search insights…"
					defaultValue={filters.q}
					onChange={(e) => update({ q: e.target.value || null })}
				/>

				<CategoryFilterChip
					categories={categories}
					value={filters.category}
					onChange={(v) => update({ category: v || null })}
				/>

				{/* <button
					className={`h-9 rounded-full border px-3 text-sm ${filters.pinned ? "bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
					onClick={() => update({ pinned: filters.pinned ? null : "1" })}
				>
					Pinned
				</button>

				<button
					className={`h-9 rounded-full border px-3 text-sm ${filters.hasEvidence ? "bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
					onClick={() => update({ evidence: filters.hasEvidence ? null : "1" })}
				>
					Has evidence
				</button> */}

				<select
					className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value as SortKey)}
				>
					<option value="newest">Newest</option>
					<option value="mostPinned">Most pinned</option>
					<option value="mostEvidence">Most evidence</option>
				</select>
			</div>

			{/* Grid */}
			<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{data.map((x) => (
					<li key={x.id}>
						<InsightCard item={x} />
					</li>
				))}
			</ul>
		</div>
	);
}
