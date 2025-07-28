import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import InsightCardV2 from "~/features/insights/components/InsightCardV2"
import { getInsightById } from "~/features/insights/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.insight?.name || "Insight"} | Insights` },
		{ name: "description", content: "Insight details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { insightId } = params

	if (!insightId) {
		throw new Response("Insight ID is required", { status: 400 })
	}

	try {
		const data = await getInsightById({
			supabase,
			accountId,
			id: insightId,
		})

		// add flattened tags for convenience
		return {
			insight: {
				...data,
				tags: data.insight_tags?.map((it: any) => ({ id: it.tags.id, tag: it.tags.tag })) ?? [],
				interviews: Array.isArray(data.interviews) ? data.interviews : data.interviews ? [data.interviews] : [],
			},
		}
	} catch (error) {
		throw new Response("Failed to load insight", { status: 500 })
	}
}

export default function InsightDetail() {
	const { insight } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-6 flex items-center gap-2">
				<Link to="/insights" className="text-blue-600 hover:text-blue-800">
					Insights
				</Link>
				<span className="text-gray-500">/</span>
				<span className="text-gray-900">{insight.name}</span>
			</div>

			<InsightCardV2 insight={insight} />
		</div>
	)
}
