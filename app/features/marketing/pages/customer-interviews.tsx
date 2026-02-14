import type { MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => {
	return [
		{
			title: "Customer Interview Software | AI-Powered User Research Platform - Upsight",
		},
		{
			name: "description",
			content:
				"Transform customer interviews into actionable insights with AI. Automated transcription, sentiment analysis, and insight extraction. Turn user research into product decisions faster.",
		},
		{
			name: "keywords",
			content:
				"customer interviews, user research software, interview analysis, AI transcription, customer insights, user feedback analysis, product research, UX research tools, customer discovery, interview management",
		},
		{ property: "og:title", content: "Customer Interview Software | Upsight" },
		{
			property: "og:description",
			content:
				"AI-powered customer interview platform. Automate transcription, extract insights, and make data-driven product decisions.",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://getupsight.com/customer-interviews" },
	];
};

export default function CustomerInterviews() {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="border-b bg-gradient-to-b from-primary/5 to-background px-6 py-20">
				<div className="mx-auto max-w-6xl">
					<div className="text-center">
						<h1 className="mb-6 font-bold text-5xl text-foreground tracking-tight md:text-6xl">
							Turn Customer Interviews Into
							<span className="text-primary"> Actionable Insights</span>
						</h1>
						<p className="mx-auto mb-8 max-w-3xl text-muted-foreground text-xl">
							Stop drowning in interview notes. Our AI-powered platform automatically transcribes, analyzes, and
							extracts insights from customer interviews—so you can focus on building what users actually need.
						</p>
						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Link
								to="/sign-up"
								className="rounded-lg bg-primary px-8 py-3 font-semibold text-lg text-primary-foreground transition-colors hover:bg-primary/90"
							>
								Start Free Trial
							</Link>
							<Link
								to="/login"
								className="rounded-lg border border-border px-8 py-3 font-semibold text-foreground text-lg transition-colors hover:bg-accent"
							>
								Watch Demo
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Problem Section */}
			<section className="border-b px-6 py-20">
				<div className="mx-auto max-w-6xl">
					<div className="mb-12 text-center">
						<h2 className="mb-4 font-bold text-4xl text-foreground">The Customer Interview Challenge</h2>
						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							Product teams conduct hundreds of customer interviews but struggle to turn conversations into decisions
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-3">
						<div className="rounded-lg border bg-card p-6">
							<div className="mb-4 text-4xl">⏰</div>
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Hours of Manual Work</h3>
							<p className="text-muted-foreground">
								Teams spend 3-5 hours per interview transcribing, tagging, and organizing notes instead of analyzing
								insights and making decisions.
							</p>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<div className="mb-4 text-4xl">🔍</div>
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Lost Insights</h3>
							<p className="text-muted-foreground">
								Critical customer feedback gets buried in scattered notes, spreadsheets, and recordings. Patterns go
								unnoticed, opportunities are missed.
							</p>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<div className="mb-4 text-4xl">📊</div>
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Slow Decision Making</h3>
							<p className="text-muted-foreground">
								Without centralized insights, product decisions take weeks. Teams debate opinions instead of acting on
								validated customer needs.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Solution Section */}
			<section className="border-b bg-accent/30 px-6 py-20">
				<div className="mx-auto max-w-6xl">
					<div className="mb-12 text-center">
						<h2 className="mb-4 font-bold text-4xl text-foreground">AI-Powered Customer Interview Analysis</h2>
						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							Upsight automates the entire interview workflow—from recording to insights—using advanced AI and natural
							language processing
						</p>
					</div>

					<div className="grid gap-12 lg:grid-cols-2">
						<div>
							<h3 className="mb-6 font-bold text-2xl text-foreground">How It Works</h3>
							<div className="space-y-6">
								<div className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-lg text-primary-foreground">
										1
									</div>
									<div>
										<h4 className="mb-2 font-semibold text-foreground">Record or Upload Interviews</h4>
										<p className="text-muted-foreground">
											Upload audio, video, or text transcripts. Our AI handles multiple speakers and accents with 95%+
											accuracy.
										</p>
									</div>
								</div>

								<div className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-lg text-primary-foreground">
										2
									</div>
									<div>
										<h4 className="mb-2 font-semibold text-foreground">Automatic Insight Extraction</h4>
										<p className="text-muted-foreground">
											AI identifies pain points, feature requests, user needs, and emotional responses. Every insight is
											linked to exact quotes.
										</p>
									</div>
								</div>

								<div className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-lg text-primary-foreground">
										3
									</div>
									<div>
										<h4 className="mb-2 font-semibold text-foreground">Pattern Recognition</h4>
										<p className="text-muted-foreground">
											Discover trends across interviews. See which problems affect the most users and which
											opportunities have the highest impact.
										</p>
									</div>
								</div>

								<div className="flex gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-lg text-primary-foreground">
										4
									</div>
									<div>
										<h4 className="mb-2 font-semibold text-foreground">Actionable Reports</h4>
										<p className="text-muted-foreground">
											Generate executive summaries, persona profiles, and opportunity maps. Share insights with
											stakeholders in minutes, not days.
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border bg-card p-8">
							<h3 className="mb-6 font-bold text-2xl text-card-foreground">Key Features</h3>
							<ul className="space-y-4">
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">AI Transcription:</strong> Automatic speech-to-text with speaker
										identification
									</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">Sentiment Analysis:</strong> Detect emotions, frustrations, and
										excitement
									</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">Insight Tagging:</strong> Automatic categorization by theme,
										persona, and journey stage
									</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">Evidence Linking:</strong> Every insight backed by exact
										customer quotes
									</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">Collaboration Tools:</strong> Share findings, comment, and vote
										on insights
									</span>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-primary">✓</span>
									<span className="text-muted-foreground">
										<strong className="text-foreground">Integration Ready:</strong> Export to Jira, Notion, or your
										product management tools
									</span>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="border-b px-6 py-20">
				<div className="mx-auto max-w-6xl">
					<div className="mb-12 text-center">
						<h2 className="mb-4 font-bold text-4xl text-foreground">Why Product Teams Choose Upsight</h2>
						<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
							Join hundreds of product teams building better products with customer-driven insights
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">10x Faster Analysis</h3>
							<p className="mb-4 text-muted-foreground">
								Reduce interview analysis time from hours to minutes. Get insights while they're still fresh and
								actionable.
							</p>
							<div className="font-bold text-3xl text-primary">5 min</div>
							<div className="text-muted-foreground text-sm">vs. 3-5 hours manually</div>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Higher Quality Insights</h3>
							<p className="mb-4 text-muted-foreground">
								AI catches patterns humans miss. Never lose a critical insight buried in interview notes again.
							</p>
							<div className="font-bold text-3xl text-primary">95%</div>
							<div className="text-muted-foreground text-sm">insight capture rate</div>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Better Product Decisions</h3>
							<p className="mb-4 text-muted-foreground">
								Make data-driven decisions backed by real customer evidence. Build features users actually want.
							</p>
							<div className="font-bold text-3xl text-primary">3x</div>
							<div className="text-muted-foreground text-sm">faster decision velocity</div>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Centralized Knowledge</h3>
							<p className="mb-4 text-muted-foreground">
								All customer insights in one searchable platform. No more scattered notes or lost recordings.
							</p>
							<div className="font-bold text-3xl text-primary">100%</div>
							<div className="text-muted-foreground text-sm">interview retention</div>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Team Alignment</h3>
							<p className="mb-4 text-muted-foreground">
								Share insights across product, design, and engineering. Everyone sees the same customer truth.
							</p>
							<div className="font-bold text-3xl text-primary">∞</div>
							<div className="text-muted-foreground text-sm">stakeholder access</div>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Scalable Research</h3>
							<p className="mb-4 text-muted-foreground">
								Handle 10 or 1,000 interviews with the same effort. Scale your user research without scaling your team.
							</p>
							<div className="font-bold text-3xl text-primary">∞</div>
							<div className="text-muted-foreground text-sm">unlimited interviews</div>
						</div>
					</div>
				</div>
			</section>

			{/* Use Cases Section */}
			<section className="border-b bg-accent/30 px-6 py-20">
				<div className="mx-auto max-w-6xl">
					<div className="mb-12 text-center">
						<h2 className="mb-4 font-bold text-4xl text-foreground">Perfect for Every Research Scenario</h2>
					</div>

					<div className="grid gap-8 md:grid-cols-2">
						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Product Discovery</h3>
							<p className="text-muted-foreground">
								Validate ideas before building. Understand customer problems, needs, and willingness to pay. Identify
								high-impact opportunities.
							</p>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">UX Research</h3>
							<p className="text-muted-foreground">
								Conduct usability testing and user interviews. Extract pain points, feature requests, and behavioral
								insights to improve user experience.
							</p>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Customer Development</h3>
							<p className="text-muted-foreground">
								Build detailed customer personas. Understand jobs-to-be-done, motivations, and decision criteria across
								your target market.
							</p>
						</div>

						<div className="rounded-lg border bg-card p-6">
							<h3 className="mb-3 font-semibold text-card-foreground text-xl">Market Research</h3>
							<p className="text-muted-foreground">
								Analyze competitive landscape, pricing sensitivity, and market trends. Turn qualitative interviews into
								quantitative insights.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="px-6 py-20">
				<div className="mx-auto max-w-4xl text-center">
					<h2 className="mb-4 font-bold text-4xl text-foreground">Start Building Better Products Today</h2>
					<p className="mb-8 text-muted-foreground text-xl">
						Join product teams using AI to turn customer interviews into winning products. Free 14-day trial, no credit
						card required.
					</p>
					<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Link
							to="/sign-up"
							className="rounded-lg bg-primary px-8 py-3 font-semibold text-lg text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Get Started Free
						</Link>
						<Link to="/login" className="font-semibold text-lg text-primary hover:underline">
							Already have an account? Sign in →
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
