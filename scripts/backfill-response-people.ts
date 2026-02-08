/**
 * Backfill script to create/link person records for existing Ask link responses
 * Run with: npx tsx scripts/backfill-response-people.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { Database } from "~/types";

async function findOrCreatePerson({
	supabase,
	accountId,
	projectId,
	email,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	projectId: string | null;
	email: string;
}): Promise<string | null> {
	const normalizedEmail = email.toLowerCase().trim();

	// Try to find existing person by email
	const { data: existingPerson } = await supabase
		.from("people")
		.select("id")
		.eq("account_id", accountId)
		.eq("primary_email", normalizedEmail)
		.maybeSingle();

	if (existingPerson?.id) {
		return existingPerson.id;
	}

	// Parse name from email (use part before @)
	const emailName = normalizedEmail.split("@")[0] || "Unknown";
	const nameParts = emailName.replace(/[._-]/g, " ").split(/\s+/);
	const firstname = nameParts[0]?.charAt(0).toUpperCase() + (nameParts[0]?.slice(1) || "");
	const lastname =
		nameParts.length > 1
			? nameParts
					.slice(1)
					.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
					.join(" ")
			: null;

	// Create new person
	const { data: newPerson, error: createError } = await supabase
		.from("people")
		.insert({
			account_id: accountId,
			project_id: projectId,
			primary_email: normalizedEmail,
			firstname,
			lastname,
			person_type: "respondent",
		})
		.select("id")
		.maybeSingle();

	if (createError) {
		// Handle unique constraint violation - person may have been created concurrently
		if (createError.code === "23505") {
			const { data: retryPerson } = await supabase
				.from("people")
				.select("id")
				.eq("account_id", accountId)
				.eq("primary_email", normalizedEmail)
				.maybeSingle();
			return retryPerson?.id ?? null;
		}
		consola.error("Failed to create person for response", createError);
		return null;
	}

	return newPerson?.id ?? null;
}

async function main() {
	const supabase = createSupabaseAdminClient();

	consola.start("Backfilling person records for Ask link responses");

	// Find all completed responses without a person_id
	const { data: responses, error: responsesError } = await supabase
		.from("research_link_responses")
		.select(
			`
      id,
      email,
      research_link_id,
      research_link:research_links(account_id, project_id)
    `
		)
		.eq("completed", true)
		.is("person_id", null);

	if (responsesError) {
		throw responsesError;
	}

	if (!responses?.length) {
		consola.success("No responses need backfilling");
		return;
	}

	consola.info(`Found ${responses.length} completed responses without person_id`);

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const response of responses) {
		const researchLink = response.research_link as {
			account_id: string;
			project_id: string | null;
		} | null;

		if (!researchLink?.account_id) {
			consola.warn(`Response ${response.id} has no linked research_link`);
			skipped++;
			continue;
		}

		const personId = await findOrCreatePerson({
			supabase,
			accountId: researchLink.account_id,
			projectId: researchLink.project_id,
			email: response.email,
		});

		if (!personId) {
			consola.warn(`Could not create person for response ${response.id}`);
			errors++;
			continue;
		}

		const { error: updateError } = await supabase
			.from("research_link_responses")
			.update({ person_id: personId })
			.eq("id", response.id);

		if (updateError) {
			consola.error(`Failed to update response ${response.id}`, updateError);
			errors++;
			continue;
		}

		updated++;
		consola.info(`Linked response ${response.id} to person ${personId}`);
	}

	consola.success(`Backfill complete. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((err) => {
	consola.error("Backfill failed", err);
	process.exit(1);
});
