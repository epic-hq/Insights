import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { deriveUserGroups } from "~/features/people/services/deriveUserGroups.server";
import { supabaseAdmin } from "~/lib/supabase/client.server";

/**
 * Test API route for user group derivation
 * POST /api/test-user-groups with { projectId: string }
 *
 * NOTE: Uses admin client to bypass RLS for testing
 */
export async function action({ request }: ActionFunctionArgs) {
	const supabase = supabaseAdmin;

	try {
		const formData = await request.formData();
		const projectId = formData.get("projectId")?.toString();

		if (!projectId) {
			return Response.json({ error: "projectId is required" }, { status: 400 });
		}

		consola.log(`[test-user-groups] Deriving user groups for project: ${projectId}`);

		const groups = await deriveUserGroups({
			supabase,
			projectId,
			minGroupSize: 1, // Lower threshold for testing
		});

		console.log(`[test-user-groups] Found ${groups.length} groups`);

		// Get some sample data for each group
		const groupsWithSamples = await Promise.all(
			groups.map(async (group) => {
				// Get sample people from this group
				const { data: samplePeople, error } = await supabase
					.from("people")
					.select("id, name, role, segment")
					.in("id", group.member_ids.slice(0, 3));

				if (error) {
					consola.error(`Error loading sample people for group ${group.name}:`, error);
				}

				return {
					...group,
					sample_people: samplePeople || [],
				};
			})
		);

		return Response.json(
			{
				success: true,
				projectId,
				groups: groupsWithSamples,
				summary: {
					total_groups: groups.length,
					by_type: {
						role: groups.filter((g) => g.type === "role").length,
						segment: groups.filter((g) => g.type === "segment").length,
						cohort: groups.filter((g) => g.type === "cohort").length,
					},
					total_members: groups.reduce((sum, g) => sum + g.member_count, 0),
				},
			},
			{ status: 200 }
		);
	} catch (error) {
		consola.error("[test-user-groups] Error:", error);
		return Response.json(
			{
				error: "Failed to derive user groups",
				details: error instanceof Error ? error.message : JSON.stringify(error),
			},
			{ status: 500 }
		);
	}
}
