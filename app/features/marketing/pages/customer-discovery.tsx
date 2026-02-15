import { ArrowRight, CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => {
	return [
		{
			title: "Customer Discovery Platform | Human-Centric, AI-Native Customer Intelligence | UpSight",
		},
		{
			name: "description",
			content:
				"UpSight helps teams run customer discovery with evidence, not guesswork. Capture conversations, extract source-linked insights, and turn customer intelligence into confident product decisions.",
		},
		{ property: "og:title", content: "Customer Discovery Platform | UpSight" },
		{
			property: "og:description",
			content:
				"Human-centric, AI-native customer discovery. Turn interviews, calls, and feedback into evidence-backed decisions your team can defend.",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://getupsight.com/customer-discovery" },
	];
};

export const links: LinksFunction = () => [
	{
		rel: "canonical",
		href: "https://getupsight.com/customer-discovery",
	},
];

const proofLoop = [
	{
		title: "Capture Human Signal",
		description:
			"Bring interviews, sales calls, support conversations, surveys, and notes into one stream before insight gets lost.",
	},
	{
		title: "Synthesize With AI",
		description:
			"AI extracts patterns, pains, goals, and opportunities across conversations in minutes instead of weeks of manual synthesis.",
	},
	{
		title: "Verify With Receipts",
		description:
			"Every insight links back to verbatim customer evidence so your team can validate context and trust the conclusion.",
	},
	{
		title: "Decide With Conviction",
		description: "Prioritize roadmap, messaging, and GTM with shared evidence, not opinion battles or memory bias.",
	},
];

const useCases = [
	"Pre-PMF discovery: validate problem urgency before building.",
	"Post-launch diagnostics: understand weak adoption and friction quickly.",
	"Roadmap prioritization: rank requests by evidence strength, not volume.",
	"Consulting delivery: turn stakeholder interviews into defensible recommendations.",
];

const notUseCases = [
	"If you only need transcript storage with no decision workflow.",
	"If your team is not speaking to customers at all yet.",
	"If you want generic AI summaries without source verification.",
];

const faqItems = [
	{
		question: "What is customer discovery software?",
		answer:
			"Customer discovery software helps teams capture customer conversations, identify patterns, and make decisions based on evidence. UpSight adds source-linked AI synthesis so every recommendation can be traced to what customers actually said.",
	},
	{
		question: "How is UpSight different from interview repositories?",
		answer:
			"Repositories store research. UpSight focuses on decision velocity: capture, synthesis, evidence verification, and action-ready outputs in one workflow.",
	},
	{
		question: "How is UpSight different from AI PM copilots?",
		answer:
			"PM copilots help draft requirements. UpSight starts earlier with customer voice and evidence, so your team can decide what is worth building before drafting docs.",
	},
	{
		question: "Can we trust AI insights?",
		answer:
			"Yes, when insights show receipts. UpSight links insights to source quotes and context so your team can verify claims instead of accepting opaque summaries.",
	},
	{
		question: "Who is UpSight best for?",
		answer:
			"Founders, product leads, and consultants in small-to-mid teams who talk to customers often and need faster, evidence-backed decisions.",
	},
];

const faqStructuredData = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: faqItems.map((item) => ({
		"@type": "Question",
		name: item.question,
		acceptedAnswer: {
			"@type": "Answer",
			text: item.answer,
		},
	})),
};

export default function CustomerDiscovery() {
	return (
		<div className="min-h-screen bg-background">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data required for SEO */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

			<section className="border-b bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-20 text-white">
				<div className="mx-auto max-w-6xl">
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-medium text-sm">
						<Sparkles className="h-4 w-4 text-amber-300" />
						Human-Centric, AI-Native Customer Intelligence
					</div>
					<h1 className="max-w-5xl font-bold text-4xl tracking-tight md:text-6xl">
						Customer Discovery That Builds
						<span className="text-amber-300"> Conviction</span>, Not Just Content
					</h1>
					<p className="mt-6 max-w-4xl text-lg text-zinc-200 md:text-xl">
						UpSight helps teams turn customer conversations into decisions they can defend. Capture real voice, extract
						patterns with AI, and verify every insight with source evidence.
					</p>
					<p className="mt-3 max-w-4xl text-zinc-300">
						If your team is asking "what should we build next?" this is the fastest path from customer signal to
						confident action.
					</p>

					<div className="mt-10 flex flex-col gap-4 sm:flex-row">
						<Link
							to="/sign-up"
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-black transition-colors hover:bg-amber-300"
						>
							Start Free
							<ArrowRight className="h-4 w-4" />
						</Link>
						{/* <Link
							to="/pricing"
							className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 font-semibold transition-colors hover:bg-white/10"
						>
							See Pricing
						</Link> */}
					</div>
				</div>
			</section>

			<section className="border-b px-6 py-16">
				<div className="mx-auto max-w-6xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-4xl">The Old Way Loses the Plot</h2>
					<p className="mt-4 max-w-4xl text-lg text-muted-foreground">
						Most teams do the hard part: they talk to customers. Then insights scatter across docs, recordings, and
						inbox threads. Discovery turns into debates, not decisions.
					</p>
					<p className="mt-3 max-w-4xl text-muted-foreground">
						Modern customer discovery is not about collecting more notes. It is about making customer truth searchable,
						shareable, and provable at decision time.
					</p>
				</div>
			</section>

			<section className="border-b bg-accent/20 px-6 py-16">
				<div className="mx-auto max-w-6xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-4xl">The UpSight Proof Loop</h2>
					<p className="mt-4 max-w-3xl text-muted-foreground">
						An operating system for customer discovery: fast enough for weekly decisions, rigorous enough for strategic
						bets.
					</p>
					<div className="mt-10 grid gap-6 md:grid-cols-2">
						{proofLoop.map((step) => (
							<div key={step.title} className="rounded-xl border bg-card p-6">
								<h3 className="font-semibold text-card-foreground text-xl">{step.title}</h3>
								<p className="mt-3 text-muted-foreground">{step.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="border-b px-6 py-16">
				<div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
					<div className="rounded-xl border bg-card p-6">
						<div className="mb-3 inline-flex items-center gap-2 font-semibold text-emerald-700 text-sm">
							<CheckCircle2 className="h-4 w-4" />
							When To Use UpSight
						</div>
						<ul className="space-y-3 text-muted-foreground">
							{useCases.map((item) => (
								<li key={item} className="flex gap-3">
									<span className="mt-1 text-emerald-600">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>

					<div className="rounded-xl border bg-card p-6">
						<div className="mb-3 inline-flex items-center gap-2 font-semibold text-amber-700 text-sm">
							<CircleAlert className="h-4 w-4" />
							When Not To Use It
						</div>
						<ul className="space-y-3 text-muted-foreground">
							{notUseCases.map((item) => (
								<li key={item} className="flex gap-3">
									<span className="mt-1 text-amber-600">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			<section className="border-b px-6 py-16">
				<div className="mx-auto max-w-6xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-4xl">Built For Builders, Not Just Researchers</h2>
					<p className="mt-4 max-w-4xl text-muted-foreground">
						Most tools solve one slice of the workflow. UpSight connects voice to evidence to decision so your whole
						team can move.
					</p>
					<div className="mt-8 overflow-x-auto rounded-xl border">
						<table className="w-full min-w-[680px] border-collapse text-left">
							<thead className="bg-accent/30">
								<tr>
									<th className="p-4 font-semibold">Category</th>
									<th className="p-4 font-semibold">What You Get</th>
									<th className="p-4 font-semibold">Where It Breaks</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-t">
									<td className="p-4 font-medium">Research repositories</td>
									<td className="p-4 text-muted-foreground">Storage, tagging, and playback</td>
									<td className="p-4 text-muted-foreground">Insight exists, but action still slows down</td>
								</tr>
								<tr className="border-t">
									<td className="p-4 font-medium">Recruiting platforms</td>
									<td className="p-4 text-muted-foreground">Faster access to participants</td>
									<td className="p-4 text-muted-foreground">No end-to-end synthesis to decision pipeline</td>
								</tr>
								<tr className="border-t">
									<td className="p-4 font-medium">AI PM copilots</td>
									<td className="p-4 text-muted-foreground">Faster PRDs and specs</td>
									<td className="p-4 text-muted-foreground">Can accelerate writing before validating reality</td>
								</tr>
								<tr className="border-t bg-amber-50/60">
									<td className="p-4 font-semibold">UpSight</td>
									<td className="p-4 font-semibold">Capture → synthesize → verify → decide</td>
									<td className="p-4 text-muted-foreground">Designed for evidence-backed decisions at team speed</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<section className="border-b px-6 py-16">
				<div className="mx-auto max-w-5xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-4xl">FAQ</h2>
					<div className="mt-8 space-y-6">
						{faqItems.map((item) => (
							<div key={item.question} className="rounded-xl border bg-card p-6">
								<h3 className="font-semibold text-card-foreground text-xl">{item.question}</h3>
								<p className="mt-3 text-muted-foreground">{item.answer}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="px-6 py-20">
				<div className="mx-auto max-w-4xl rounded-2xl border bg-gradient-to-br from-zinc-900 to-zinc-700 p-10 text-center text-white">
					<h2 className="font-bold text-3xl tracking-tight md:text-4xl">Get Your Customers. Build Conviction.</h2>
					<p className="mx-auto mt-4 max-w-2xl text-zinc-200">
						Bring your next five customer conversations into UpSight and see what changes when every insight has
						receipts.
					</p>
					<div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
						<Link
							to="/sign-up"
							className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-6 py-3 font-semibold text-black transition-colors hover:bg-amber-300"
						>
							Start Free
						</Link>
						<Link
							to="/blog"
							className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 font-semibold transition-colors hover:bg-white/10"
						>
							Read Customer Discovery Guides
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
