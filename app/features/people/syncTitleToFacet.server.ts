import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";

/**
 * Sync person title to job_title facet
 * When a person's title is updated, automatically create/update their job_title facet.
 * NOTE: This stores the RAW title text (e.g. "VP of Engineering") as a facet.
 * The AI-derived job_function enum (e.g. "Engineering") is stored on people.job_function.
 */
export async function syncTitleToJobTitleFacet({
	supabase,
	personId,
	accountId,
	title,
}: {
	supabase: SupabaseClient<Database>;
	personId: string;
	accountId: string;
	title: string;
}) {
	try {
		// Get the person's project_id
		const { data: person, error: personError } = await supabase
			.from("people")
			.select("project_id")
			.eq("id", personId)
			.single();

		if (personError || !person) {
			consola.warn("Could not fetch person for title sync:", personError);
			return;
		}

		const projectId = person.project_id;

		// If title is empty, remove job_title facet
		if (!title || title.trim() === "") {
			// Get job_function kind_id
			const { data: kind } = await supabase.from("facet_kind_global").select("id").eq("slug", "job_title").single();

			if (!kind) return;

			// Delete all job_title facets for this person
			const { data: allJobFunctionFacets } = await supabase
				.from("facet_account")
				.select("id")
				.eq("kind_id", kind.id)
				.eq("account_id", accountId);

			if (allJobFunctionFacets && allJobFunctionFacets.length > 0) {
				const jobFunctionFacetIds = allJobFunctionFacets.map((f) => f.id);
				await supabase
					.from("person_facet")
					.delete()
					.eq("person_id", personId)
					.in("facet_account_id", jobFunctionFacetIds);
			}

			consola.info("Removed job_title facet for person", { personId });
			return;
		}

		// Get or create facet_kind_global for job_function
		const { data: kind, error: kindError } = await supabase
			.from("facet_kind_global")
			.select("id")
			.eq("slug", "job_title")
			.single();

		if (kindError || !kind) {
			consola.warn("job_title facet kind not found:", kindError);
			return;
		}

		const kindId = kind.id;

		// Create slug from title (lowercase, replace spaces with hyphens)
		const slug = title
			.toLowerCase()
			.trim()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");

		// Get or create facet_account for this title
		let facetAccountId: number | null = null;

		const { data: existingFacet } = await supabase
			.from("facet_account")
			.select("id")
			.eq("account_id", accountId)
			.eq("kind_id", kindId)
			.eq("slug", slug)
			.single();

		if (existingFacet) {
			facetAccountId = existingFacet.id;
		} else {
			// Create new facet_account
			const { data: newFacet, error: createError } = await supabase
				.from("facet_account")
				.insert({
					account_id: accountId,
					kind_id: kindId,
					slug,
					label: title.trim(),
					is_active: true,
				})
				.select("id")
				.single();

			if (createError) {
				consola.error("Failed to create facet_account:", createError);
				return;
			}

			facetAccountId = newFacet.id;
			consola.info("Created new facet_account for title:", { slug, label: title });
		}

		if (!facetAccountId) return;

		// Delete any existing job_title facets for this person (except the one we're about to upsert)
		const { data: allJobFunctionFacets } = await supabase
			.from("facet_account")
			.select("id")
			.eq("kind_id", kindId)
			.eq("account_id", accountId);

		if (allJobFunctionFacets && allJobFunctionFacets.length > 0) {
			const jobFunctionFacetIds = allJobFunctionFacets.map((f) => f.id).filter((id) => id !== facetAccountId);

			if (jobFunctionFacetIds.length > 0) {
				await supabase
					.from("person_facet")
					.delete()
					.eq("person_id", personId)
					.in("facet_account_id", jobFunctionFacetIds);
			}
		}

		// Upsert person_facet linking person to the job_title facet
		const { error: linkError } = await supabase.from("person_facet").upsert(
			{
				person_id: personId,
				account_id: accountId,
				project_id: projectId,
				facet_account_id: facetAccountId,
				source: "manual", // User explicitly set the title
				confidence: 1.0,
				noted_at: new Date().toISOString(),
			},
			{
				onConflict: "person_id,facet_account_id",
			}
		);

		if (linkError) {
			consola.error("Failed to link person to job_title facet:", linkError);
			return;
		}

		consola.info("Synced title to job_title facet:", { personId, title, facetAccountId });
	} catch (error) {
		consola.error("Error in syncTitleToJobTitleFacet:", error);
	}
}
