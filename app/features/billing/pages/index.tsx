import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

export default function BillingPage() {
	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold">Billing</h1>
				<p className="text-muted-foreground">Plans and usage billed via Polar.sh.</p>
			</div>

			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Individual Plans</CardTitle>
						<CardDescription>Per-user billing for individual seats.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
							<span className="text-lg font-semibold">$20/user/mo</span>
							<span className="text-muted-foreground">
								Includes 15 hours of recording & processing per month
							</span>
						</div>
						<Separator />
						<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
							<span className="text-lg font-semibold">$40/user/mo</span>
							<span className="text-muted-foreground">Includes 40 hours, longer retention</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Team Plan</CardTitle>
						<CardDescription>Best for collaborative workspaces.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="text-lg font-semibold">$90/mo</div>
						<ul className="list-disc space-y-1 pl-5 text-muted-foreground">
							<li>Includes 3 users</li>
							<li>Onboarding support</li>
						</ul>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Usage-Based Add-ons</CardTitle>
						<CardDescription>Scale as your usage grows.</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="list-disc space-y-1 pl-5 text-muted-foreground">
							<li>Minimum monthly fee applies</li>
							<li>Additional usage via credits (buy more as needed)</li>
							<li>Sales CRM insights & export included or as a paid add-on</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
