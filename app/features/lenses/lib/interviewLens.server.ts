import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "supabase/types";
import type {
	InterviewLensFramework,
	InterviewLensView,
	LensEvidencePointer,
	LensHygieneItem,
	LensMilestone,
	LensNextStep,
	LensObjection,
	LensStakeholder,
} from "~/features/lenses/types";
import type { Tables } from "~/types";

type DbClient = SupabaseClient<Database>;

type SalesLensSlotRow = Tables<"sales_lens_slots"> & {
	evidence_refs: Array<{
		evidence_id: string;
		start_ms: number | null;
		end_ms: number | null;
		transcript_snippet: string | null;
	}> | null;
	hygiene: Array<{
		code: string;
		severity: "info" | "warning" | "critical";
		message?: string | null;
		slot?: string | null;
	}> | null;
	position: number | null;
};

type SalesLensStakeholderRow = Tables<"sales_lens_stakeholders"> & {
	evidence_refs: Array<{
		evidence_id: string;
		start_ms: number | null;
		end_ms: number | null;
		transcript_snippet: string | null;
	}> | null;
};

type SalesLensSummaryRow = Tables<"sales_lens_summaries"> & {
	sales_lens_slots: SalesLensSlotRow[] | null;
	sales_lens_stakeholders: SalesLensStakeholderRow[] | null;
};

type SalesLensHygieneEventRow = Tables<"sales_lens_hygiene_events">;

type PeopleLookup = Map<string, { name: string | null }>;

type LoadInterviewLensArgs = {
	db: DbClient;
	projectId: string;
	interviewId: string;
	peopleLookup?: PeopleLookup;
};

export async function loadInterviewSalesLens({
	db,
	projectId,
	interviewId,
	peopleLookup,
}: LoadInterviewLensArgs): Promise<InterviewLensView | null> {
	const baseLookup = peopleLookup ?? new Map<string, { name: string | null }>();

	const { data: summaryRows, error: summaryError } = await db
		.from("sales_lens_summaries")
		.select<SalesLensSummaryRow>(
			`id, framework, computed_at, attendee_person_ids, attendee_person_keys, attendee_unlinked, hygiene_summary, metadata,
        sales_lens_slots (id, slot, label, description, text_value, numeric_value, date_value, status, confidence, owner_person_id, owner_person_key, related_person_ids, related_organization_ids, evidence_refs, hygiene, position),
        sales_lens_stakeholders (id, display_name, role, influence, labels, confidence, person_id, person_key, candidate_person_key, organization_id, email, evidence_refs)`
		)
		.eq("project_id", projectId)
		.eq("interview_id", interviewId)
		.order("computed_at", { ascending: false });

	if (summaryError) {
		throw new Error(`Failed to load sales lens summaries: ${summaryError.message}`);
	}

	const summaries = summaryRows ?? [];
	if (summaries.length === 0) {
		return null;
	}

	const summaryIds = summaries.map((summary) => summary.id);
	const hygieneEventsBySummary = new Map<
		string,
		Array<Pick<SalesLensHygieneEventRow, "id" | "summary_id" | "slot_id" | "code" | "severity" | "message">>
	>();

	if (summaryIds.length > 0) {
		const { data: hygieneRows, error: hygieneError } = await db
			.from("sales_lens_hygiene_events")
			.select<Pick<SalesLensHygieneEventRow, "id" | "summary_id" | "slot_id" | "code" | "severity" | "message">>(
				"id, summary_id, slot_id, code, severity, message"
			)
			.in("summary_id", summaryIds);

		if (hygieneError) {
			throw new Error(`Failed to load sales lens hygiene events: ${hygieneError.message}`);
		}

		for (const event of hygieneRows ?? []) {
			const list = hygieneEventsBySummary.get(event.summary_id) ?? [];
			list.push(event);
			hygieneEventsBySummary.set(event.summary_id, list);
		}
	}

	const personIds = new Set<string>();
	const organizationIds = new Set<string>();

	for (const summary of summaries) {
		const slots = summary.sales_lens_slots ?? [];
		for (const slot of slots) {
			if (slot.owner_person_id) personIds.add(slot.owner_person_id);
			const relatedIds = Array.isArray(slot.related_person_ids) ? (slot.related_person_ids as string[]) : [];
			for (const id of relatedIds) {
				if (id) personIds.add(id);
			}
			const relatedOrgIds = Array.isArray(slot.related_organization_ids)
				? (slot.related_organization_ids as string[])
				: [];
			for (const id of relatedOrgIds) {
				if (id) organizationIds.add(id);
			}
		}

		const stakeholders = summary.sales_lens_stakeholders ?? [];
		for (const stakeholder of stakeholders) {
			if (stakeholder.person_id) personIds.add(stakeholder.person_id);
			if (stakeholder.organization_id) organizationIds.add(stakeholder.organization_id);
		}
	}

	const missingPersonIds = Array.from(personIds).filter((id) => !baseLookup.has(id));
	if (missingPersonIds.length > 0) {
		const { data: peopleRows, error: peopleError } = await db
			.from("people")
			.select("id, name")
			.in("id", missingPersonIds);

		if (peopleError) {
			throw new Error(`Failed to load people for sales lens: ${peopleError.message}`);
		}

		for (const person of peopleRows ?? []) {
			baseLookup.set(person.id, { name: person.name ?? null });
		}
	}

	const organizationsById = new Map<string, string | null>();
	if (organizationIds.size > 0) {
		const { data: organizationRows, error: organizationError } = await db
			.from("organizations")
			.select("id, name")
			.in("id", Array.from(organizationIds));

		if (organizationError) {
			throw new Error(`Failed to load organizations for sales lens: ${organizationError.message}`);
		}

		for (const organization of organizationRows ?? []) {
			organizationsById.set(organization.id, organization.name ?? null);
		}
	}

	const frameworks: InterviewLensFramework[] = [];
	const nextSteps: LensNextStep[] = [];
	const mapMilestones: LensMilestone[] = [];
	const objections: LensObjection[] = [];

	for (const summary of summaries) {
		const slots = [...(summary.sales_lens_slots ?? [])].sort((a, b) => {
			const aPos = typeof a.position === "number" ? a.position : 0;
			const bPos = typeof b.position === "number" ? b.position : 0;
			return aPos - bPos;
		});

		const slotLabelById = new Map<string, string>();

		const slotViews = slots.map((slot) => {
			const evidence = mapEvidence(slot.evidence_refs);
			const hygiene = mapSlotHygiene(slot.hygiene, slot.label ?? slot.slot);
			const ownerName = slot.owner_person_id
				? (baseLookup.get(slot.owner_person_id)?.name ?? null)
				: (slot.owner_person_key ?? null);
			const relatedNames = Array.isArray(slot.related_person_ids)
				? (slot.related_person_ids as string[])
						.map((id) => baseLookup.get(id)?.name ?? null)
						.filter((value): value is string => Boolean(value))
				: [];

			if (slot.id) {
				slotLabelById.set(slot.id, slot.label ?? slot.slot);
			}

			const numericValue =
				typeof slot.numeric_value === "number"
					? slot.numeric_value
					: typeof slot.numeric_value === "string"
						? Number(slot.numeric_value)
						: null;

			const confidence =
				typeof slot.confidence === "number"
					? slot.confidence
					: typeof slot.confidence === "string"
						? Number(slot.confidence)
						: null;

			const slotView = {
				id: slot.id,
				fieldKey: slot.slot,
				label: slot.label ?? null,
				summary: slot.description ?? null,
				textValue: slot.text_value ?? null,
				numericValue: Number.isFinite(numericValue) ? numericValue : null,
				dateValue: slot.date_value ?? null,
				status: slot.status ?? null,
				confidence: Number.isFinite(confidence) ? confidence : null,
				ownerName,
				relatedNames,
				evidenceCount: evidence.length,
				evidence,
				hygiene,
			};

			extractExecutionDetails({
				summary,
				slot,
				slotView,
				nextSteps,
				mapMilestones,
				objections,
				baseLookup,
			});

			return slotView;
		});

		const hygieneSummaryItems = mapSummaryHygiene(summary.hygiene_summary);
		const hygieneEvents = (hygieneEventsBySummary.get(summary.id) ?? []).map((event) => ({
			code: event.code,
			severity: event.severity as LensHygieneItem["severity"],
			message: event.message ?? null,
			slotLabel: event.slot_id ? (slotLabelById.get(event.slot_id) ?? null) : null,
		}));

		const frameworkView: InterviewLensFramework = {
			name: summary.framework as InterviewLensFramework["name"],
			summaryId: summary.id,
			computedAt: summary.computed_at ?? null,
			hygiene: [...hygieneSummaryItems, ...hygieneEvents],
			slots: slotViews,
		};

		frameworks.push(frameworkView);
	}

	const stakeholders = (summaries[0]?.sales_lens_stakeholders ?? []).map<LensStakeholder>((stakeholder) => ({
		id: stakeholder.id,
		displayName: stakeholder.display_name,
		role: stakeholder.role ?? null,
		influence:
			stakeholder.influence === "low" || stakeholder.influence === "medium" || stakeholder.influence === "high"
				? stakeholder.influence
				: null,
		labels: Array.isArray(stakeholder.labels) ? stakeholder.labels : [],
		confidence: toNullableNumber(stakeholder.confidence),
		personId: stakeholder.person_id ?? null,
		personName: stakeholder.person_id ? (baseLookup.get(stakeholder.person_id)?.name ?? null) : null,
		personKey: stakeholder.person_key ?? stakeholder.candidate_person_key ?? null,
		email: stakeholder.email ?? null,
		organizationName: stakeholder.organization_id ? (organizationsById.get(stakeholder.organization_id) ?? null) : null,
		evidence: mapEvidence(stakeholder.evidence_refs),
	}));

	return {
		frameworks,
		entities: {
			stakeholders,
			nextSteps,
			mapMilestones,
			objections,
		},
	};
}

function mapEvidence(items: SalesLensSlotRow["evidence_refs"]): LensEvidencePointer[] {
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => {
			if (!item || typeof item !== "object" || typeof item.evidence_id !== "string") {
				return null;
			}
			return {
				evidenceId: item.evidence_id,
				startMs: typeof item.start_ms === "number" ? item.start_ms : null,
				endMs: typeof item.end_ms === "number" ? item.end_ms : null,
				transcriptSnippet:
					typeof item.transcript_snippet === "string" ? item.transcript_snippet : (item.transcript_snippet ?? null),
			};
		})
		.filter((value): value is LensEvidencePointer => value !== null);
}

function mapSlotHygiene(items: SalesLensSlotRow["hygiene"], slotLabel: string): LensHygieneItem[] {
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => {
			if (!item || typeof item !== "object" || typeof item.code !== "string") return null;
			const severity =
				item.severity === "info" || item.severity === "warning" || item.severity === "critical"
					? item.severity
					: "info";
			return {
				code: item.code,
				severity,
				message: typeof item.message === "string" ? item.message : (item.message ?? null),
				slotLabel,
			};
		})
		.filter((value): value is LensHygieneItem => value !== null);
}

function mapSummaryHygiene(value: unknown): LensHygieneItem[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (!item || typeof item !== "object" || typeof (item as { code?: unknown }).code !== "string") return null;
			const entry = item as { code: string; severity?: unknown; message?: unknown; slot?: unknown };
			const severity =
				entry.severity === "info" || entry.severity === "warning" || entry.severity === "critical"
					? entry.severity
					: "info";
			return {
				code: entry.code,
				severity,
				message: typeof entry.message === "string" ? entry.message : (entry.message ?? null),
				slotLabel: typeof entry.slot === "string" ? entry.slot : null,
			};
		})
		.filter((value): value is LensHygieneItem => value !== null);
}

type ExtractExecutionArgs = {
	summary: SalesLensSummaryRow;
	slot: SalesLensSlotRow;
	slotView: InterviewLensFramework["slots"][number];
	nextSteps: LensNextStep[];
	mapMilestones: LensMilestone[];
	objections: LensObjection[];
	baseLookup: PeopleLookup;
};

function extractExecutionDetails({
	summary,
	slot,
	slotView,
	nextSteps,
	mapMilestones,
	objections,
	baseLookup,
}: ExtractExecutionArgs) {
	const frameworkName = summary.framework;
	const slotKey = slot.slot.toLowerCase();

	if (
		frameworkName === "MAP" &&
		(slotKey.includes("milestone") || slotKey.includes("next") || slotKey.includes("step"))
	) {
		const milestone: LensMilestone = {
			id: slot.id,
			label: slot.label ?? slotView.textValue ?? slotView.summary ?? "Milestone",
			ownerName: slot.owner_person_id
				? (baseLookup.get(slot.owner_person_id)?.name ?? null)
				: (slot.owner_person_key ?? null),
			dueDate: slot.date_value ?? null,
			status: normalizeStatus(slot.status),
			evidence: slotView.evidence,
		};
		mapMilestones.push(milestone);

		nextSteps.push({
			id: `${slot.id}-next`,
			description: slotView.textValue ?? slotView.summary ?? milestone.label ?? "Next step",
			ownerName: milestone.ownerName,
			dueDate: slot.date_value ?? null,
			confidence: slotView.confidence,
			evidence: slotView.evidence,
		});
	}

	if (slotKey.includes("objection")) {
		objections.push({
			id: slot.id,
			type: slot.label ?? slot.slot,
			status: normalizeStatus(slot.status),
			confidence: slotView.confidence,
			note: slotView.summary ?? null,
			evidence: slotView.evidence,
		});
	}

	// Some frameworks store relationship owners in slot metadata; surface as ad-hoc milestones.
	if (frameworkName === "BANT_GPCT" && slotKey.includes("next")) {
		nextSteps.push({
			id: `${slot.id}-bant`,
			description: slotView.textValue ?? slotView.summary ?? slot.label ?? "Next step",
			ownerName: slot.owner_person_id
				? (baseLookup.get(slot.owner_person_id)?.name ?? null)
				: (slot.owner_person_key ?? null),
			dueDate: slot.date_value ?? null,
			confidence: slotView.confidence,
			evidence: slotView.evidence,
		});
	}
}

function normalizeStatus(status: unknown): "planned" | "in_progress" | "done" {
	if (typeof status !== "string") return "planned";
	const normalized = status.trim().toLowerCase();
	if (normalized.includes("progress")) return "in_progress";
	if (normalized.includes("done") || normalized.includes("complete") || normalized.includes("closed")) return "done";
	return "planned";
}

function toNullableNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}
