import { AlertTriangle, ArrowLeft, Cpu, Headset, Layers3, Sparkle } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function ConversationLensesGuide() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Conversation Lenses</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				How Insights assembles SPICED, BANT, MEDDIC, MAP, and team-specific perspectives so product, engineering, and
				GTM stay aligned on every interview.
			</p>

			<div className="space-y-10">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Layers3 className="h-5 w-5 text-primary" />
							What lives inside a lens?
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Each lens is a structured snapshot of the interview. Think of it as a page in the deal playbook — a
							concise key takeaway, the supporting notes, and the evidence you can drill into when someone asks “where
							did that come from?”
						</p>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
								<h3 className="mb-2 font-semibold text-foreground text-sm uppercase tracking-wide">Sales frameworks</h3>
								<ul className="space-y-2 text-muted-foreground text-sm">
									<li>
										<Badge variant="outline" className="mr-2 text-[0.65rem] uppercase">
											SPICED
										</Badge>
										Situation, Pain, Impact, Critical Event, Decision
									</li>
									<li>
										<Badge variant="outline" className="mr-2 text-[0.65rem] uppercase">
											BANT / GPCT
										</Badge>
										Budget, Authority, Need, Timeline / Goals, Plans, Challenges
									</li>
									<li>
										<Badge variant="outline" className="mr-2 text-[0.65rem] uppercase">
											MEDDIC
										</Badge>
										Metrics, Economic Buyer, Decision Criteria & Process, Identify Pain, Champion
									</li>
									<li>
										<Badge variant="outline" className="mr-2 text-[0.65rem] uppercase">
											MAP
										</Badge>
										Mutual action plan milestones, owners, and due dates
									</li>
								</ul>
							</div>
							<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
								<h3 className="mb-2 font-semibold text-foreground text-sm uppercase tracking-wide">Team lenses</h3>
								<ul className="space-y-2 text-muted-foreground text-sm">
									<li className="flex items-center gap-2">
										<Cpu className="h-4 w-4 text-indigo-500" />
										<b className="text-foreground">Engineering Impact</b>
										<span className="text-muted-foreground text-xs">integration work, API gaps, tech debt</span>
									</li>
									<li className="flex items-center gap-2">
										<Headset className="h-4 w-4 text-blue-500" />
										<b className="text-foreground">Customer Service</b>
										<span className="text-muted-foreground text-xs">support expectations and service risks</span>
									</li>
									<li className="flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-rose-500" />
										<b className="text-foreground">Pessimistic</b>
										<span className="text-muted-foreground text-xs">
											open objections, blockers, worst-case scenarios
										</span>
									</li>
								</ul>
								<p className="mt-3 text-muted-foreground text-sm">
									These lenses pull from empathy maps, open questions, and interview notes so non-sellers can see what
									matters without digging through the transcript.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkle className="h-5 w-5 text-primary" />
							Where the data comes from
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<p>
							When an interview finishes processing, Trigger.dev runs{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 text-foreground text-xs">
								buildInitialSalesLensExtraction
							</code>{" "}
							(<code>app/utils/salesLens.server.ts</code>). That task reads evidence, attendees, and observations, then
							persists the structured snapshot into the <code>sales_lens_*</code> tables:
						</p>
						<ul className="space-y-2 text-sm">
							<li>
								<b>sales_lens_summaries</b> – one row per framework with top-level metadata, attendee list, and hygiene
								flags.
							</li>
							<li>
								<b>sales_lens_slots</b> – the individual fields (Budget status, Champion, Timeline, etc.) with text,
								confidence, owners, and linked evidence.
							</li>
							<li>
								<b>sales_lens_stakeholders</b> – the people and influence labels resolved from the call.
							</li>
							<li>
								<b>sales_lens_hygiene_events</b> – gaps and alerts (missing owner, stale evidence) that show up as
								hygiene badges in the UI.
							</li>
						</ul>
						<p>
							The new team-focused lenses load their defaults from interview context (high impact themes, empathy map
							signals, open questions) and store edits inside{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 text-foreground text-xs">
								interviews.conversation_analysis → custom_lenses
							</code>{" "}
							(same JSON blob that powers AI takeaways).
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkle className="h-5 w-5 text-primary" />
							Editing & overrides
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<ol className="list-decimal space-y-2 pl-6 text-sm">
							<li>
								Hover a lens header and click the inline text to edit the key takeaway. The editor updates the
								<code>custom_lenses.[lensId].summary</code> field and saves through{" "}
								<code className="rounded bg-muted px-1.5 py-0.5 text-foreground text-xs">POST /api/update-lens</code>.
							</li>
							<li>
								The notes panel underneath each lens writes to <code>custom_lenses.[lensId].notes</code>. These notes
								always win over auto-generated defaults.
							</li>
							<li>
								The rest of the table (slots, stakeholders, hygiene) still comes from Supabase. When the AI reruns, new
								slot values appear but your manual lens notes remain intact.
							</li>
						</ol>
						<div className="rounded-lg border border-border/60 border-dashed bg-muted/10 p-4 text-sm">
							<p className="font-medium text-foreground">Tip</p>
							<p className="mt-1">
								If you want to version-control overrides, export the <code>conversation_analysis.custom_lenses</code>{" "}
								JSON — it is a lightweight, human-readable map of your manual tweaks.
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Cpu className="h-5 w-5 text-primary" />
							How updates flow
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<ul className="space-y-2 text-sm">
							<li>
								<b>1. Processing finishes.</b> Trigger.dev writes new rows into the <code>sales_lens_*</code> tables.
							</li>
							<li>
								<b>2. Loader combines data.</b> <code>loadInterviewSalesLens</code> reads Supabase, merges hygiene,
								stakeholders, and slots, then the Remix loader augments it with{" "}
								<code>conversation_analysis.custom_lenses</code>.
							</li>
							<li>
								<b>3. UI renders accordions.</b> <code>SalesLensesSection</code> displays each lens with inline editing,
								highlight pills, and the slot table.
							</li>
							<li>
								<b>4. Manual edits.</b> Inline edits call <code>/api/update-lens</code>, which updates the JSON column
								only — the AI can safely refresh without wiping human input.
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
