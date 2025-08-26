import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, redirect, useActionData, useLoaderData } from "react-router-dom"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { createInterview } from "~/features/interviews/db"
import { createPerson, getPeople } from "~/features/people/db"
import { userContext } from "~/server/user-context"
import { createSupabaseAdminClient } from "~/lib/supabase/server"
import { Plus, User, Users, X } from "lucide-react"

export const meta: MetaFunction = () => {
	return [{ title: "New Interview | Insights" }, { name: "description", content: "Create a new interview" }]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// Fetch existing people for participant selection
	const { data: people } = await getPeople({ supabase, accountId, projectId })

	return {
		people: people || [],
		accountId,
		projectId,
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const formData = await request.formData()
	const title = formData.get("title") as string
	const interviewDate = formData.get("interview_date") as string
	const description = formData.get("description") as string
	const participantPseudonym = formData.get("participant_pseudonym") as string
	const segment = formData.get("segment") as string
	const durationMin = formData.get("duration_min") as string
	const selectedPeople = formData.getAll("selected_people") as string[]
	const newPeopleData = formData.get("new_people_data") as string

	if (!title?.trim()) {
		return { error: "Title is required" }
	}

	// Parse new people data if provided
	let newPeopleToCreate: Array<{ name: string; segment: string }> = []
	if (newPeopleData) {
		try {
			newPeopleToCreate = JSON.parse(newPeopleData)
		} catch {
			// Ignore parsing errors
		}
	}

	try {
		const { data, error } = await createInterview({
			supabase,
			data: {
				title: title.trim(),
				interview_date: interviewDate || null,
				participant_pseudonym: participantPseudonym?.trim() || null,
				segment: segment?.trim() || null,
				duration_min: durationMin ? parseInt(durationMin, 10) : null,
				account_id: accountId,
				project_id: projectId,
			},
		})

		if (error) {
			return { error: "Failed to create interview" }
		}

		// Create new people first
		const createdPeopleIds: string[] = []
		if (newPeopleToCreate.length > 0 && data?.id) {
			for (const newPerson of newPeopleToCreate) {
				const { data: personData, error: personError } = await createPerson({
					supabase,
					data: {
						name: newPerson.name.trim(),
						segment: newPerson.segment || null,
						account_id: accountId,
						project_id: projectId,
					},
				})
				if (!personError && personData?.id) {
					createdPeopleIds.push(personData.id)
				}
			}
		}

		// Link all people (existing + newly created) to the interview
		const allPeopleIds = [...selectedPeople, ...createdPeopleIds]
		if (allPeopleIds.length > 0 && data?.id) {
			for (const personId of allPeopleIds) {
				await supabase.from("interview_people").insert({
					interview_id: data.id,
					person_id: personId,
					role: "participant", // Default role
				})
			}
		}

		return redirect(`/a/${accountId}/projects/${projectId}/interviews/${data.id}`)
	} catch (_error) {
		return { error: "Failed to create interview" }
	}
}

export default function NewInterview() {
	const actionData = useActionData<typeof action>()
	const { people } = useLoaderData<typeof loader>()
	const [selectedPeople, setSelectedPeople] = useState<string[]>([])
	const [showNewPersonForm, setShowNewPersonForm] = useState(false)
	const [newPersonName, setNewPersonName] = useState("")
	const [newPersonSegment, setNewPersonSegment] = useState("")
	const [newPeople, setNewPeople] = useState<Array<{ name: string; segment: string; tempId: string }>>([])

	const togglePersonSelection = (personId: string) => {
		setSelectedPeople((prev) => (prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]))
	}

	const addNewPerson = () => {
		if (newPersonName.trim()) {
			const tempId = `temp_${Date.now()}`
			setNewPeople((prev) => [
				...prev,
				{
					name: newPersonName.trim(),
					segment: newPersonSegment,
					tempId,
				},
			])
			setNewPersonName("")
			setNewPersonSegment("")
			setShowNewPersonForm(false)
		}
	}

	const removeNewPerson = (tempId: string) => {
		setNewPeople((prev) => prev.filter((p) => p.tempId !== tempId))
	}

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-foreground">New Interview</h1>
				<p className="mt-2 text-muted-foreground">Create a comprehensive interview record with participant details</p>
			</div>

			<Form method="post" className="space-y-8">
				{/* Basic Interview Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<User className="h-5 w-5" />
							Interview Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="title">Title *</Label>
								<Input
									id="title"
									name="title"
									type="text"
									required
									placeholder="e.g., User onboarding feedback session"
									className="mt-1"
								/>
							</div>

							<div>
								<Label htmlFor="interview_date">Interview Date</Label>
								<Input id="interview_date" name="interview_date" type="date" className="mt-1" />
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="participant_pseudonym">Participant Name/Pseudonym</Label>
								<Input
									id="participant_pseudonym"
									name="participant_pseudonym"
									type="text"
									placeholder="e.g., Sarah K, User_001"
									className="mt-1"
								/>
							</div>

							<div>
								<Label htmlFor="duration_min">Duration (minutes)</Label>
								<Input
									id="duration_min"
									name="duration_min"
									type="number"
									placeholder="30"
									min="1"
									max="480"
									className="mt-1"
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="segment">Participant Segment</Label>
							<Select name="segment">
								<SelectTrigger className="mt-1">
									<SelectValue placeholder="Select participant segment" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="new_user">New User</SelectItem>
									<SelectItem value="existing_user">Existing User</SelectItem>
									<SelectItem value="power_user">Power User</SelectItem>
									<SelectItem value="churned_user">Churned User</SelectItem>
									<SelectItem value="prospect">Prospect</SelectItem>
									<SelectItem value="stakeholder">Stakeholder</SelectItem>
									<SelectItem value="other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="description">Description & Context</Label>
							<Textarea
								id="description"
								name="description"
								placeholder="Interview objectives, key topics to explore, participant background..."
								className="mt-1"
								rows={4}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Participant Selection */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Participants (Optional)
						</CardTitle>
						<p className="text-sm text-muted-foreground">
							Link existing people or add new participants for better tracking and persona analysis.
						</p>
					</CardHeader>
					<CardContent>
						{/* Hidden input for new people data */}
						<input
							type="hidden"
							name="new_people_data"
							value={JSON.stringify(newPeople.map((p) => ({ name: p.name, segment: p.segment })))}
						/>
						{/* Add New Person Section */}
						<div className="mb-6">
							<div className="flex items-center justify-between mb-3">
								<h4 className="font-medium text-sm text-foreground">Add New Participants</h4>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowNewPersonForm(!showNewPersonForm)}
								>
									<Plus className="h-4 w-4 mr-1" />
									Add Person
								</Button>
							</div>

							{showNewPersonForm && (
								<div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										<div>
											<Label htmlFor="new_person_name">Name</Label>
											<Input
												id="new_person_name"
												value={newPersonName}
												onChange={(e) => setNewPersonName(e.target.value)}
												placeholder="e.g., Bob Jones, Sally Smith"
												className="mt-1"
											/>
										</div>
										<div>
											<Label htmlFor="new_person_segment">Segment</Label>
											<Select value={newPersonSegment} onValueChange={setNewPersonSegment}>
												<SelectTrigger className="mt-1">
													<SelectValue placeholder="Select segment" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="new_user">New User</SelectItem>
													<SelectItem value="existing_user">Existing User</SelectItem>
													<SelectItem value="power_user">Power User</SelectItem>
													<SelectItem value="churned_user">Churned User</SelectItem>
													<SelectItem value="prospect">Prospect</SelectItem>
													<SelectItem value="stakeholder">Stakeholder</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<Button type="button" onClick={addNewPerson} disabled={!newPersonName.trim()} size="sm">
										Add Person
									</Button>
								</div>
							)}

							{/* Display added new people */}
							{newPeople.length > 0 && (
								<div className="space-y-2">
									<h5 className="font-medium text-sm text-foreground">New Participants to Add:</h5>
									{newPeople.map((person) => (
										<div
											key={person.tempId}
											className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded"
										>
											<div className="flex items-center gap-2">
												<span className="font-medium text-sm">{person.name}</span>
												{person.segment && (
													<Badge variant="outline" className="text-xs">
														{person.segment.replace("_", " ")}
													</Badge>
												)}
											</div>
											<Button type="button" variant="ghost" size="sm" onClick={() => removeNewPerson(person.tempId)}>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Existing People Selection */}
						{people.length > 0 && (
							<div className="space-y-3">
								<h4 className="font-medium text-sm text-foreground">Select from Existing People</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{people.map((person) => (
										<div
											key={person.id}
											className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
										>
											<Checkbox
												id={`person-${person.id}`}
												checked={selectedPeople.includes(person.id)}
												onCheckedChange={() => togglePersonSelection(person.id)}
											/>
											<input
												type="hidden"
												name="selected_people"
												value={person.id}
												disabled={!selectedPeople.includes(person.id)}
											/>
											<div className="flex-1">
												<label htmlFor={`person-${person.id}`} className="font-medium text-sm cursor-pointer">
													{person.name}
												</label>
												{person.segment && (
													<Badge variant="outline" className="ml-2 text-xs">
														{person.segment}
													</Badge>
												)}
												{person.description && (
													<p className="text-xs text-muted-foreground mt-1 line-clamp-2">{person.description}</p>
												)}
											</div>
										</div>
									))}
								</div>
								{(selectedPeople.length > 0 || newPeople.length > 0) && (
									<div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
										<p className="text-sm text-blue-700 dark:text-blue-300">
											✓ {selectedPeople.length + newPeople.length} participant
											{selectedPeople.length + newPeople.length > 1 ? "s" : ""} will be linked
										</p>
									</div>
								)}
							</div>
						)}
						{people.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								<Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p className="text-sm">No people in your database yet.</p>
								<p className="text-xs mt-1">Use "Add Person" above to create participants for this interview.</p>
							</div>
						)}
					</CardContent>
				</Card>

				{actionData?.error && (
					<div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4">
						<p className="text-red-700 dark:text-red-300 text-sm">{actionData.error}</p>
					</div>
				)}

				<div className="flex gap-4">
					<Button type="submit" className="bg-blue-600 hover:bg-blue-700">
						Create Interview
					</Button>
					<Button type="button" variant="outline" onClick={() => window.history.back()}>
						Cancel
					</Button>
				</div>
			</Form>
		</div>
	)
}
