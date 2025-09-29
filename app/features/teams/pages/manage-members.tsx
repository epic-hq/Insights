import { parseWithZod } from "@conform-to/zod/v4"
import consola from "consola"
import { useCallback, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, useLoaderData } from "react-router"
import { useFetcher } from "react-router-dom"
import { z } from "zod"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { type PermissionLevel, TeamInvite, type TeamMember } from "~/components/ui/team-invite"
// import { sendEmail } from "~/emails/clients.server"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { PATHS } from "~/paths"
import type { GetAccountInvitesResponse } from "~/types-accounts"
import InvitationEmail from "../../../../emails/team-invitation"
import {
	getAccount as dbGetAccount,
	getAccountMembers as dbGetAccountMembers,
	updateAccountUserRole as dbUpdateAccountUserRole,
} from "../db/accounts"
import {
	createInvitation as dbCreateInvitation,
	deleteInvitation as dbDeleteInvitation,
	getAccountInvitations as dbGetAccountInvitations,
} from "../db/invitations"

type MembersRow = {
	user_id: string
	name: string
	email: string
	account_role: "owner" | "member" | "viewer"
	is_primary_owner: boolean
}

type LoaderData = {
	account: { account_id: string; name: string; account_role: "owner" | "member" | "viewer" } | null
	members: MembersRow[]
	invitations: GetAccountInvitesResponse
}
export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client } = getServerClient(request)
	const user = await getAuthenticatedUser(request)
	if (!user) throw new Response("Unauthorized", { status: 401 })

	const accountId = params.accountId as string | undefined
	if (!accountId) throw new Response("Missing accountId", { status: 400 })

	const { data: account, error: accountError } = await dbGetAccount({ supabase: client, account_id: accountId })
	if (accountError) throw new Response(accountError.message, { status: 500 })

	let members: MembersRow[] = []
	let invitations: GetAccountInvitesResponse = []
	if (account?.account_role === "owner") {
		const { data: membersData, error: membersError } = await dbGetAccountMembers({
			supabase: client,
			account_id: accountId,
		})
		if (membersError) throw new Response(membersError.message, { status: 500 })
		members = (membersData as MembersRow[] | null) ?? []

		const { data: invitationsData, error: invitationsError } = await dbGetAccountInvitations({
			supabase: client,
			account_id: accountId,
		})
		if (invitationsError) throw new Response(invitationsError.message, { status: 500 })
		invitations = (invitationsData as GetAccountInvitesResponse | null) ?? []
	}

	const data: LoaderData = { account: account ?? null, members, invitations }
	return data
}

// --- React Router Action ---
const InviteSchema = z.object({
	intent: z.literal("invite"),
	email: z.string().email(),
	permission: z.enum(["can-view", "can-edit", "admin"]),
})

const UpdateRoleSchema = z.object({
	intent: z.literal("updateRole"),
	memberId: z.string().uuid(),
	permission: z.enum(["can-view", "can-edit", "admin"]),
})

const DeleteInviteSchema = z.object({
	intent: z.literal("deleteInvite"),
	invitationId: z.string().uuid(),
})

export async function action({ request, params }: ActionFunctionArgs) {
	const { client } = getServerClient(request)
	const user = await getAuthenticatedUser(request)
	if (!user) return new Response("Unauthorized", { status: 401 })
	const accountId = params.accountId as string | undefined
	if (!accountId) return new Response("Missing accountId", { status: 400 })

	const formData = await request.formData()
	const intent = formData.get("intent")

	if (intent === "invite") {
		const submission = parseWithZod(formData, { schema: InviteSchema })
		if (submission.status !== "success") {
			return data({ ok: false, errors: submission.error }, { status: 400 })
		}
		const { email, permission } = submission.value
		const result = await dbCreateInvitation({
			supabase: client,
			account_id: accountId,
			account_role: mapPermissionToAccountRoleForRpc(permission),
			invitation_type: "one_time",
			invitee_email: email,
		})
		if (result.error) return data({ ok: false, message: result.error.message }, { status: 500 })
		const token =
			typeof (result.data as { token?: unknown } | null)?.token === "string"
				? (result.data as { token: string }).token
				: undefined

		// Attempt to send invitation email if we have both email and token
		if (email && token) {
			try {
				// Build absolute invite URL that preserves token through auth
				const host = PATHS.AUTH.HOST
				const inviteUrl = `${host}/accept-invite?token=${encodeURIComponent(token)}`

				consola.info("[INVITE] Prepared invite", {
					accountId,
					to: email,
					inviteUrl,
					token,
				})

				// Optionally fetch account name for nicer subject
				let teamName = "your team"
				try {
					const { data: accountData } = await dbGetAccount({ supabase: client, account_id: accountId })
					teamName = (accountData as any)?.name || teamName
				} catch { }
				const { sendEmail } = await import("~/emails/clients.server")

				const sendResult = await sendEmail({
					to: email,
					subject: `You’re invited to join ${teamName} on Upsight`,
					react: (
						<InvitationEmail
							appName="Upsight"
							inviterName={user.email || "A teammate"}
							teamName={teamName}
							inviteUrl={inviteUrl}
							inviteeEmail={email}
						/>
					),
				})
				consola.success("[INVITE] Email send attempted", {
					to: email,
					resultId: (sendResult as unknown as { id?: string })?.id,
				})
			} catch (err) {
				consola.error("[INVITE] Failed to send invitation email", {
					to: email,
					error: err,
				})
			}
		}

		return data({ ok: true, token, email })
	}

	if (intent === "updateRole") {
		const submission = parseWithZod(formData, { schema: UpdateRoleSchema })
		if (submission.status !== "success") {
			return data({ ok: false, errors: submission.error }, { status: 400 })
		}
		const { memberId, permission } = submission.value
		const result = await dbUpdateAccountUserRole({
			supabase: client,
			account_id: accountId,
			user_id: memberId,
			role: mapPermissionToAccountRoleForRpc(permission),
		})
		if (result.error) return data({ ok: false, message: result.error.message }, { status: 500 })
		return data({ ok: true })
	}

	if (intent === "deleteInvite") {
		const submission = parseWithZod(formData, { schema: DeleteInviteSchema })
		if (submission.status !== "success") {
			return data({ ok: false, errors: submission.error }, { status: 400 })
		}
		const { invitationId } = submission.value
		const result = await dbDeleteInvitation({
			supabase: client,
			invitation_id: invitationId,
		})
		if (result.error) return data({ ok: false, message: result.error.message }, { status: 500 })
		return data({ ok: true })
	}

	return new Response("Bad Request", { status: 400 })
}
export default function ManageTeamMembers() {
	const { account, members, invitations } = useLoaderData() as LoaderData
	const inviteFetcher = useFetcher()
	const updateRoleFetcher = useFetcher()
	const deleteInviteFetcher = useFetcher()
	const [localMembers, setLocalMembers] = useState<TeamMember[]>(() =>
		(members || []).map((m) => ({
			id: m.user_id,
			name: m.name,
			email: m.email,
			role: mapAccountRoleToPermission(m.account_role),
			isOwner: m.is_primary_owner,
		}))
	)
	const [localInvitations, setLocalInvitations] = useState<GetAccountInvitesResponse>(() => invitations)

	const [isRevokeOpen, setIsRevokeOpen] = useState(false)
	const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null)
	const [selectedInviteEmail, setSelectedInviteEmail] = useState<string | null>(null)

	const canManage = account?.account_role === "owner"
	const teamName = account?.name ?? "Team"
	const totalMembers = localMembers.length

	const handleInvite = useCallback(
		(email: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			inviteFetcher.submit({ intent: "invite", email, permission }, { method: "post" })
		},
		[account?.account_id, inviteFetcher]
	)

	const handleUpdateMemberPermission = useCallback(
		(memberId: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			updateRoleFetcher.submit({ intent: "updateRole", memberId, permission }, { method: "post" })
			setLocalMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: permission } : m)))
		},
		[account?.account_id, updateRoleFetcher]
	)

	const handleDeleteInvitation = useCallback(
		(invitationId: string) => {
			if (!account?.account_id) return
			deleteInviteFetcher.submit({ intent: "deleteInvite", invitationId }, { method: "post" })
			setLocalInvitations((prev) => prev.filter((inv) => inv.invitation_id !== invitationId))
		},
		[account?.account_id, deleteInviteFetcher]
	)

	return (
		<div className="container mx-auto max-w-3xl py-6">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">Team Members</h1>
				<p className="text-muted-foreground text-sm">Manage access and invite collaborators to your team.</p>
				{localInvitations.length > 0 && (
					<p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:bg-amber-950/40 dark:text-amber-300">
						You have {localInvitations.length} pending invitation{localInvitations.length === 1 ? "" : "s"}.
					</p>
				)}
			</div>

			<TeamInvite
				teamName={teamName}
				totalMembers={totalMembers}
				members={localMembers}
				onInvite={canManage ? handleInvite : undefined}
				onUpdateMemberPermission={canManage ? handleUpdateMemberPermission : undefined}
			/>

			{localInvitations.length > 0 && (
				<>
					<div className="mt-6">
						<h2 className="font-semibold text-lg">Pending invitations</h2>
						<ul className="mt-2 space-y-2">
							{localInvitations.map((inv, idx) => (
								<li key={inv.invitation_id ?? idx} className="flex items-center justify-between rounded-md border p-3">
									<span className="text-sm">
										{inv.email ? <strong>{inv.email}</strong> : "(no email)"} • Role: {inv.account_role}
									</span>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground text-xs">
											{new Date(String(inv.created_at)).toLocaleString()}
										</span>
										{canManage && (
											<Button
												variant="outline"
												size="sm"
												className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
												onClick={() => {
													setSelectedInviteId(inv.invitation_id)
													setSelectedInviteEmail(inv.email ?? null)
													setIsRevokeOpen(true)
												}}
											>
												Revoke
											</Button>
										)}
									</div>
								</li>
							))}
						</ul>
					</div>

					{/* Revoke confirmation dialog */}
					<AlertDialog
						open={isRevokeOpen}
						onOpenChange={(open) => {
							setIsRevokeOpen(open)
							if (!open) {
								setSelectedInviteId(null)
								setSelectedInviteEmail(null)
							}
						}}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Revoke invitation</AlertDialogTitle>
								<AlertDialogDescription>
									{selectedInviteEmail ? (
										<span>
											Are you sure you want to revoke the invitation for <strong>{selectedInviteEmail}</strong>?
										</span>
									) : (
										<span>Are you sure you want to revoke this invitation?</span>
									)}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									disabled={deleteInviteFetcher.state === "submitting" || !selectedInviteId}
									onClick={() => {
										if (selectedInviteId) {
											handleDeleteInvitation(selectedInviteId)
											setIsRevokeOpen(false)
											setSelectedInviteId(null)
											setSelectedInviteEmail(null)
										}
									}}
								>
									Revoke invitation
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</>
			)}
		</div>
	)
}

function mapAccountRoleToPermission(role: "owner" | "member" | "viewer"): PermissionLevel {
	switch (role) {
		case "owner":
			return "admin"
		case "member":
			return "can-edit"
		case "viewer":
		default:
			return "can-view"
	}
}
// For RPCs that only accept 'owner' | 'member'
function mapPermissionToAccountRoleForRpc(permission: PermissionLevel): "owner" | "member" {
	switch (permission) {
		case "admin":
			return "owner"
		case "can-edit":
			return "member"
		case "can-view":
		default:
			return "member" // fallback to member when 'viewer' is not supported in RPC type
	}
}
