/**
 * API route for merging person records
 *
 * Merges a source person (e.g., placeholder "Sales Rep 1") into a target person (real person).
 * Transfers all evidence, facets, personas, scales, and interview associations.
 * Creates audit trail in person_merge_history for potential rollback.
 */

import { type ActionFunctionArgs, json } from "react-router";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

const MergePersonSchema = z.object({
	sourcePersonId: z.string().uuid("Invalid source person ID"),
	targetPersonId: z.string().uuid("Invalid target person ID"),
	reason: z.string().optional(),
});

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const { supabase, user } = ctx;

	if (!user) {
		return json({ ok: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const parsed = MergePersonSchema.safeParse(body);

		if (!parsed.success) {
			return json({ ok: false, error: "Invalid request", details: parsed.error.issues }, { status: 400 });
		}

		const { sourcePersonId, targetPersonId, reason } = parsed.data;

		// Validate: source and target must be different
		if (sourcePersonId === targetPersonId) {
			return json({ ok: false, error: "Cannot merge a person into themselves" }, { status: 400 });
		}

		// Use admin client for transactional merge (bypasses RLS within transaction)
		const adminClient = createSupabaseAdminClient();

		// 1. Fetch source and target persons (validate they exist)
		const { data: sourcePerson, error: sourceError } = await supabase
			.from("people")
			.select("*")
			.eq("id", sourcePersonId)
			.single();

		if (sourceError || !sourcePerson) {
			return json({ ok: false, error: "Source person not found" }, { status: 404 });
		}

		const { data: targetPerson, error: targetError } = await supabase
			.from("people")
			.select("*")
			.eq("id", targetPersonId)
			.single();

		if (targetError || !targetPerson) {
			return json({ ok: false, error: "Target person not found" }, { status: 404 });
		}

		// 2. Count records to be transferred
		const [evidenceCount, interviewCount, facetCount] = await Promise.all([
			supabase
				.from("evidence")
				.select("id", { count: "exact", head: true })
				.eq("person_id", sourcePersonId)
				.then((r) => r.count || 0),
			supabase
				.from("interview_participants")
				.select("id", { count: "exact", head: true })
				.eq("person_id", sourcePersonId)
				.then((r) => r.count || 0),
			supabase
				.from("person_facets")
				.select("id", { count: "exact", head: true })
				.eq("person_id", sourcePersonId)
				.then((r) => r.count || 0),
		]);

		// 3. Execute transactional merge using admin client
		// This bypasses RLS and ensures atomicity
		const mergeResult = await adminClient.rpc("merge_people_transaction", {
			p_source_person_id: sourcePersonId,
			p_target_person_id: targetPersonId,
			p_account_id: sourcePerson.account_id,
			p_project_id: sourcePerson.project_id,
			p_merged_by: user.id,
			p_reason: reason || null,
			p_source_person_data: sourcePerson,
			p_source_person_name: sourcePerson.name || "Unnamed",
			p_target_person_name: targetPerson.name || "Unnamed",
			p_evidence_count: evidenceCount,
			p_interview_count: interviewCount,
			p_facet_count: facetCount,
		});

		if (mergeResult.error) {
			console.error("[merge-people] Transaction failed:", mergeResult.error);
			return json(
				{
					ok: false,
					error: "Failed to merge people",
					details: mergeResult.error.message,
				},
				{ status: 500 }
			);
		}

		return json({
			ok: true,
			message: "People merged successfully",
			sourcePersonId,
			targetPersonId,
			transferred: {
				evidence: evidenceCount,
				interviews: interviewCount,
				facets: facetCount,
			},
		});
	} catch (error) {
		console.error("[merge-people] Unexpected error:", error);
		return json(
			{
				ok: false,
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
