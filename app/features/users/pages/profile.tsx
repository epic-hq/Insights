import consola from "consola"
import { data } from "react-router"
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { resolveInternalPerson } from "~/features/people/services/internalPeople.server"
import UserSettings from "~/features/users/components/UserSettings"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const { user_settings, claims } = ctx

	// Get OAuth avatar from claims.user_metadata (Supabase auth metadata)
	// Different OAuth providers use different field names
	const userMetadata = claims.user_metadata as Record<string, unknown> | null | undefined
	const readMetadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
		const value = metadata?.[key]
		return typeof value === "string" ? value : undefined
	}
	const oauthAvatar =
		readMetadataString(userMetadata, "avatar_url") ||
		readMetadataString(userMetadata, "picture") ||
		readMetadataString(userMetadata, "image_url") ||
		null

	consola.log("OAuth avatar from user_metadata:", oauthAvatar)
	return { user_settings, userId: claims.sub, oauthAvatar }
}

export async function action({ request, context }: ActionFunctionArgs) {
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		return data({ error: "Unauthorized" }, { status: 401 })
	}

	const ctx = context.get(userContext)
	const { supabase } = ctx

	const formData = await request.formData()
	const field = formData.get("field") as string
	const value = formData.get("value") as string

	if (!field) {
		return data({ error: "Field is required" }, { status: 400 })
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
		"role",
		"industry",
		"referral_source",
		"theme",
		"language",
		"image_url",
	]

	if (!allowedFields.includes(field)) {
		return data({ error: "Invalid field" }, { status: 400 })
	}

	// Update user_settings
	const { error } = await supabase
		.from("user_settings")
		.update({ [field]: value || null })
		.eq("user_id", user.sub)

	if (error) {
		consola.error("Failed to update user settings:", error)
		return data({ error: error.message }, { status: 500 })
	}

	try {
		const { data: updatedSettings } = await supabase
			.from("user_settings")
			.select("first_name, last_name, title, role, company_name, industry, email, image_url, last_used_project_id")
			.eq("user_id", user.sub)
			.maybeSingle()

		await resolveInternalPerson({
			supabase,
			accountId: ctx.account_id,
			projectId: updatedSettings?.last_used_project_id ?? null,
			userId: user.sub,
			userSettings: updatedSettings || null,
			userMetadata: ctx.user_metadata,
			allowNullUpdates: true,
		})
	} catch (personSyncError) {
		consola.warn("Failed to update internal person from profile settings", personSyncError)
	}

	consola.log(`Updated user_settings.${field} for user ${user.sub}`)
	return data({ success: true })
}

export default function Profile() {
	const { user_settings, oauthAvatar } = useLoaderData<typeof loader>()
	consola.log("user_settings", user_settings)
	return (
		<PageContainer size="sm" padded={false} className="max-w-3xl p-6">
			<UserSettings settings={user_settings || {}} oauthAvatar={oauthAvatar} />
		</PageContainer>
	)
}
