/**
 * User guide for distributing surveys via email/Mailchimp with UpSight personalization.
 * Covers: import contacts, create survey, generate links, send via Mailchimp, track responses.
 */
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Globe,
	Link2,
	Mail,
	MessageSquare,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function SendingSurveysGuide() {
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
					Email
				</Badge>
			</div>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Send Surveys to Your Mailing List</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Distribute personalized surveys via Mailchimp, email, or direct link -- and use UpSight's CRM data to reduce
				friction and ask smarter questions.
			</p>

			{/* Overview */}
			<Card className="mb-8 border-primary/20 bg-primary/5">
				<CardContent className="pt-6">
					<div className="flex items-start gap-3">
						<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
						<div>
							<p className="font-medium text-foreground text-sm">Why this matters</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Generic surveys get low response rates. When you import your contacts first, UpSight can skip questions
								it already knows the answer to, personalize the AI interviewer's approach, and branch to relevant
								follow-ups -- turning a 15-question survey into a focused 5-minute conversation.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="space-y-10">
				{/* The Full Flow */}
				<div className="mb-2 rounded-lg border bg-muted/20 p-6">
					<h3 className="mb-4 font-semibold text-foreground">The Full Flow</h3>
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">Import Contacts</span>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
						<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">Create Survey</span>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
						<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">Send via Email</span>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
						<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">Collect Responses</span>
						<ArrowRight className="h-4 w-4 text-muted-foreground" />
						<span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">Analyze</span>
					</div>
				</div>

				{/* Step 1: Import */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								1
							</span>
							Import Your Contacts
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Before sending surveys, import your mailing list into UpSight's People section. This is what enables
							personalization.
						</p>

						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Export your Mailchimp audience (or any mailing list) as CSV
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Include key fields: name, email, company, title, and any custom fields (membership status, segment,
									etc.)
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Import into UpSight using paste-to-chat or the CSV import API
								</span>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">
								See the{" "}
								<Link to="/docs/importing-people" className="text-primary underline">
									Import People guide
								</Link>{" "}
								for detailed instructions on CSV format, custom fields, and import modes.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Step 2: Create Survey */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								2
							</span>
							Create Your Survey
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Create a Research Link (survey) from your project. Choose the response mode that fits your goals.
						</p>

						<h4 className="font-semibold text-foreground text-sm">Response Modes</h4>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-lg border p-3">
								<div className="mb-2 flex items-center gap-2">
									<Globe className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-foreground text-sm">Form</span>
								</div>
								<p className="text-muted-foreground text-xs">
									Standard question-by-question format. Deterministic branching with skip logic rules.
								</p>
							</div>
							<div className="rounded-lg border p-3">
								<div className="mb-2 flex items-center gap-2">
									<MessageSquare className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-foreground text-sm">Chat</span>
								</div>
								<p className="text-muted-foreground text-xs">
									Conversational AI interviewer. Can probe deeper and adapt based on respondent context.
								</p>
							</div>
							<div className="rounded-lg border p-3">
								<div className="mb-2 flex items-center gap-2">
									<Zap className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-foreground text-sm">Voice</span>
								</div>
								<p className="text-muted-foreground text-xs">
									Spoken conversation with AI. Best for discovery research and longer interviews.
								</p>
							</div>
						</div>

						<h4 className="font-semibold text-foreground text-sm">Personalization Features</h4>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<Sparkles className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Identity resolution:</strong> when a respondent starts a survey,
									UpSight matches their email to your imported contacts and loads their profile
								</span>
							</div>
							<div className="flex items-start gap-2">
								<Sparkles className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Profile-aware AI:</strong> in Chat/Voice mode, the AI interviewer
									knows the respondent's title, company, and segment -- making the conversation feel 1:1, not generic
								</span>
							</div>
							<div className="flex items-start gap-2">
								<Sparkles className="mt-0.5 h-4 w-4 text-primary" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Skip logic:</strong> branch to different question paths based on
									early answers (e.g., B2B vs B2C, founders vs operators)
								</span>
							</div>
						</div>

						<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4">
							<div className="flex items-center gap-2">
								<p className="font-medium text-sm">Coming Soon: CRM-Attribute Branching</p>
								<Badge variant="secondary" className="text-xs">
									In Development
								</Badge>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								Soon you'll be able to create branching rules that reference imported person fields directly. For
								example: "If seniority is Leadership, skip to strategy section" or "If member status is inactive, show
								re-engagement questions" -- without asking those questions first. This uses the data you already
								imported.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Step 3: Distribute */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								3
							</span>
							Distribute via Email
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<p className="text-muted-foreground">
							UpSight generates a public survey URL for each Research Link. Share it through any email platform.
						</p>

						{/* Mailchimp */}
						<div>
							<h4 className="mb-3 font-semibold text-foreground text-sm">
								<Mail className="mr-1 inline h-4 w-4" />
								Using Mailchimp
							</h4>
							<ol className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-xs">
										1
									</span>
									<div>
										<strong className="text-foreground">Copy your survey URL</strong> from the Research Link settings.
										It looks like:{" "}
										<code className="rounded bg-muted px-1 text-xs">https://getupsight.com/ask/your-survey-slug</code>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-xs">
										2
									</span>
									<div>
										<strong className="text-foreground">Create a campaign</strong> in Mailchimp. Use your imported
										audience list.
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-xs">
										3
									</span>
									<div>
										<strong className="text-foreground">Add the survey link</strong> as a prominent CTA button in your
										email template. Optionally append{" "}
										<code className="rounded bg-muted px-1 text-xs">?email=*|EMAIL|*</code> to pre-fill the respondent's
										email for faster identity matching.
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-xs">
										4
									</span>
									<div>
										<strong className="text-foreground">Send or schedule</strong> your campaign. Mailchimp handles
										delivery, unsubscribes, and compliance.
									</div>
								</li>
							</ol>

							<div className="mt-4 rounded-lg border-amber-500 border-l-4 bg-amber-50 p-3 dark:bg-amber-950/20">
								<p className="font-medium text-sm">Pro tip: Pre-fill email for seamless identity matching</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Use Mailchimp's merge tag to pass the respondent's email automatically:
								</p>
								<pre className="mt-2 overflow-x-auto text-xs">
									{"https://getupsight.com/ask/your-survey?email=*|EMAIL|*"}
								</pre>
								<p className="mt-2 text-muted-foreground text-sm">
									When the respondent clicks through, UpSight instantly matches them to their imported profile -- no
									need to type their email again.
								</p>
							</div>
						</div>

						{/* Other platforms */}
						<div>
							<h4 className="mb-3 font-semibold text-foreground text-sm">
								<Link2 className="mr-1 inline h-4 w-4" />
								Other Platforms
							</h4>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="font-medium text-foreground text-sm">Gmail / Outlook</p>
									<p className="text-muted-foreground text-xs">
										Paste the survey URL directly into your email. For Gmail integration, use UpSight's built-in Gmail
										send feature from the Research Link page.
									</p>
								</div>
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="font-medium text-foreground text-sm">SendGrid / Postmark / etc.</p>
									<p className="text-muted-foreground text-xs">
										Use your platform's templating to include the survey URL. Most support a{" "}
										<code className="rounded bg-muted px-1 text-xs">{"{{email}}"}</code> merge variable for pre-fill.
									</p>
								</div>
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="font-medium text-foreground text-sm">Slack / Teams / Social</p>
									<p className="text-muted-foreground text-xs">
										Share the survey link in channels or DMs. Respondents will self-identify when they start.
									</p>
								</div>
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="font-medium text-foreground text-sm">Embed on Website</p>
									<p className="text-muted-foreground text-xs">
										Use the embed URL <code className="rounded bg-muted px-1 text-xs">/embed/your-survey-slug</code> to
										add the survey inline on any webpage via iframe.
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Step 4: Track and Analyze */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								4
							</span>
							Track Responses & Analyze
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							As responses come in, UpSight processes them into your research pipeline automatically.
						</p>

						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Real-time response tracking</p>
									<p className="text-muted-foreground text-xs">
										See responses as they arrive on the Research Link responses page. Filter by completion status.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Person records updated</p>
									<p className="text-muted-foreground text-xs">
										Survey answers update person facets -- role, industry, and other profile fields get enriched from
										responses
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">Evidence created</p>
									<p className="text-muted-foreground text-xs">
										Each answer creates an evidence record linked to the respondent, searchable and attributable
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
								<div>
									<p className="font-medium text-foreground text-sm">AI analysis</p>
									<p className="text-muted-foreground text-xs">
										Run AI analysis on responses to surface patterns, themes, and insights across your audience
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">Segmented analysis</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Because respondents are linked to imported profiles, you can analyze results by any imported attribute
								-- compare how Enterprise vs Growth segments answered, or slice by membership status.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Reducing Survey Friction */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-primary" />
							Tips for Reducing Survey Friction
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
									1
								</span>
								<div>
									<p className="font-medium text-foreground text-sm">Import before you send</p>
									<p className="text-muted-foreground text-xs">
										The single biggest friction reducer. When UpSight knows who's responding, it can skip "What's your
										role?" and "What company are you at?" because it already knows.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
									2
								</span>
								<div>
									<p className="font-medium text-foreground text-sm">Pre-fill email in the link</p>
									<p className="text-muted-foreground text-xs">
										Append <code className="rounded bg-muted px-1">?email=*|EMAIL|*</code> (Mailchimp) so respondents
										don't have to type their email. They click and go.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
									3
								</span>
								<div>
									<p className="font-medium text-foreground text-sm">Use branching to stay relevant</p>
									<p className="text-muted-foreground text-xs">
										Set up skip logic so B2C founders don't see B2B questions. Fewer irrelevant questions = higher
										completion rates.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
									4
								</span>
								<div>
									<p className="font-medium text-foreground text-sm">Try Chat mode for discovery</p>
									<p className="text-muted-foreground text-xs">
										Chat surveys feel like conversations, not forms. The AI adapts pacing, probes interesting answers,
										and keeps things natural. Response quality goes up.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
									5
								</span>
								<div>
									<p className="font-medium text-foreground text-sm">Keep it short</p>
									<p className="text-muted-foreground text-xs">
										Aim for 5-8 core questions with branching, not 20 questions for everyone. Use AI analysis to extract
										depth from fewer, better questions.
									</p>
								</div>
							</div>
						</div>
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
									with custom fields for richer personalization
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/analyzing-insights" className="text-primary underline">
										Analyze your results
									</Link>{" "}
									with AI-powered theme extraction and segmentation
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/survey-branching" className="text-primary underline">
										Learn about survey branching
									</Link>{" "}
									and AI autonomy for advanced conversation control
								</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
