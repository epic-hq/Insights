import consola from "consola"
import { useRouteLoaderData } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import AccountDetailCard from "~/features/accounts/components/AccountDetailCard"
import ProjectContextCard from "~/features/projects/components/ProjectContextCard"
import type { Project } from "~/types"

// export async function loader(loaderArgs: LoaderFunctionArgs) {
// 	const account_id = loaderArgs.context.get(currentAccountContext)
// 	const { client: supabase } = getServerClient(loaderArgs.request)

// 	const { data: accounts } = await supabase.rpc("get_accounts")
// 	// consola.log("/accounts: Accounts list:", accountsList)

// 	const { data: projects } = await supabase.from("projects").select("*").eq("account_id", account_id)
// 	return { accounts, projects: accounts.projects }
// }

export default function Index() {
	const currentProjectContext = useCurrentProject()
	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout")
	consola.log("Home acct accounts & currentProjectContext:", accounts, currentProjectContext)

	const projects: Project[] = accounts?.flatMap((account) =>
		account.projects.map((project) => ({ ...project, account_id: account.account_id }))
	)

	consola.log("Home accounts & projects", accounts, projects)
	return (
		<div className="mx-auto max-w-7xl space-y-10 px-6 py-8">
			<h1 className="mb-4 font-bold text-3xl">Home</h1>
			<div className="space-y-8">
				<section>
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
				</section>
				<section>
					<h2 className="mb-4 font-semibold text-muted-foreground text-xl">Projects</h2>
					{projects?.length === 0 ? (
						<div className="text-muted-foreground">No projects found.</div>
					) : (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{projects?.map((project) => (
								<ProjectContextCard
									key={project.id}
									project={project}
									projectPath={`/a/${project.account_id}/${project.id}/projects/${project.id}`}
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
