import { Link, useLoaderData, useNavigate } from "react-router"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { userContext } from "~/server/user-context"

export async function loader({ context }: any) {
	const ctx = context.get(userContext)
	if (!ctx?.claims) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { supabase, accounts = [] } = ctx

	// Get project counts for each account
	const accountSummaries = await Promise.all(
		accounts.map(async (account: any) => {
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
	const { accounts, user } = useLoaderData<typeof loader>()
	const navigate = useNavigate()

	const displayName = user?.user_metadata?.full_name || user?.email || "User"

	// If user only has one account, redirect to that account's home
	if (accounts.length === 1) {
		const account = accounts[0]
		navigate(`/a/${account.account_id}/home`, { replace: true })
		return null
	}

	return (
		<div className="mx-auto w-full max-w-4xl px-6 py-8">
			<div className="mb-8 text-center">
				<h1 className="font-semibold text-3xl">Welcome back, {displayName.split(" ")[0]}!</h1>
				<p className="mt-2 text-muted-foreground">
					Choose an account to continue working with your research and sales data.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{accounts.map((account: any) => (
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
										<CardTitle className="truncate text-lg">{account.name || "Unnamed Account"}</CardTitle>
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
