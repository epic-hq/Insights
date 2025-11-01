import consola from "consola"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Input } from "~/components/ui/input"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Quick Insights | Pain points" }, { name: "description", content: "Quick insights interface" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId ?? params.projectId ?? null
	const accountId = ctx_project.accountId ?? params.accountId ?? null

	if (!projectId || !accountId) {
		consola.warn("Missing project or account context")
		return { insights: [] }
	}

	const { data: insights, error } = await getInsights({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Insights query error:", error)
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${insights?.length || 0} insights`)

	return {
		insights: insights || [],
	}
}

export default function QuickInsights() {
	const { insights } = useLoaderData<typeof loader>()
	const [searchQuery, setSearchQuery] = useState("")

	const filtered = useMemo(() => {
		const normalized = searchQuery.trim().toLowerCase()
		if (!normalized) return insights

		return insights.filter((insight: Insight & { [key: string]: any }) => {
			const haystack = [
				insight.name,
				insight.pain,
				insight.details,
				insight.category,
				insight.emotional_response,
				insight.desired_outcome,
				insight.jtbd,
				insight.evidence,
				insight.motivation,
				insight?.persona_insights?.map((pi: any) => pi.personas?.name).join(" "),
				insight?.linked_themes?.map((theme: any) => theme.name).join(" "),
			]

			return haystack.some((text) => typeof text === "string" && text.toLowerCase().includes(normalized))
		})
	}, [insights, searchQuery])

	return (
		<PageContainer className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="font-semibold text-3xl text-foreground">Quick Insights</h1>
					<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
						Browse the latest validated findings. Open a card to review context, linked themes, and leave feedback for your
						team.
					</p>
				</div>
				<div className="relative w-full max-w-md">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder="Search by insight, pain, tags, personas…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/30 py-16 text-center text-muted-foreground">
					<p className="font-medium">No insights match your filters</p>
					{searchQuery ? <p className="mt-2 text-sm">Try a different keyword or clear the search field.</p> : null}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{filtered.map((insight) => (
						<InsightCardV3 key={insight.id} insight={insight} />
					))}
				</div>
			)}
		</PageContainer>
	)
}
