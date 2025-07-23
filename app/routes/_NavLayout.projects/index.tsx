import type { MetaFunction } from "react-router"
import { redirect, useLoaderData } from "react-router-dom"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import type { Route } from "./+types"

interface Project {
	id: string
	title: string
	description: string
	code: string
	status: string
	createdAt: string
	updatedAt: string
}

export const meta: MetaFunction = () => {
	return [{ title: "Projects | Research Insights" }, { name: "description", content: "All research projects" }]
}

export async function loader({ request }: Route.LoaderArgs) {
	const user = await getAuthenticatedUser(request)

	if (!user) {
		// redirect to login or return null
		throw redirect("/login")
	}
	// const userId = sessionData?.user?.id
	// if (!userId) throw new Response("Unauthorized", { status: 401 })

	const { data: rows, error } = await getServerClient(request)
		.client.from("research_projects")
		.select("*")
		// .eq("user_id", userId)
		.order("updated_at", { ascending: false })

	if (error) throw new Response(error.message, { status: 500 })

	const projects = rows.map((row) => ({
		id: row.id,
		title: row.title,
		description: row.description ?? "",
		code: row.code ?? "",
		status: row.status ?? "",
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}))

	return {
		projects,
	}
}

export default function Projects() {
	const { projects } = useLoaderData<typeof loader>()

	return (
		<div className="w-full px-[5%]">
			<h1>My Research Projects</h1>
			{projects.length > 0 ? <ProjectList projects={projects} /> : <p>No projects found.</p>}
		</div>
	)
}

export function ProjectList({ projects }: { projects: Project[] }) {
	return (
		<div className="space-y-4">
			<ul className="space-y-2">
				{projects.map((project) => (
					<li key={project.id} className="rounded border bg-white p-4 shadow-sm dark:bg-gray-900">
						<h2 className="font-semibold text-lg">{project.title}</h2>
						{project.description && <p className="mt-1 text-gray-600">{project.description}</p>}
						<p className="mt-2 text-gray-400 text-xs">Updated: {new Date(project.updatedAt).toLocaleDateString()}</p>
					</li>
				))}
			</ul>
		</div>
	)
}
