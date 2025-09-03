import consola from "consola"
import { Link, redirect, type LoaderFunctionArgs, useLoaderData, useRouteLoaderData } from "react-router"
import { Button } from "~/components/ui/button"
import { ProjectCard } from "~/features/projects/components/ProjectCard"
import { getProjects } from "~/features/projects/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Project, Project_Section } from "~/types"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const { supabase, account_id } = ctx // account_id is now team account from middleware
	const user_settings = ctx.user_settings

	// Use account_id from middleware (already resolved to team account)
	consola.log("home loader account_id:", account_id)

	const _signup_completed = user_settings?.signup_data?.completed ?? false
	// if (!signup_completed) {
	// 	consola.log("Signup not completed. Redirecting to signup-chat.")
	// 	return redirect("/signup-chat")
	// }

	// if !onboarding_completed redirect to /onboarding
	// const onboardingCompleted = user_settings?.onboarding_completed ?? false
	// if (!onboardingCompleted) {
	// 	consola.log("Onboarding not completed. Redirecting to onboarding.")
	// 	return redirect("/onboarding")
	// }

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

	// If no projects exist, redirect to the new project flow
	if (!projects || projects.length === 0) {
		throw redirect(`/a/${account_id}/projects/new`)
	}
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
	const { auth } = useRouteLoaderData("routes/_ProtectedLayout") as {
		auth: { accountId: string }
	}

	// Build routes using accountId only; projectId is supplied per-link where needed
	const routes = useProjectRoutes(`/a/${auth.accountId}/_`)

	return (
		<div className="mx-auto max-w-7xl ">
			{/* <h1 className="mb-4 px-6 font-bold text-3xl">Projects</h1> */}
			<div className="space-y-10 space-y-8 px-6 py-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-3xl tracking-tight">My Projects</h1>
						{/* <p className="text-muted-foreground">Group your.</p> */}
					</div>
					<Button asChild>
						<Link to={routes.projects.new()}>Create Project</Link>
					</Button>
				</div>
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
										projectPath={routes.projects.detail(project.id)}
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
