/**
 * Task Detail Page
 * Displays all task information with editing capabilities and commentary via annotations
 */

import {
	ArrowLeft,
	Bot,
	Building2,
	Calendar as CalendarIcon,
	Check,
	Clock,
	ExternalLink,
	FileText,
	Flag,
	Lightbulb,
	Link2,
	MessageCircle,
	Mic,
	Plus,
	Quote,
	Search,
	Sparkles,
	Tag,
	Target,
	Trash2,
	User,
	Users,
	X,
} from "lucide-react"
import type React from "react"
import { useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Link, redirect, useFetcher, useLoaderData } from "react-router"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import InlineEdit from "~/components/ui/inline-edit"
import { Input } from "~/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { getInsights } from "~/features/insights/db"
import { getInterviews } from "~/features/interviews/db"
import { getOpportunities } from "~/features/opportunities/db"
import { getPeople } from "~/features/people/db"
import {
	createTaskLink,
	deleteTaskLink,
	getTaskActivity,
	getTaskById,
	getTaskLinks,
	type TaskLink,
	type TaskLinkEntityType,
	updateTask,
} from "~/features/tasks/db"
import { PriorityBars, priorityConfig as sharedPriorityConfig } from "~/features/tasks/components/PriorityBars"
import { StatusDropdown } from "~/features/tasks/components/TaskStatus"
import type { AgentType, Assignee, TaskActivity, TaskStatus } from "~/features/tasks/types"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

// ============================================================================
// Types
// ============================================================================

interface TeamMember {
	user_id: string
	name: string
	email: string | null
	avatar_url: string | null
}

interface ProjectPerson {
	id: string
	name: string | null
	title: string | null
	email: string | null
	avatar_url: string | null
}

interface EnrichedTaskLink {
	id: string
	task_id: string
	entity_type: TaskLinkEntityType
	entity_id: string
	link_type: string
	description: string | null
	// Enriched data
	entity_name: string
	entity_preview: string | null
}

interface LinkableEntity {
	id: string
	name: string
	preview: string | null
	type: TaskLinkEntityType
}

// ============================================================================
// Loader
// ============================================================================

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)

	if (!ctx?.claims) {
		return redirect("/login")
	}

	const { accountId, projectId, taskId } = params

	if (!accountId || !projectId || !taskId) {
		throw new Response("Missing required parameters", { status: 400 })
	}

	if (!ctx.supabase) {
		throw new Response("Supabase client missing", { status: 500 })
	}

	try {
		// Fetch task, activity, team members, project people, task links, and linkable entities in parallel
		const [
			task,
			activity,
			membersResult,
			peopleResult,
			taskLinks,
			evidenceResult,
			interviewsResult,
			insightsResult,
			opportunitiesResult,
		] = await Promise.all([
			getTaskById({ supabase: ctx.supabase, taskId }),
			getTaskActivity({ supabase: ctx.supabase, taskId, limit: 20 }),
			// Fetch team members from account_user and user_settings
			(async () => {
				const supabase = ctx.supabase!
				const { data: accountUsers } = await supabase
					.schema("accounts")
					.from("account_user")
					.select("user_id")
					.eq("account_id", accountId)

				if (!accountUsers || accountUsers.length === 0) return []

				const userIds = accountUsers.map((u) => u.user_id)
				const { data: profiles } = await supabase
					.from("user_settings")
					.select("user_id, first_name, last_name, email, image_url")
					.in("user_id", userIds)

				return (profiles || []).map((p) => ({
					user_id: p.user_id,
					name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown",
					email: p.email,
					avatar_url: p.image_url,
				}))
			})(),
			// Fetch people from the project
			getPeople({ supabase: ctx.supabase, accountId, projectId }),
			// Fetch task links
			getTaskLinks({ supabase: ctx.supabase, taskId }),
			// Fetch linkable entities
			// Evidence - query directly since there's no db function
			(async () => {
				const { data } = await ctx
					.supabase!.from("evidence")
					.select("id, gist, verbatim")
					.eq("project_id", projectId)
					.limit(100)
				return { data: data || [] }
			})(),
			getInterviews({ supabase: ctx.supabase, accountId, projectId }),
			getInsights({ supabase: ctx.supabase, accountId, projectId }),
			getOpportunities({ supabase: ctx.supabase, accountId, projectId }),
		])

		// Map project people to a simpler format
		const projectPeople: ProjectPerson[] = (peopleResult.data || []).map(
			(p: {
				id: string
				name: string | null
				title: string | null
				primary_email: string | null
				image_url: string | null
			}) => ({
				id: p.id,
				name: p.name,
				title: p.title,
				email: p.primary_email,
				avatar_url: p.image_url,
			})
		)

		// Enrich task links with entity details
		const enrichedLinks: EnrichedTaskLink[] = await Promise.all(
			taskLinks.map(async (link: TaskLink) => {
				let entityName = "Unknown"
				let entityPreview: string | null = null

				try {
					const supabase = ctx.supabase!
					switch (link.entity_type) {
						case "evidence": {
							const { data } = await supabase
								.from("evidence")
								.select("gist, verbatim")
								.eq("id", link.entity_id)
								.single()
							if (data) {
								entityName = data.gist || "Evidence"
								entityPreview = data.verbatim?.slice(0, 100) || null
							}
							break
						}
						case "person": {
							const { data } = await supabase.from("people").select("name, title").eq("id", link.entity_id).single()
							if (data) {
								entityName = data.name || "Unknown Person"
								entityPreview = data.title
							}
							break
						}
						case "organization": {
							const { data } = await supabase
								.from("organizations")
								.select("name, description")
								.eq("id", link.entity_id)
								.single()
							if (data) {
								entityName = data.name || "Unknown Organization"
								entityPreview = data.description?.slice(0, 100) || null
							}
							break
						}
						case "opportunity": {
							const { data } = await supabase
								.from("opportunities")
								.select("title, description")
								.eq("id", link.entity_id)
								.single()
							if (data) {
								entityName = data.title || "Unknown Opportunity"
								entityPreview = data.description?.slice(0, 100) || null
							}
							break
						}
						case "interview": {
							const { data } = await supabase
								.from("interviews")
								.select("title, participant_pseudonym")
								.eq("id", link.entity_id)
								.single()
							if (data) {
								entityName = data.title || "Interview"
								entityPreview = data.participant_pseudonym
							}
							break
						}
						case "insight": {
							const { data } = await supabase.from("themes").select("name, details").eq("id", link.entity_id).single()
							if (data) {
								entityName = data.name || "Insight"
								entityPreview = data.details?.slice(0, 100) || null
							}
							break
						}
						case "persona": {
							const { data } = await supabase
								.from("personas")
								.select("name, description")
								.eq("id", link.entity_id)
								.single()
							if (data) {
								entityName = data.name || "Persona"
								entityPreview = data.description?.slice(0, 100) || null
							}
							break
						}
					}
				} catch {
					// Keep defaults if entity not found
				}

				return {
					id: link.id,
					task_id: link.task_id,
					entity_type: link.entity_type,
					entity_id: link.entity_id,
					link_type: link.link_type,
					description: link.description,
					entity_name: entityName,
					entity_preview: entityPreview,
				}
			})
		)

		// Build linkable entities from fetched data
		const linkableEntities: LinkableEntity[] = [
			// Evidence
			...(evidenceResult.data || []).map((e: { id: string; gist: string | null; verbatim: string | null }) => ({
				id: e.id,
				name: e.gist || "Evidence",
				preview: e.verbatim?.slice(0, 100) || null,
				type: "evidence" as TaskLinkEntityType,
			})),
			// Interviews
			...(interviewsResult.data || []).map(
				(i: { id: string; title: string | null; participant_pseudonym: string | null }) => ({
					id: i.id,
					name: i.title || "Interview",
					preview: i.participant_pseudonym || null,
					type: "interview" as TaskLinkEntityType,
				})
			),
			// Insights
			...(insightsResult.data || []).map((i: { id: string; name: string | null; details: string | null }) => ({
				id: i.id,
				name: i.name || "Insight",
				preview: i.details?.slice(0, 100) || null,
				type: "insight" as TaskLinkEntityType,
			})),
			// Opportunities
			...(opportunitiesResult.data || []).map(
				(o: { id: string; title: string | null; description: string | null }) => ({
					id: o.id,
					name: o.title || "Opportunity",
					preview: o.description?.slice(0, 100) || null,
					type: "opportunity" as TaskLinkEntityType,
				})
			),
			// People (already fetched)
			...projectPeople.map((p: ProjectPerson) => ({
				id: p.id,
				name: p.name || "Unknown Person",
				preview: p.title || null,
				type: "person" as TaskLinkEntityType,
			})),
		]

		const projectPath = `/a/${accountId}/${projectId}`

		return {
			task,
			activity,
			projectPath,
			accountId,
			projectId,
			teamMembers: membersResult,
			projectPeople,
			taskLinks: enrichedLinks,
			linkableEntities,
		}
	} catch (error) {
		throw new Response("Task not found", { status: 404 })
	}
}

// ============================================================================
// Action
// ============================================================================

export async function action({ context, request, params }: ActionFunctionArgs) {
	const ctx = context.get(userContext)

	if (!ctx?.claims) {
		throw new Response("Unauthorized", { status: 401 })
	}

	if (!ctx.supabase) {
		throw new Response("Supabase client missing", { status: 500 })
	}

	const { taskId } = params
	if (!taskId) {
		throw new Response("Missing task ID", { status: 400 })
	}

	const userId = ctx.claims.sub
	const formData = await request.formData()
	const action = formData.get("_action") as string
	const field = formData.get("field") as string
	const value = formData.get("value") as string

	if (action === "update-field") {
		if (!field) {
			throw new Response("Missing field name", { status: 400 })
		}

		try {
			let parsedValue: unknown = value

			// Parse value based on field type
			if (field === "priority" || field === "impact") {
				parsedValue = Number.parseInt(value, 10)
			} else if (field === "status") {
				parsedValue = value as TaskStatus
			} else if (field === "tags") {
				parsedValue = value
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			} else if (field === "assigned_to") {
				parsedValue = JSON.parse(value)
			} else if (field === "due_date") {
				// Handle empty string as null for clearing the date
				parsedValue = value === "" ? null : value
			}

			await updateTask({
				supabase: ctx.supabase,
				taskId,
				userId,
				updates: { [field]: parsedValue } as any,
			})

			return { success: true }
		} catch (error) {
			throw new Response("Failed to update task", { status: 500 })
		}
	}

	if (action === "add-link") {
		const entityType = formData.get("entityType") as TaskLinkEntityType
		const entityId = formData.get("entityId") as string
		const linkType = (formData.get("linkType") as string) || "supports"

		if (!entityType || !entityId) {
			throw new Response("Missing entity type or ID", { status: 400 })
		}

		try {
			await createTaskLink({
				supabase: ctx.supabase,
				userId,
				data: {
					task_id: taskId,
					entity_type: entityType,
					entity_id: entityId,
					link_type: linkType as any,
				},
			})

			return { success: true }
		} catch (error) {
			throw new Response("Failed to add link", { status: 500 })
		}
	}

	if (action === "remove-link") {
		const linkId = formData.get("linkId") as string

		if (!linkId) {
			throw new Response("Missing link ID", { status: 400 })
		}

		try {
			await deleteTaskLink({
				supabase: ctx.supabase,
				linkId,
				userId,
			})

			return { success: true }
		} catch (error) {
			throw new Response("Failed to remove link", { status: 500 })
		}
	}

	throw new Response("Invalid action", { status: 400 })
}

// ============================================================================
// Config
// ============================================================================

const impactConfig = {
	1: { label: "Low", className: "bg-slate-100 text-slate-700", description: "Minor improvement" },
	2: { label: "Medium", className: "bg-blue-100 text-blue-700", description: "Noticeable improvement" },
	3: { label: "High", className: "bg-purple-100 text-purple-700", description: "Significant impact" },
}

const effortConfig = {
	S: { label: "Small (S)", description: "< 2 hours" },
	M: { label: "Medium (M)", description: "2-8 hours" },
	L: { label: "Large (L)", description: "1-3 days" },
	XL: { label: "Extra Large (XL)", description: "> 3 days" },
}

const agentTypes: AgentType[] = ["code-generation", "research", "testing", "documentation"]

// ============================================================================
// Field Components
// ============================================================================

function EditableField({
	taskId,
	field,
	value,
	multiline = false,
}: {
	taskId: string
	field: string
	value: string
	multiline?: boolean
}) {
	const fetcher = useFetcher()

	const handleSubmit = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", field)
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<InlineEdit
			value={value}
			onSubmit={handleSubmit}
			textClassName="text-sm"
			inputClassName="text-sm"
			multiline={multiline}
			autoSize={true}
			placeholder={`Add ${field}...`}
		/>
	)
}

function StatusSelectField({ taskId, value }: { taskId: string; value: TaskStatus }) {
	const fetcher = useFetcher()

	const handleStatusChange = (_taskId: string, newStatus: TaskStatus) => {
		if (newStatus === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "status")
		formData.append("value", newStatus)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<StatusDropdown
			currentStatus={value}
			taskId={taskId}
			onStatusChange={handleStatusChange}
			size="default"
		/>
	)
}

function PrioritySelectField({ taskId, value }: { taskId: string; value: 1 | 2 | 3 }) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)

	const handleSelect = (newValue: number) => {
		if (newValue === value) {
			setOpen(false)
			return
		}

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "priority")
		formData.append("value", newValue.toString())

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<PriorityBars priority={value} size="default" />
					<span className="text-sm">{sharedPriorityConfig[value].label}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-48" align="start">
				<div className="space-y-2">
					<h4 className="font-semibold text-sm">Set Priority</h4>
					<div className="space-y-1">
						{[3, 2, 1].map((p) => (
							<Button
								key={p}
								variant={value === p ? "default" : "ghost"}
								size="sm"
								className="w-full justify-start"
								onClick={() => handleSelect(p)}
							>
								<PriorityBars priority={p} size="default" />
								<span className="ml-2">{sharedPriorityConfig[p as 1 | 2 | 3].label}</span>
							</Button>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

function ImpactSelect({ taskId, value }: { taskId: string; value: number | null }) {
	const fetcher = useFetcher()

	const handleChange = (newValue: string) => {
		const numValue = Number.parseInt(newValue, 10)
		if (numValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "impact")
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	const currentImpact = value ? impactConfig[value as 1 | 2 | 3] : null

	return (
		<Select value={value?.toString() || ""} onValueChange={handleChange}>
			<SelectTrigger className="w-full">
				{currentImpact ? (
					<span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${currentImpact.className}`}>
						{currentImpact.label}
					</span>
				) : (
					<span className="text-muted-foreground">Set impact...</span>
				)}
			</SelectTrigger>
			<SelectContent>
				{Object.entries(impactConfig).map(([val, config]) => (
					<SelectItem key={val} value={val}>
						<div className="flex flex-col">
							<span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${config.className}`}>
								{config.label}
							</span>
							<span className="mt-0.5 text-muted-foreground text-xs">{config.description}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function EffortSelect({ taskId, value }: { taskId: string; value: string | null }) {
	const fetcher = useFetcher()

	const handleChange = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "estimated_effort")
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<Select value={value || ""} onValueChange={handleChange}>
			<SelectTrigger className="w-40">
				<SelectValue placeholder="Set effort..." />
			</SelectTrigger>
			<SelectContent>
				{Object.entries(effortConfig).map(([val, config]) => (
					<SelectItem key={val} value={val}>
						<div className="flex flex-col">
							<span className="font-medium">{config.label}</span>
							<span className="text-muted-foreground text-xs">{config.description}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function TagManager({ taskId, tags }: { taskId: string; tags: string[] }) {
	const fetcher = useFetcher()
	const [newTag, setNewTag] = useState("")

	const handleAddTag = (e: React.FormEvent) => {
		e.preventDefault()
		const trimmedTag = newTag.trim()
		if (!trimmedTag || tags.includes(trimmedTag)) {
			setNewTag("")
			return
		}

		const updatedTags = [...tags, trimmedTag]
		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "tags")
		formData.append("value", updatedTags.join(","))

		fetcher.submit(formData, { method: "POST" })
		setNewTag("")
	}

	const handleRemoveTag = (tagToRemove: string) => {
		const updatedTags = tags.filter((t) => t !== tagToRemove)
		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "tags")
		formData.append("value", updatedTags.join(","))

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<div className="space-y-2">
			{tags.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag: string) => (
						<Badge key={tag} variant="secondary" className="group max-w-full gap-1 pr-1 text-xs">
							<span className="truncate">{tag}</span>
							<button
								onClick={() => handleRemoveTag(tag)}
								className="ml-0.5 flex-shrink-0 rounded-full p-0.5 opacity-50 hover:bg-destructive/20 hover:text-destructive hover:opacity-100"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<form onSubmit={handleAddTag} className="flex gap-1">
				<Input
					value={newTag}
					onChange={(e) => setNewTag(e.target.value)}
					placeholder="Add tag..."
					className="h-8 text-sm"
				/>
				<Button type="submit" variant="outline" size="sm" className="h-8 px-2" disabled={!newTag.trim()}>
					<Plus className="h-4 w-4" />
				</Button>
			</form>
		</div>
	)
}

function DueDatePicker({ taskId, value }: { taskId: string; value: string | null }) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)

	const handleSelect = (date: Date | undefined) => {
		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "due_date")
		formData.append("value", date ? date.toISOString().split("T")[0] : "")

		fetcher.submit(formData, { method: "POST" })
		if (date) setOpen(false)
	}

	const handleClear = () => {
		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "due_date")
		formData.append("value", "")

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
	}

	const formatDate = (dateString: string | null) => {
		if (!dateString) return null
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	const selectedDate = value ? new Date(value) : undefined

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
					<CalendarIcon className="mr-2 h-4 w-4" />
					{value ? formatDate(value) : <span className="text-muted-foreground">Set due date...</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="z-[100] w-auto p-0" align="end" side="left" sideOffset={8}>
				<Calendar mode="single" selected={selectedDate} onSelect={handleSelect} initialFocus />
				{value && (
					<div className="border-t p-2">
						<Button variant="ghost" size="sm" onClick={handleClear} className="w-full">
							<X className="mr-2 h-4 w-4" />
							Clear date
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}

function AssigneeSelector({
	taskId,
	currentAssignees,
	teamMembers,
	projectPeople,
}: {
	taskId: string
	currentAssignees: Assignee[]
	teamMembers: TeamMember[]
	projectPeople: ProjectPerson[]
}) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")

	// Filter people based on search
	const filteredPeople = useMemo(() => {
		if (!search.trim()) return projectPeople
		const lower = search.toLowerCase()
		return projectPeople.filter(
			(p) =>
				p.name?.toLowerCase().includes(lower) ||
				p.title?.toLowerCase().includes(lower) ||
				p.email?.toLowerCase().includes(lower)
		)
	}, [projectPeople, search])

	const filteredTeamMembers = useMemo(() => {
		if (!search.trim()) return teamMembers
		const lower = search.toLowerCase()
		return teamMembers.filter((m) => m.name?.toLowerCase().includes(lower) || m.email?.toLowerCase().includes(lower))
	}, [teamMembers, search])

	// Show search if combined count > 5
	const showSearch = projectPeople.length + teamMembers.length > 5

	const handleAddPerson = (person: ProjectPerson) => {
		// Check if already assigned
		if (currentAssignees.some((a) => a.type === "person" && a.person_id === person.id)) {
			return
		}

		const newAssignees: Assignee[] = [
			...currentAssignees,
			{
				type: "person",
				person_id: person.id,
				name: person.name || "Unknown",
				avatar_url: person.avatar_url || undefined,
			},
		]

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "assigned_to")
		formData.append("value", JSON.stringify(newAssignees))

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
		setSearch("")
	}

	const handleAddTeamMember = (member: TeamMember) => {
		// Check if already assigned
		if (currentAssignees.some((a) => a.type === "human" && a.user_id === member.user_id)) {
			return
		}

		const newAssignees: Assignee[] = [
			...currentAssignees,
			{
				type: "human",
				user_id: member.user_id,
				name: member.name,
				avatar_url: member.avatar_url || undefined,
			},
		]

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "assigned_to")
		formData.append("value", JSON.stringify(newAssignees))

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
		setSearch("")
	}

	const handleAddAgent = (agentType: AgentType) => {
		// Check if already assigned
		if (currentAssignees.some((a) => a.type === "agent" && a.agent_type === agentType)) {
			return
		}

		const newAssignees: Assignee[] = [
			...currentAssignees,
			{
				type: "agent",
				agent_type: agentType,
			},
		]

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "assigned_to")
		formData.append("value", JSON.stringify(newAssignees))

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
		setSearch("")
	}

	const handleRemove = (index: number) => {
		const newAssignees = currentAssignees.filter((_, i) => i !== index)

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", "assigned_to")
		formData.append("value", JSON.stringify(newAssignees))

		fetcher.submit(formData, { method: "POST" })
	}

	const getAssigneeName = (assignee: Assignee) => {
		if (assignee.type === "agent") {
			return assignee.agent_type
		}
		return assignee.name || "Unknown"
	}

	return (
		<div className="space-y-2">
			{/* Current assignees */}
			{currentAssignees.length > 0 && (
				<div className="space-y-2">
					{currentAssignees.map((assignee, idx) => (
						<div key={idx} className="group flex items-center justify-between gap-2 text-sm">
							<div className="flex items-center gap-2">
								{assignee.type === "agent" ? (
									<>
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
											<Bot className="h-3 w-3 text-purple-600" />
										</div>
										<span className="capitalize">{assignee.agent_type}</span>
									</>
								) : (
									<>
										{assignee.avatar_url ? (
											<img src={assignee.avatar_url} alt={getAssigneeName(assignee)} className="h-6 w-6 rounded-full" />
										) : (
											<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">
												{getAssigneeName(assignee)?.[0]?.toUpperCase() || "?"}
											</div>
										)}
										<span>{getAssigneeName(assignee)}</span>
									</>
								)}
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
								onClick={() => handleRemove(idx)}
							>
								<X className="h-3 w-3" />
							</Button>
						</div>
					))}
				</div>
			)}

			{/* Add assignee button */}
			<Popover
				open={open}
				onOpenChange={(isOpen) => {
					setOpen(isOpen)
					if (!isOpen) setSearch("")
				}}
			>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="w-full justify-start">
						<Plus className="mr-2 h-4 w-4" />
						Add assignee
					</Button>
				</PopoverTrigger>
				<PopoverContent className="z-[100] w-72 p-2" align="start" side="left" sideOffset={8}>
					<div className="space-y-2">
						{/* Search input */}
						{showSearch && (
							<div className="relative">
								<Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search people..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="h-8 pl-8"
									autoFocus
								/>
							</div>
						)}

						<div className="max-h-64 space-y-2 overflow-y-auto">
							{/* Project People section */}
							{filteredPeople.length > 0 && (
								<div>
									<div className="px-2 py-1 font-medium text-muted-foreground text-xs">Project People</div>
									{filteredPeople.map((person) => {
										const isAssigned = currentAssignees.some((a) => a.type === "person" && a.person_id === person.id)
										return (
											<button
												key={person.id}
												onClick={() => handleAddPerson(person)}
												disabled={isAssigned}
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
											>
												{person.avatar_url ? (
													<img src={person.avatar_url} alt={person.name || ""} className="h-5 w-5 rounded-full" />
												) : (
													<div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
														{person.name?.[0]?.toUpperCase() || "?"}
													</div>
												)}
												<div className="min-w-0 flex-1 text-left">
													<div className="truncate">{person.name || "Unknown"}</div>
													{person.title && <div className="truncate text-muted-foreground text-xs">{person.title}</div>}
												</div>
												{isAssigned && <Check className="h-4 w-4 flex-shrink-0 text-green-600" />}
											</button>
										)
									})}
								</div>
							)}

							{/* Team Members section */}
							{filteredTeamMembers.length > 0 && (
								<div>
									<div className="px-2 py-1 font-medium text-muted-foreground text-xs">Team Members</div>
									{filteredTeamMembers.map((member) => {
										const isAssigned = currentAssignees.some((a) => a.type === "human" && a.user_id === member.user_id)
										return (
											<button
												key={member.user_id}
												onClick={() => handleAddTeamMember(member)}
												disabled={isAssigned}
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
											>
												{member.avatar_url ? (
													<img src={member.avatar_url} alt={member.name} className="h-5 w-5 rounded-full" />
												) : (
													<div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
														{member.name?.[0]?.toUpperCase() || "?"}
													</div>
												)}
												<span className="flex-1 truncate text-left">{member.name}</span>
												{isAssigned && <Check className="h-4 w-4 flex-shrink-0 text-green-600" />}
											</button>
										)
									})}
								</div>
							)}

							{/* AI agents section - only show when no search or search matches */}
							{(!search.trim() || "ai agent research code".includes(search.toLowerCase())) && (
								<div>
									<div className="px-2 py-1 font-medium text-muted-foreground text-xs">AI Agents</div>
									{agentTypes.map((agentType) => {
										const isAssigned = currentAssignees.some((a) => a.type === "agent" && a.agent_type === agentType)
										// Filter agents by search
										if (search.trim() && !agentType.toLowerCase().includes(search.toLowerCase())) {
											return null
										}
										return (
											<button
												key={agentType}
												onClick={() => handleAddAgent(agentType)}
												disabled={isAssigned}
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
											>
												<div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
													<Bot className="h-3 w-3 text-purple-600" />
												</div>
												<span className="flex-1 text-left capitalize">{agentType}</span>
												{isAssigned && <Check className="h-4 w-4 flex-shrink-0 text-green-600" />}
											</button>
										)
									})}
								</div>
							)}

							{/* Empty state */}
							{search.trim() && filteredPeople.length === 0 && filteredTeamMembers.length === 0 && (
								<div className="px-2 py-4 text-center text-muted-foreground text-sm">
									No people found matching "{search}"
								</div>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}

function ActivityTimeline({ activity }: { activity: TaskActivity[] }) {
	const [expanded, setExpanded] = useState(false)
	const COLLAPSED_COUNT = 3

	if (activity.length === 0) {
		return <div className="py-4 text-center text-muted-foreground text-sm">No activity yet</div>
	}

	const formatActivityDescription = (item: TaskActivity) => {
		switch (item.activity_type) {
			case "created":
				return "Created this task"
			case "status_change":
				return `Changed status from ${item.old_value} to ${item.new_value}`
			case "field_update":
				return `Updated ${item.field_name}`
			case "assignment":
				return "Updated assignees"
			case "comment":
				return item.content || "Added a comment"
			case "voice_update":
				return item.content || "Voice update"
			default:
				return item.content || "Made changes"
		}
	}

	const displayedActivity = expanded ? activity : activity.slice(0, COLLAPSED_COUNT)
	const hasMore = activity.length > COLLAPSED_COUNT

	return (
		<div className="space-y-3">
			{displayedActivity.map((item) => (
				<div key={item.id} className="flex gap-3 text-sm">
					<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground/40" />
					<div className="min-w-0 flex-1">
						<p className="text-foreground">{formatActivityDescription(item)}</p>
						<p className="text-muted-foreground text-xs">
							{new Date(item.created_at).toLocaleString()}
							{item.source !== "web" && ` via ${item.source}`}
						</p>
					</div>
				</div>
			))}
			{hasMore && (
				<Button
					variant="ghost"
					size="sm"
					className="h-auto w-full py-1 text-muted-foreground text-xs hover:text-foreground"
					onClick={() => setExpanded(!expanded)}
				>
					{expanded ? "Show less" : `Show ${activity.length - COLLAPSED_COUNT} more...`}
				</Button>
			)}
		</div>
	)
}

// Entity type icon mapping
const entityTypeIcons: Record<TaskLinkEntityType, React.ComponentType<{ className?: string }>> = {
	evidence: Quote,
	person: User,
	organization: Building2,
	opportunity: Sparkles,
	interview: Mic,
	insight: Lightbulb,
	persona: Users,
}

const entityTypeLabels: Record<TaskLinkEntityType, string> = {
	evidence: "Evidence",
	person: "Person",
	organization: "Organization",
	opportunity: "Opportunity",
	interview: "Interview",
	insight: "Insight",
	persona: "Persona",
}

function TaskLinksCard({ taskLinks, projectPath }: { taskLinks: EnrichedTaskLink[]; projectPath: string }) {
	const fetcher = useFetcher()
	const routes = useProjectRoutes(projectPath)

	const handleRemoveLink = (linkId: string) => {
		const formData = new FormData()
		formData.append("_action", "remove-link")
		formData.append("linkId", linkId)
		fetcher.submit(formData, { method: "POST" })
	}

	const getEntityRoute = (link: EnrichedTaskLink): string | null => {
		switch (link.entity_type) {
			case "evidence":
				return routes.evidence.detail(link.entity_id)
			case "person":
				return routes.people.detail(link.entity_id)
			case "interview":
				return routes.interviews.detail(link.entity_id)
			case "insight":
				return routes.insights.detail(link.entity_id)
			default:
				return null
		}
	}

	// Group links by entity type
	const groupedLinks = useMemo(() => {
		const groups: Record<TaskLinkEntityType, EnrichedTaskLink[]> = {
			evidence: [],
			person: [],
			organization: [],
			opportunity: [],
			interview: [],
			insight: [],
			persona: [],
		}
		for (const link of taskLinks) {
			groups[link.entity_type].push(link)
		}
		return groups
	}, [taskLinks])

	const nonEmptyGroups = Object.entries(groupedLinks).filter(([_, links]) => links.length > 0)

	if (taskLinks.length === 0) {
		return <div className="py-4 text-center text-muted-foreground text-sm">No linked entities</div>
	}

	return (
		<div className="space-y-4">
			{nonEmptyGroups.map(([type, links]) => {
				const entityType = type as TaskLinkEntityType
				const Icon = entityTypeIcons[entityType]
				return (
					<div key={type}>
						<div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
							<Icon className="h-3 w-3" />
							{entityTypeLabels[entityType]} ({links.length})
						</div>
						<div className="space-y-2">
							{links.map((link) => {
								const route = getEntityRoute(link)
								return (
									<div
										key={link.id}
										className="group flex items-start gap-2 rounded-md bg-muted/50 p-2 text-sm hover:bg-muted"
									>
										<div className="min-w-0 flex-1">
											{route ? (
												<Link to={route} className="line-clamp-1 flex items-center gap-1 font-medium hover:underline">
													{link.entity_name}
													<ExternalLink className="h-3 w-3 opacity-50" />
												</Link>
											) : (
												<span className="line-clamp-1 font-medium">{link.entity_name}</span>
											)}
											{link.entity_preview && (
												<p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">{link.entity_preview}</p>
											)}
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
											onClick={() => handleRemoveLink(link.id)}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
								)
							})}
						</div>
					</div>
				)
			})}
		</div>
	)
}

function EntityLinkAdder({
	linkableEntities,
	existingLinkIds,
}: {
	linkableEntities: LinkableEntity[]
	existingLinkIds: Set<string>
}) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const [selectedType, setSelectedType] = useState<TaskLinkEntityType | "all">("all")

	// Filter entities based on search and type
	const filteredEntities = useMemo(() => {
		let filtered = linkableEntities.filter((entity) => !existingLinkIds.has(entity.id))

		if (selectedType !== "all") {
			filtered = filtered.filter((entity) => entity.type === selectedType)
		}

		if (search.trim()) {
			const lower = search.toLowerCase()
			filtered = filtered.filter(
				(entity) => entity.name.toLowerCase().includes(lower) || entity.preview?.toLowerCase().includes(lower)
			)
		}

		return filtered.slice(0, 20) // Limit to 20 results
	}, [linkableEntities, existingLinkIds, selectedType, search])

	const handleAddLink = (entity: LinkableEntity) => {
		const formData = new FormData()
		formData.append("_action", "add-link")
		formData.append("entityType", entity.type)
		formData.append("entityId", entity.id)
		formData.append("linkType", "supports")

		fetcher.submit(formData, { method: "POST" })
		setOpen(false)
		setSearch("")
	}

	const entityTypes: Array<{ value: TaskLinkEntityType | "all"; label: string }> = [
		{ value: "all", label: "All" },
		{ value: "evidence", label: "Evidence" },
		{ value: "interview", label: "Interviews" },
		{ value: "insight", label: "Insights" },
		{ value: "opportunity", label: "Opportunities" },
		{ value: "person", label: "People" },
	]

	return (
		<Popover
			open={open}
			onOpenChange={(isOpen) => {
				setOpen(isOpen)
				if (!isOpen) {
					setSearch("")
					setSelectedType("all")
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" className="w-full justify-start">
					<Plus className="mr-2 h-4 w-4" />
					Link entity
				</Button>
			</PopoverTrigger>
			<PopoverContent className="z-[100] w-80 p-2" align="start" side="left" sideOffset={8}>
				<div className="space-y-3">
					{/* Search input */}
					<div className="relative">
						<Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search entities..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="h-8 pl-8"
							autoFocus
						/>
					</div>

					{/* Type filter */}
					<div className="flex flex-wrap gap-1">
						{entityTypes.map((type) => (
							<Badge
								key={type.value}
								variant={selectedType === type.value ? "default" : "outline"}
								className="cursor-pointer text-xs"
								onClick={() => setSelectedType(type.value)}
							>
								{type.label}
							</Badge>
						))}
					</div>

					{/* Results */}
					<div className="max-h-64 space-y-1 overflow-y-auto">
						{filteredEntities.length === 0 ? (
							<div className="px-2 py-4 text-center text-muted-foreground text-sm">
								{search.trim() ? `No results for "${search}"` : "No entities to link"}
							</div>
						) : (
							filteredEntities.map((entity) => {
								const Icon = entityTypeIcons[entity.type]
								return (
									<button
										key={`${entity.type}-${entity.id}`}
										onClick={() => handleAddLink(entity)}
										className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
									>
										<Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
										<div className="min-w-0 flex-1">
											<div className="line-clamp-1 font-medium">{entity.name}</div>
											{entity.preview && (
												<div className="line-clamp-1 text-muted-foreground text-xs">{entity.preview}</div>
											)}
										</div>
										<Badge variant="secondary" className="flex-shrink-0 text-xs">
											{entityTypeLabels[entity.type]}
										</Badge>
									</button>
								)
							})
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

// ============================================================================
// Main Component
// ============================================================================

export default function TaskDetailPage() {
	const { task, activity, projectPath, teamMembers, projectPeople, taskLinks, linkableEntities } =
		useLoaderData<typeof loader>()

	// Build a set of already linked entity IDs
	const existingLinkIds = useMemo(() => new Set(taskLinks.map((link) => link.entity_id)), [taskLinks])
	const routes = useProjectRoutes(projectPath)

	const formatDate = (dateString: string | null) => {
		if (!dateString) return null
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	return (
		<div className="container mx-auto max-w-5xl px-4 py-6">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={routes.priorities()}
					className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Tasks
				</Link>

				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0 flex-1">
						<EditableField taskId={task.id} field="title" value={task.title} />
						<div className="mt-3 flex items-center gap-3">
							<StatusSelectField taskId={task.id} value={task.status} />
							<PrioritySelectField taskId={task.id} value={task.priority} />
							{task.cluster && (
								<Badge variant="outline" className="text-xs">
									{task.cluster}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Main Content */}
				<div className="min-w-0 space-y-6 lg:col-span-2">
					{/* Description */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Description</CardTitle>
						</CardHeader>
						<CardContent>
							<EditableField taskId={task.id} field="description" value={task.description || ""} multiline />
						</CardContent>
					</Card>

					{/* Context Fields */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Context</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<label className="mb-1 flex items-center gap-1 font-medium text-muted-foreground text-xs">
									<Target className="h-3 w-3" /> Benefit
								</label>
								<EditableField taskId={task.id} field="benefit" value={task.benefit || ""} multiline />
							</div>
							<div>
								<label className="mb-1 flex items-center gap-1 font-medium text-muted-foreground text-xs">
									<Users className="h-3 w-3" /> Segments
								</label>
								<EditableField taskId={task.id} field="segments" value={task.segments || ""} />
							</div>
							<div>
								<label className="mb-1 flex items-center gap-1 font-medium text-muted-foreground text-xs">
									<Flag className="h-3 w-3" /> Stage
								</label>
								<EditableField taskId={task.id} field="stage" value={task.stage || ""} />
							</div>
							<div>
								<label className="mb-1 block font-medium text-muted-foreground text-xs">Reason / Rationale</label>
								<EditableField taskId={task.id} field="reason" value={task.reason || ""} multiline />
							</div>
						</CardContent>
					</Card>

					{/* Commentary / Annotations */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<MessageCircle className="h-4 w-4" />
								Comments & Notes
							</CardTitle>
						</CardHeader>
						<CardContent>
							<EntityInteractionPanel entityType="task" entityId={task.id} className="border-0 p-0 shadow-none" />
						</CardContent>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="relative z-10 min-w-0 space-y-6">
					{/* Planning */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Planning</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<label className="mb-2 flex items-center gap-1 font-medium text-muted-foreground text-xs">
									{/* <Calendar className="h-3 w-3" /> Due Date */}
								</label>
								<DueDatePicker taskId={task.id} value={task.due_date} />
							</div>

							<div>
								<label className="mb-2 flex items-center gap-1 font-medium text-muted-foreground text-xs">
									<Clock className="h-3 w-3" /> Estimated Effort
								</label>
								<EffortSelect taskId={task.id} value={task.estimated_effort} />
							</div>

							{task.actual_hours && (
								<div>
									<label className="mb-1 block font-medium text-muted-foreground text-xs">Actual Hours</label>
									<div className="text-sm">{task.actual_hours}h</div>
								</div>
							)}

							<div>
								<label className="mb-2 block font-medium text-muted-foreground text-xs">Impact</label>
								<ImpactSelect taskId={task.id} value={task.impact} />
							</div>
						</CardContent>
					</Card>

					{/* Assignees */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<User className="h-4 w-4" />
								Assignees
							</CardTitle>
						</CardHeader>
						<CardContent>
							<AssigneeSelector
								taskId={task.id}
								currentAssignees={task.assigned_to || []}
								teamMembers={teamMembers}
								projectPeople={projectPeople}
							/>
						</CardContent>
					</Card>

					{/* Tags */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Tag className="h-4 w-4" />
								Tags
							</CardTitle>
						</CardHeader>
						<CardContent>
							<TagManager taskId={task.id} tags={task.tags || []} />
						</CardContent>
					</Card>

					{/* Linked Entities */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Link2 className="h-4 w-4" />
								Linked Entities
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<TaskLinksCard taskLinks={taskLinks} projectPath={projectPath} />
							<EntityLinkAdder linkableEntities={linkableEntities} existingLinkIds={existingLinkIds} />
						</CardContent>
					</Card>

					{/* Dependencies */}
					{((task.depends_on_task_ids && task.depends_on_task_ids.length > 0) ||
						(task.blocks_task_ids && task.blocks_task_ids.length > 0)) && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Link2 className="h-4 w-4" />
										Dependencies
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{task.depends_on_task_ids && task.depends_on_task_ids.length > 0 && (
										<div>
											<div className="mb-1 font-medium text-muted-foreground text-xs">Depends on</div>
											<div className="text-muted-foreground text-sm">{task.depends_on_task_ids.length} task(s)</div>
										</div>
									)}
									{task.blocks_task_ids && task.blocks_task_ids.length > 0 && (
										<div>
											<div className="mb-1 font-medium text-muted-foreground text-xs">Blocks</div>
											<div className="text-muted-foreground text-sm">{task.blocks_task_ids.length} task(s)</div>
										</div>
									)}
								</CardContent>
							</Card>
						)}

					{/* Activity */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Activity</CardTitle>
						</CardHeader>
						<CardContent>
							<ActivityTimeline activity={activity} />
						</CardContent>
					</Card>

					{/* Metadata */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base text-muted-foreground">Metadata</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1 text-muted-foreground text-xs">
							<div>Created: {formatDate(task.created_at)}</div>
							<div>Updated: {formatDate(task.updated_at)}</div>
							{task.completed_at && <div>Completed: {formatDate(task.completed_at)}</div>}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
