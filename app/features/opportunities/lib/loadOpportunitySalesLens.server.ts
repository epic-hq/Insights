import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/supabase/types";

export type OpportunitySalesLensData = {
	stakeholders: Array<{
		id: string;
		displayName: string;
		role: string | null;
		influence: "low" | "medium" | "high" | null;
		labels: string[];
		confidence: number | null;
		personName: string | null;
		personId: string | null;
		email: string | null;
		organizationName: string | null;
	}>;
	nextSteps: Array<{
		id: string;
		description: string;
		ownerName: string | null;
		dueDate: string | null;
		confidence: number | null;
	}>;
	objections: Array<{
		id: string;
		type: string;
		status: string;
		confidence: number | null;
		note?: string | null;
	}>;
	mapMilestones: Array<{
		id: string;
		label: string;
		ownerName: string | null;
		dueDate: string | null;
		status: "planned" | "in_progress" | "done";
	}>;
	linkedInterviews: Array<{
		id: string;
		title: string;
		interviewDate: string | null;
	}>;
};

export async function loadOpportunitySalesLens({
	supabase,
	opportunityId,
	accountId,
	projectId,
}: {
	supabase: SupabaseClient<Database>;
	opportunityId: string;
	accountId: string;
	projectId: string;
}): Promise<OpportunitySalesLensData | null> {
	// Get all sales lens summaries for this opportunity
	const { data: summaries, error: summariesError } = await supabase
		.from("sales_lens_summaries")
		.select("id")
		.eq("opportunity_id", opportunityId)
		.eq("account_id", accountId)
		.eq("project_id", projectId);

	if (summariesError || !summaries || summaries.length === 0) {
		return null;
	}

	const summaryIds = summaries.map((s) => s.id);

	// Get stakeholders
	const { data: stakeholdersData, error: stakeholdersError } = await supabase
		.from("sales_lens_stakeholders")
		.select("*")
		.in("summary_id", summaryIds);

	const stakeholders =
		stakeholdersData?.map((s) => ({
			id: s.id,
			displayName: s.display_name,
			role: s.role,
			influence: s.influence as "low" | "medium" | "high" | null,
			labels: s.labels || [],
			confidence: s.confidence,
			personName: null, // TODO: Join with people table if needed
			personId: s.person_id,
			email: s.email,
			organizationName: null, // TODO: Join with organizations table if needed
		})) || [];

	// Get slots for next steps, objections, and milestones
	const { data: slotsData } = await supabase.from("sales_lens_slots").select("*").in("summary_id", summaryIds);

	const slots = slotsData || [];

	// Extract next steps from MAP framework slots
	const nextSteps: OpportunitySalesLensData["nextSteps"] = [];
	const mapMilestones: OpportunitySalesLensData["mapMilestones"] = [];
	const objections: OpportunitySalesLensData["objections"] = [];

	for (const slot of slots) {
		const slotKey = slot.slot?.toLowerCase() || "";

		// Look for MAP milestones/next steps
		if (slotKey.includes("milestone") || slotKey.includes("next") || slotKey.includes("step")) {
			const milestone = {
				id: slot.id,
				label: slot.label || slot.text_value || slot.description || "Milestone",
				ownerName: null, // TODO: Join with people table
				dueDate: slot.date_value,
				status: (slot.status as "planned" | "in_progress" | "done") || "planned",
			};
			mapMilestones.push(milestone);

			nextSteps.push({
				id: `${slot.id}-next`,
				description: slot.text_value || slot.description || milestone.label,
				ownerName: null,
				dueDate: slot.date_value,
				confidence: slot.confidence,
			});
		}

		// Look for objections
		if (slotKey.includes("objection")) {
			objections.push({
				id: slot.id,
				type: slot.label || slot.slot || "Objection",
				status: slot.status || "open",
				confidence: slot.confidence,
				note: slot.description,
			});
		}
	}

	// Get linked interviews
	const { data: interviewsData } = await supabase
		.from("sales_lens_summaries")
		.select("interview_id")
		.eq("opportunity_id", opportunityId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.not("interview_id", "is", null);

	const interviewIds = [...new Set(interviewsData?.map((s) => s.interview_id).filter(Boolean) || [])];

	const linkedInterviews: OpportunitySalesLensData["linkedInterviews"] = [];
	if (interviewIds.length > 0) {
		const { data: interviews } = await supabase
			.from("interviews")
			.select("id, title, interview_date")
			.in("id", interviewIds);

		linkedInterviews.push(
			...(interviews?.map((i) => ({
				id: i.id,
				title: i.title || "Untitled Interview",
				interviewDate: i.interview_date,
			})) || [])
		);
	}

	return {
		stakeholders,
		nextSteps,
		objections,
		mapMilestones,
		linkedInterviews,
	};
}
