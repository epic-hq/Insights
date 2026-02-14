import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { AccountSettingsMetadata } from "~/features/opportunities/stage-config";
import type { Database } from "~/types";

type AccountSettingsRow = Database["public"]["Tables"]["account_settings"]["Row"];

export async function getOrCreateAccountSettings({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
}): Promise<AccountSettingsRow> {
	const { data, error } = await supabase
		.from("account_settings")
		.select("*")
		.eq("account_id", accountId)
		.limit(1)
		.maybeSingle();

	if (error) {
		consola.warn("getOrCreateAccountSettings: select failed, attempting insert", { error: error.message, accountId });
	}

	if (data) return data;

	const { data: inserted, error: insertErr } = await supabase
		.from("account_settings")
		.insert({ account_id: accountId })
		.select("*")
		.single();

	if (insertErr || !inserted) {
		consola.error("getOrCreateAccountSettings: failed to insert", { error: insertErr?.message, accountId });
		throw new Error("Unable to create account settings");
	}

	return inserted;
}

export async function updateAccountMetadata({
	supabase,
	accountId,
	metadata,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
	metadata: Partial<AccountSettingsMetadata>;
}) {
	const settings = await getOrCreateAccountSettings({ supabase, accountId });
	const nextMetadata = { ...(settings.metadata as AccountSettingsMetadata), ...metadata };

	const { error } = await supabase
		.from("account_settings")
		.update({ metadata: nextMetadata } as Record<string, unknown>)
		.eq("id", settings.id);

	if (error) {
		consola.error("updateAccountMetadata failed", { accountId, error: error.message });
		throw new Error("Failed to update account settings");
	}

	return nextMetadata;
}

export async function loadAccountMetadata({
	supabase,
	accountId,
}: {
	supabase: SupabaseClient<Database>;
	accountId: string;
}) {
	const settings = await getOrCreateAccountSettings({ supabase, accountId });
	return (settings.metadata as AccountSettingsMetadata) || ({} as AccountSettingsMetadata);
}
