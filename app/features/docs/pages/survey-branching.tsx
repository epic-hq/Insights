/**
 * User guide for survey branching logic and AI autonomy modes.
 * Covers: skip logic, condition types, AI modes, and upcoming person-attribute branching.
 */
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, GitBranch, Sparkles, Users } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function SurveyBranchingGuide() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<div className="mb-2 flex items-center gap-2">
				<Badge variant="outline" className="text-xs">
					Surveys
				</Badge>
				<Badge variant="outline" className="text-xs">
					Branching
				</Badge>
			</div>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Survey Branching & AI Modes</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Route respondents to relevant questions using skip logic, and control how much freedom the AI interviewer has to
				adapt the conversation.
			</p>

			<div className="space-y-10">
				{/* Skip Logic */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<GitBranch className="h-5 w-5 text-primary" />
							Skip Logic (Form Mode)
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Skip logic lets you create rules that route respondents to different questions based on their answers.
							Rules are configured per-question in the survey editor.
						</p>

						<h4 className="font-semibold text-foreground text-sm">Condition Operators</h4>
						<div className="grid gap-2 md:grid-cols-2">
							{[
								{ op: "equals / not_equals", desc: "Exact match on answer value" },
								{ op: "contains / not_contains", desc: "Answer includes a substring" },
								{ op: "selected / not_selected", desc: "Option was chosen (multi-select)" },
								{ op: "answered / not_answered", desc: "Question was answered at all" },
							].map(({ op, desc }) => (
								<div key={op} className="rounded-lg border bg-muted/20 p-2">
									<code className="text-foreground text-xs">{op}</code>
									<p className="mt-1 text-muted-foreground text-xs">{desc}</p>
								</div>
							))}
						</div>

						<h4 className="font-semibold text-foreground text-sm">Actions</h4>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Skip to question:</strong> jump to a specific question
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Skip to section:</strong> jump to a named section
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">End survey:</strong> finish the survey early
								</span>
							</div>
						</div>

						<h4 className="font-semibold text-foreground text-sm">AND / OR Logic</h4>
						<p className="text-muted-foreground text-sm">
							Combine multiple conditions with AND (all must match) or OR (any can match). For example: "If role is
							Founder AND company size is 1-10, skip to solo founder section."
						</p>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">Natural language rules</p>
							<p className="mt-1 text-muted-foreground text-sm">
								You can type rules in plain English like "if they haven't purchased, skip to awareness questions" and
								the AI will parse it into structured conditions.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* AI Autonomy */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Bot className="h-5 w-5 text-primary" />
							AI Autonomy Modes (Chat & Voice)
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							In Chat or Voice mode, you control how much freedom the AI interviewer has to adapt. Choose the mode that
							matches your research goals.
						</p>

						<div className="space-y-4">
							<div className="rounded-lg border p-4">
								<div className="mb-2 flex items-center gap-2">
									<h4 className="font-semibold text-foreground">Strict</h4>
									<Badge variant="outline" className="text-xs">
										Default
									</Badge>
								</div>
								<p className="text-muted-foreground text-sm">
									Asks each question exactly as written, in order. No follow-ups, no improvisation. Every respondent
									gets the identical experience.
								</p>
								<p className="mt-2 text-muted-foreground text-xs">
									Best for: standardized surveys, compliance-sensitive research, large sample sizes
								</p>
							</div>

							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-semibold text-foreground">Moderate</h4>
								<p className="text-muted-foreground text-sm">
									Questions in order, but the AI may ask one brief follow-up if an answer is particularly interesting.
									Skips clearly irrelevant questions when respondent context is known.
								</p>
								<p className="mt-2 text-muted-foreground text-xs">
									Best for: customer feedback, satisfaction surveys, general research
								</p>
							</div>

							<div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
								<div className="mb-2 flex items-center gap-2">
									<h4 className="font-semibold text-foreground">Adaptive</h4>
									<Badge variant="secondary" className="text-xs">
										Pro
									</Badge>
								</div>
								<p className="text-muted-foreground text-sm">
									The AI uses your project's research goals, the respondent's CRM profile, and past interactions to
									guide the conversation. It probes deeper on important topics, reorders questions for flow, and asks
									natural follow-ups.
								</p>
								<p className="mt-2 text-muted-foreground text-xs">
									Best for: discovery research, user interviews, exploratory conversations
								</p>
								<div className="mt-3 space-y-1">
									<p className="text-muted-foreground text-xs">
										<Sparkles className="mr-1 inline h-3 w-3" />
										References respondent's job title, company, and segment
									</p>
									<p className="text-muted-foreground text-xs">
										<Sparkles className="mr-1 inline h-3 w-3" />
										Uses project research goals to prioritize questions
									</p>
									<p className="text-muted-foreground text-xs">
										<Sparkles className="mr-1 inline h-3 w-3" />
										Can reference past interviews with the same person
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Person-Attribute Branching */}
				<Card className="border-primary/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							Person-Attribute Branching
							<Badge variant="secondary" className="text-xs">
								Coming Soon
							</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Today, branching rules can only reference answers given during the current survey. Person-attribute
							branching extends this to reference CRM data imported before the survey starts.
						</p>

						<h4 className="font-semibold text-foreground text-sm">What This Enables</h4>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									Skip "What's your role?" when it's already in the CRM
								</span>
							</div>
							<div className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									Branch on seniority level without asking about it first
								</span>
							</div>
							<div className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									Show different sections to members vs non-members based on imported membership status
								</span>
							</div>
							<div className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									Route Enterprise vs Growth segment contacts to tailored question paths
								</span>
							</div>
						</div>

						<h4 className="font-semibold text-foreground text-sm">Available Person Attributes</h4>
						<div className="grid gap-2 md:grid-cols-3">
							{[
								"Job Title",
								"Job Function",
								"Seniority Level",
								"Role Type",
								"Segment",
								"ICP Band",
								"Company",
								"Persona",
								"Industry",
							].map((attr) => (
								<div key={attr} className="rounded-lg border bg-muted/20 px-3 py-1.5 text-center text-sm">
									{attr}
								</div>
							))}
						</div>

						<h4 className="font-semibold text-foreground text-sm">How It Works</h4>
						<div className="rounded-lg border bg-muted/20 p-4">
							<ol className="space-y-2 text-muted-foreground text-sm">
								<li>
									<strong className="text-foreground">1. Survey start:</strong> respondent is matched by email to an
									imported person record
								</li>
								<li>
									<strong className="text-foreground">2. Attributes loaded:</strong> title, segment, seniority, and
									other fields from the person record are loaded into a branching context
								</li>
								<li>
									<strong className="text-foreground">3. Rules evaluated:</strong> branching conditions can reference
									either question responses OR person attributes
								</li>
								<li>
									<strong className="text-foreground">4. In-session updates:</strong> when a survey answer maps to a
									person field (e.g., a "role" question), the attribute updates mid-survey so later rules see the fresh
									value
								</li>
							</ol>
						</div>

						<p className="text-muted-foreground text-xs">
							This feature is being developed on the{" "}
							<code className="rounded bg-muted px-1 text-xs">feat/person-attribute-branching</code> branch and will
							work in both Form and Chat modes.
						</p>
					</CardContent>
				</Card>

				{/* Next Steps */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle>Next Steps</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/importing-people" className="text-primary underline">
										Import your contacts
									</Link>{" "}
									to enable profile-aware personalization and attribute branching
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/sending-surveys" className="text-primary underline">
										Send surveys via Mailchimp
									</Link>{" "}
									with pre-filled email for seamless identity matching
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/research-workflow" className="text-primary underline">
										Research workflow
									</Link>{" "}
									for the complete research process from planning to analysis
								</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
