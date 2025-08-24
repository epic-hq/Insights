import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { userContext } from "~/server/user-context"
import type { Theme } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })
	const { data, error } = await supabase
		.from("themes")
		.select("id, name, statement, created_at")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
	if (error) throw new Error(`Failed to load themes: ${error.message}`)
	return { themes: (data ?? []) as Pick<Theme, "id" | "name" | "statement" | "created_at">[] }
}

export default function ThemesIndex() {
	const { themes } = useLoaderData<typeof loader>()
	return (
		<div className="space-y-4 p-4">
			<h1 className="font-semibold text-xl">Themes</h1>
			<ul className="divide-y divide-gray-200">
				{themes.map((t) => (
					<li key={t.id} className="flex items-start justify-between gap-4 py-3">
						<div>
							<div className="font-medium text-sm">{t.name}</div>
							<div className="mt-1 text-gray-500 text-xs">{t.statement}</div>
						</div>
						<Link to={t.id} className="text-primary-600 text-sm hover:underline">
							View
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}
