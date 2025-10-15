import { parseWithZod } from "@conform-to/zod/v4"
import consola from "consola"
import posthog from "posthog-js"
import { useCallback, useEffect, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, useLoaderData, useNavigation } from "react-router"
import { useSubmit } from "react-router-dom"
import { z } from "zod"
import { PageContainer } from "~/components/layout/PageContainer"
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
	acceptInvitation as dbAcceptInvitation,
	createInvitation as dbCreateInvitation,
	deleteInvitation as dbDeleteInvitation,
	getAccountInvitations as dbGetAccountInvitations,
	lookupInvitation as dbLookupInvitation,
} from "../db/invitations"

type MembersRow = {
	user_id: string
	name: string
	email: string
	account_role: "owner" | "member" | "viewer"
	is_primary_owner: boolean
}

type InvitationAcceptanceState = {
	status: "idle" | "accepted" | "inactive" | "error"
	message?: string
}

type LoaderData = {
	account: {
		account_id: string
		name: string | null
		personal_account: boolean
		account_role: "owner" | "member" | "viewer"
	} | null
	members: MembersRow[]
	invitations: GetAccountInvitesResponse
	inviteAcceptance: InvitationAcceptanceState
}
export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client } = getServerClient(request)
	const user = await getAuthenticatedUser(request)
	if (!user) throw new Response("Unauthorized", { status: 401 })

	const accountId = params.accountId as string | undefined
	if (!accountId) throw new Response("Missing accountId", { status: 400 })

	const url = new URL(request.url)
	const inviteToken = url.searchParams.get("invite_token")?.trim() || null
	let inviteAcceptance: InvitationAcceptanceState = { status: "idle" }

	if (inviteToken) {
		const { data: lookupData, error: lookupError } = await dbLookupInvitation({
			supabase: client,
			lookup_invitation_token: inviteToken,
		})
		if (lookupError) {
			inviteAcceptance = {
				status: "error",
				message: lookupError.message || "We couldn't validate this invitation.",
			}
		} else {
			const lookup = (lookupData as Record<string, unknown> | null) ?? null
			const lookupAccountId = (lookup?.account_id as string | undefined) ?? null
			const isActive = Boolean(lookup?.active)

			if (!lookupAccountId || lookupAccountId !== accountId) {
				inviteAcceptance = {
					status: "error",
					message: "This invitation doesn't match the selected team.",
				}
			} else if (!isActive) {
				inviteAcceptance = {
					status: "inactive",
					message: "This invitation has already been used or has expired.",
				}
			} else {
				const { error: acceptError } = await dbAcceptInvitation({
					supabase: client,
					lookup_invitation_token: inviteToken,
				})
				if (acceptError) {
					inviteAcceptance = {
						status: "error",
						message: acceptError.message || "We couldn't accept this invitation.",
					}
				} else {
					inviteAcceptance = {
						status: "accepted",
						message: "Invitation accepted. You're now on this team.",
					}

					// Capture invite_accepted event
					try {
						const inviterUserId = (lookup?.inviter_user_id as string | undefined) ?? null
						const role = (lookup?.account_role as "owner" | "member" | "viewer" | undefined) ?? "member"

						posthog.capture("invite_accepted", {
							account_id: accountId,
							inviter_user_id: inviterUserId,
							role,
						})

						// Update user lifecycle
						posthog.identify(user.sub, {
							$set: {
								team_member: true,
								last_team_joined_at: new Date().toISOString(),
							},
						})
					} catch (trackingError) {
						consola.warn("[INVITE] PostHog tracking failed:", trackingError)
					}
				}
			}
		}
	}

	const { data: account, error: accountError } = await dbGetAccount({ supabase: client, account_id: accountId })
	if (accountError) throw new Response(accountError.message, { status: 500 })

	const normalizedAccount = account
		? {
				account_id: accountId,
				name: ((account as Record<string, unknown>)?.name as string | null | undefined) ?? null,
				personal_account: Boolean(
					(account as Record<string, unknown>)?.personal_account ??
						(account as Record<string, unknown>)?.personalAccount
				),
				account_role: ((account as Record<string, unknown>)?.account_role ?? "viewer") as "owner" | "member" | "viewer",
			}
		: null

	let members: MembersRow[] = []
	let invitations: GetAccountInvitesResponse = []
	if (normalizedAccount?.account_role === "owner") {
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

	const data: LoaderData = {
		account: normalizedAccount,
		members,
		invitations,
		inviteAcceptance,
	}
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
				const inviteUrl = `${host}/accept-invite?invite_token=${encodeURIComponent(token)}`

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
					if (
						accountData &&
						typeof accountData === "object" &&
						"name" in accountData &&
						typeof accountData.name === "string"
					) {
						teamName = accountData.name
					}
				} catch {}
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

		// Capture invite_sent event
		try {
			posthog.capture("invite_sent", {
				account_id: accountId,
				invitee_email: email,
				role: mapPermissionToAccountRoleForRpc(permission),
				invitation_type: "one_time",
			})
		} catch (trackingError) {
			consola.warn("[INVITE] PostHog tracking failed:", trackingError)
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
	const { account, members, invitations, inviteAcceptance } = useLoaderData() as LoaderData
	const submit = useSubmit()
	const navigation = useNavigation()

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

	// Keep local state in sync with loader data after automatic revalidation
	useEffect(() => {
		setLocalMembers(
			(members || []).map((m) => ({
				id: m.user_id,
				name: m.name,
				email: m.email,
				role: mapAccountRoleToPermission(m.account_role),
				isOwner: m.is_primary_owner,
			}))
		)
	}, [members])

	useEffect(() => {
		setLocalInvitations(invitations)
	}, [invitations])

	const canManage = account?.account_role === "owner"
	const teamName = getAccountDisplayName(account)
	const totalMembers = localMembers.length

	const handleInvite = useCallback(
		async (email: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			submit({ intent: "invite", email, permission }, { method: "post", replace: true })
		},
		[account?.account_id, submit]
	)

	const handleUpdateMemberPermission = useCallback(
		async (memberId: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			setLocalMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: permission } : m)))
			submit({ intent: "updateRole", memberId, permission }, { method: "post", replace: true })
			return null
		},
		[account?.account_id, submit]
	)

	const handleDeleteInvitation = useCallback(
		async (invitationId: string) => {
			if (!account?.account_id) return
			setLocalInvitations((prev) => prev.filter((inv) => inv.invitation_id !== invitationId))
			submit({ intent: "deleteInvite", invitationId }, { method: "post", replace: true })
			return null
		},
		[account?.account_id, submit]
	)

	return (
		<PageContainer size="sm" padded={false} className="container max-w-3xl py-6">
			<div className="mb-6 space-y-2">
				<h1 className="font-semibold text-2xl">Team Members</h1>
				<p className="text-muted-foreground text-sm">
					Manage access and invite collaborators for <span className="font-medium text-foreground">{teamName}</span>.
				</p>
				{inviteAcceptance.status !== "idle" && inviteAcceptance.message && (
					<div
						className={
							inviteAcceptance.status === "accepted"
								? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
								: inviteAcceptance.status === "inactive"
									? "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
									: "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
						}
					>
						{inviteAcceptance.message}
					</div>
				)}
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
							</AlertDialogHeader>
							<AlertDialogDescription>
								{selectedInviteEmail ? (
									<span>
										Are you sure you want to revoke the invitation for <strong>{selectedInviteEmail}</strong>?
									</span>
								) : (
									<span>Are you sure you want to revoke this invitation?</span>
								)}
							</AlertDialogDescription>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									disabled={navigation.state === "submitting" || !selectedInviteId}
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
		</PageContainer>
	)
}

function mapAccountRoleToPermission(role: "owner" | "member" | "viewer"): PermissionLevel {
	switch (role) {
		case "owner":
			return "admin"
		case "member":
			return "can-edit"
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
		default:
			return "member" // fallback to member when 'viewer' is not supported in RPC type
	}
}

function getAccountDisplayName(account: LoaderData["account"]): string {
	if (!account) return "Team"
	const baseName = account.name?.trim()
	if (account.personal_account) {
		return baseName && baseName.length > 0 ? `${baseName} (Personal)` : "Personal Workspace"
	}
	return baseName && baseName.length > 0 ? baseName : "Team"
}
