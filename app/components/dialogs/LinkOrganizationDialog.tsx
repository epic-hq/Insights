import { Building2, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Form, useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

interface Organization {
	id: string
	name: string
	headquarters_location?: string | null
}

interface LinkOrganizationDialogProps {
	personId: string
	availableOrganizations: Organization[]
	triggerButton?: React.ReactNode
	onSuccess?: () => void
}

export function LinkOrganizationDialog({
	personId,
	availableOrganizations,
	triggerButton,
	onSuccess,
}: LinkOrganizationDialogProps) {
	const [open, setOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("")
	const [role, setRole] = useState("")
	const fetcher = useFetcher()

	const filteredOrganizations = availableOrganizations.filter((org) =>
		org.name.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleLink = () => {
		if (!selectedOrganizationId) return

		fetcher.submit(
			{
				_action: "link-organization",
				organization_id: selectedOrganizationId,
				role: role || "",
			},
			{ method: "post" }
		)

		// Close dialog and reset on success
		setOpen(false)
		setSearchTerm("")
		setSelectedOrganizationId("")
		setRole("")
		onSuccess?.()
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{triggerButton || (
					<Button variant="outline" size="sm">
						<Building2 className="mr-2 h-4 w-4" />
						Link Organization
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Link Organization</DialogTitle>
					<DialogDescription>
						Search for an existing organization or create a new one to link to this person.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="existing" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="existing">Select Existing</TabsTrigger>
						<TabsTrigger value="new">Create New</TabsTrigger>
					</TabsList>

					<TabsContent value="existing" className="space-y-4">
						<div className="relative">
							<Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search organizations..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
							/>
						</div>

						<ScrollArea className="h-[300px] rounded-md border">
							{filteredOrganizations.length === 0 ? (
								<div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
									<Building2 className="mb-2 h-8 w-8" />
									<p className="text-sm">No organizations found</p>
									<p className="text-xs">Try creating a new one</p>
								</div>
							) : (
								<div className="p-2 space-y-2">
									{filteredOrganizations.map((org) => (
										<button
											key={org.id}
											type="button"
											onClick={() => setSelectedOrganizationId(org.id)}
											className={`w-full rounded-lg border p-3 text-left transition-colors ${
												selectedOrganizationId === org.id
													? "border-primary bg-primary/10"
													: "border-border hover:bg-muted"
											}`}
										>
											<div className="font-medium text-sm">{org.name}</div>
											{org.headquarters_location && (
												<div className="text-muted-foreground text-xs">{org.headquarters_location}</div>
											)}
										</button>
									))}
								</div>
							)}
						</ScrollArea>

						<div className="space-y-2">
							<Label htmlFor="role">Role (optional)</Label>
							<Input
								id="role"
								placeholder="e.g., Employee, Contractor, Advisor"
								value={role}
								onChange={(e) => setRole(e.target.value)}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleLink} disabled={!selectedOrganizationId}>
								Link Organization
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="new" className="space-y-4">
						<Form
							method="post"
							onSubmit={(e) => {
								e.preventDefault()
								const formData = new FormData(e.currentTarget)
								fetcher.submit(formData, { method: "post" })
								setOpen(false)
								onSuccess?.()
							}}
						>
							<input type="hidden" name="_action" value="create-and-link-organization" />
							<input type="hidden" name="person_id" value={personId} />

							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="new-org-name">Organization Name *</Label>
									<Input id="new-org-name" name="name" placeholder="Acme Corp" required />
								</div>

								<div className="space-y-2">
									<Label htmlFor="new-org-location">Location</Label>
									<Input id="new-org-location" name="headquarters_location" placeholder="San Francisco, CA" />
								</div>

								<div className="space-y-2">
									<Label htmlFor="new-org-role">Role</Label>
									<Input id="new-org-role" name="role" placeholder="e.g., Employee, Contractor" />
								</div>

								<div className="flex justify-end gap-2">
									<Button type="button" variant="outline" onClick={() => setOpen(false)}>
										Cancel
									</Button>
									<Button type="submit">
										<Plus className="mr-2 h-4 w-4" />
										Create & Link
									</Button>
								</div>
							</div>
						</Form>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	)
}
