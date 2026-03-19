/**
 * Comprehensive guide for distributing surveys via all channels:
 * direct link, email platforms, QR code, website embed, and social/messaging.
 */
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Code,
	ExternalLink,
	Globe,
	Link2,
	Mail,
	QrCode,
	Share2,
	Sparkles,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function SurveyDistributionGuide() {
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
					Distribution
				</Badge>
			</div>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Survey Distribution Guide</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Every way to get your survey in front of respondents — from a simple link to personalized email campaigns.
			</p>

			{/* Pre-fill overview */}
			<Card className="mb-8 border-primary/20 bg-primary/5">
				<CardContent className="pt-6">
					<div className="flex items-start gap-3">
						<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
						<div>
							<p className="font-medium text-foreground text-sm">Pre-filling respondent info</p>
							<p className="mt-1 text-muted-foreground text-sm">
								All distribution methods support URL parameters to pre-fill respondent data. When you append{" "}
								<code className="rounded bg-muted px-1 text-xs">?email=jane@acme.com</code> to your survey link,
								UpSight automatically matches the respondent to their imported profile — skipping identity questions
								and enabling personalized AI conversations.
							</p>
							<div className="mt-3 space-y-1.5">
								<p className="font-medium text-foreground text-sm">Supported URL parameters</p>
								<div className="grid gap-1.5 text-muted-foreground text-sm sm:grid-cols-2">
									<div>
										<code className="rounded bg-muted px-1 text-xs">email</code> — respondent email (primary
										identifier)
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">name</code> — full name (auto-splits into
										first/last)
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">first_name</code> — first name only
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">last_name</code> — last name only
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">company</code> — company / organization
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">title</code> — job title
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">job_function</code> — e.g. Product,
										Marketing
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">industry</code> — e.g. SaaS, Healthcare
									</div>
									<div>
										<code className="rounded bg-muted px-1 text-xs">company_size</code> — e.g. 51-200
									</div>
								</div>
								<p className="text-muted-foreground text-xs">
									When a known person's profile has missing fields, respondents see a pre-filled form to
									confirm and complete their details before starting.
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="space-y-8">
				{/* 1. Direct Link */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Link2 className="h-5 w-5 text-primary" />
							Share a Direct Link
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground text-sm">
							The simplest way to share. Copy your public survey link from the Distribute tab and send it however
							you like — email, DM, text message.
						</p>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="mb-1 font-medium text-foreground text-xs">Your survey URL</p>
							<code className="text-xs">https://getupsight.com/ask/your-survey-slug</code>
						</div>
						<div className="flex items-start gap-2">
							<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
							<span className="text-muted-foreground text-sm">
								Customize the URL slug in the Distribute tab to make it memorable
							</span>
						</div>
					</CardContent>
				</Card>

				{/* 2. Email Distribution */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5 text-primary" />
							Send via Email
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<p className="text-muted-foreground text-sm">
							Two options: send directly from UpSight via Gmail, or use your own email platform with a personalized
							link.
						</p>

						{/* Gmail from UpSight */}
						<div>
							<h4 className="mb-2 font-semibold text-foreground text-sm">Option A: Send from UpSight (Gmail)</h4>
							<p className="mb-3 text-muted-foreground text-sm">
								Connect your Gmail account in the Distribute tab, then send personalized invites directly from
								UpSight. You can select recipients from your People CRM or enter email addresses manually.
							</p>
							<div className="space-y-2">
								<div className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
									<span className="text-muted-foreground text-sm">Emails sent from your own Gmail address</span>
								</div>
								<div className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
									<span className="text-muted-foreground text-sm">
										Respondent email is automatically pre-filled in the survey link
									</span>
								</div>
								<div className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
									<span className="text-muted-foreground text-sm">
										Customize subject line and message body per batch
									</span>
								</div>
							</div>
						</div>

						{/* External email platforms */}
						<div>
							<h4 className="mb-2 font-semibold text-foreground text-sm">
								Option B: Use Your Email Platform
							</h4>
							<p className="mb-3 text-muted-foreground text-sm">
								If you use Mailchimp, SendGrid, Postmark, ConvertKit, or any other email tool, include your survey
								link in the campaign and use their merge tags to pre-fill the respondent's email.
							</p>

							<div className="space-y-3">
								{/* Mailchimp */}
								<div className="rounded-lg border p-4">
									<p className="mb-2 font-medium text-foreground text-sm">Mailchimp</p>
									<p className="mb-2 text-muted-foreground text-xs">
										Add your survey URL as a button or link in your campaign template. Append the merge tag so
										each recipient's email is passed automatically:
									</p>
									<div className="rounded-md bg-muted/50 p-2">
										<code className="break-all text-xs">
											https://getupsight.com/ask/your-survey?email=*|EMAIL|*
										</code>
									</div>
									<p className="mt-2 text-muted-foreground text-xs">
										You can also pass name and company:{" "}
										<code className="rounded bg-muted px-1 text-[11px]">
											?email=*|EMAIL|*&name=*|FNAME|*&company=*|MMERGE5|*
										</code>{" "}
										(replace MMERGE5 with your company field's merge tag).
									</p>
								</div>

								{/* SendGrid */}
								<div className="rounded-lg border p-4">
									<p className="mb-2 font-medium text-foreground text-sm">SendGrid / Postmark</p>
									<p className="mb-2 text-muted-foreground text-xs">
										Use their template variable syntax for dynamic substitution:
									</p>
									<div className="rounded-md bg-muted/50 p-2">
										<code className="break-all text-xs">
											{"https://getupsight.com/ask/your-survey?email={{email}}"}
										</code>
									</div>
									<p className="mt-2 text-muted-foreground text-xs">
										SendGrid uses <code className="rounded bg-muted px-1 text-[11px]">{"{{variable}}"}</code>{" "}
										syntax. Postmark uses <code className="rounded bg-muted px-1 text-[11px]">{"{{variable}}"}</code>{" "}
										as well. Check your platform's docs for exact field names.
									</p>
								</div>

								{/* ConvertKit / Generic */}
								<div className="rounded-lg border p-4">
									<p className="mb-2 font-medium text-foreground text-sm">ConvertKit / HubSpot / Others</p>
									<p className="text-muted-foreground text-xs">
										Most email platforms support merge tags or personalization tokens. The pattern is the same:
										append <code className="rounded bg-muted px-1 text-[11px]">?email=</code> followed by your
										platform's email merge tag. Check your platform's documentation for the correct syntax.
									</p>
								</div>
							</div>

							<div className="mt-4 rounded-lg border-amber-500 border-l-4 bg-amber-50 p-3 dark:bg-amber-950/20">
								<p className="font-medium text-sm">Why pre-fill the email?</p>
								<p className="mt-1 text-muted-foreground text-sm">
									When a respondent clicks a link with their email pre-filled, UpSight instantly matches them to
									their imported profile. This means: no "What's your email?" question, the AI interviewer knows
									their name/company/role, and you get clean attribution in your results. Without it, respondents
									must type their email manually.
								</p>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">Import contacts first for best results</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Pre-filling only works if the email matches someone in your People CRM. See the{" "}
								<Link to="/docs/importing-people" className="text-primary underline">
									Import People guide
								</Link>{" "}
								to import your contacts before sending, or the{" "}
								<Link to="/docs/sending-surveys" className="text-primary underline">
									Send Surveys guide
								</Link>{" "}
								for the full end-to-end Mailchimp workflow.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* 3. QR Code */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<QrCode className="h-5 w-5 text-primary" />
							Share via QR Code
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground text-sm">
							Generate a QR code from the Distribute tab. Great for in-person events, printed materials,
							presentations, or product packaging.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Click the QR code button in the Distribute tab to generate and download
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Works on any smartphone camera — no app needed
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Ideal for conferences, workshops, retail, or anywhere you meet respondents in person
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* 4. Embed on Website */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Code className="h-5 w-5 text-primary" />
							Embed on Your Website
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground text-sm">
							Embed the survey directly on your website using an iframe. Use the embed code generator in the
							Distribute tab.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Feedback widgets:</strong> add to your app's settings or help
									page
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Waitlists & lead capture:</strong> embed on a landing page to
									collect signups
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									<strong className="text-foreground">Post-purchase:</strong> embed on a thank-you page for immediate
									feedback
								</span>
							</div>
						</div>
						<div className="rounded-md border bg-muted/30 p-3">
							<p className="mb-1 font-medium text-foreground text-xs">Embed URL pattern</p>
							<code className="text-xs">https://getupsight.com/embed/your-survey-slug</code>
						</div>
						<p className="text-muted-foreground text-xs">
							If your site knows the user's email, pass it via the embed URL:{" "}
							<code className="rounded bg-muted px-1 text-[11px]">
								/embed/your-survey-slug?email=user@example.com
							</code>
						</p>
					</CardContent>
				</Card>

				{/* 5. Social & Messaging */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Share2 className="h-5 w-5 text-primary" />
							Share on Slack, Teams, or Social Media
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground text-sm">
							Paste your survey link directly into Slack channels, Teams chats, LinkedIn posts, Twitter/X, or
							anywhere else. The link will generate a preview card automatically.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									Respondents self-identify when they start the survey
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-muted-foreground text-sm">
									No pre-fill needed — good for broad outreach where you don't have contact data
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Next Steps */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle>Related Guides</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/sending-surveys" className="text-primary underline">
										Send Surveys to Your Mailing List
									</Link>{" "}
									— full end-to-end guide for import → Mailchimp → analyze
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/importing-people" className="text-primary underline">
										Import People & Organizations
									</Link>{" "}
									— set up contacts for identity matching and personalization
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
								<span>
									<Link to="/docs/survey-branching" className="text-primary underline">
										Survey Branching & AI Modes
									</Link>{" "}
									— skip logic, conditions, and AI autonomy settings
								</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
