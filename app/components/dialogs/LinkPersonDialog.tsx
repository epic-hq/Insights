import { Plus, Search, UserPlus } from "lucide-react"
import { useState } from "react"
import { Form, useFetcher } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
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
import { Textarea } from "~/components/ui/textarea"

interface Person {
	id: string
	name: string | null
	title?: string | null
	image_url?: string | null
	primary_email?: string | null
}

interface LinkPersonDialogProps {
	/** The ID of the entity (organization, interview, etc.) to link the person to */
	entityId: string
	/** The type of entity for the action name */
	entityType?: "organization" | "interview"
	availablePeople: Person[]
	triggerButton?: React.ReactNode
	onSuccess?: () => void
}

export function LinkPersonDialog({
	entityId,
	entityType = "organization",
	availablePeople,
	triggerButton,
	onSuccess,
}: LinkPersonDialogProps) {
	const [open, setOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedPersonId, setSelectedPersonId] = useState<string>("")
	const [role, setRole] = useState("")
	const [relationshipStatus, setRelationshipStatus] = useState("")
	const fetcher = useFetcher()

	const filteredPeople = availablePeople.filter(
		(person) =>
			person.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			person.primary_email?.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleLink = () => {
		if (!selectedPersonId) return

		fetcher.submit(
			{
				_action: "link-person",
				person_id: selectedPersonId,
				role: role || "",
				relationship_status: relationshipStatus || "",
			},
			{ method: "post" }
		)

		// Close dialog and reset on success
		setOpen(false)
		setSearchTerm("")
		setSelectedPersonId("")
		setRole("")
		setRelationshipStatus("")
		onSuccess?.()
	}

	const getInitials = (name: string | null) => {
		if (!name) return "?"
		return name
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase()
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{triggerButton || (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 rounded-full border border-border/70 border-dashed px-3 font-medium text-muted-foreground text-xs"
					>
						<span className="font-semibold text-sm leading-none">+</span>
						<UserPlus className="h-3.5 w-3.5" />
						<span>Link Person</span>
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Link Person</DialogTitle>
					<DialogDescription>
						Search for an existing person or create a new one to link to this {entityType}.
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
								placeholder="Search by name or email..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
							/>
						</div>

						<ScrollArea className="h-[300px] rounded-md border">
							{filteredPeople.length === 0 ? (
								<div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
									<UserPlus className="mb-2 h-8 w-8" />
									<p className="text-sm">No people found</p>
									<p className="text-xs">Try creating a new person</p>
								</div>
							) : (
								<div className="space-y-2 p-2">
									{filteredPeople.map((person) => (
										<button
											key={person.id}
											type="button"
											onClick={() => setSelectedPersonId(person.id)}
											className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
												selectedPersonId === person.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
											}`}
										>
											<Avatar className="h-10 w-10">
												{person.image_url && <AvatarImage src={person.image_url} alt={person.name ?? "Person"} />}
												<AvatarFallback>{getInitials(person.name)}</AvatarFallback>
											</Avatar>
											<div className="flex-1">
												<div className="font-medium text-sm">{person.name || "Unnamed"}</div>
												<div className="text-muted-foreground text-xs">
													{person.title && <span>{person.title}</span>}
													{person.primary_email && (
														<span className="ml-2 text-muted-foreground/70">{person.primary_email}</span>
													)}
												</div>
											</div>
										</button>
									))}
								</div>
							)}
						</ScrollArea>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="role">Role (optional)</Label>
								<Input
									id="role"
									placeholder="e.g., Decision Maker, Champion"
									value={role}
									onChange={(e) => setRole(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="relationship_status">Status (optional)</Label>
								<Input
									id="relationship_status"
									placeholder="e.g., Active, Prospect"
									value={relationshipStatus}
									onChange={(e) => setRelationshipStatus(e.target.value)}
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleLink} disabled={!selectedPersonId}>
								Link Person
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
							<input type="hidden" name="_action" value="create-and-link-person" />
							<input type="hidden" name={`${entityType}_id`} value={entityId} />

							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="new-person-name">Full Name *</Label>
									<Input id="new-person-name" name="name" placeholder="Jane Doe" required />
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="new-person-email">Email</Label>
										<Input id="new-person-email" name="primary_email" type="email" placeholder="jane@example.com" />
									</div>
									<div className="space-y-2">
										<Label htmlFor="new-person-title">Title</Label>
										<Input id="new-person-title" name="title" placeholder="Product Manager" />
									</div>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="new-person-role">Role</Label>
										<Input id="new-person-role" name="role" placeholder="Decision Maker" />
									</div>
									<div className="space-y-2">
										<Label htmlFor="new-person-status">Status</Label>
										<Input id="new-person-status" name="relationship_status" placeholder="Active" />
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="new-person-notes">Notes (optional)</Label>
									<Textarea id="new-person-notes" name="notes" rows={3} placeholder="Any context about this person" />
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
