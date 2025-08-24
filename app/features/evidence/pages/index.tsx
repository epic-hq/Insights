import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })
	const { data, error } = await supabase
		.from("evidence")
		.select("id, verbatim, support, confidence, created_at")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
	if (error) throw new Error(`Failed to load evidence: ${error.message}`)
	return { evidence: (data ?? []) as Pick<Evidence, "id" | "verbatim" | "support" | "confidence" | "created_at">[] }
}

export default function EvidenceIndex() {
	const { evidence } = useLoaderData<typeof loader>()
	return (
		<div className="space-y-4 p-4">
			<h1 className="font-semibold text-xl">Evidence</h1>
			<ul className="divide-y divide-gray-200">
				{evidence.map((e) => (
					<li key={e.id} className="flex items-start justify-between gap-4 py-3">
						<div>
							<div className="line-clamp-2 text-gray-700 text-sm">“{e.verbatim}”</div>
							<div className="mt-1 text-gray-500 text-xs">
								{e.support} • {e.confidence} • {new Date(e.created_at).toLocaleString()}
							</div>
						</div>
						<Link to={e.id} className="text-primary-600 text-sm hover:underline">
							View
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}
