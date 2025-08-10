import consola from "consola"
import { type LoaderFunctionArgs, useLoaderData, useRouteLoaderData } from "react-router"
import { useAuth } from "~/contexts/AuthContext"
import { ProjectCard } from "~/features/projects/components/ProjectCard"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getServerClient } from "~/lib/supabase/server"
import type { Project } from "~/types"

export async function loader(loaderArgs: LoaderFunctionArgs) {
	// const account_id = loaderArgs.context.get(currentAccountContext)
	const { client: supabase } = getServerClient(loaderArgs.request)
	const _project_id = loaderArgs.params.projectId

	const { data: latest_sections } = await supabase
		// .from("project_sections_latest")
		.from("project_sections")
		.select("*")
		// .eq("project_id", project_id)
		.order("position", { ascending: true, nullsFirst: false })
		.order("created_at", { ascending: false })
	consola.log("/project sections: Latest sections:", latest_sections)

	// const { data: projects } = await supabase.from("projects").select("*").eq("account_id", account_id)
	return { latest_sections }
}

export default function Index() {
	const { account_settings } = useAuth()
	const { accounts, project_sections } = useRouteLoaderData("routes/_ProtectedLayout")
	const { latest_sections } = useLoaderData<typeof loader>()
	consola.log("Home acct accounts & account_settings:", accounts, account_settings)

	const projects: Project[] = accounts?.flatMap((account) =>
		account.projects.map((project) => ({ ...project, account_id: account.account_id }))
	)

	const projectPath = `/a/${account_settings?.current_account_id}/${account_settings?.current_project_id}`
	consola.log("Home accounts & projects & projectPath", accounts, projects, projectPath)

	const routes = useProjectRoutes(projectPath)

	return (
		<div className="mx-auto max-w-7xl space-y-10 px-6 py-8">
			<h1 className="mb-4 font-bold text-3xl">Home</h1>
			<div className="space-y-8">
				{/* <section>
					<h2 className="mb-4 font-semibold text-muted-foreground text-xl">Accounts</h2>
					{accounts?.length === 0 ? (
						<div className="text-muted-foreground">No accounts found.</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{accounts?.map((account) => (
								<AccountDetailCard key={account.id} account={account} />
							))}
						</div>
					)}
				</section> */}
				<section>
					<h2 className="mb-4 font-semibold text-muted-foreground text-xl">Projects</h2>
					{projects?.length === 0 ? (
						<div className="text-muted-foreground">No projects found.</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-1 2xl:grid-cols-2">
							{projects?.map((project) => (
								<ProjectCard
									key={project.id}
									project={project}
									projectPath={routes.projects.dashboard(project.id)}
									sections={project_sections || []}
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
