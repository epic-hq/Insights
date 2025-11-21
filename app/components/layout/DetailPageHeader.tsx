import type { LucideIcon } from "lucide-react"
import { Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { Form, Link } from "react-router-dom"
import { LinkOrganizationDialog } from "~/components/dialogs/LinkOrganizationDialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

interface DetailPageHeaderProps {
	/** Icon component to display in the badge */
	icon: LucideIcon
	/** Type label (e.g., "Organization", "Person", "Persona") */
	typeLabel: string
	/** Main title/name - can be string or editable component */
	title: string | ReactNode
	/** Optional subtitle or metadata row */
	metadata?: ReactNode
	/** Optional badges row */
	badges?: ReactNode
	/** Optional description/bio content - can be string or editable component */
	description?: string | ReactNode | null
	/** Optional avatar to display */
	avatar?: ReactNode
	/** Optional content to display above the description */
	aboveDescription?: ReactNode
	/** Optional organization data for inline organization management */
	organizations?: {
		personId: string
		sortedLinkedOrganizations: any[]
		availableOrganizations: any[]
		routes: any
	}
	/** Optional additional content in the card body */
	children?: ReactNode
}

export function DetailPageHeader({
	icon: Icon,
	typeLabel,
	title,
	metadata,
	badges,
	description,
	avatar,
	aboveDescription,
	organizations,
	children,
}: DetailPageHeaderProps) {
	return (
		<div>
			<Badge variant="secondary" className="w-fit gap-1 text-xs">
				<Icon className="h-3.5 w-3.5" /> {typeLabel}
			</Badge>
			<Card className="mb-8 border border-border/80">
				<CardHeader className="space-y-3">
					<div className="flex items-center gap-4">
						{avatar && <div className="flex-shrink-0">{avatar}</div>}
						<div className="flex-1">
							<CardTitle className="font-bold text-3xl text-foreground">{title}</CardTitle>
							{metadata && (
								<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">{metadata}</div>
							)}
							{badges && <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">{badges}</div>}
						</div>
					</div>
				</CardHeader>
				{(description !== undefined || aboveDescription || organizations || children) && (
					<CardContent className="space-y-4">
						{aboveDescription}
						{description !== undefined && (typeof description === "string" ? <p className="text-foreground">{description}</p> : description)}

						{organizations && (
							<div className="space-y-4 border-border/50 border-t pt-4">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium text-sm">Organizations</h4>
										{/* <p className="text-muted-foreground text-xs">Accounts linked to this participant.</p> */}
									</div>
									<LinkOrganizationDialog
										personId={organizations.personId}
										availableOrganizations={organizations.availableOrganizations}
									/>
								</div>

								{organizations.sortedLinkedOrganizations.length > 0 ? (
									<div className="grid gap-3 sm:grid-cols-2">
										{organizations.sortedLinkedOrganizations.map((link) => {
											const organization = link.organization
											if (!organization) return null
											return (
												<div
													key={link.id}
													className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3"
												>
													<div className="min-w-0 flex-1">
														<Link
															to={organizations.routes.organizations.detail(organization.id)}
															className="block truncate font-medium text-foreground text-sm hover:text-primary"
														>
															{organization.name}
														</Link>
														<div className="truncate text-muted-foreground text-xs">{link.role || "Linked participant"}</div>
													</div>
													<Form method="post">
														<input type="hidden" name="_action" value="unlink-organization" />
														<input type="hidden" name="organization_id" value={organization.id} />
														<Button
															type="submit"
															variant="ghost"
															size="icon"
															className="ml-2 h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
															title="Remove organization"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</Form>
												</div>
											)
										})}
									</div>
								) : (
									<div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
										No organizations linked yet
									</div>
								)}
							</div>
						)}

						{children}
					</CardContent>
				)}
			</Card>
		</div>
	)
}
