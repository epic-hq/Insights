import { Building2, LinkIcon, Users } from "lucide-react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOrganizations } from "~/features/organizations/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getServerClient } from "~/lib/supabase/client.server"
import { cn } from "~/lib/utils"
import type { Organization, PeopleOrganization } from "~/types"

export const meta: MetaFunction = () => {
	return [
		{ title: "Organizations" },
		{ name: "description", content: "Manage companies linked to your research participants" },
	]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data, error } = await getOrganizations({ supabase, accountId, projectId })

	if (error) {
		throw new Response("Error loading organizations", { status: 500 })
	}

	return { organizations: (data as Array<Organization & { people_organizations: PeopleOrganization[] }>) ?? [] }
}

export default function OrganizationsIndexPage() {
	const { organizations } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	return (
		<div className="min-h-screen bg-gray-50 pb-16 dark:bg-gray-950">
			<PersonaPeopleSubnav />
			<div className="border-b bg-white py-8 dark:border-gray-800 dark:bg-gray-950">
				<div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-2 font-semibold text-3xl text-gray-900 dark:text-white">
							<Building2 className="h-7 w-7" />
							Organizations
						</h1>
						<p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
							Keep company records up to date and understand how people relate to each account.
						</p>
					</div>
					<div className="flex gap-3">
						<Button asChild variant="outline" className="border-gray-300 dark:border-gray-700">
							<Link to={routes.people.index()}>View People</Link>
						</Button>
						<Button asChild>
							<Link to={routes.organizations.new()}>Add Organization</Link>
						</Button>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-6xl px-6 py-12">
				{organizations.length === 0 ? (
					<div className="rounded-xl border border-gray-300 border-dashed bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
						<Building2 className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
						<h2 className="mt-4 font-semibold text-2xl text-gray-900 dark:text-white">No organizations yet</h2>
						<p className="mt-2 text-gray-600 dark:text-gray-400">
							Add an organization to start linking people, tracking roles, and capturing account insights.
						</p>
						<div className="mt-6 flex justify-center">
							<Button asChild>
								<Link to={routes.organizations.new()}>Create organization</Link>
							</Button>
						</div>
					</div>
				) : (
					<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
						{organizations.map((organization) => {
							const linkedPeople = organization.people_organizations || []
							const primaryDomain = organization.domain || organization.website_url
							return (
								<Card
									key={organization.id}
									className="relative overflow-hidden border-border/80 transition-shadow hover:shadow-lg"
								>
									<CardHeader>
										<CardTitle className="flex items-start justify-between gap-2 text-xl">
											<Link
												to={routes.organizations.detail(organization.id)}
												className="transition-colors hover:text-primary"
											>
												{organization.name}
											</Link>
											{primaryDomain && (
												<Badge variant="outline" className="flex items-center gap-1 text-xs">
													<LinkIcon className="h-3 w-3" />
													<span className="max-w-[140px] truncate" title={primaryDomain}>
														{primaryDomain.replace(/^https?:\/\//, "")}
													</span>
												</Badge>
											)}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3 text-muted-foreground text-sm">
										<div className="flex flex-col gap-1">
											{organization.industry && (
												<span className="font-medium text-foreground">{organization.industry}</span>
											)}
											{organization.size_range && <span>Size: {organization.size_range}</span>}
											{organization.headquarters_location && <span>HQ: {organization.headquarters_location}</span>}
										</div>
										{organization.notes && <p className="line-clamp-2 text-muted-foreground">{organization.notes}</p>}
									</CardContent>
									<CardFooter className="flex items-center justify-between text-muted-foreground text-xs">
										<span className="flex items-center gap-1">
											<Users className="h-3.5 w-3.5" />
											{linkedPeople.length} linked
										</span>
										<Link
											to={routes.organizations.detail(organization.id)}
											className={cn(
												"rounded-full border border-transparent px-3 py-1 font-medium text-primary text-xs transition-colors",
												"hover:border-primary hover:bg-primary/5"
											)}
										>
											View details
										</Link>
									</CardFooter>
								</Card>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
