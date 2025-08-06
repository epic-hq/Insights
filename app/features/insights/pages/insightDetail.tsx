import consola from "consola"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router-dom"
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
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const { insightId } = params
	consola.log("insight accountId", accountId, "projectId", projectId, "insightId", insightId)

	if (!accountId || !projectId || !insightId) {
		throw new Response("Account ID, Project ID, and Insight ID are required", { status: 400 })
	}

	try {
		const insight = await getInsightById({
			supabase,
			accountId,
			projectId,
			id: insightId,
		})

		if (!insight) {
			throw new Response("Insight not found", { status: 404 })
		}

		return {
			insight: insight,
		}
	} catch (error) {
		consola.error("Error loading insight:", error)
		if (error instanceof Response) {
			throw error
		}
		throw new Response("Failed to load insight", { status: 500 })
	}
}

export default function InsightDetail() {
	const { insight } = useLoaderData<typeof loader>()
	if (!insight) {
		return <div>Insight not found</div>
	}
	return (
		<div className="mx-auto max-w-4xl">
			{/* <div className="mb-6 flex items-center gap-2">
				<Link to="/insights" className="text-blue-600 hover:text-blue-800">
					Insights
				</Link>
				<span className="text-gray-500">/</span>
				<span className="text-gray-900">{insight.name}</span>
			</div> */}

			<InsightCardV2 insight={insight} />
		</div>
	)
}
