import { Link, type LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { cn } from "~/lib/utils"
import { getAccounts } from "../db"
import type { Route } from "./+types/list"

export async function loader({ request }: LoaderFunctionArgs) {
	const { client, headers } = getServerClient(request)
	const user = await getAuthenticatedUser(request)

	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data, error } = await getAccounts({ supabase: client })
	if (error) {
		throw error
	}
	return {
		teams: data?.teamAccounts,
	}
}

export default function TeamsList({ loaderData }: Route.ComponentProps) {
	return (
		<div className="container mx-auto flex h-full flex-col">
			<h1>Teams</h1>
			{/* {loaderData.teams?.map((team) => (
				<div key={team.account_id}>{team.name}</div>
			))} */}
			<div className="max-w-lg flex-1 space-y-3">
				{loaderData.teams?.map((team) => (
					<Link to={`/a/${team.account_id}/projects`} key={team.account_id}>
						<div
							// initial={{ opacity: 0, y: 10 }}
							// animate={{ opacity: 1, y: 0 }}
							// transition={{ duration: 0.2 }}
							className={cn(
								"group",
								"rounded-xl p-4",
								"bg-white dark:bg-zinc-900",
								"border border-zinc-200 dark:border-zinc-800",
								"hover:border-zinc-300 dark:hover:border-zinc-700",
								"transition-all duration-200"
							)}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div
										className={cn(
											"relative h-12 w-12 overflow-hidden rounded-lg",
											"bg-zinc-100 dark:bg-zinc-800",
											"transition-colors duration-200",
											"group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
										)}
									>
										{/* <img
											src={team.logo}
											alt={team.name}
											fill
											className="object-cover"
										/> */}
									</div>
									<div>
										<div className="flex items-center gap-2">
											<h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{team.name}</h3>
											<span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
												{team.slug}
											</span>
										</div>
										{/* <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
											<span>${product.price}</span>
											<span>•</span>
											<span>{product.color}</span>
										</div> */}
									</div>
								</div>
								{/* <Button
									size="sm"
									variant="outline"
									onClick={() => addToCart(product)}
									className="gap-1.5"
								>
									<Plus className="w-3.5 h-3.5" />
									Add
								</Button> */}
							</div>
						</div>

					</Link>))}
			</div>
		</div>
	)
}
