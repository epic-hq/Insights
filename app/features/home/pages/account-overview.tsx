import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router"

import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { userContext } from "~/server/user-context"

type Project = {
	id: string
	account_id: string
	name: string | null
	description: string | null
	status: string | null
	slug: string | null
	created_at: string
	updated_at: string
}

type UserAccount = {
	account_id: string
	account_role: string
	is_primary_owner: boolean
	name: string | null
	slug: string | null
	personal_account: boolean | null
	created_at: string
	updated_at: string
	projects: Project[]
}

type AccountSummary = UserAccount & {
	projectCount: number
}

type User = {
	email?: string
	user_metadata?: {
		full_name?: string
	}
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.claims) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { supabase, accounts = [] } = ctx

	if (!supabase) {
		throw new Response("Database connection not available", { status: 500 })
	}

	// Filter business accounts from user context (accounts already include personal_account field)
	const businessAccounts = accounts.filter((account: UserAccount) => !account.personal_account)

	// Get project counts for each account
	const accountSummaries = await Promise.all(
		businessAccounts.map(async (account: UserAccount) => {
			const { count: projectCount } = await supabase
				.from("projects")
				.select("*", { count: "exact", head: true })
				.eq("account_id", account.account_id)

			return {
				...account,
				projectCount: projectCount || 0,
			}
		})
	)

	return {
		accounts: accountSummaries,
		user: ctx.claims,
	}
}

function getInitials(name: string) {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)
}

export default function AccountOverview() {
	const { accounts } = useLoaderData<{ accounts: AccountSummary[]; user: User }>()
	const navigate = useNavigate()

	// If user only has one business account, redirect to that account's home
	if (accounts.length === 1) {
		const account = accounts[0]
		navigate(`/a/${account.account_id}/home`, { replace: true })
		return null
	}

	return (
		<div className="mx-auto w-full max-w-4xl px-6 py-8">
			<div className="mb-6">
				<h2 className="font-semibold text-2xl">Accounts</h2>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{accounts.map((account: AccountSummary) => (
					<Card key={account.account_id} className="group cursor-pointer transition-all hover:shadow-md">
						<Link to={`/a/${account.account_id}/home`} className="block">
							<CardHeader className="pb-4">
								<div className="flex items-center gap-3">
									<Avatar className="h-12 w-12">
										<AvatarFallback className="font-semibold text-lg">
											{getInitials(account.name || account.account_id)}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<CardTitle className="truncate text-lg">{account.name || "Unnamed Account"}</CardTitle>
											{account.is_primary_owner && (
												<Badge variant="secondary" className="text-xs">
													Owner
												</Badge>
											)}
										</div>
										<CardDescription className="text-sm">
											{account.projectCount} {account.projectCount === 1 ? "project" : "projects"}
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="pt-0">
								<Button className="w-full" variant="outline">
									Open Account
								</Button>
							</CardContent>
						</Link>
					</Card>
				))}
			</div>

			{accounts.length === 0 && (
				<div className="py-12 text-center">
					<p className="text-muted-foreground">No accounts found. Please contact support.</p>
				</div>
			)}
		</div>
	)
}
