import consola from "consola"
import { type LoaderFunctionArgs, redirect, useLoaderData, useRouteLoaderData } from "react-router"
import { ProjectCard } from "~/features/projects/components/ProjectCard"
import { getProjects } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Project, Project_Section } from "~/types"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const { supabase, account_id: user_id } = ctx
	const user_settings = ctx.user_settings

	// consola.log("home loader:", user_id)
	// Get projects for the current account
	// get account_id from user_id
	// const { data: accounts } = await supabase.schema("accounts").from("account_user").select("*").eq("user_id", user_id)
	// consola.log("accounts:", accounts)
	const { data: accounts } = await supabase
		.schema("accounts")
		.from("account_user")
		.select("*")
		.eq("user_id", user_id)
		.neq("account_id", user_id)
	const account_id = accounts?.[0]?.account_id || ""
	// consola.log("account_id:", account_id)

	// if !onboarding_complete redirect to /signup_chat
	const completed = user_settings?.signup_data?.completed ?? false
	if (!completed) {
		consola.log("SignUp Chat not completed. Redirecting.")
		return redirect("/signup_chat")
	}

	if (!account_id) {
		return {
			projects: [],
			latest_sections: [],
		}
	}
	// TODO make helper for getProjects from user_id
	const { data: projects } = await getProjects({
		supabase,
		accountId: account_id,
	})
	// consola.log("projects:", projects)
	// Get project sections for the current account
	const { data: latest_sections } = await supabase
		.from("project_sections")
		.select("*")
		.in("project_id", projects?.map((project) => project.id) || [])
		.order("position", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(10)

	return {
		projects: projects || [],
		latest_sections: latest_sections || [],
	}
}

type LoaderData = {
	projects: Project[]
	latest_sections: Project_Section[]
}

export default function Index() {
	const { projects, latest_sections } = useLoaderData<typeof loader>()
	const { account_settings } = useRouteLoaderData("routes/_ProtectedLayout") as {
		account_settings: { current_account_id: string; current_project_id: string }
	}

	const projectPath =
		account_settings?.current_account_id && account_settings?.current_project_id
			? `/a/${account_settings.current_account_id}/${account_settings.current_project_id}`
			: ""

	const routes = useProjectRoutes(projectPath)

	return (
		<div className="mx-auto max-w-7xl ">
			<h1 className="mb-4 px-6 font-bold text-3xl">Projects</h1>
			<div className="space-y-10 space-y-8 px-6 py-8">
				<section>
					{/* <h2 className="mb-4 font-semibold text-muted-foreground text-xl">Projects</h2> */}
					{projects.length === 0 ? (
						<div className="text-muted-foreground">No projects found. Create your first project to get started.</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-1 2xl:grid-cols-2">
							{projects.map((project) => {
								const projectSections = latest_sections.filter((section) => section.project_id === project.id)

								return (
									<ProjectCard
										key={project.id}
										project={project}
										projectPath={routes.projects.dashboard(project.id)}
										sections={projectSections}
									/>
								)
							})}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
