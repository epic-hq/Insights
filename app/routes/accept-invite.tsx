import consola from "consola"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useState } from "react"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { Link, useLoaderData, useNavigate } from "react-router-dom"
import { Logo } from "~/components/branding"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import { acceptInvitation, lookupInvitation } from "~/features/teams/db"
import { provisionSeatOnInviteAccept } from "~/lib/billing/polar.server"
import { getServerClient } from "~/lib/supabase/client.server"

type LoaderData =
	| {
			status: "success"
			accountId: string
			accountName: string
			accountSlug: string | null
			accountRole: string
			projectDestination: string | null
			projectName: string | null
	  }
	| {
			status: "error"
			error: string
	  }
	| {
			status: "already_member"
			accountId: string
			accountName: string
			accountSlug: string | null
			projectDestination: string | null
			projectName: string | null
	  }

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const token = url.searchParams.get("invite_token") || url.searchParams.get("token") || null
	const redirectTo = url.searchParams.get("redirect") || null

	consola.log("[ACCEPT INVITE] Received request with token:", token ? "present" : "missing", "redirect:", redirectTo)

	const { client: supabase, headers: supabaseHeaders } = getServerClient(request)

	// Check auth
	const {
		data: { user },
	} = await supabase.auth.getUser()

	// If no user, redirect to login
	if (!user) {
		let next = "/accept-invite"
		if (token) {
			next = `/accept-invite?invite_token=${encodeURIComponent(token)}`
			if (redirectTo) {
				next += `&redirect=${encodeURIComponent(redirectTo)}`
			}
		}
		consola.log("[ACCEPT INVITE] User not authenticated, redirecting to login with next:", next)
		return redirect(`/login?next=${encodeURIComponent(next)}`, {
			headers: supabaseHeaders,
		})
	}

	consola.log("[ACCEPT INVITE] User authenticated:", user.email, "proceeding with token:", token)

	if (!token) {
		consola.warn("[ACCEPT INVITE] No invitation token found")
		return {
			status: "error",
			error: "No invitation token provided",
		} satisfies LoaderData
	}

	// Lookup invitation first to get account details
	const { data: lookup, error: lookupError } = await lookupInvitation({
		supabase,
		lookup_invitation_token: token,
	})

	if (lookupError) {
		consola.error("[ACCEPT INVITE] lookup_invitation error:", lookupError)
		return {
			status: "error",
			error: "Failed to lookup invitation",
		} satisfies LoaderData
	}

	const lookupData = lookup as {
		active?: boolean
		account_name?: string
		account_id?: string
		account_role?: string
	} | null

	if (!lookupData?.active) {
		consola.warn("[ACCEPT INVITE] Invitation inactive or expired")
		return {
			status: "error",
			error: "This invitation has expired or is no longer valid",
		} satisfies LoaderData
	}

	// Accept the invitation
	const { data: accepted, error: acceptError } = await acceptInvitation({
		supabase,
		lookup_invitation_token: token,
	})

	const acceptedData = accepted as {
		account_id?: string
		account_role?: string
		slug?: string
	} | null

	const accountId = acceptedData?.account_id ?? lookupData?.account_id ?? ""

	// Fetch a project from the invited account to navigate to
	let projectDestination: string | null = null
	let projectName: string | null = null

	if (accountId) {
		const { data: projects } = await supabase
			.from("projects")
			.select("id, name")
			.eq("account_id", accountId)
			.order("updated_at", { ascending: false })
			.limit(1)

		if (projects && projects.length > 0) {
			const project = projects[0]
			projectDestination = `/a/${accountId}/${project.id}`
			projectName = project.name
		} else {
			// No projects yet, go to account home
			projectDestination = `/a/${accountId}/home`
		}
	}

	if (acceptError) {
		const msg = acceptError.message || ""
		consola.warn("[ACCEPT INVITE] accept_invitation error:", msg)

		// If already a member, show that state
		if (msg.includes("already a member")) {
			return {
				status: "already_member",
				accountId,
				accountName: lookupData?.account_name ?? "the team",
				accountSlug: acceptedData?.slug ?? null,
				projectDestination,
				projectName,
			} satisfies LoaderData
		}

		return {
			status: "error",
			error: msg || "Failed to accept invitation",
		} satisfies LoaderData
	}

	// Auto-provision seat for Team plan subscriptions
	// This runs after the invite is accepted (user added to account_user)
	if (accountId) {
		try {
			const seatProvisioned = await provisionSeatOnInviteAccept({ accountId })
			if (seatProvisioned) {
				consola.info("[ACCEPT INVITE] Seat provisioned for Team plan", {
					accountId,
				})
			}
		} catch (seatError) {
			// Don't fail the invite acceptance if seat provisioning fails
			// The team admin can manually adjust seats via billing portal
			consola.warn("[ACCEPT INVITE] Seat provisioning failed (non-blocking)", {
				accountId,
				error: seatError,
			})
		}
	}

	return {
		status: "success",
		accountId,
		accountName: lookupData?.account_name ?? "the team",
		accountSlug: acceptedData?.slug ?? null,
		accountRole: acceptedData?.account_role ?? "member",
		projectDestination,
		projectName,
	} satisfies LoaderData
}

export default function AcceptInvite() {
	const data = useLoaderData<LoaderData>()
	const navigate = useNavigate()
	const [isNavigating, setIsNavigating] = useState(false)

	const handleGoToTeam = () => {
		if (data.status === "success" || data.status === "already_member") {
			setIsNavigating(true)
			if (data.projectDestination) {
				navigate(data.projectDestination)
			} else {
				navigate("/home")
			}
		}
	}

	const handleStayHere = () => {
		// Go back to where they were, or home if no history
		if (window.history.length > 1) {
			navigate(-1)
		} else {
			navigate("/home")
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
			<Card className="w-full max-w-md border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
				<CardHeader className="flex flex-col items-center gap-4 pb-2">
					<Logo size={10} />
				</CardHeader>

				<CardContent className="space-y-4 text-center">
					{data.status === "success" && (
						<>
							<div className="flex justify-center">
								<div className="rounded-full bg-emerald-500/20 p-3">
									<CheckCircle2 className="h-8 w-8 text-emerald-400" />
								</div>
							</div>
							<div>
								<h1 className="font-semibold text-xl">Welcome to the Team!</h1>
								<p className="mt-2 text-white/70">
									You&apos;ve joined <span className="font-medium text-white">{data.accountName}</span> as a{" "}
									{data.accountRole}.
								</p>
							</div>
						</>
					)}

					{data.status === "already_member" && (
						<>
							<div className="flex justify-center">
								<div className="rounded-full bg-blue-500/20 p-3">
									<CheckCircle2 className="h-8 w-8 text-blue-400" />
								</div>
							</div>
							<div>
								<h1 className="font-semibold text-xl">Already a Member</h1>
								<p className="mt-2 text-white/70">
									You&apos;re already part of <span className="font-medium text-white">{data.accountName}</span>.
								</p>
							</div>
						</>
					)}

					{data.status === "error" && (
						<>
							<div className="flex justify-center">
								<div className="rounded-full bg-red-500/20 p-3">
									<XCircle className="h-8 w-8 text-red-400" />
								</div>
							</div>
							<div>
								<h1 className="font-semibold text-xl">Unable to Accept Invitation</h1>
								<p className="mt-2 text-white/70">{data.error}</p>
							</div>
						</>
					)}
				</CardContent>

				<CardFooter className="flex flex-col gap-3 pt-2">
					{(data.status === "success" || data.status === "already_member") && (
						<>
							<Button onClick={handleGoToTeam} disabled={isNavigating} className="w-full">
								{isNavigating ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Loading...
									</>
								) : (
									<>
										Go to {data.accountName}
										{data.projectName && <span className="ml-1 text-white/70">({data.projectName})</span>}
									</>
								)}
							</Button>
							<Button onClick={handleStayHere} variant="ghost" className="w-full text-white/70 hover:text-white">
								Stay in current project
							</Button>
						</>
					)}

					{data.status === "error" && (
						<Button asChild variant="secondary">
							<Link to="/home">Go to Home</Link>
						</Button>
					)}
				</CardFooter>
			</Card>
		</div>
	)
}
