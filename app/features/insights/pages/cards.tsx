import { useCallback, useEffect, useMemo, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useFetcher, useLoaderData, useLocation, useSearchParams } from "react-router-dom"
import InsightCardGrid from "~/features/insights/components/InsightCardGrid"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const user_id = ctx.claims?.sub || ""

	const url = new URL(request.url)
	const raw_offset = Number(url.searchParams.get("offset") ?? "0")
	const raw_limit = Number(url.searchParams.get("limit") ?? "20")
	const offset = Number.isFinite(raw_offset) && raw_offset >= 0 ? raw_offset : 0
	const limit = Number.isFinite(raw_limit) && raw_limit > 0 ? Math.min(raw_limit, 50) : 20

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || params.projectId || ""
	const accountId = ctx_project.accountId || params.accountId || ""

	if (!projectId || !accountId || !supabase) {
		throw new Response("Missing project context", { status: 400 })
	}

	const { data: insights_plus_one, error } = await getInsights({
		supabase,
		accountId,
		projectId,
		offset,
		limit: limit + 1,
	})
	if (error) throw new Response("Failed to load insights", { status: 500 })

	const insights = (insights_plus_one || []).slice(0, limit)
	const has_more = (insights_plus_one || []).length > limit
	const next_offset = offset + insights.length

	const insight_ids = (insights || []).map((i) => i.id).filter(Boolean)

	const comment_counts_by_id: Record<string, number> = {}
	const flags_by_id: Record<
		string,
		{
			hidden: boolean
			archived: boolean
			starred: boolean
			priority: boolean
		}
	> = {}

	if (insight_ids.length > 0) {
		const [commentRowsResult, flagRowsResult] = await Promise.all([
			supabase
				.from("annotations")
				.select("entity_id")
				.eq("account_id", accountId)
				.eq("project_id", projectId)
				.eq("entity_type", "insight")
				.eq("annotation_type", "comment")
				.eq("status", "active")
				.in("entity_id", insight_ids),
			user_id
				? supabase
					.from("entity_flags")
					.select("entity_id, flag_type, flag_value")
					.eq("project_id", projectId)
					.eq("entity_type", "insight")
					.eq("user_id", user_id)
					.in("entity_id", insight_ids)
				: Promise.resolve({ data: [], error: null }),
		])

		// Default counts/flags
		for (const id of insight_ids) {
			comment_counts_by_id[id] = 0
			flags_by_id[id] = { hidden: false, archived: false, starred: false, priority: false }
		}

		for (const row of commentRowsResult.data || []) {
			const id = row.entity_id
			if (!id) continue
			comment_counts_by_id[id] = (comment_counts_by_id[id] || 0) + 1
		}

		for (const row of (flagRowsResult as { data: Array<{ entity_id: string; flag_type: string; flag_value: unknown }> })
			.data || []) {
			const id = row.entity_id
			if (!id) continue
			const key = row.flag_type as keyof (typeof flags_by_id)[string]
			if (!(key in flags_by_id[id])) continue
			flags_by_id[id][key] = Boolean(row.flag_value)
		}
	}

	return {
		insights: insights || [],
		comment_counts_by_id,
		flags_by_id,
		filters: { sort: null },
		paging: {
			offset,
			limit,
			has_more,
			next_offset,
		},
	}
}

export default function Cards() {
	const { insights, comment_counts_by_id, flags_by_id, filters, paging } = useLoaderData<typeof loader>()
	const location = useLocation()
	const loadMoreFetcher = useFetcher<typeof loader>()
	const [searchParams, setSearchParams] = useSearchParams()

	const [allInsights, setAllInsights] = useState(insights)
	const [commentCountsById, setCommentCountsById] = useState(comment_counts_by_id)
	const [flagsById, setFlagsById] = useState(flags_by_id)
	const [hasMore, setHasMore] = useState(paging.has_more)
	const [nextOffset, setNextOffset] = useState(paging.next_offset)

	useEffect(() => {
		setAllInsights(insights)
		setCommentCountsById(comment_counts_by_id)
		setFlagsById(flags_by_id)
		setHasMore(paging.has_more)
		setNextOffset(paging.next_offset)
	}, [insights, comment_counts_by_id, flags_by_id, paging.has_more, paging.next_offset])

	useEffect(() => {
		if (loadMoreFetcher.state !== "idle") return
		const data = loadMoreFetcher.data
		if (!data) return
		if (!Array.isArray(data.insights) || data.insights.length === 0) {
			setHasMore(false)
			return
		}

		setAllInsights((prev) => {
			const existing = new Set(prev.map((i) => i.id))
			const toAdd = data.insights.filter((i) => !existing.has(i.id))
			return prev.concat(toAdd)
		})
		setCommentCountsById((prev) => ({ ...prev, ...(data.comment_counts_by_id || {}) }))
		setFlagsById((prev) => ({ ...prev, ...(data.flags_by_id || {}) }))
		setHasMore(Boolean(data.paging?.has_more))
		setNextOffset(typeof data.paging?.next_offset === "number" ? data.paging.next_offset : nextOffset)
	}, [loadMoreFetcher.state, loadMoreFetcher.data, nextOffset])

	const loadMoreHref = useMemo(() => {
		const sp = new URLSearchParams(searchParams)
		sp.set("offset", String(nextOffset))
		sp.set("limit", String(paging.limit))
		return `${location.pathname}?${sp.toString()}`
	}, [searchParams, nextOffset, paging.limit, location.pathname])

	const updateSort = useCallback(
		(sort: string) => {
			const newParams = new URLSearchParams(searchParams)
			newParams.set("sort", sort)
			newParams.delete("offset")
			setSearchParams(newParams)
		},
		[searchParams, setSearchParams]
	)

	const clearFilters = useCallback(() => {
		setSearchParams({})
	}, [setSearchParams])
	return (
		<>
			<div className="mb-4 flex items-center justify-between">
				<div className="flex gap-2">
					<span className="text-gray-500 text-sm dark:text-gray-400">Sort by:</span>
					<select
						value={filters.sort || "default"}
						onChange={(e) => updateSort(e.target.value)}
						className="rounded border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<option value="default">Default</option>
						<option value="latest">Latest</option>
						<option value="impact">Impact</option>
						<option value="confidence">Confidence</option>
					</select>
				</div>
			</div>
			{allInsights.length > 0 ? (
				<>
					<InsightCardGrid insights={allInsights} comment_counts_by_id={commentCountsById} flags_by_id={flagsById} />
					{hasMore && (
						<div className="mt-6 flex justify-center">
							<button
								type="button"
								onClick={() => loadMoreFetcher.load(loadMoreHref)}
								disabled={loadMoreFetcher.state !== "idle"}
								className="rounded border border-border bg-background px-4 py-2 text-foreground text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
							>
								{loadMoreFetcher.state === "loading" ? "Loading…" : "Load more"}
							</button>
						</div>
					)}
				</>
			) : (
				<div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
					<p className="text-gray-600 text-lg dark:text-gray-400">No insights match your current filters</p>
					<button type="button" onClick={clearFilters} className="mt-4 text-blue-600 hover:text-blue-800">
						Clear all filters
					</button>
				</div>
			)}
		</>
	)
}
