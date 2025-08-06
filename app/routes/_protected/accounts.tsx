/**
 * Handles protected account routes, including (team) account context resolution and authentication middleware.
 * Ensures only authenticated users can access account-specific resources and provides account data to child routes.
 *
 * Temporarily disabled get_account() validation due to issues with the rpc function access.
 */

import consola from "consola"
import { Outlet, redirect } from "react-router-dom"
import { z } from "zod"
import { CurrentAccountProvider } from "~/contexts/current-account-context"
import { currentAccountContext } from "~/server/current-account-context"
import { userContext } from "~/server/user-context"
import type { GetAccount, SupabaseClient } from "~/types"
import type { Route } from "../../types/root"

function isUUID(str: string) {
	const uuidSchema = z.string().uuid()
	const isValid = uuidSchema.safeParse(str).success
	return isValid
}

async function parse_account_id_from_params({
	user_id,
	account_id_or_slug,
	supabase,
}: {
	user_id: string
	account_id_or_slug: string
	supabase: SupabaseClient
}) {
	// Testing direct call
	// const query = supabase.from("accounts.accounts").select("*").eq("account_id", account_id_or_slug)
	// const { data: account, error } = await query.single()
	// if (error) {
	// 	consola.error("Get account error:", error)
	// 	throw new Response("Account not found", { status: 404 })
	// }
	// if (account) {
	// 	consola.log("Get account success:", account)
	// 	return account
	// }

	if (isUUID(account_id_or_slug || "")) {
		// consola.log("Get account by id ", account_id_or_slug)
		const accountQuery = supabase.schema("accounts").from("accounts").select("*").eq("id", account_id_or_slug)
		const { data: account, error } = await accountQuery.single()
		if (error) {
			consola.error("Get account error:", error)
		}
		const account_usersQuery = supabase.schema("accounts").from("account_user").select("*").eq("user_id", user_id)
		const { data: account_users, error: account_users_error } = await account_usersQuery
		// consola.log("/accounts: Account users:", account_users)

		const _current_user_role = await supabase.rpc("current_user_account_role", { p_account_id: account_id_or_slug })
		// consola.log("/accounts: Current user role:", current_user_role)

		const { data: accountsList } = await supabase.rpc("get_accounts")
		consola.log(
			"/accounts: Accounts list:",
			accountsList?.map((a) => a.account_id)
		)

		const getAccountResponse = await supabase.rpc("get_account", { account_id: account_id_or_slug })
		consola.log("/accounts: Get account response:", getAccountResponse)
		if (account) {
			return account
		}

		// HIDE FOR TESTING
		// if (!getAccountResponse.data) {
		// 	consola.error("Get account error:", getAccountResponse.error)
		// 	throw new Response("Account not found", { status: 404 })
		// }
		// if (getAccountResponse.error) {
		// 	consola.error("Get account error:", getAccountResponse.error)
		// 	throw new Response(getAccountResponse.error.message, { status: 500 })
		// }
		// const data = getAccountResponse.data as GetAccount
		// return data
	}
	// slug
	const getAccountBySlugResponse = await supabase.rpc("get_account_by_slug", {
		slug: account_id_or_slug,
	})
	if (!getAccountBySlugResponse.data) {
		consola.error("Get account error:", getAccountBySlugResponse.error)
		throw new Response("Account not found", { status: 404 })
	}
	if (getAccountBySlugResponse.error) {
		consola.error("Get account id error:", getAccountBySlugResponse.error)
		throw new Response(getAccountBySlugResponse.error.message, { status: 500 })
	}
	const data = getAccountBySlugResponse.data as GetAccount
	return data
}

// Server-side Authentication Middleware
// This middleware runs before every loader in current-project-layout routes
// It ensures the user is authenticated and sets up the user context
export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const ctx = context.get(userContext)
			const _supabase = ctx.supabase
			const account_id_or_slug = params?.accountId || ""

			const parsed_account = await parse_account_id_from_params({
				user_id: ctx.account_id,
				account_id_or_slug,
				supabase: _supabase,
			})

			// Set user context for all child loaders/actions to access
			context.set(currentAccountContext, {
				current_account_id: parsed_account?.account_id,
				account: parsed_account,
			})
			// current_account_id: account_id_or_slug,
			// account: {},
			// consola.log("_protected/accounts currentAccountContext", parsed_account.account_id)
		} catch (error) {
			consola.error("_protected/accounts Authentication middleware error:", error)
			throw redirect("/login")
		}
	},
]

export async function loader({ context }: Route.LoaderArgs) {
	try {
		const currentProject = context.get(currentAccountContext)

		return {
			...currentProject,
		}
	} catch (error) {
		consola.error("_protected/accounts loader error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

export default function Accounts() {
	// const currentProject = useLoaderData<typeof loader>()
	// consola.log("Accounts currentAccountContext:", currentProject)

	return (
		<CurrentAccountProvider>
			<Outlet />
		</CurrentAccountProvider>
	)
}
