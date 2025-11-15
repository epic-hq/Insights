import { AlertCircle, ArrowLeft, Briefcase, CheckCircle2, Lightbulb, Link2, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function CRMOpportunitiesGuide() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">CRM & Opportunities</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Turn discovery conversations into actionable deal intelligence with built-in CRM features and AI-powered deal
				coaching.
			</p>

			<div className="space-y-10">
				{/* Overview */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Briefcase className="h-5 w-5 text-primary" />
							Overview
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							The CRM & Opportunities feature transforms customer conversations into structured sales intelligence.
							Every interview can be linked to an opportunity, automatically extracting stakeholder relationships, next
							steps, and deal context. The AI Deal Advisor then analyzes this data to provide strategic recommendations
							for advancing deals.
						</p>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
								<h4 className="mb-2 font-semibold text-foreground text-sm">Key Capabilities</h4>
								<ul className="space-y-1 text-muted-foreground text-sm">
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>Create and manage opportunities (deals)</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>Link conversations to opportunities</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>Track stakeholders with role classification</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>Extract and manage next steps with ownership</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>Get AI-powered deal advice</span>
									</li>
								</ul>
							</div>
							<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-3">
								<p className="font-medium text-foreground text-sm">💡 Quick Start</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Record a customer conversation → Create an opportunity → Link the conversation → Get AI advice. The
									entire workflow takes under 5 minutes!
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Creating Opportunities */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								1
							</span>
							Creating Opportunities
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Create opportunities directly from the CRM page or while processing an interview.
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">From the Opportunities Page</h4>
								<ol className="list-decimal space-y-1 pl-5 text-muted-foreground text-sm">
									<li>Navigate to CRM in the sidebar</li>
									<li>Click "+ New Opportunity" in the header</li>
									<li>Fill in: Title (required), Stage, Amount, Close Date, Product/Solution, Notes</li>
									<li>Click "Create Opportunity"</li>
								</ol>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">From a Conversation</h4>
								<ol className="list-decimal space-y-1 pl-5 text-muted-foreground text-sm">
									<li>Open an interview detail page</li>
									<li>Click "Link to Opportunity"</li>
									<li>Click "Create New Opportunity"</li>
									<li>System pre-fills fields based on conversation context</li>
									<li>Review and save</li>
								</ol>
							</div>
						</div>
						<div className="rounded-lg border-amber-500 border-l-4 bg-amber-50 p-3 dark:bg-amber-950/20">
							<p className="font-medium text-sm">⚡ Tip</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Creating opportunities from conversations automatically links the interview and extracts stakeholder
								information.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Linking Conversations */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								2
							</span>
							Linking Conversations to Opportunities
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Linking interviews enables automatic extraction of stakeholders, next steps, and deal context.
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">What Happens When You Link</h4>
								<ul className="space-y-1 text-muted-foreground text-sm">
									<li className="flex items-start gap-2">
										<Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<span>
											<strong className="text-foreground">Extracts stakeholders</strong> from the conversation with role
											classification (Decision Maker, Influencer, Blocker)
										</span>
									</li>
									<li className="flex items-start gap-2">
										<Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<span>
											<strong className="text-foreground">Identifies next steps</strong> with owners and timing
										</span>
									</li>
									<li className="flex items-start gap-2">
										<Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<span>
											<strong className="text-foreground">Analyzes the conversation</strong> using sales frameworks
											(BANT, MEDDIC, SPICED)
										</span>
									</li>
									<li className="flex items-start gap-2">
										<Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										<span>
											<strong className="text-foreground">Updates the opportunity</strong> with fresh insights
										</span>
									</li>
								</ul>
							</div>
						</div>
						<div className="rounded-lg border-border/60 border-dashed bg-muted/10 p-3 text-sm">
							<p className="font-medium text-foreground">Note</p>
							<p className="mt-1 text-muted-foreground">
								The Sales Lens analysis runs in the background. You'll see stakeholders and next steps appear within 1-2
								minutes.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Managing Stakeholders */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							Managing Stakeholders
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							The Stakeholder Matrix provides a centralized view of all people involved in the deal, extracted from
							linked conversations.
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">Stakeholder Types</h4>
								<div className="grid gap-2 text-sm">
									<div className="flex items-center gap-3 rounded border border-border/60 bg-muted/10 p-2">
										<Badge variant="destructive" className="shrink-0">
											DM
										</Badge>
										<div>
											<strong className="text-foreground">Decision Maker</strong> - Has final authority to approve the
											purchase
										</div>
									</div>
									<div className="flex items-center gap-3 rounded border border-border/60 bg-muted/10 p-2">
										<Badge variant="default" className="shrink-0 bg-yellow-500">
											I
										</Badge>
										<div>
											<strong className="text-foreground">Influencer</strong> - Provides input and recommendations
										</div>
									</div>
									<div className="flex items-center gap-3 rounded border border-border/60 bg-muted/10 p-2">
										<Badge variant="secondary" className="shrink-0 bg-blue-500 text-white">
											B
										</Badge>
										<div>
											<strong className="text-foreground">Blocker</strong> - Can prevent or delay the purchase
										</div>
									</div>
									<div className="flex items-center gap-3 rounded border border-border/60 bg-muted/10 p-2">
										<Badge variant="outline" className="shrink-0">
											-
										</Badge>
										<div>
											<strong className="text-foreground">Unknown</strong> - Role not yet determined
										</div>
									</div>
								</div>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">Influence Levels</h4>
								<div className="space-y-1 text-muted-foreground text-sm">
									<div className="flex items-start gap-2">
										<TrendingUp className="mt-0.5 h-4 w-4 text-green-600" />
										<div>
											<strong className="text-foreground">High</strong> - Can make or break the deal (C-level, VP,
											Budget holder)
										</div>
									</div>
									<div className="flex items-start gap-2">
										<TrendingUp className="mt-0.5 h-4 w-4 text-yellow-600" />
										<div>
											<strong className="text-foreground">Medium</strong> - Strong voice but not final say (Director,
											Manager, Champion)
										</div>
									</div>
									<div className="flex items-start gap-2">
										<TrendingUp className="mt-0.5 h-4 w-4 text-gray-400" />
										<div>
											<strong className="text-foreground">Low</strong> - Limited impact on decision (End user, Analyst)
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-3">
							<p className="font-medium text-foreground text-sm">💡 Editing Stakeholders</p>
							<p className="mt-1 text-muted-foreground text-sm">
								All fields are inline-editable. Click any cell in the matrix to edit. Changes save automatically.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* AI Deal Advisor */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Lightbulb className="h-5 w-5 text-primary" />
							AI Deal Advisor
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							The AI Deal Advisor analyzes your opportunity data and provides strategic recommendations.
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">What It Analyzes</h4>
								<ul className="space-y-1 text-muted-foreground text-sm">
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>
											<strong className="text-foreground">Stakeholder coverage</strong> - Are you engaging the right
											people?
										</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>
											<strong className="text-foreground">Next step momentum</strong> - Are actions clear, owned, and
											time-bound?
										</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>
											<strong className="text-foreground">Deal qualification</strong> - Is this a real opportunity?
										</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>
											<strong className="text-foreground">Risk factors</strong> - What could prevent closing?
										</span>
									</li>
									<li className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
										<span>
											<strong className="text-foreground">Conversation history</strong> - Insights from linked
											interviews
										</span>
									</li>
								</ul>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">Understanding the Recommendations</h4>
								<div className="space-y-2">
									<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
										<p className="font-semibold text-foreground text-sm">Status Assessment</p>
										<p className="mt-1 text-muted-foreground text-xs">
											One-sentence summary of deal health and momentum.
										</p>
										<p className="mt-1 text-muted-foreground text-xs italic">
											Example: "Strong momentum with executive engagement, but timeline clarity needed before Q4 close."
										</p>
									</div>
									<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
										<p className="font-semibold text-foreground text-sm">Recommendations (2-3 actions)</p>
										<p className="mt-1 text-muted-foreground text-xs">
											Specific, actionable next steps with clear ownership and timing.
										</p>
									</div>
									<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
										<p className="font-semibold text-foreground text-sm">Risks (1-2 blockers)</p>
										<p className="mt-1 text-muted-foreground text-xs">
											Concrete risks or red flags that could derail the deal.
										</p>
									</div>
								</div>
							</div>
							<div>
								<h4 className="mb-2 font-medium text-foreground text-sm">Confidence Levels</h4>
								<div className="space-y-1 text-sm">
									<div className="flex items-start gap-2">
										<span className="text-green-600">🟢</span>
										<div className="text-muted-foreground">
											<strong className="text-foreground">High</strong> - Strong data quality, clear momentum
										</div>
									</div>
									<div className="flex items-start gap-2">
										<span className="text-yellow-600">🟡</span>
										<div className="text-muted-foreground">
											<strong className="text-foreground">Medium</strong> - Some gaps but directionally sound
										</div>
									</div>
									<div className="flex items-start gap-2">
										<span className="text-red-600">🔴</span>
										<div className="text-muted-foreground">
											<strong className="text-foreground">Low</strong> - Insufficient data or significant red flags
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-3">
							<p className="font-medium text-foreground text-sm">💡 When to Use the Advisor</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Get fresh advice after every conversation, before key meetings, when deals stall, or during deal
								reviews. Click "Get Advice" again after updating stakeholder information or completing next steps.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Troubleshooting */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-primary" />
							Troubleshooting
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div>
								<h4 className="mb-1 font-medium text-foreground text-sm">No stakeholders showing up</h4>
								<p className="text-muted-foreground text-sm">
									Ensure interview is linked (look for "Linked Interviews" section). Wait 1-2 minutes for Sales Lens
									extraction, then refresh the page. If still missing, manually add stakeholders.
								</p>
							</div>
							<div>
								<h4 className="mb-1 font-medium text-foreground text-sm">AI Advisor returns no recommendations</h4>
								<p className="text-muted-foreground text-sm">
									Link at least one conversation, ensure stakeholders are populated, and add some next steps (even
									manual ones). Then try again.
								</p>
							</div>
							<div>
								<h4 className="mb-1 font-medium text-foreground text-sm">Next steps seem inaccurate</h4>
								<p className="text-muted-foreground text-sm">
									Review the source evidence (hover to see transcript snippet). Edit or remove inaccurate next steps and
									add manual next steps for clarity.
								</p>
							</div>
							<div>
								<h4 className="mb-1 font-medium text-foreground text-sm">Can't find my opportunity</h4>
								<p className="text-muted-foreground text-sm">
									Check you're in the correct project (top nav). Use the search/filter on opportunities page. Verify
									it's not in a different account.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Tips & Best Practices */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle>Tips & Best Practices</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="space-y-2 text-sm">
							<div>
								<h4 className="mb-1 font-semibold text-foreground">🎯 Maximize AI Accuracy</h4>
								<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
									<li>Link conversations as soon as possible after calls</li>
									<li>Ensure stakeholder names/emails are correct (improves matching)</li>
									<li>Add manual context in Notes that wasn't captured in calls</li>
									<li>Update next steps ownership promptly</li>
								</ul>
							</div>
							<div>
								<h4 className="mb-1 font-semibold text-foreground">📊 Keep Data Fresh</h4>
								<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
									<li>Review stakeholder matrix weekly</li>
									<li>Mark completed next steps or update status</li>
									<li>Get fresh AI advice before key meetings</li>
									<li>Link all relevant conversations, not just discovery calls</li>
								</ul>
							</div>
							<div>
								<h4 className="mb-1 font-semibold text-foreground">🤝 Improve Collaboration</h4>
								<ul className="list-disc space-y-1 pl-4 text-muted-foreground">
									<li>Share opportunity links with team members</li>
									<li>Use AI recommendations in deal reviews</li>
									<li>Reference specific conversation evidence when debating strategy</li>
									<li>Track recommendation history to show progress</li>
								</ul>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Related Resources */}
				<Card>
					<CardHeader>
						<CardTitle>Related Resources</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 text-sm">
							<Link to="/docs/crm-quick-reference" className="flex items-center gap-2 text-primary hover:underline">
								<span className="text-primary">→</span>
								<span>CRM Workflow Quick Reference - One-page cheat sheet</span>
							</Link>
							<Link to="/docs/conversation-lenses" className="flex items-center gap-2 text-primary hover:underline">
								<span className="text-primary">→</span>
								<span>Conversation Lenses - Deep dive on BANT/MEDDIC extraction</span>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
