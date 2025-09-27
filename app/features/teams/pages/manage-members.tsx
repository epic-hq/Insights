import { parseWithZod } from "@conform-to/zod/v4"
import { useCallback, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { data, useLoaderData } from "react-router"
import { useFetcher } from "react-router-dom"
import { z } from "zod"
import { type PermissionLevel, TeamInvite, type TeamMember } from "~/components/ui/team-invite"
// import { useNotification } from "~/contexts/NotificationContext"
// import { getSupabaseClient } from "~/lib/supabase/client"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import {
	getAccount as dbGetAccount,
	getAccountMembers as dbGetAccountMembers,
	updateAccountUserRole as dbUpdateAccountUserRole,
} from "../db/accounts"
import { createInvitation as dbCreateInvitation } from "../db/invitations"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client } = getServerClient(request)
	const user = await getAuthenticatedUser(request)

	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const accountId = params.accountId as string | undefined
	if (!accountId) {
		throw new Response("Missing accountId", { status: 400 })
	}

	// Fetch account context first to know user role
	const { data: account, error: accountError } = await dbGetAccount({ supabase: client, account_id: accountId })

	if (accountError) {
		throw new Response(accountError.message, { status: 500 })
	}

	let members = []
	// Only owners can access members via RPC; if not owner, we still render page with limited capabilities
	if (account?.account_role === "owner") {
		const { data: membersData, error: membersError } = await dbGetAccountMembers({
			supabase: client,
			account_id: accountId,
		})
		if (membersError) {
			// Surface error to client; helps debug RLS
			throw new Response(membersError.message, { status: 500 })
		}
		members = (membersData) ?? []
	}

	const data = {
		account: account ?? null,
		members,
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
	const { account, members } = useLoaderData()
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

	const totalMembers = localMembers.length

	const teamName = account?.name ?? "Team"

	const handleInvite = useCallback(
		async (email: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			inviteFetcher.submit(
				{
					intent: "invite",
					email,
					permission,
				},
				{ method: "post" }
			)
		},
		[account?.account_id, inviteFetcher]
	)

	const handleUpdateMemberPermission = useCallback(
		async (memberId: string, permission: PermissionLevel) => {
			if (!account?.account_id) return
			updateRoleFetcher.submit(
				{
					intent: "updateRole",
					memberId,
					permission,
				},
				{ method: "post" }
			)
			// Optimistic update
			setLocalMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: permission } : m)))
		},
		[account?.account_id, updateRoleFetcher]
	)

	const canManage = account?.account_role === "owner"

	return (
		<div className="container mx-auto max-w-3xl py-6">
			<div className="mb-6">
				<h1 className="font-semibold text-2xl">Team Members</h1>
				<p className="text-muted-foreground text-sm">Manage access and invite collaborators to your team.</p>
				{!canManage && (
					<p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-700 text-sm dark:bg-amber-950/40 dark:text-amber-300">
						You are not an owner of this account. You can view members but cannot manage permissions or create
						invitations.
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
