import { formatDistanceToNow } from "date-fns"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { redirect, useFetcher, useLoaderData, useParams } from "react-router"
import { z } from "zod"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Tables } from "~/types"

const severityBadge: Record<string, { variant?: "default" | "secondary" | "destructive" | "outline"; color?: string }> =
	{
		info: { variant: "outline", color: "blue" },
		warning: { variant: "outline", color: "yellow" },
		critical: { variant: "destructive" },
	}

type LoaderFramework = {
	summaryId: string
	name: string
	computedAt: string
	interviewId: string | null
	attendeeNames: string[]
	attendeePersonKeys: string[]
	unlinkedAttendees: Array<{ displayName: string; role: string | null; personKey: string | null }>
	hygieneSummary: Array<{ code: string; severity: string; message?: string | null; slot?: string | null }>
	hygieneEvents: Array<{
		id: string
		code: string
		severity: string
		message?: string | null
		slotLabel?: string | null
	}>
	slots: Array<{
		id: string
		slot: string
		label: string | null
		summary: string | null
		textValue: string | null
		numericValue: number | null
		dateValue: string | null
		status: string | null
		confidence: number | null
		ownerName: string | null
		relatedNames: string[]
		evidenceCount: number
		evidenceRefs: Array<{
			evidenceId: string
			startMs: number | null
			endMs: number | null
			transcriptSnippet: string | null
		}>
	}>
	stakeholders: Array<{
		id: string
		displayName: string
		role: string | null
		influence: string | null
		labels: string[]
		confidence: number | null
		personName: string | null
		personKey: string | null
		email: string | null
		organizationName: string | null
		evidenceRefs: Array<{
			evidenceId: string
			startMs: number | null
			endMs: number | null
			transcriptSnippet: string | null
		}>
	}>
}

type LoaderData = {
	projectId: string
	frameworks: LoaderFramework[]
}

type SalesLensSlotRow = Tables<"sales_lens_slots"> & {
	evidence_refs: Array<{
		evidence_id: string
		start_ms: number | null
		end_ms: number | null
		transcript_snippet: string | null
	}> | null
	hygiene: Array<{
		code: string
		severity: string
		message?: string | null
		slot?: string | null
	}> | null
}

type SalesLensSummaryRow = Tables<"sales_lens_summaries"> & {
	sales_lens_slots: SalesLensSlotRow[] | null
	sales_lens_stakeholders: SalesLensStakeholderRow[] | null
}

type SalesLensHygieneEventRow = Tables<"sales_lens_hygiene_events">
type SalesLensStakeholderRow = Tables<"sales_lens_stakeholders">

const salesLensActionSchema = z
	.object({
		intent: z.enum(["refresh", "commit"]),
		interviewId: z.string().uuid().optional().nullable(),
		summaryId: z.string().uuid().optional().nullable(),
	})
	.superRefine((value, ctx) => {
		if (value.intent === "refresh" && !value.interviewId) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Missing interviewId", path: ["interviewId"] })
		}
		if (value.intent === "commit" && !value.summaryId) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Missing summaryId", path: ["summaryId"] })
		}
	})

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.claims) {
		return redirect("/login")
	}

	const projectId = params.projectId
	if (!projectId) {
		throw new Response("Project id missing", { status: 400 })
	}

	if (!ctx.supabase) {
		throw new Response("Supabase client missing", { status: 500 })
	}

	const { data: summaries, error } = await ctx.supabase
		.from("sales_lens_summaries")
		.select<SalesLensSummaryRow>(
			`id, framework, computed_at, attendee_person_ids, attendee_person_keys, attendee_unlinked, hygiene_summary, metadata,
                        sales_lens_slots (id, slot, label, description, text_value, numeric_value, date_value, status, confidence, owner_person_id, owner_person_key, related_person_ids, evidence_refs, hygiene, position),
                        sales_lens_stakeholders (id, display_name, role, influence, labels, confidence, person_id, person_key, candidate_person_key, email, evidence_refs)`
		)
		.eq("project_id", projectId)
		.order("computed_at", { ascending: false })

	if (error) {
		throw new Response(`Failed to load sales lenses: ${error.message}`, { status: 500 })
	}

	const summariesList = summaries ?? []
	const latestByFramework = new Map<string, SalesLensSummaryRow>()
	const summaryIds: string[] = []
	for (const summary of summariesList) {
		if (!latestByFramework.has(summary.framework)) {
			latestByFramework.set(summary.framework, summary)
			summaryIds.push(summary.id)
		}
	}

	const { data: hygieneEventsData } = summaryIds.length
		? await ctx.supabase
				.from("sales_lens_hygiene_events")
				.select<Pick<SalesLensHygieneEventRow, "id" | "summary_id" | "slot_id" | "code" | "severity" | "message">>(
					"id, summary_id, slot_id, code, severity, message"
				)
				.in("summary_id", summaryIds)
		: {
				data: [] as Array<
					Pick<SalesLensHygieneEventRow, "id" | "summary_id" | "slot_id" | "code" | "severity" | "message">
				>,
			}

	const peopleIds = new Set<string>()
	const organizationIds = new Set<string>()
	for (const summary of latestByFramework.values()) {
		for (const personId of summary.attendee_person_ids ?? []) {
			if (personId) peopleIds.add(personId)
		}
		for (const slot of summary.sales_lens_slots ?? []) {
			if (slot.owner_person_id) peopleIds.add(slot.owner_person_id)
			for (const related of slot.related_person_ids ?? []) {
				if (related) peopleIds.add(related)
			}
			for (const relatedOrg of slot.related_organization_ids ?? []) {
				if (relatedOrg) organizationIds.add(relatedOrg)
			}
		}
		for (const stakeholder of summary.sales_lens_stakeholders ?? []) {
			if (stakeholder.person_id) {
				peopleIds.add(stakeholder.person_id)
			}
			if (stakeholder.organization_id) {
				organizationIds.add(stakeholder.organization_id)
			}
		}
	}

	const { data: peopleRows } = peopleIds.size
		? await ctx.supabase
				.from("people")
				.select<Pick<Tables<"people">, "id" | "name" | "role" | "title">>("id, name, role, title")
				.in("id", Array.from(peopleIds))
		: { data: [] as Array<Pick<Tables<"people">, "id" | "name" | "role" | "title">> }

	const peopleById = new Map<string, { name: string | null; role: string | null; title: string | null }>()
	for (const person of peopleRows ?? []) {
		peopleById.set(person.id, {
			name: person.name ?? null,
			role: person.role ?? null,
			title: person.title ?? null,
		})
	}

	// Pull organization display names so stakeholder rows can surface company context.
	const { data: organizationRows } = organizationIds.size
		? await ctx.supabase
				.from("organizations")
				.select<Pick<Tables<"organizations">, "id" | "name">>("id, name")
				.in("id", Array.from(organizationIds))
		: { data: [] as Array<Pick<Tables<"organizations">, "id" | "name">> }

	const organizationsById = new Map<string, { name: string | null }>()
	for (const organization of organizationRows ?? []) {
		organizationsById.set(organization.id, { name: organization.name ?? null })
	}

	const hygieneEventsBySummary = new Map<
		string,
		Array<Pick<SalesLensHygieneEventRow, "id" | "summary_id" | "slot_id" | "code" | "severity" | "message">>
	>()
	for (const event of hygieneEventsData ?? []) {
		const list = hygieneEventsBySummary.get(event.summary_id) ?? []
		list.push(event)
		hygieneEventsBySummary.set(event.summary_id, list)
	}

	const frameworks: LoaderFramework[] = []
	for (const [name, summary] of latestByFramework.entries()) {
		const slots = Array.isArray(summary.sales_lens_slots) ? summary.sales_lens_slots : []
		const orderedSlots = [...slots].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

		const slotViews = orderedSlots.map((slot) => {
			const owner = slot.owner_person_id ? peopleById.get(slot.owner_person_id) : undefined
			const ownerName = owner?.name ?? (slot.owner_person_key ? `Unlinked (${slot.owner_person_key})` : null)
			const relatedNames = (slot.related_person_ids ?? [])
				.map((id) => peopleById.get(id)?.name ?? null)
				.filter((value): value is string => Boolean(value))

			const evidenceRefs = Array.isArray(slot.evidence_refs) ? slot.evidence_refs : []
			return {
				id: slot.id,
				slot: slot.slot,
				label: slot.label ?? null,
				summary: slot.description ?? null,
				textValue: slot.text_value ?? null,
				numericValue: typeof slot.numeric_value === "number" ? slot.numeric_value : null,
				dateValue: slot.date_value ?? null,
				status: slot.status ?? null,
				confidence: typeof slot.confidence === "number" ? slot.confidence : null,
				ownerName,
				relatedNames,
				evidenceCount: evidenceRefs.length,
				evidenceRefs: evidenceRefs.map((ref) => ({
					evidenceId: ref.evidence_id,
					startMs: ref.start_ms ?? null,
					endMs: ref.end_ms ?? null,
					transcriptSnippet: ref.transcript_snippet ?? null,
				})),
			}
		})

		const stakeholderRows = Array.isArray(summary.sales_lens_stakeholders) ? summary.sales_lens_stakeholders : []
		const stakeholderViews = stakeholderRows.map((stakeholder) => {
			const linkedPerson = stakeholder.person_id ? peopleById.get(stakeholder.person_id) : undefined
			const organization = stakeholder.organization_id ? organizationsById.get(stakeholder.organization_id) : undefined
			const stakeholderEvidenceRefs = Array.isArray(stakeholder.evidence_refs) ? stakeholder.evidence_refs : []
			return {
				id: stakeholder.id,
				displayName: stakeholder.display_name,
				role: stakeholder.role ?? null,
				influence: stakeholder.influence ?? null,
				labels: Array.isArray(stakeholder.labels) ? stakeholder.labels : [],
				confidence: typeof stakeholder.confidence === "number" ? stakeholder.confidence : null,
				personName: linkedPerson?.name ?? null,
				personKey: stakeholder.person_key ?? stakeholder.candidate_person_key ?? null,
				email: stakeholder.email ?? null,
				organizationName: organization?.name ?? null,
				evidenceRefs: stakeholderEvidenceRefs.map((ref) => ({
					evidenceId: ref.evidence_id,
					startMs: ref.start_ms ?? null,
					endMs: ref.end_ms ?? null,
					transcriptSnippet: ref.transcript_snippet ?? null,
				})),
			}
		})

		const attendeeNames = (summary.attendee_person_ids ?? [])
			.map((id) => peopleById.get(id)?.name ?? null)
			.filter((value): value is string => Boolean(value))

		const hygieneEvents = hygieneEventsBySummary.get(summary.id) ?? []
		const hygieneViews = hygieneEvents.map((event) => {
			const slot = orderedSlots.find((candidate) => candidate.id === event.slot_id)
			return {
				id: event.id,
				code: event.code,
				severity: event.severity,
				message: event.message ?? null,
				slotLabel: slot?.slot ?? null,
			}
		})

		const unlinkedAttendees = Array.isArray(summary.attendee_unlinked)
			? summary.attendee_unlinked
					.map((entry) =>
						entry && typeof entry === "object"
							? {
									displayName: "displayName" in entry ? String(entry.displayName) : "Unknown attendee",
									role: "role" in entry && entry.role ? String(entry.role) : null,
									personKey: "personKey" in entry && entry.personKey ? String(entry.personKey) : null,
								}
							: null
					)
					.filter((candidate): candidate is { displayName: string; role: string | null; personKey: string | null } =>
						Boolean(candidate)
					)
			: []

		frameworks.push({
			summaryId: summary.id,
			name,
			computedAt: summary.computed_at,
			interviewId: summary.interview_id ?? null,
			attendeeNames,
			attendeePersonKeys: summary.attendee_person_keys ?? [],
			unlinkedAttendees,
			hygieneSummary: Array.isArray(summary.hygiene_summary) ? summary.hygiene_summary : [],
			hygieneEvents: hygieneViews,
			slots: slotViews,
			stakeholders: stakeholderViews,
		})
	}

	const result: LoaderData = { projectId, frameworks }
	return result
}

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.claims) {
		return redirect("/login")
	}

	const projectId = params.projectId
	if (!projectId) {
		throw new Response("Project id missing", { status: 400 })
	}

	const formData = await request.formData()
	const payload = {
		intent: formData.get("intent"),
		interviewId: formData.get("interviewId"),
		summaryId: formData.get("summaryId"),
	}

	const parsed = salesLensActionSchema.safeParse(payload)
	if (!parsed.success) {
		return Response.json(
			{
				success: false as const,
				errors: parsed.error.flatten(),
			},
			{ status: 400 }
		)
	}

	if (parsed.data.intent === "refresh") {
		const { generateSalesLensTask } = await import("~/../src/trigger/sales/generateSalesLens")
		await generateSalesLensTask.trigger({
			interviewId: parsed.data.interviewId!,
			computedBy: ctx.claims.sub ?? null,
		})
		return Response.json({ success: true as const, intent: parsed.data.intent })
	}

	if (parsed.data.intent === "commit") {
		return Response.json({
			success: true as const,
			intent: parsed.data.intent,
			message: "CRM write-back coming soon.",
		})
	}

	return Response.json({ success: false as const }, { status: 400 })
}

export default function ProjectSalesLensesPage() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="flex flex-col gap-2">
				<h1 className="font-semibold text-3xl text-foreground">Sales methodology lenses</h1>
				<p className="text-muted-foreground text-sm">
					Aggregated BANT, SPICED, MEDDIC, and MAP snapshots for the latest interviews in this project.
				</p>
			</header>
			<div className="grid gap-6 lg:grid-cols-2">
				{data.frameworks.map((framework) => (
					<LensCard key={framework.name} framework={framework} />
				))}
			</div>
		</div>
	)
}

type LensCardProps = {
	framework: LoaderFramework
}

function LensCard({ framework }: LensCardProps) {
	const params = useParams()
	const { accountId, projectId } = params
	const routes = useProjectRoutesFromIds(accountId!, projectId!)
	const commitFetcher = useFetcher<{ success: boolean; intent: string; message?: string }>()
	const refreshFetcher = useFetcher<{ success: boolean; intent: string }>()
	const isCommitting = commitFetcher.state !== "idle"
	const isRefreshing = refreshFetcher.state !== "idle"
	const commitMessage = commitFetcher.data?.intent === "commit" ? (commitFetcher.data?.message ?? null) : null
	const lastUpdatedLabel = formatDistanceToNow(new Date(framework.computedAt), { addSuffix: true })
	return (
		<Card className="flex h-full flex-col">
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<CardTitle className="font-semibold text-xl">{friendlyFrameworkName(framework.name)}</CardTitle>
					<p className="text-muted-foreground text-sm">Last updated {lastUpdatedLabel}</p>
					{framework.attendeeNames.length > 0 ? (
						<p className="text-muted-foreground text-sm">Attendees: {framework.attendeeNames.join(", ")}</p>
					) : null}
				</div>
				<div className="flex flex-col items-end gap-2">
					<commitFetcher.Form method="post" className="flex items-center gap-2">
						<input type="hidden" name="intent" value="commit" />
						<input type="hidden" name="summaryId" value={framework.summaryId} />
						<Button size="sm" variant="secondary" disabled={isCommitting}>
							{isCommitting ? "Committing..." : "Commit to CRM"}
						</Button>
					</commitFetcher.Form>
					{framework.interviewId ? (
						<refreshFetcher.Form method="post" className="flex items-center gap-2">
							<input type="hidden" name="intent" value="refresh" />
							<input type="hidden" name="interviewId" value={framework.interviewId} />
							<Button size="sm" variant="outline" disabled={isRefreshing}>
								{isRefreshing ? "Refreshing..." : "Refresh lens"}
							</Button>
						</refreshFetcher.Form>
					) : null}
					{commitMessage ? <p className="text-muted-foreground text-xs">{commitMessage}</p> : null}
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<HygieneList hygiene={framework.hygieneEvents} summary={framework.hygieneSummary} />
				<StakeholderList stakeholders={framework.stakeholders} unlinked={framework.unlinkedAttendees} />

				{/* BANT/Framework Slots */}
				<div className="flex flex-col gap-3">
					{framework.slots
						.filter((slot) => !slot.slot.startsWith("next_step"))
						.map((slot) => (
							<div key={slot.id} className="rounded-lg border bg-muted/30 p-4">
								<div className="flex flex-col gap-2">
									<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
										<div className="flex-1 space-y-1">
											<p className="font-medium text-muted-foreground text-xs uppercase">{slot.label || slot.slot}</p>
											{slot.summary ? (
												<p className="font-semibold text-base text-foreground">{slot.summary}</p>
											) : (
												<p className="font-semibold text-base text-foreground">No value captured</p>
											)}
											{slot.summary && slot.summary !== slot.summary ? (
												<p className="text-muted-foreground text-sm">{slot.summary}</p>
											) : null}
											{slot.textValue && slot.textValue !== slot.summary ? (
												<p className="text-muted-foreground text-sm italic">"{slot.textValue}"</p>
											) : null}
											{slot.relatedNames.length > 0 ? (
												<p className="text-muted-foreground text-xs">Related: {slot.relatedNames.join(", ")}</p>
											) : null}
										</div>
										<div className="flex flex-col items-start gap-1 text-right md:items-end">
											{slot.ownerName ? <p className="text-muted-foreground text-xs">Owner: {slot.ownerName}</p> : null}
											{slot.dateValue ? <p className="text-muted-foreground text-xs">Due: {slot.dateValue}</p> : null}
											{typeof slot.confidence === "number" ? (
												<Badge variant="outline" color="green">
													{Math.round(slot.confidence * 100)}% confidence
												</Badge>
											) : null}
											{slot.evidenceCount > 0 ? (
												<Badge variant="outline" color="indigo">
													{slot.evidenceCount} evidence
												</Badge>
											) : null}
										</div>
									</div>
									{slot.evidenceRefs.length > 0 ? (
										<div className="mt-2 flex flex-col gap-2 border-t pt-2">
											<p className="font-medium text-muted-foreground text-xs">Supporting Evidence:</p>
											{slot.evidenceRefs.map((ref) => (
												<a
													key={ref.evidenceId}
													href={routes.evidence.detail(ref.evidenceId)}
													className="rounded-md border border-dashed bg-background/50 p-2 text-sm transition-colors hover:bg-accent/50"
												>
													<p className="line-clamp-2 text-foreground">{ref.transcriptSnippet || "View evidence"}</p>
													{ref.startMs !== null ? (
														<p className="mt-1 text-muted-foreground text-xs">
															{Math.floor(ref.startMs / 1000 / 60)}:
															{String(Math.floor((ref.startMs / 1000) % 60)).padStart(2, "0")}
														</p>
													) : null}
												</a>
											))}
										</div>
									) : null}
								</div>
							</div>
						))}
				</div>

				{/* Next Steps Section */}
				{framework.slots.filter((slot) => slot.slot.startsWith("next_step")).length > 0 ? (
					<div className="flex flex-col gap-2">
						<p className="font-semibold text-foreground text-sm">Next Steps</p>
						<div className="flex flex-col gap-2">
							{framework.slots
								.filter((slot) => slot.slot.startsWith("next_step"))
								.map((step) => (
									<div
										key={step.id}
										className="flex items-start gap-3 rounded-md border border-dashed bg-background/50 p-3"
									>
										<div className="flex-1">
											<p className="font-medium text-foreground text-sm">{step.summary}</p>
											{step.textValue && step.textValue !== step.summary ? (
												<p className="mt-1 text-muted-foreground text-xs">{step.textValue}</p>
											) : null}
											{step.evidenceRefs.length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-1">
													{step.evidenceRefs.map((ref) => (
														<a
															key={ref.evidenceId}
															href={routes.evidence.detail(ref.evidenceId)}
															className="rounded border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent/50"
															title={ref.transcriptSnippet || "View evidence"}
														>
															Evidence
														</a>
													))}
												</div>
											) : null}
										</div>
										<div className="flex flex-col items-end gap-1">
											{step.ownerName ? <p className="text-muted-foreground text-xs">Owner: {step.ownerName}</p> : null}
											{step.dateValue ? <p className="text-muted-foreground text-xs">Due: {step.dateValue}</p> : null}
											{typeof step.confidence === "number" ? (
												<Badge variant="outline" color="green" className="text-xs">
													{Math.round(step.confidence * 100)}%
												</Badge>
											) : null}
										</div>
									</div>
								))}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}

type HygieneListProps = {
	hygiene: LoaderFramework["hygieneEvents"]
	summary: LoaderFramework["hygieneSummary"]
}

function HygieneList({ hygiene, summary }: HygieneListProps) {
	const combined = [...summary.map((item) => ({ ...item, slotLabel: item.slot ?? null })), ...hygiene]
	if (!combined.length) {
		return null
	}
	return (
		<div className="flex flex-wrap gap-2">
			{combined.map((item) => {
				const badgeVariant = severityBadge[item.severity] ?? { variant: "outline" as const }
				return (
					<Badge key={`${item.code}-${item.slotLabel ?? "summary"}`} {...badgeVariant}>
						<span className="font-medium">{item.code}</span>
						{item.slotLabel ? <span className="ml-1 text-muted-foreground text-xs">({item.slotLabel})</span> : null}
						{item.message ? <span className="ml-1 text-muted-foreground text-xs">{item.message}</span> : null}
					</Badge>
				)
			})}
		</div>
	)
}

type StakeholderListProps = {
	stakeholders: LoaderFramework["stakeholders"]
	unlinked: LoaderFramework["unlinkedAttendees"]
}

function StakeholderList({ stakeholders, unlinked }: StakeholderListProps) {
	if (!stakeholders.length && !unlinked.length) {
		return null
	}

	return (
		<div className="flex flex-col gap-2">
			<p className="font-semibold text-foreground text-sm">Stakeholders</p>
			<div className="flex flex-col gap-2">
				{stakeholders.map((stakeholder) => (
					<div key={stakeholder.id} className="flex flex-col gap-2 rounded-md border border-dashed p-3">
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium text-foreground text-sm">{stakeholder.displayName}</span>
								{stakeholder.personName ? (
									<Badge variant="outline" color="green">
										Linked to {stakeholder.personName}
									</Badge>
								) : null}
								{stakeholder.labels.map((label) => (
									<Badge key={label} variant="outline">
										{label.replace(/_/g, " ")}
									</Badge>
								))}
							</div>
							<div className="mt-1 flex flex-wrap gap-3 text-muted-foreground text-xs">
								{stakeholder.role ? <span>Role: {stakeholder.role}</span> : null}
								{stakeholder.influence ? <span>Influence: {stakeholder.influence}</span> : null}
								{typeof stakeholder.confidence === "number" ? (
									<span>Confidence: {Math.round(stakeholder.confidence * 100)}%</span>
								) : null}
								{stakeholder.personKey ? <span>Person key: {stakeholder.personKey}</span> : null}
								{stakeholder.email ? <span>{stakeholder.email}</span> : null}
								{stakeholder.organizationName ? <span>Org: {stakeholder.organizationName}</span> : null}
							</div>
						</div>
						{stakeholder.evidenceRefs.length > 0 ? (
							<div className="flex flex-col gap-1 border-t pt-2">
								<p className="font-medium text-muted-foreground text-xs">Evidence:</p>
								<div className="flex flex-wrap gap-1">
									{stakeholder.evidenceRefs.map((ref) => (
										<a
											key={ref.evidenceId}
											href={routes.evidence.detail(ref.evidenceId)}
											className="rounded border bg-background/50 px-2 py-1 text-xs transition-colors hover:bg-accent/50"
											title={ref.transcriptSnippet || "View evidence"}
										>
											{ref.startMs !== null ? (
												<span>
													{Math.floor(ref.startMs / 1000 / 60)}:
													{String(Math.floor((ref.startMs / 1000) % 60)).padStart(2, "0")}
												</span>
											) : (
												<span>View</span>
											)}
										</a>
									))}
								</div>
							</div>
						) : null}
					</div>
				))}
				{unlinked.length > 0 ? (
					<div className="flex flex-col gap-1 rounded-md border border-dotted p-3">
						<p className="font-medium text-muted-foreground text-sm">Unlinked attendees pending review</p>
						<ul className="list-disc pl-4 text-muted-foreground text-xs">
							{unlinked.map((attendee) => (
								<li key={`${attendee.displayName}-${attendee.personKey ?? "unknown"}`}>
									{attendee.displayName}
									{attendee.role ? ` · ${attendee.role}` : ""}
									{attendee.personKey ? ` · key: ${attendee.personKey}` : ""}
								</li>
							))}
						</ul>
					</div>
				) : null}
			</div>
		</div>
	)
}

function friendlyFrameworkName(name: string) {
	switch (name) {
		case "BANT_GPCT":
			return "BANT / GPCT"
		case "SPICED":
			return "SPICED"
		case "MEDDIC":
			return "MEDDIC"
		case "MAP":
			return "Mutual Action Plan"
		default:
			return name
	}
}
