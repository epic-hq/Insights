import consola from "consola"
import { type LoaderFunctionArgs, type RequestContext, useRouteLoaderData } from "react-router"
import AccountDetailCard from "~/features/accounts/components/AccountDetailCard"
import ProjectContextCard from "~/features/projects/components/ProjectContextCard"
import { getServerClient } from "~/lib/supabase/server"
import { currentAccountContext } from "~/server/current-account-context"

export async function loader(loaderArgs: LoaderFunctionArgs) {
	const account_id = loaderArgs.context.get(currentAccountContext)
	const { client: supabase } = getServerClient(loaderArgs.request)

	const { data: accounts } = await supabase.rpc("get_accounts")
	// consola.log("/accounts: Accounts list:", accountsList)

	const { data: projects } = await supabase.from("projects").select("*").eq("account_id", account_id)
	return { accounts, projects: accounts.projects }
}

export default function Index({ context }: { context: RequestContext }) {
	// const currentAccountContext = useCurrentAccount()
	// consola.log("Home currentAccountContext", currentAccountContext)
	const { accounts } = useRouteLoaderData("routes/_ProtectedLayout")
	// const { accountId } = currentAccountContext

	// const accounts = [currentAccountContext.accountId]
	// const projects = currentAccountContext.accountId.projects
	// const accounts = []
	const projects = accounts[0].projects

	consola.log("projects", projects)
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
								<ProjectContextCard key={project.id} project={project} />
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
