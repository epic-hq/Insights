import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params
	if (!evidenceId) throw new Response("Missing evidenceId", { status: 400 })
	const { data, error } = await supabase
		.from("evidence")
		.select("*, evidence_tag(tag_id, confidence)")
		.eq("id", evidenceId)
		.single()
	if (error) throw new Error(`Failed to load evidence: ${error.message}`)
	return {
			evidence: data as (Pick<Evidence, "id" | "verbatim" | "support" | "confidence" | "anchors"> & {
				context_summary?: string | null
			}) & {
			evidence_tag?: { tag_id: string; confidence: number | null }[]
		},
	}
}

export default function EvidenceDetail() {
	const { evidence } = useLoaderData<typeof loader>()
	const anchors = Array.isArray(evidence.anchors) ? evidence.anchors : []
	return (
		<div className="space-y-4 p-6">
			<h1 className="font-semibold text-xl">Evidence Detail</h1>
			<div className="rounded-md border bg-white p-4">
				<div className="text-lg">“{evidence.verbatim}”</div>
				{(evidence as any).context_summary && (
					<div className="mt-2 text-muted-foreground text-sm">{(evidence as any).context_summary}</div>
				)}
				<div className="mt-2 text-gray-500 text-sm">
					{evidence.support} • {evidence.confidence}
				</div>
			</div>
			<div>
				<h2 className="mb-2 font-medium">Anchors</h2>
				<pre className="overflow-auto rounded border bg-gray-50 p-3 text-xs">{JSON.stringify(anchors, null, 2)}</pre>
			</div>
		</div>
	)
}
