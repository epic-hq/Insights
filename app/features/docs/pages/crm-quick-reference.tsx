import { ArrowLeft, CheckCircle2, Zap, AlertCircle, BarChart3 } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function CRMQuickReference() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">CRM Workflow Quick Reference</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				A cheat sheet for the complete discovery-to-deal workflow. Get up and running in 5 minutes.
			</p>

			<div className="space-y-10">
				{/* Quick Start */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-primary" />
							Quick Start (5 minutes)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ol className="space-y-2 text-muted-foreground">
							<li className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
									1
								</span>
								<div className="pt-0.5">
									<strong className="text-foreground">Record or upload</strong> a customer conversation
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
									2
								</span>
								<div className="pt-0.5">
									<strong className="text-foreground">Create an opportunity</strong> from CRM sidebar
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
									3
								</span>
								<div className="pt-0.5">
									<strong className="text-foreground">Link the conversation</strong> to the opportunity
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
									4
								</span>
								<div className="pt-0.5">
									<strong className="text-foreground">Review auto-extracted</strong> stakeholders & next steps
								</div>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
									5
								</span>
								<div className="pt-0.5">
									<strong className="text-foreground">Get AI advice</strong> on next moves
								</div>
							</li>
						</ol>
						<div className="mt-4 rounded-lg border-primary border-l-4 bg-white p-3 dark:bg-background">
							<p className="font-semibold text-foreground text-sm">✅ Done!</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Your deal intelligence is now centralized and actionable.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Complete Workflow */}
				<Card>
					<CardHeader>
						<CardTitle>Complete Workflow</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div>
								<h3 className="mb-2 font-semibold text-foreground text-sm">Phase 1: Capture Conversation</h3>
								<div className="rounded-lg bg-muted/50 p-3 font-mono text-muted-foreground text-xs">
									<div>Home → Record Now</div>
									<div className="ml-4">↓</div>
									<div>Interview processing runs (1-2 min)</div>
									<div className="ml-4">↓</div>
									<div>Transcript + Evidence generated</div>
								</div>
							</div>

							<div>
								<h3 className="mb-2 font-semibold text-foreground text-sm">Phase 2: Create Opportunity</h3>
								<div className="rounded-lg bg-muted/50 p-3 font-mono text-muted-foreground text-xs">
									<div>Sidebar → CRM</div>
									<div className="ml-4">↓</div>
									<div>+ New Opportunity</div>
									<div className="ml-4">↓</div>
									<div>Fill: Title, Stage, Amount, Close Date</div>
									<div className="ml-4">↓</div>
									<div>Create</div>
								</div>
							</div>

							<div>
								<h3 className="mb-2 font-semibold text-foreground text-sm">Phase 3: Link & Extract</h3>
								<div className="rounded-lg bg-muted/50 p-3 font-mono text-muted-foreground text-xs">
									<div>Interview Detail → Link to Opportunity</div>
									<div className="ml-4">↓</div>
									<div>Select opportunity (or create new)</div>
									<div className="ml-4">↓</div>
									<div>Sales Lens extraction runs (1-2 min)</div>
									<div className="ml-4">↓</div>
									<div>Stakeholders + Next Steps appear</div>
								</div>
							</div>

							<div>
								<h3 className="mb-2 font-semibold text-foreground text-sm">Phase 4: Review & Edit</h3>
								<div className="rounded-lg bg-muted/50 p-3 font-mono text-muted-foreground text-xs">
									<div>Opportunity Detail Page</div>
									<div className="ml-4">↓</div>
									<div>Review Stakeholder Matrix</div>
									<div className="ml-6">├─ Edit Type (DM, I, B)</div>
									<div className="ml-6">├─ Update Influence (L/M/H)</div>
									<div className="ml-6">└─ Add missing stakeholders</div>
									<div className="ml-4">↓</div>
									<div>Review Next Steps</div>
									<div className="ml-6">├─ Assign owners</div>
									<div className="ml-6">├─ Set due dates</div>
									<div className="ml-6">└─ Add manual steps</div>
								</div>
							</div>

							<div>
								<h3 className="mb-2 font-semibold text-foreground text-sm">Phase 5: Get AI Advice</h3>
								<div className="rounded-lg bg-muted/50 p-3 font-mono text-muted-foreground text-xs">
									<div>Opportunity Detail → AI Deal Advisor</div>
									<div className="ml-4">↓</div>
									<div>Click "Get Advice"</div>
									<div className="ml-4">↓</div>
									<div>Review:</div>
									<div className="ml-6">• Status Assessment</div>
									<div className="ml-6">• 2-3 Recommendations</div>
									<div className="ml-6">• 1-2 Risk Factors</div>
									<div className="ml-6">• Confidence Level</div>
									<div className="ml-4">↓</div>
									<div>Take action on recommendations</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Key Concepts */}
				<Card>
					<CardHeader>
						<CardTitle>Key Concepts</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Stakeholder Types</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="pb-2 pr-4 text-left font-medium">Code</th>
											<th className="pb-2 pr-4 text-left font-medium">Role</th>
											<th className="pb-2 text-left font-medium">When to Use</th>
										</tr>
									</thead>
									<tbody className="text-muted-foreground">
										<tr className="border-b">
											<td className="py-2 pr-4">
												<Badge variant="destructive">DM</Badge>
											</td>
											<td className="py-2 pr-4 font-medium text-foreground">Decision Maker</td>
											<td className="py-2">Has final approval authority</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4">
												<Badge className="bg-yellow-500">I</Badge>
											</td>
											<td className="py-2 pr-4 font-medium text-foreground">Influencer</td>
											<td className="py-2">Provides input, makes recommendations</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4">
												<Badge className="bg-blue-500">B</Badge>
											</td>
											<td className="py-2 pr-4 font-medium text-foreground">Blocker</td>
											<td className="py-2">Can prevent or delay purchase</td>
										</tr>
										<tr>
											<td className="py-2 pr-4">
												<Badge variant="outline">-</Badge>
											</td>
											<td className="py-2 pr-4 font-medium text-foreground">Unknown</td>
											<td className="py-2">Role not yet clear</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Influence Levels</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="pb-2 pr-4 text-left font-medium">Level</th>
											<th className="pb-2 pr-4 text-left font-medium">Meaning</th>
											<th className="pb-2 text-left font-medium">Examples</th>
										</tr>
									</thead>
									<tbody className="text-muted-foreground">
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">High</td>
											<td className="py-2 pr-4">Can make or break the deal</td>
											<td className="py-2">C-level, VP, Budget holder</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">Medium</td>
											<td className="py-2 pr-4">Strong voice but not final say</td>
											<td className="py-2">Director, Manager, Champion</td>
										</tr>
										<tr>
											<td className="py-2 pr-4 font-medium text-foreground">Low</td>
											<td className="py-2 pr-4">Limited impact on decision</td>
											<td className="py-2">End user, Analyst</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Deal Stages</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="pb-2 pr-4 text-left font-medium">Stage</th>
											<th className="pb-2 pr-4 text-left font-medium">Description</th>
											<th className="pb-2 text-left font-medium">Typical Activities</th>
										</tr>
									</thead>
									<tbody className="text-muted-foreground">
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">Discovery</td>
											<td className="py-2 pr-4">Qualifying the opportunity</td>
											<td className="py-2">Initial conversations, pain discovery</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">Proposal</td>
											<td className="py-2 pr-4">Presenting solution</td>
											<td className="py-2">Demos, POCs, pricing discussions</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">Negotiation</td>
											<td className="py-2 pr-4">Working toward close</td>
											<td className="py-2">Contracts, legal review, approvals</td>
										</tr>
										<tr className="border-b">
											<td className="py-2 pr-4 font-medium text-foreground">Closed-Won</td>
											<td className="py-2 pr-4">Deal signed</td>
											<td className="py-2">Onboarding, implementation</td>
										</tr>
										<tr>
											<td className="py-2 pr-4 font-medium text-foreground">Closed-Lost</td>
											<td className="py-2 pr-4">Opportunity lost</td>
											<td className="py-2">Post-mortem, nurture for future</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Power User Tips */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-primary" />
							Power User Tips
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Speed Up Data Entry</h3>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>Click any field in stakeholder matrix to edit</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>Press Tab to move to next field</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>Press Enter to save and continue</span>
								</li>
							</ul>
						</div>

						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Improve AI Accuracy</h3>
							<div className="grid gap-2 md:grid-cols-2">
								<div className="space-y-1 text-sm">
									<p className="font-medium text-foreground">✅ Do this:</p>
									<ul className="space-y-1 text-muted-foreground">
										<li>• Link conversations within 24 hours</li>
										<li>• Correct stakeholder names immediately</li>
										<li>• Add context in Notes that wasn't said</li>
										<li>• Update next step owners/dates promptly</li>
									</ul>
								</div>
								<div className="space-y-1 text-sm">
									<p className="font-medium text-foreground">❌ Avoid this:</p>
									<ul className="space-y-1 text-muted-foreground">
										<li>• Linking wrong conversations to deals</li>
										<li>• Ignoring "Unknown" stakeholder types</li>
										<li>• Leaving next steps unassigned</li>
										<li>• Not refreshing advice after updates</li>
									</ul>
								</div>
							</div>
						</div>

						<div>
							<h3 className="mb-2 font-semibold text-foreground text-sm">Team Collaboration</h3>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>Copy opportunity URL and share in Slack with context</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>Project opportunity detail on screen during deal reviews</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>Walk through stakeholder matrix together</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>Assign next steps to team members live</span>
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>

				{/* Common Issues */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-primary" />
							Common Issues
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
							<h4 className="mb-1 font-semibold text-foreground">Issue: No stakeholders after linking</h4>
							<p className="mb-2 text-muted-foreground">Quick Fix:</p>
							<ol className="space-y-1 pl-5 text-muted-foreground list-decimal">
								<li>Wait 2 minutes for processing</li>
								<li>Refresh page</li>
								<li>Check if conversation actually linked (see "Linked Interviews")</li>
								<li>Manually add if still missing</li>
							</ol>
						</div>

						<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
							<h4 className="mb-1 font-semibold text-foreground">Issue: AI Advisor says "insufficient data"</h4>
							<p className="mb-2 text-muted-foreground">Quick Fix:</p>
							<ol className="space-y-1 pl-5 text-muted-foreground list-decimal">
								<li>Ensure at least 1 conversation linked</li>
								<li>Add 2-3 stakeholders (even manual)</li>
								<li>Add at least 1 next step</li>
								<li>Try "Get Advice" again</li>
							</ol>
						</div>

						<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
							<h4 className="mb-1 font-semibold text-foreground">Issue: Next steps seem wrong</h4>
							<p className="mb-2 text-muted-foreground">Quick Fix:</p>
							<ol className="space-y-1 pl-5 text-muted-foreground list-decimal">
								<li>Review source evidence (hover to see)</li>
								<li>Edit description inline</li>
								<li>Delete if completely wrong</li>
								<li>Add manual next step with correct info</li>
							</ol>
						</div>

						<div className="rounded-lg border border-border/60 bg-muted/10 p-3">
							<h4 className="mb-1 font-semibold text-foreground">Issue: Can't find opportunity</h4>
							<p className="mb-2 text-muted-foreground">Quick Fix:</p>
							<ol className="space-y-1 pl-5 text-muted-foreground list-decimal">
								<li>Check you're in right project (top nav)</li>
								<li>Use search bar on opportunities page</li>
								<li>Check other stages on kanban board</li>
								<li>Verify it saved (look for success message)</li>
							</ol>
						</div>
					</CardContent>
				</Card>

				{/* Metrics to Track */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-primary" />
							Metrics to Track
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div>
							<h4 className="mb-2 font-semibold text-foreground">Deal Health Indicators</h4>
							<ul className="space-y-1 text-muted-foreground">
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>
										<strong className="text-foreground">Stakeholder Coverage</strong> - Do you have DM + Champion?
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>
										<strong className="text-foreground">Next Step Momentum</strong> - All steps owned with dates?
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>
										<strong className="text-foreground">Conversation Frequency</strong> - Talking at least weekly?
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
									<span>
										<strong className="text-foreground">Risk Mitigation</strong> - Addressing AI-identified blockers?
									</span>
								</li>
							</ul>
						</div>

						<div>
							<h4 className="mb-2 font-semibold text-foreground">Team Performance</h4>
							<ul className="space-y-1 text-muted-foreground">
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>
										<strong className="text-foreground">Opportunities Created</strong> - Per rep, per week
									</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>
										<strong className="text-foreground">Conversations Linked</strong> - % of calls tracked
									</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>
										<strong className="text-foreground">AI Recommendations Actioned</strong> - How many implemented?
									</span>
								</li>
								<li className="flex items-start gap-2">
									<span className="text-primary">→</span>
									<span>
										<strong className="text-foreground">Time to Next Step</strong> - Average time from call to action
									</span>
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>

				{/* Related Docs */}
				<Card>
					<CardHeader>
						<CardTitle>Related Documentation</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 text-sm">
							<Link to="/docs/crm-opportunities" className="flex items-center gap-2 text-primary hover:underline">
								<span className="text-primary">→</span>
								<span>Full CRM & Opportunities Guide - Complete reference</span>
							</Link>
							<Link to="/docs/conversation-lenses" className="flex items-center gap-2 text-primary hover:underline">
								<span className="text-primary">→</span>
								<span>Conversation Lenses - How extraction works</span>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Pro Tip */}
				<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4">
					<p className="font-medium text-foreground text-sm">💡 Pro Tip</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Print this page and keep it visible at your desk for the first week. You'll internalize the workflow
						quickly!
					</p>
				</div>
			</div>
		</div>
	)
}
