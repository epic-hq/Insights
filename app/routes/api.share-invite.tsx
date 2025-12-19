import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { sendEmail } from "~/emails/clients.server"
import { createInvitation } from "~/features/teams/db/invitations"
import { PATHS } from "~/paths"
import { userContext } from "~/server/user-context"
import ShareInviteEmail from "../../emails/share-invite.tsx"

const ShareInviteSchema = z.object({
	targetEmail: z.string().email(),
	accountId: z.string().uuid(),
	resourceLink: z.string().url(),
	resourceName: z.string().min(1),
	resourceType: z.string().min(1),
	note: z.string().max(1000).optional(),
})

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	if (!supabase) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const formData = await request.formData()
	const parsed = ShareInviteSchema.safeParse({
		targetEmail: formData.get("targetEmail"),
		accountId: formData.get("accountId"),
		resourceLink: formData.get("resourceLink") ?? formData.get("shareUrl"),
		resourceName: formData.get("resourceName"),
		resourceType: formData.get("resourceType"),
		note: formData.get("note") || undefined,
	})

	if (!parsed.success) {
		consola.warn("[share-invite] Invalid payload", parsed.error.flatten())
		return Response.json({ error: "Invalid share payload" }, { status: 400 })
	}

	const { targetEmail, accountId, resourceLink, resourceName, resourceType, note } = parsed.data
	const inviterName =
		ctx.user_metadata?.name ||
		(typeof ctx.claims?.name === "string" ? ctx.claims.name : null) ||
		(typeof ctx.claims?.email === "string" ? ctx.claims.email : null) ||
		"A teammate"
	const inviterEmail = typeof ctx.claims?.email === "string" ? ctx.claims.email : undefined

	try {
		// Create a proper team invitation
		const { data: inviteData, error: inviteError } = await createInvitation({
			supabase,
			account_id: accountId,
			account_role: "member",
			invitation_type: "one_time",
			invitee_email: targetEmail,
		})

		if (inviteError) {
			consola.error("[share-invite] Failed to create invitation", {
				error: inviteError,
			})
			return Response.json({ error: "Failed to create invitation" }, { status: 500 })
		}

		const token =
			typeof (inviteData as { token?: unknown } | null)?.token === "string"
				? (inviteData as { token: string }).token
				: undefined

		if (!token) {
			consola.error("[share-invite] No token returned from createInvitation")
			return Response.json({ error: "Failed to create invitation" }, { status: 500 })
		}

		// Build invite URL with token and redirect to the shared resource
		const host = PATHS.AUTH.HOST
		const resourcePath = new URL(resourceLink).pathname
		const inviteUrl = `${host}/accept-invite?invite_token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(resourcePath)}`

		// Get team name for the email
		let teamName = "the team"
		try {
			const { data: accountData } = await supabase.from("accounts").select("name").eq("id", accountId).single()
			if (accountData?.name) {
				teamName = accountData.name
			}
		} catch {
			// Use default team name
		}

		consola.info("[share-invite] Sending invitation", {
			targetEmail,
			resourceType,
			resourceName,
			teamName,
		})

		await sendEmail({
			to: targetEmail,
			subject: `${inviterName} invited you to join ${teamName} and shared a ${resourceType}`,
			send_intent: "transactional",
			react: (
				<ShareInviteEmail
					inviterName={inviterName}
					teamName={teamName}
					resourceName={resourceName}
					resourceType={resourceType}
					inviteUrl={inviteUrl}
					note={typeof note === "string" && note.trim() ? note : undefined}
					inviteeEmail={targetEmail}
				/>
			),
			reply_to: inviterEmail,
		})

		return Response.json({ ok: true })
	} catch (error) {
		consola.error("[share-invite] Failed to send", { error })
		return Response.json({ error: "Unable to send invite right now" }, { status: 500 })
	}
}
