import consola from "consola"
import { formatDistance } from "date-fns"
import { Calendar, Loader2, Search, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useFetcher, useNavigate, useRevalidator } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { AddLink } from "~/components/links/AddLink"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { BackButton } from "~/components/ui/back-button"
import { Button } from "~/components/ui/button"
import InlineEdit from "~/components/ui/inline-edit"
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { createClient } from "~/lib/supabase/client"
import type { Database } from "~/types"

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]

interface NoteViewerProps {
	interview: InterviewRow
	projectId: string
	className?: string
}

interface LinkedItem {
	id: string
	linkId: string
	label: string
}

interface AvailableItem {
	id: string
	label: string
}

export function NoteViewer({ interview, projectId, className }: NoteViewerProps) {
	const fetcher = useFetcher<{ success?: boolean; redirectTo?: string; error?: string }>()
	const linkFetcher = useFetcher()
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const supabase = createClient()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isIndexing, setIsIndexing] = useState(false)

	// Link state (people, organizations, opportunities)
	const [linked_people, set_linked_people] = useState<LinkedItem[]>([])
	const [available_people, set_available_people] = useState<AvailableItem[]>([])
	const [linked_organizations, set_linked_organizations] = useState<LinkedItem[]>([])
	const [available_organizations, set_available_organizations] = useState<AvailableItem[]>([])
	const [linked_opportunities, set_linked_opportunities] = useState<LinkedItem[]>([])
	const [available_opportunities, set_available_opportunities] = useState<AvailableItem[]>([])
	const [is_loading_links, set_is_loading_links] = useState(true)

	const fetch_links = useCallback(async () => {
		set_is_loading_links(true)
		try {
			const [{ data: linkedPeopleData, error: linkedPeopleError }, { data: peopleData, error: peopleError }] =
				await Promise.all([
					supabase.from("interview_people").select("id, people(id, name)").eq("interview_id", interview.id),
					supabase.from("people").select("id, name").eq("project_id", projectId).order("name", { ascending: true }),
				])

			if (linkedPeopleError) {
				consola.warn("Failed to fetch linked people:", linkedPeopleError)
			} else {
				set_linked_people(
					(linkedPeopleData || [])
						.map((row) => {
							const person = row.people as { id: string; name: string | null } | null
							if (!person?.id) return null
							return {
								id: person.id,
								linkId: String(row.id),
								label: person.name || "Unnamed",
							} satisfies LinkedItem
						})
						.filter(Boolean) as LinkedItem[]
				)
			}

			if (peopleError) {
				consola.warn("Failed to fetch available people:", peopleError)
			} else {
				set_available_people((peopleData || []).map((p) => ({ id: p.id, label: p.name || "Unnamed" })))
			}

			const [
				{ data: linkedOrganizationsData, error: linkedOrganizationsError },
				{ data: organizationsData, error: organizationsError },
			] = await Promise.all([
				supabase.from("interview_organizations").select("id, organizations(id, name)").eq("interview_id", interview.id),
				supabase
					.from("organizations")
					.select("id, name")
					.eq("project_id", projectId)
					.order("name", { ascending: true }),
			])

			if (linkedOrganizationsError) {
				consola.warn("Failed to fetch linked organizations:", linkedOrganizationsError)
			} else {
				set_linked_organizations(
					(linkedOrganizationsData || [])
						.map((row) => {
							const org = row.organizations as { id: string; name: string } | null
							if (!org?.id) return null
							return {
								id: org.id,
								linkId: String(row.id),
								label: org.name,
							} satisfies LinkedItem
						})
						.filter(Boolean) as LinkedItem[]
				)
			}

			if (organizationsError) {
				consola.warn("Failed to fetch available organizations:", organizationsError)
			} else {
				set_available_organizations((organizationsData || []).map((o) => ({ id: o.id, label: o.name })))
			}

			const [
				{ data: linkedOpportunitiesData, error: linkedOpportunitiesError },
				{ data: opportunitiesData, error: opportunitiesError },
			] = await Promise.all([
				supabase
					.from("interview_opportunities")
					.select("id, opportunities(id, title)")
					.eq("interview_id", interview.id),
				supabase
					.from("opportunities")
					.select("id, title")
					.eq("project_id", projectId)
					.order("updated_at", { ascending: false }),
			])

			if (linkedOpportunitiesError) {
				consola.warn("Failed to fetch linked opportunities:", linkedOpportunitiesError)
			} else {
				set_linked_opportunities(
					(linkedOpportunitiesData || [])
						.map((row) => {
							const opp = row.opportunities as { id: string; title: string } | null
							if (!opp?.id) return null
							return {
								id: opp.id,
								linkId: String(row.id),
								label: opp.title,
							} satisfies LinkedItem
						})
						.filter(Boolean) as LinkedItem[]
				)
			}

			if (opportunitiesError) {
				consola.warn("Failed to fetch available opportunities:", opportunitiesError)
			} else {
				set_available_opportunities((opportunitiesData || []).map((o) => ({ id: o.id, label: o.title })))
			}
		} finally {
			set_is_loading_links(false)
		}
	}, [interview.id, projectId, supabase])

	useEffect(() => {
		fetch_links()
	}, [fetch_links])

	// Refresh people when link fetcher completes
	useEffect(() => {
		if (linkFetcher.state === "idle" && linkFetcher.data) {
			fetch_links()
		}
	}, [linkFetcher.state, linkFetcher.data, fetch_links])

	const handleLinkPerson = (personId: string) => {
		linkFetcher.submit(
			{
				intent: "add-participant",
				personId,
			},
			{ method: "post" }
		)
	}

	const handleUnlinkPerson = (interviewPersonId: string) => {
		linkFetcher.submit(
			{
				intent: "remove-participant",
				interviewPersonId,
			},
			{ method: "post" }
		)
	}

	const handleCreateAndLinkPerson = (name: string) => {
		if (!name.trim()) return
		linkFetcher.submit(
			{
				intent: "add-participant",
				create_person: "true",
				person_name: name.trim(),
			},
			{ method: "post" }
		)
	}

	const handleLinkOrganization = (organizationId: string) => {
		linkFetcher.submit(
			{
				intent: "link-organization",
				organizationId,
			},
			{ method: "post" }
		)
	}

	type UnlinkOrganizationPayload = { interviewOrganizationId: string }
	const handleUnlinkOrganization = (payload: UnlinkOrganizationPayload) => {
		linkFetcher.submit(
			{
				intent: "unlink-organization",
				interviewOrganizationId: payload.interviewOrganizationId,
			},
			{ method: "post" }
		)
	}

	const handleCreateAndLinkOrganization = (name: string) => {
		if (!name.trim()) return
		linkFetcher.submit(
			{
				intent: "create-and-link-organization",
				organization_name: name.trim(),
			},
			{ method: "post" }
		)
	}

	const handleLinkOpportunity = (opportunityId: string) => {
		linkFetcher.submit(
			{
				intent: "link-opportunity",
				opportunityId,
			},
			{ method: "post" }
		)
	}

	type UnlinkOpportunityPayload = { interviewOpportunityId: string }
	const handleUnlinkOpportunity = (payload: UnlinkOpportunityPayload) => {
		linkFetcher.submit(
			{
				intent: "unlink-opportunity",
				interviewOpportunityId: payload.interviewOpportunityId,
			},
			{ method: "post" }
		)
	}

	const handleCreateAndLinkOpportunity = (title: string) => {
		if (!title.trim()) return
		linkFetcher.submit(
			{
				intent: "create-and-link-opportunity",
				opportunity_title: title.trim(),
			},
			{ method: "post" }
		)
	}

	// Handle delete response - navigate after successful delete
	useEffect(() => {
		if (fetcher.data?.success && fetcher.data?.redirectTo) {
			navigate(fetcher.data.redirectTo)
		} else if (fetcher.data?.error) {
			consola.error("Delete failed:", fetcher.data.error)
		}
	}, [fetcher.data, navigate])

	// Check indexing status from conversation_analysis
	const conversationAnalysis = interview.conversation_analysis as {
		indexed_at?: string
		evidence_count?: number
	} | null
	const isIndexed = !!conversationAnalysis?.indexed_at
	const evidenceCount = conversationAnalysis?.evidence_count ?? 0

	const handleIndexNote = async () => {
		setIsIndexing(true)
		try {
			const response = await fetch("/api/index-note", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ interviewId: interview.id }),
			})
			const result = await response.json()
			if (result.success) {
				consola.success("Note indexing started", result.runId)
				// Revalidate after a short delay to give the task time to start
				setTimeout(() => revalidator.revalidate(), 2000)
			} else {
				consola.error("Failed to index note:", result.error)
			}
		} catch (e) {
			consola.error("Index note failed", e)
		} finally {
			setIsIndexing(false)
		}
	}

	const handleSaveContent = (value: string) => {
		fetcher.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId: interview.account_id,
				projectId: projectId,
				fieldName: "observations_and_notes",
				fieldValue: value,
			},
			{
				method: "POST",
				action: "/api/update-field",
			}
		)
	}

	const handleSaveTitle = (value: string) => {
		fetcher.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId: interview.account_id,
				projectId: projectId,
				fieldName: "title",
				fieldValue: value,
			},
			{
				method: "POST",
				action: "/api/update-field",
			}
		)
	}

	const handleDelete = () => {
		fetcher.submit(
			{
				interviewId: interview.id,
				projectId: projectId,
			},
			{
				method: "DELETE",
				action: "/api/interviews/delete",
			}
		)
	}

	return (
		<PageContainer size="md" className={className}>
			<BackButton />

			{/* Header */}
			<div className="mt-6 mb-6">
				<div className="mb-4 flex items-start justify-between">
					<div className="flex items-center gap-3">
						<MediaTypeIcon
							mediaType={interview.media_type}
							sourceType={interview.source_type}
							showLabel={true}
							iconClassName="h-5 w-5"
							labelClassName="text-base font-semibold"
						/>
						{isIndexed && (
							<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 text-xs">
								{evidenceCount} evidence indexed
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleIndexNote}
							disabled={isIndexing}
							title={isIndexed ? "Re-index this note for semantic search" : "Index this note for semantic search"}
						>
							{isIndexing ? (
								<>
									<Loader2 className="mr-1 h-4 w-4 animate-spin" />
									Indexing...
								</>
							) : (
								<>
									<Search className="mr-1 h-4 w-4" />
									{isIndexed ? "Re-index" : "Index Now"}
								</>
							)}
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				</div>

				<InlineEdit
					value={interview.title || ""}
					onSubmit={handleSaveTitle}
					placeholder="Untitled Note"
					submitOnBlur={true}
					textClassName="font-bold text-3xl text-slate-900 dark:text-white"
					inputClassName="font-bold text-3xl"
				/>

				{/* Metadata */}
				<div className="flex flex-wrap items-center gap-4 text-slate-600 text-sm dark:text-slate-400">
					{interview.created_at && (
						<div className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" />
							<span>{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}</span>
						</div>
					)}
				</div>

				{/* Linked Entities */}
				<div className="mt-4">
					<AddLink
						default_kind="person"
						disabled={linkFetcher.state !== "idle"}
						is_loading={is_loading_links}
						kinds={[
							{
								kind: "person",
								label_singular: "Person",
								label_plural: "People",
								linked_items: linked_people.map((p) => ({ id: p.id, label: p.label, link_id: p.linkId })),
								available_items: available_people,
								on_link: handleLinkPerson,
								on_unlink: (link_id) => handleUnlinkPerson(link_id),
								on_create_and_link: handleCreateAndLinkPerson,
							},
							{
								kind: "organization",
								label_singular: "Organization",
								label_plural: "Organizations",
								linked_items: linked_organizations.map((o) => ({ id: o.id, label: o.label, link_id: o.linkId })),
								available_items: available_organizations,
								on_link: handleLinkOrganization,
								on_unlink: (link_id) => handleUnlinkOrganization({ interviewOrganizationId: link_id }),
								on_create_and_link: handleCreateAndLinkOrganization,
							},
							{
								kind: "opportunity",
								label_singular: "Opportunity",
								label_plural: "Opportunities",
								linked_items: linked_opportunities.map((o) => ({ id: o.id, label: o.label, link_id: o.linkId })),
								available_items: available_opportunities,
								on_link: handleLinkOpportunity,
								on_unlink: (link_id) => handleUnlinkOpportunity({ interviewOpportunityId: link_id }),
								on_create_and_link: handleCreateAndLinkOpportunity,
							},
						]}
					/>
				</div>
			</div>

			{/* Audio Player */}
			{interview.media_url &&
				(interview.media_type === "voice_memo" ||
					interview.file_extension === "mp3" ||
					interview.file_extension === "wav" ||
					interview.file_extension === "m4a") && (
					<div className="mb-6">
						<audio controls className="w-full">
							<source src={interview.media_url} type={`audio/${interview.file_extension || "mp3"}`} />
							Your browser does not support the audio element.
						</audio>
					</div>
				)}

			{/* Note Content */}
			<div className="prose max-w-none text-foreground">
				<InlineEdit
					value={interview.observations_and_notes || ""}
					onSubmit={handleSaveContent}
					multiline={true}
					markdown={true}
					submitOnBlur={true}
					placeholder="Click to add note content..."
					textClassName="prose text-foreground"
					inputClassName="min-h-[500px] font-mono text-sm"
				/>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Note</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this note? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContainer>
	)
}
