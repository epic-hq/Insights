import consola from "consola"
import { Search } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { Input } from "~/components/ui/input"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Quick Insights | Pain points" }, { name: "description", content: "Quick insights interface" }]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || ""
	const accountId = ctx_project.accountId || ""

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

	const filtered = insights.filter(
		(insight: Insight) =>
			insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			insight.details?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	return (
		<div className="min-h-screen bg-background text-foreground p-4">
			<div className="mb-4 flex items-center">
				<Search className="mr-2 h-5 w-5 text-muted-foreground" />
				<Input placeholder="Search insights…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
			</div>

			{filtered.length === 0 ? (
				<div className="py-8 text-center text-muted-foreground">
					<p>No insights found</p>
					{searchQuery && <p className="mt-1 text-sm">Try adjusting your search</p>}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filtered.map((insight) => (
						<InsightCardV3 key={insight.id} insight={insight} />
					))}
				</div>
			)}
		</div>
	)
}
