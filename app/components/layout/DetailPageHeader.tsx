import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Form, Link } from "react-router-dom"

interface DetailPageHeaderProps {
	/** Icon component to display in the badge */
	icon: LucideIcon
	/** Type label (e.g., "Organization", "Person", "Persona") */
	typeLabel: string
	/** Main title/name */
	title: string
	/** Optional subtitle or metadata row */
	metadata?: ReactNode
	/** Optional badges row */
	badges?: ReactNode
	/** Optional description/bio content */
	description?: string | null
	/** Optional avatar to display */
	avatar?: ReactNode
	/** Optional content to display above the description */
	aboveDescription?: ReactNode
	/** Optional organization data for inline organization management */
	organizations?: {
		sortedLinkedOrganizations: any[]
		availableOrganizations: any[]
		showLinkForm: boolean
		setShowLinkForm: (show: boolean) => void
		actionData?: { error?: string }
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
							{metadata && <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">{metadata}</div>}
							{badges && <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">{badges}</div>}
						</div>
					</div>
				</CardHeader>
				{(description || aboveDescription || organizations || children) && (
					<CardContent className="space-y-4">
						{aboveDescription}
						{description && <p className="text-muted-foreground">{description}</p>}

						{organizations && (
							<div className="space-y-4 pt-4 border-t border-border/50">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium text-sm">Organizations</h4>
										<p className="text-muted-foreground text-xs">Accounts linked to this participant.</p>
									</div>
									{organizations.availableOrganizations.length > 0 && !organizations.showLinkForm && (
										<Button variant="outline" size="sm" onClick={() => organizations.setShowLinkForm(true)}>
											Link organization
										</Button>
									)}
								</div>

								{organizations.sortedLinkedOrganizations.length > 0 ? (
									<div className="space-y-3">
										{organizations.sortedLinkedOrganizations.map((link) => {
											const organization = link.organization
											if (!organization) return null
											return (
												<div
													key={link.id}
													className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3"
												>
													<div>
														<Link
															to={organizations.routes.organizations.detail(organization.id)}
															className="font-medium text-foreground text-sm hover:text-primary"
														>
															{organization.name}
														</Link>
														<div className="text-muted-foreground text-xs">{link.role || "Linked participant"}</div>
													</div>
													<Form method="post">
														<input type="hidden" name="_action" value="unlink-organization" />
														<input type="hidden" name="organization_id" value={organization.id} />
														<Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
															Remove
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

								{organizations.actionData?.error && (
									<div className="rounded-md bg-destructive/15 p-3 text-destructive text-sm">{organizations.actionData.error}</div>
								)}

								{organizations.showLinkForm && organizations.availableOrganizations.length > 0 && (
									<Form method="post" className="space-y-3 rounded-lg border border-dashed p-4">
										<input type="hidden" name="_action" value="link-organization" />
										<Select name="organization_id" defaultValue={organizations.availableOrganizations[0]?.id ?? ""}>
											<SelectTrigger>
												<SelectValue placeholder="Select organization" />
											</SelectTrigger>
											<SelectContent>
												{organizations.availableOrganizations.map((org) => (
													<SelectItem key={org.id} value={org.id}>
														{org.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Input name="role" placeholder="Role or relationship" />
										<div className="flex gap-2">
											<Button type="submit" size="sm">
												Link
											</Button>
											<Button type="button" variant="ghost" size="sm" onClick={() => organizations.setShowLinkForm(false)}>
												Cancel
											</Button>
										</div>
									</Form>
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
