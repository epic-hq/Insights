/**
 * Handles protected account routes, including (team) account context resolution and authentication middleware.
 * Ensures only authenticated users can access account-specific resources and provides account data to child routes.
 *
 * Temporarily disabled get_account() validation due to issues with the rpc function access.
 */

import consola from "consola"
import { Outlet, redirect } from "react-router"
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
	userAccounts,
}: {
	user_id: string
	account_id_or_slug: string
	supabase: SupabaseClient
	userAccounts?: Array<{ account_id: string; slug: string | null }>
}) {
	consola.log("parse_account_id_from_params:", {
		account_id_or_slug,
		hasUserAccounts: !!userAccounts,
		userAccountsCount: userAccounts?.length,
	})

	// If UUID, validate against user's accounts and return the account
	if (isUUID(account_id_or_slug || "")) {
		// Validate user has access to this account
		if (userAccounts && userAccounts.length > 0) {
			const userAccount = userAccounts.find((acc) => acc.account_id === account_id_or_slug)
			consola.log("Found user account:", !!userAccount)
			if (!userAccount) {
				consola.error("User does not have access to account:", account_id_or_slug)
				throw new Response("You must be a member of an account to access it", { status: 403 })
			}
			// Return the account ID - the account object will be loaded from userContext
			return { account_id: account_id_or_slug }
		}

		consola.warn("No userAccounts available, falling back to database query")
		// Fallback: query database if userAccounts not available
		const accountQuery = supabase.schema("accounts").from("accounts").select("*").eq("id", account_id_or_slug)
		const { data: account, error } = await accountQuery.single()
		if (error) {
			consola.error("Get account error:", error)
			throw new Response("Account not found", { status: 404 })
		}
		return account
	}

	// If slug, look up in user's accounts first
	if (userAccounts) {
		const account = userAccounts.find((acc) => acc.slug === account_id_or_slug)
		if (account) {
			return { account_id: account.account_id }
		}
	}

	// Fallback to RPC for slug lookup
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
export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const ctx = context.get(userContext)
			const _supabase = ctx.supabase
			const account_id_or_slug = params?.accountId || ""

			// Get user accounts from middleware context for validation
			const userAccounts = ctx.accounts?.map((acc: any) => ({
				account_id: acc.account_id,
				slug: acc.slug,
			}))

			consola.log("_protected/accounts middleware:", {
				account_id_or_slug,
				hasAccounts: !!ctx.accounts,
				accountsCount: ctx.accounts?.length,
				userAccountsCount: userAccounts?.length,
			})

			const parsed_account = await parse_account_id_from_params({
				user_id: ctx.account_id,
				account_id_or_slug,
				supabase: _supabase,
				userAccounts,
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
