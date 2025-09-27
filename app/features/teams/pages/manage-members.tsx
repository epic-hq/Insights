import { parseWithZod } from "@conform-to/zod/v4"
import { useCallback, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, useLoaderData } from "react-router"
import { useFetcher } from "react-router-dom"
import { z } from "zod"
import { type PermissionLevel, TeamInvite, type TeamMember } from "~/components/ui/team-invite"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import type { GetAccountInvitesResponse } from "~/types-accounts"
import {
	getAccount as dbGetAccount,
	getAccountMembers as dbGetAccountMembers,
	updateAccountUserRole as dbUpdateAccountUserRole,
} from "../db/accounts"
import {
	createInvitation as dbCreateInvitation,
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

	return new Response("Bad Request", { status: 400 })
}
export default function ManageTeamMembers() {
	const { account, members, invitations } = useLoaderData() as LoaderData
	const inviteFetcher = useFetcher()
	const updateRoleFetcher = useFetcher()
	const [localMembers, setLocalMembers] = useState<TeamMember[]>(() =>
		(members || []).map((m) => ({
			id: m.user_id,
			name: m.name,
			email: m.email,
			role: mapAccountRoleToPermission(m.account_role),
			isOwner: m.is_primary_owner,
		}))
	)

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

	return (
		<div className="container mx-auto max-w-3xl py-6">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">Team Members</h1>
				<p className="text-muted-foreground text-sm">Manage access and invite collaborators to your team.</p>
				{invitations.length > 0 && (
					<p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:bg-amber-950/40 dark:text-amber-300">
						You have {invitations.length} pending invitation{invitations.length === 1 ? "" : "s"}.
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

			{invitations.length > 0 && (
				<div className="mt-6">
					<h2 className="font-semibold text-lg">Pending invitations</h2>
					<ul className="mt-2 space-y-2">
						{invitations.map((inv, idx) => (
							<li key={inv.invitation_id ?? idx} className="flex items-center justify-between rounded-md border p-3">
								<span className="text-sm">
									{inv.email ? <strong>{inv.email}</strong> : "(no email)"} • Role: {inv.account_role}
								</span>
								<span className="text-muted-foreground text-xs">
									{new Date(String(inv.created_at)).toLocaleString()}
								</span>
							</li>
						))}
					</ul>
				</div>
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
