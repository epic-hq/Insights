import consola from "consola";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

async function main() {
	const supabase = createSupabaseAdminClient();

	consola.start("Backfilling internal people (user_id + person_type)");

	const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
	if (usersError) throw usersError;

	const authUsers = users?.users || [];
	const emailToUserId = new Map<string, string>();
	for (const u of authUsers) {
		const email = (u.email || "").toLowerCase();
		if (email) emailToUserId.set(email, u.id);
	}

	const { data: people, error: peopleError } = await supabase
		.from("people")
		.select("id, account_id, user_id, person_type, primary_email, name")
		.is("user_id", null);

	if (peopleError) throw peopleError;

	let updated = 0;
	let skipped = 0;
	for (const person of people || []) {
		const email = (person.primary_email || "").toLowerCase();
		const userId = email ? emailToUserId.get(email) : undefined;
		if (!userId) {
			skipped++;
			continue;
		}

		const { error: updateError } = await supabase
			.from("people")
			.update({ user_id: userId, person_type: "internal" })
			.eq("id", person.id);

		if (updateError) {
			consola.warn("Failed to update person", {
				personId: person.id,
				email: person.primary_email,
				error: updateError.message,
			});
			continue;
		}
		updated++;
	}

	consola.success(`Backfill complete. Updated ${updated}, skipped ${skipped}.`);
}

main().catch((err) => {
	consola.error("Backfill failed", err);
	process.exit(1);
});
