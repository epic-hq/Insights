import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";

import type { Database } from "supabase/types";
import {
	type SalesConversationExtraction,
	type SalesFrameworkPayload,
	type SalesFrameworkSlot,
	salesConversationExtractionSchema,
	salesFrameworkEnum,
} from "~/lib/sales-lens/schema";
import type { Tables } from "~/types";

type DbClient = SupabaseClient<Database>;

type StakeholderDraft = SalesConversationExtraction["entities"]["stakeholders"][number];

/**
 * Basic influence heuristics allow the MVP to reason about stakeholder weightings
 * without a bespoke ML model. Titles containing executive keywords map to "high",
 * middle-management titles to "medium", and the remainder default to "low".
 */
const influenceFromRole = (role: string | null | undefined): "low" | "medium" | "high" => {
	if (!role) return "low";
	const normalized = role.toLowerCase();
	if (/chief|cfo|ceo|coo|cto|founder|vp/.test(normalized)) {
		return "high";
	}
	if (/director|lead|manager/.test(normalized)) {
		return "medium";
	}
	return "low";
};

const normalizeSnippet = (text: string | null | undefined): string | null => {
	if (!text) return null;
	return text.length > 240 ? `${text.slice(0, 237)}...` : text;
};

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

const derivePersonKey = (name: string | null, index: number): string => {
	const base = slugify(name ?? "") || "stakeholder";
	return `${base}-${index}`;
};

/**
 * Applies lightweight labeling heuristics (economic buyer, influencer, etc.)
 * so downstream hygiene checks and UI affordances have structured personas to target.
 */
const decorateStakeholders = (stakeholders: StakeholderDraft[]): StakeholderDraft[] => {
	const clones = stakeholders.map((entry) => ({
		...entry,
		labels: [...(entry.labels ?? [])],
	}));

	const weights: Record<StakeholderDraft["influence"], number> = { low: 1, medium: 2, high: 3 };
	const ranked = clones
		.map((entry, index) => ({ entry, index }))
		.sort((a, b) => (weights[b.entry.influence] ?? 0) - (weights[a.entry.influence] ?? 0));

	if (ranked[0]) {
		const primary = clones[ranked[0].index];
		primary.labels = Array.from(new Set([...primary.labels, "economic_buyer", "decision_maker"]));
	}

	if (ranked[1]) {
		const influencer = clones[ranked[1].index];
		influencer.labels = Array.from(new Set([...influencer.labels, "influencer"]));
	}

	return clones;
};

const emptyFramework = (name: SalesFrameworkPayload["name"]): SalesFrameworkPayload => ({
	name,
	hygiene: [],
	slots: [],
});

/**
 * Builds an initial, fully-linked sales lens extraction for an interview record.
 * The payload aligns to the shared Zod schema so it can be reused by Trigger.dev
 * tasks, Remix actions, or direct Supabase writes without bespoke validation.
 */
export async function buildInitialSalesLensExtraction(
	db: DbClient,
	interviewId: string
): Promise<SalesConversationExtraction> {
	type InterviewRecord = Pick<
		Tables<"interviews">,
		| "id"
		| "account_id"
		| "project_id"
		| "open_questions_and_next_steps"
		| "high_impact_themes"
		| "interview_date"
		| "title"
		| "observations_and_notes"
	>;

	const { data: interview, error: interviewError } = await db
		.from("interviews")
		.select<InterviewRecord>(
			"id, account_id, project_id, open_questions_and_next_steps, high_impact_themes, interview_date, title, observations_and_notes"
		)
		.eq("id", interviewId)
		.maybeSingle();

	if (interviewError) {
		throw new Error(`Failed to load interview ${interviewId}: ${interviewError.message}`);
	}
	if (!interview) {
		throw new Error(`Interview ${interviewId} not found`);
	}

	type InterviewPersonRow = Pick<Tables<"interview_people">, "person_id" | "role" | "display_name">;

	const { data: attendeeRows, error: attendeeError } = await db
		.from("interview_people")
		.select<InterviewPersonRow>("person_id, role, display_name")
		.eq("interview_id", interviewId);

	if (attendeeError) {
		throw new Error(`Failed to load interview attendees: ${attendeeError.message}`);
	}

	const personIds = Array.from(
		new Set((attendeeRows ?? []).map((row) => row.person_id).filter((id): id is string => Boolean(id)))
	);

	type PeopleRow = Pick<
		Tables<"people">,
		"id" | "name" | "role" | "title" | "company" | "primary_email" | "default_organization_id"
	>;
	// Cache the mini-CRM contact attributes we need for stakeholder linkage and evidence.
	const peopleById = new Map<
		string,
		Pick<PeopleRow, "name" | "role" | "title" | "company" | "primary_email" | "default_organization_id">
	>();
	if (personIds.length > 0) {
		const { data: people, error: peopleError } = await db
			.from("people")
			.select("id, name, role, title, primary_email, default_organization_id, default_organization:organizations!default_organization_id(name)")
			.in("id", personIds);
		if (peopleError) {
			consola.warn("Failed to load people for sales lens", peopleError);
		} else {
			for (const person of (people ?? []) as Array<PeopleRow & { default_organization?: { name: string | null } | null }>) {
				const orgName = person.default_organization?.name;
				peopleById.set(person.id, {
					name: person.name ?? null,
					role: person.role ?? null,
					title: person.title ?? null,
					company: orgName ?? null,
					primary_email: person.primary_email ?? null,
					default_organization_id: person.default_organization_id ?? null,
				});
			}
		}
	}

	type EvidenceRow = Pick<Tables<"evidence">, "id" | "anchors" | "verbatim">;

	const { data: evidenceRecords, error: evidenceError } = await db
		.from("evidence")
		.select<EvidenceRow>("id, anchors, verbatim")
		.eq("interview_id", interviewId)
		.order("created_at", { ascending: true })
		.limit(12);

	if (evidenceError) {
		consola.warn("Failed to load evidence for sales lens", evidenceError);
	}

	const evidencePointers = (evidenceRecords ?? []).map((record) => {
		// anchors is an array of anchor objects, not a single object
		const anchorsArray = Array.isArray(record.anchors) ? record.anchors : [];
		// Get the first media anchor with timing data
		const firstAnchor = anchorsArray[0] as { start_ms?: number; end_ms?: number } | undefined;
		const start = typeof firstAnchor?.start_ms === "number" ? firstAnchor.start_ms : null;
		const end = typeof firstAnchor?.end_ms === "number" ? firstAnchor.end_ms : null;
		return {
			evidenceId: record.id,
			startMs: start,
			endMs: end,
			transcriptSnippet: normalizeSnippet(record.verbatim ?? null),
		};
	});

	const pickEvidence = (index: number): SalesFrameworkSlot["evidence"] => {
		if (!evidencePointers.length) return [];
		return [evidencePointers[index % evidencePointers.length]];
	};

	const stakeholderDrafts: StakeholderDraft[] = (attendeeRows ?? []).map((attendee, index) => {
		const person = attendee.person_id ? peopleById.get(attendee.person_id) : undefined;
		const name = person?.name ?? attendee.display_name ?? `Stakeholder ${index + 1}`;
		const role = person?.role ?? person?.title ?? attendee.role ?? null;
		const personKey = attendee.person_id ?? derivePersonKey(name, index);
		return {
			personId: attendee.person_id ?? null,
			personKey,
			candidatePersonKey: attendee.person_id ? null : personKey,
			displayName: name,
			role,
			influence: influenceFromRole(role),
			labels: [],
			organizationId: person?.default_organization_id ?? null,
			email: person?.primary_email ?? null,
			confidence: attendee.person_id ? 0.7 : 0.4,
			evidence: pickEvidence(index),
		};
	});

	const stakeholders = decorateStakeholders(stakeholderDrafts);
	const primaryStakeholder = stakeholders[0];

	const attendeePersonIds = stakeholders
		.map((stakeholder) => stakeholder.personId)
		.filter((id): id is string => Boolean(id));

	const attendeePersonKeys = stakeholders.map(
		(stakeholder, index) => stakeholder.personKey ?? derivePersonKey(stakeholder.displayName, index)
	);

	const highImpactThemes = Array.isArray(interview.high_impact_themes)
		? (interview.high_impact_themes as string[])
		: [];
	const primaryPain = highImpactThemes[0] ?? null;

	const nextStepDescription = interview.open_questions_and_next_steps?.trim();
	const nextStepConfidence = nextStepDescription ? 0.6 : 0.2;

	const frameworks: SalesFrameworkPayload[] = [
		emptyFramework(salesFrameworkEnum.enum.SPICED),
		emptyFramework(salesFrameworkEnum.enum.BANT_GPCT),
		emptyFramework(salesFrameworkEnum.enum.MEDDIC),
		emptyFramework(salesFrameworkEnum.enum.MAP),
	];

	const spicedSlots: SalesFrameworkSlot[] = [];
	spicedSlots.push({
		slot: "situation",
		summary: interview.title ?? null,
		textValue: interview.observations_and_notes ?? null,
		numericValue: null,
		dateValue: null,
		status: null,
		confidence: 0.5,
		ownerPersonId: null,
		ownerPersonKey: null,
		relatedPersonIds: attendeePersonIds,
		relatedOrganizationIds: [],
		evidence: pickEvidence(0),
		hygiene: [],
	});
	if (primaryPain) {
		spicedSlots.push({
			slot: "pain",
			summary: primaryPain,
			textValue: primaryPain,
			numericValue: null,
			dateValue: null,
			status: null,
			confidence: 0.6,
			ownerPersonId: primaryStakeholder?.personId ?? null,
			ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
			relatedPersonIds: attendeePersonIds,
			relatedOrganizationIds: [],
			evidence: pickEvidence(1),
			hygiene: [],
		});
	}
	spicedSlots.push({
		slot: "critical_event",
		summary: interview.interview_date,
		textValue: null,
		numericValue: null,
		dateValue: interview.interview_date,
		status: null,
		confidence: 0.4,
		ownerPersonId: null,
		ownerPersonKey: null,
		relatedPersonIds: [],
		relatedOrganizationIds: [],
		evidence: pickEvidence(2),
		hygiene: [],
	});
	frameworks[0].slots = spicedSlots;

	const bantSlots: SalesFrameworkSlot[] = [];

	// Budget: Extract from observations/notes
	const budgetMatch = interview.observations_and_notes?.match(/\$[\d,]+[kKmM]?|\d+[kKmM]?\s*budget/i);
	const budgetText = budgetMatch ? budgetMatch[0] : null;
	if (budgetText) {
		bantSlots.push({
			slot: "budget",
			summary: budgetText,
			textValue: budgetText,
			numericValue: null,
			dateValue: null,
			status: null,
			confidence: 0.5,
			ownerPersonId: primaryStakeholder?.personId ?? null,
			ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
			relatedPersonIds: attendeePersonIds,
			relatedOrganizationIds: [],
			evidence: pickEvidence(3),
			hygiene: [],
		});
	}

	// Authority: Use highest influence stakeholder
	if (primaryStakeholder) {
		bantSlots.push({
			slot: "authority",
			summary: `${primaryStakeholder.displayName} (${primaryStakeholder.influence})`,
			textValue: primaryStakeholder.role ?? primaryStakeholder.displayName,
			numericValue: null,
			dateValue: null,
			status: null,
			confidence: primaryStakeholder.personId ? 0.7 : 0.4,
			ownerPersonId: primaryStakeholder.personId ?? null,
			ownerPersonKey: primaryStakeholder.personKey ?? primaryStakeholder.candidatePersonKey ?? null,
			relatedPersonIds: [primaryStakeholder.personId].filter((id): id is string => Boolean(id)),
			relatedOrganizationIds: primaryStakeholder.organizationId ? [primaryStakeholder.organizationId] : [],
			evidence: pickEvidence(1),
			hygiene: [],
		});
	}

	// Need
	if (primaryPain) {
		bantSlots.push({
			slot: "need",
			summary: primaryPain,
			textValue: primaryPain,
			numericValue: null,
			dateValue: null,
			status: null,
			confidence: 0.6,
			ownerPersonId: primaryStakeholder?.personId ?? null,
			ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
			relatedPersonIds: attendeePersonIds,
			relatedOrganizationIds: [],
			evidence: pickEvidence(3),
			hygiene: [],
		});
	}

	// Timeline
	bantSlots.push({
		slot: "timeline",
		summary: interview.interview_date,
		textValue: null,
		numericValue: null,
		dateValue: interview.interview_date,
		status: null,
		confidence: 0.4,
		ownerPersonId: null,
		ownerPersonKey: null,
		relatedPersonIds: [],
		relatedOrganizationIds: [],
		evidence: pickEvidence(4),
		hygiene: [],
	});
	frameworks[1].slots = bantSlots;

	const meddicSlots: SalesFrameworkSlot[] = [];
	meddicSlots.push({
		slot: "economic_buyer",
		summary: primaryStakeholder?.displayName ?? null,
		textValue: primaryStakeholder?.displayName ?? null,
		numericValue: null,
		dateValue: null,
		status: null,
		confidence: primaryStakeholder?.personId ? 0.6 : 0.3,
		ownerPersonId: primaryStakeholder?.personId ?? null,
		ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
		relatedPersonIds: attendeePersonIds,
		relatedOrganizationIds: [],
		evidence: [],
		hygiene: [],
	});
	frameworks[2].slots = meddicSlots;

	const mapSlots: SalesFrameworkSlot[] = [];
	if (nextStepDescription) {
		mapSlots.push({
			slot: "milestone",
			summary: nextStepDescription,
			textValue: nextStepDescription,
			numericValue: null,
			dateValue: null,
			status: "planned",
			confidence: nextStepConfidence,
			ownerPersonId: primaryStakeholder?.personId ?? null,
			ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
			relatedPersonIds: attendeePersonIds,
			relatedOrganizationIds: [],
			evidence: pickEvidence(5),
			hygiene: [],
		});
	}
	frameworks[3].slots = mapSlots;

	const extractionCandidate = {
		meetingId: interview.id,
		projectId: interview.project_id,
		accountId: interview.account_id,
		opportunityId: null,
		attendeePersonIds,
		attendeePersonKeys,
		frameworks,
		entities: {
			stakeholders,
			objections: [],
		},
		nextStep: {
			description: nextStepDescription ?? "No explicit next step captured.",
			ownerPersonId: primaryStakeholder?.personId ?? null,
			ownerPersonKey: primaryStakeholder?.personKey ?? primaryStakeholder?.candidatePersonKey ?? null,
			dueDate: null,
			confidence: nextStepConfidence,
			evidence: pickEvidence(6),
		},
		map:
			mapSlots.length > 0
				? {
						milestones: mapSlots.map((slot) => ({
							label: slot.summary ?? slot.textValue ?? "Milestone",
							ownerPersonId: slot.ownerPersonId ?? null,
							ownerPersonKey: slot.ownerPersonKey ?? null,
							dueDate: slot.dateValue ?? null,
							status: slot.status ?? undefined,
							evidence: slot.evidence,
						})),
					}
				: undefined,
	};

	return salesConversationExtractionSchema.parse(extractionCandidate);
}
