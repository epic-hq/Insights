import consola from "consola";
import { data } from "react-router";
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData } from "react-router-dom";
import { PageContainer } from "~/components/layout/PageContainer";
import { resolveInternalPerson } from "~/features/people/services/internalPeople.server";
import UserSettings from "~/features/users/components/UserSettings";
import { getAuthenticatedUser } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const { user_settings, claims } = ctx;

	// Get OAuth avatar from claims.user_metadata (Supabase auth metadata)
	// Different OAuth providers use different field names
	const userMetadata = claims.user_metadata as Record<string, unknown> | null | undefined;
	const readMetadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
		const value = metadata?.[key];
		return typeof value === "string" ? value : undefined;
	};
	const oauthAvatar =
		readMetadataString(userMetadata, "avatar_url") ||
		readMetadataString(userMetadata, "picture") ||
		readMetadataString(userMetadata, "image_url") ||
		null;

	consola.log("OAuth avatar from user_metadata:", oauthAvatar);

	// Load the user's internal person record (for linking to profile)
	const { supabase } = ctx;
	const { data: internalPerson } = await supabase
		.from("people")
		.select("id, name")
		.eq("account_id", ctx.account_id)
		.eq("user_id", claims.sub)
		.eq("person_type", "internal")
		.maybeSingle();

	return {
		user_settings,
		userId: claims.sub,
		oauthAvatar,
		internalPerson: internalPerson ?? null,
		accountId: ctx.account_id,
		lastUsedProjectId: user_settings?.last_used_project_id ?? null,
	};
}

export async function action({ request, context }: ActionFunctionArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		return data({ error: "Unauthorized" }, { status: 401 });
	}

	const ctx = context.get(userContext);
	const { supabase } = ctx;

	const formData = await request.formData();
	const field = formData.get("field") as string;
	const value = formData.get("value") as string;

	if (!field) {
		return data({ error: "Field is required" }, { status: 400 });
	}

	// Validate allowed fields
	const allowedFields = [
		"first_name",
		"last_name",
		"mobile_phone",
		"company_name",
		"company_website",
		"company_description",
		"title",
		"job_function",
		"industry",
		"referral_source",
		"theme",
		"language",
		"image_url",
	];

	if (!allowedFields.includes(field)) {
		return data({ error: "Invalid field" }, { status: 400 });
	}

	// Update user_settings
	const { error } = await supabase
		.from("user_settings")
		.update({ [field]: value || null })
		.eq("user_id", user.sub);

	if (error) {
		consola.error("Failed to update user settings:", error);
		return data({ error: error.message }, { status: 500 });
	}

	try {
		const { data: updatedSettings } = await supabase
			.from("user_settings")
			.select(
				"first_name, last_name, title, job_function, company_name, industry, email, image_url, last_used_project_id"
			)
			.eq("user_id", user.sub)
			.maybeSingle();

		await resolveInternalPerson({
			supabase,
			accountId: ctx.account_id,
			projectId: updatedSettings?.last_used_project_id ?? null,
			userId: user.sub,
			userSettings: updatedSettings || null,
			userMetadata: ctx.user_metadata,
			allowNullUpdates: true,
		});
	} catch (personSyncError) {
		consola.warn("Failed to update internal person from profile settings", personSyncError);
	}

	consola.log(`Updated user_settings.${field} for user ${user.sub}`);
	return data({ success: true });
}

export default function Profile() {
	const { user_settings, oauthAvatar, internalPerson, accountId, lastUsedProjectId } = useLoaderData<typeof loader>();
	const personUrl =
		internalPerson && accountId && lastUsedProjectId
			? `/a/${accountId}/${lastUsedProjectId}/people/${internalPerson.id}`
			: null;

	return (
		<PageContainer size="sm" padded={false} className="max-w-3xl p-6">
			{personUrl && (
				<div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-800 dark:bg-blue-950">
					<span className="text-blue-700 dark:text-blue-300">Your profile is synced to your person record:</span>
					<a
						href={personUrl}
						className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
					>
						{internalPerson.name || "View record →"}
					</a>
				</div>
			)}
			<UserSettings settings={user_settings || {}} oauthAvatar={oauthAvatar} />
		</PageContainer>
	);
}
