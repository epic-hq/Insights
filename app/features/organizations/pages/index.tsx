import { Building2, LayoutGrid, LinkIcon, Table as TableIcon, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import {
	OrganizationsDataTable,
	type OrganizationTableRow,
} from "~/features/organizations/components/OrganizationsDataTable"
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

type OrganizationWithContacts = Organization & {
	people_organizations: Array<
		PeopleOrganization & {
			person?: {
				id: string
				name: string | null
				segment?: string | null
			} | null
		}
	>
}

export default function OrganizationsIndexPage() {
	const { organizations } = useLoaderData<typeof loader>() as { organizations: OrganizationWithContacts[] }
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

	const tableRows = useMemo<OrganizationTableRow[]>(() => {
		return organizations.map((organization) => {
			const contacts =
				organization.people_organizations?.map((link) => ({
					id: link.person?.id ?? `${organization.id}-${link.id}`,
					name: link.person?.name ?? null,
					segment: link.person?.segment ?? undefined,
				})) ?? []

			const signals = new Set<string>()
			for (const link of organization.people_organizations ?? []) {
				if (link.role) signals.add(link.role)
				if (link.relationship_status) signals.add(link.relationship_status)
			}

			return {
				id: organization.id,
				name: organization.name ?? "Untitled organization",
				domain: organization.domain || organization.website_url,
				industry: organization.industry ?? undefined,
				sizeRange: organization.size_range ?? undefined,
				contacts,
				relationshipSignals: Array.from(signals).slice(0, 4),
				updatedAt: organization.updated_at ?? null,
			}
		})
	}, [organizations])

	return (
		<>
			<PersonaPeopleSubnav />
			<PageContainer className="space-y-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h1 className="flex items-center gap-2 font-semibold text-3xl text-foreground">
							<Building2 className="h-7 w-7" />
							Organizations
						</h1>
						<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
							Understand which accounts are active, who you know inside each one, and how those relationships are
							evolving.
						</p>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<ToggleGroup
							type="single"
							value={viewMode}
							onValueChange={(value) => value && setViewMode(value as "cards" | "table")}
							className="w-full sm:w-auto"
							variant="outline"
							size="sm"
						>
							<ToggleGroupItem value="cards" aria-label="Card view">
								<LayoutGrid className="h-4 w-4" />
							</ToggleGroupItem>
							<ToggleGroupItem value="table" aria-label="Table view">
								<TableIcon className="h-4 w-4" />
							</ToggleGroupItem>
						</ToggleGroup>
						<div className="flex w-full gap-2 sm:w-auto">
							<Button asChild variant="ghost" className="flex-1 sm:flex-none">
								<Link to={routes.people.index()}>View People</Link>
							</Button>
							<Button asChild variant="outline" className="flex-1 sm:flex-none">
								<Link to={routes.organizations.new()}>Add Organization</Link>
							</Button>
						</div>
					</div>
				</div>

				{organizations.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/40 py-16 text-center">
						<div className="mx-auto max-w-md space-y-4">
							<h3 className="font-semibold text-foreground text-xl">No organizations yet</h3>
							<p className="text-muted-foreground text-sm">
								Add an organization to start linking people, tracking roles, and capturing account insights.
							</p>
							<Button asChild>
								<Link to={routes.organizations.new()}>Create organization</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "table" ? (
					<OrganizationsDataTable rows={tableRows} />
				) : (
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
			</PageContainer>
		</>
	)
}
