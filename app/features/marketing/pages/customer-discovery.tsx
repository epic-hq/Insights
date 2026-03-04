import { ArrowRight, CheckCircle2, CircleAlert, Quote, Sparkles } from "lucide-react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { canonicalLink, indexRobotsMeta } from "../seo";

export const meta: MetaFunction = () => {
	return [
		{
			title: "Customer Discovery Platform | Human-Centric, AI-Native Customer Intelligence | UpSight",
		},
		{
			name: "description",
			content:
				"UpSight helps founders, product teams, and researchers run customer discovery with evidence, not guesswork. Capture conversations, synthesize patterns, and make decisions with conviction.",
		},
		{ property: "og:title", content: "Customer Discovery Platform | UpSight" },
		{
			property: "og:description",
			content:
				"Human-centric, AI-native customer discovery for founders, PMs, and researchers. Turn customer voice into source-backed decisions.",
		},
		{ property: "og:type", content: "website" },
		{
			property: "og:url",
			content: "https://getupsight.com/customer-discovery",
		},
		indexRobotsMeta(),
	];
};

export const links: LinksFunction = () => [canonicalLink("/customer-discovery")];

const proofLoop = [
	{
		step: "01",
		title: "Capture",
		hook: "Before insight gets lost.",
		description: "Interviews. Sales calls. Support tickets. Surveys. Notes. All in one stream.",
	},
	{
		step: "02",
		title: "Synthesize",
		hook: "Minutes, not weeks.",
		description: "AI finds the patterns, pains, and opportunities across every conversation.",
	},
	{
		step: "03",
		title: "Verify",
		hook: "Every insight shows its receipts.",
		description: "Click any finding. See exactly who said it, when, in what context. Trust it or challenge it.",
	},
	{
		step: "04",
		title: "Decide",
		hook: "Ship what customers actually need.",
		description: "Prioritize with shared evidence. End the opinion battles. Start building.",
	},
];

const useCases = [
	"Validate high-stakes bets before writing code.",
	"Rank opportunities by evidence strength, not gut feeling.",
	"Find repeat patterns across interviews in minutes.",
	"Diagnose weak adoption and friction after launch.",
];

const notUseCases = [
	"You just need transcript storage with no decision workflow.",
	"Your team isn't speaking to customers yet.",
	"You want generic AI summaries without source verification.",
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
		question: "Is there a consultant-specific version of this page?",
		answer:
			"Yes. If your workflow is stakeholder interviews to SOW and implementation planning, visit our customer discovery page for consultants.",
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

			{/* ── Hero ── */}
			<section className="border-b bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-white md:py-32">
				<div className="mx-auto max-w-5xl">
					<div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-medium text-sm text-zinc-300">
						<Sparkles className="h-4 w-4 text-amber-300" />
						Customer Intelligence Platform
					</div>

					<h1 className="font-bold text-5xl leading-[1.1] tracking-tight md:text-7xl">
						Stop debating
						<br />
						what to build.
						<br />
						<span className="text-amber-300">Know.</span>
					</h1>

					<p className="mt-8 max-w-2xl text-xl text-zinc-300 leading-relaxed md:text-2xl">
						UpSight turns customer conversations into decisions you can defend — so your team ships what customers
						actually need.
					</p>

					<div className="mt-12 flex flex-col gap-4 sm:flex-row">
						<Link
							to="/sign-up"
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-8 py-4 font-semibold text-black text-lg transition-colors hover:bg-amber-300"
						>
							Start Free
							<ArrowRight className="h-5 w-5" />
						</Link>
						<Link
							to="/customer-discovery-for-consultants"
							className="inline-flex items-center justify-center rounded-lg border border-white/30 px-8 py-4 font-semibold text-lg transition-colors hover:bg-white/10"
						>
							For Consultants
						</Link>
					</div>
				</div>
			</section>

			{/* ── The Problem ── */}
			<section className="px-6 py-24 md:py-32">
				<div className="mx-auto max-w-4xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-5xl">
						You listen. You learn.
						<br />
						Then you lose it.
					</h2>

					<div className="mt-10 space-y-6 text-lg text-muted-foreground leading-relaxed md:text-xl">
						<p>
							Your team talks to customers every week. The insight is there — in a Zoom recording nobody watches, a
							Notion doc nobody finds, a Slack thread that scrolled away.
						</p>
						<p className="font-medium text-foreground">
							The tragedy isn't that you don't listen. It's that listening isn't enough.
						</p>
					</div>
				</div>
			</section>

			{/* ── The Proof Loop ── */}
			<section className="border-y bg-accent/20 px-6 py-24 md:py-32">
				<div className="mx-auto max-w-5xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-5xl">Four steps to conviction.</h2>
					<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
						Not a tool. An operating system for evidence-backed decisions.
					</p>

					<div className="mt-16 space-y-0">
						{proofLoop.map((step, i) => (
							<div
								key={step.title}
								className={`flex flex-col gap-6 border-l-2 py-8 pl-8 md:flex-row md:items-start md:gap-12 ${i === 2 ? "border-amber-400" : "border-border"}`}
							>
								<div className="shrink-0">
									<span className="font-light font-mono text-4xl text-muted-foreground/40">{step.step}</span>
								</div>
								<div>
									<h3 className="font-bold text-2xl">{step.title}</h3>
									<p className="mt-1 font-medium text-amber-600 dark:text-amber-400">{step.hook}</p>
									<p className="mt-3 max-w-xl text-muted-foreground">{step.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── The Differentiator ── */}
			<section className="px-6 py-24 md:py-32">
				<div className="mx-auto max-w-4xl text-center">
					<Quote className="mx-auto mb-6 h-10 w-10 text-amber-400" />
					<h2 className="font-bold text-3xl tracking-tight md:text-5xl">
						AI can say anything.
						<br />
						We show where it came from.
					</h2>
					<p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
						Click any theme, any finding, any recommendation — and see exactly who said it, when, in what context. This
						isn't AI hallucination. This is evidence you can verify.
					</p>
				</div>
			</section>

			{/* ── Comparison ── */}
			<section className="border-y px-6 py-24 md:py-32">
				<div className="mx-auto max-w-5xl">
					<h2 className="font-bold text-3xl tracking-tight md:text-5xl">
						Built for builders.
						<br />
						Not just researchers.
					</h2>
					<p className="mt-4 max-w-2xl text-muted-foreground">
						Most tools solve one slice. UpSight connects voice to evidence to decision.
					</p>

					<div className="mt-12 space-y-4">
						{[
							{
								name: "Research repositories",
								does: "Store, tag, and replay",
								gap: "Insight exists but action stalls",
							},
							{
								name: "Recruiting platforms",
								does: "Find participants faster",
								gap: "No synthesis-to-decision pipeline",
							},
							{
								name: "AI PM copilots",
								does: "Draft PRDs and specs",
								gap: "Accelerate writing before validating reality",
							},
						].map((row) => (
							<div key={row.name} className="grid gap-4 rounded-lg border p-5 text-sm sm:grid-cols-3 md:text-base">
								<div className="font-medium">{row.name}</div>
								<div className="text-muted-foreground">{row.does}</div>
								<div className="text-muted-foreground">{row.gap}</div>
							</div>
						))}

						{/* UpSight row — high contrast, always readable */}
						<div className="grid gap-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-5 text-sm sm:grid-cols-3 md:text-base dark:bg-amber-950/40">
							<div className="font-bold text-amber-900 dark:text-amber-200">UpSight</div>
							<div className="font-semibold text-amber-800 dark:text-amber-300">
								Capture &rarr; Synthesize &rarr; Verify &rarr; Decide
							</div>
							<div className="text-amber-700 dark:text-amber-400">Evidence-backed decisions at team speed</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── Fit Check ── */}
			<section className="px-6 py-24 md:py-32">
				<div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
					<div>
						<div className="mb-4 inline-flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
							<CheckCircle2 className="h-5 w-5" />
							UpSight is for you if
						</div>
						<ul className="space-y-4">
							{useCases.map((item) => (
								<li key={item} className="flex gap-3 text-lg">
									<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>

					<div>
						<div className="mb-4 inline-flex items-center gap-2 font-semibold text-zinc-500 dark:text-zinc-400">
							<CircleAlert className="h-5 w-5" />
							Probably not the right fit if
						</div>
						<ul className="space-y-4">
							{notUseCases.map((item) => (
								<li key={item} className="flex gap-3 text-lg text-muted-foreground">
									<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			{/* ── FAQ ── */}
			<section className="border-t px-6 py-24 md:py-32">
				<div className="mx-auto max-w-3xl">
					<h2 className="mb-12 font-bold text-3xl tracking-tight md:text-4xl">Common questions</h2>
					<Accordion type="multiple">
						{faqItems.map((item, i) => (
							<AccordionItem key={item.question} value={`faq-${i}`}>
								<AccordionTrigger className="py-6 font-semibold text-lg">{item.question}</AccordionTrigger>
								<AccordionContent className="pb-6 text-base text-muted-foreground">{item.answer}</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</section>

			{/* ── CTA ── */}
			<section className="px-6 py-24 md:py-32">
				<div className="mx-auto max-w-3xl text-center">
					<h2 className="font-bold text-4xl tracking-tight md:text-6xl">
						Get your customers.
						<br />
						<span className="text-amber-500">Build conviction.</span>
					</h2>
					<p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
						Start with five conversations. See what changes when every insight has receipts.
					</p>
					<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
						<Link
							to="/sign-up"
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-8 py-4 font-semibold text-black text-lg transition-colors hover:bg-amber-300"
						>
							Start Free
							<ArrowRight className="h-5 w-5" />
						</Link>
						<Link
							to="/customer-discovery-for-consultants"
							className="inline-flex items-center justify-center rounded-lg border px-8 py-4 font-semibold text-lg transition-colors hover:bg-accent"
						>
							Consultant Workflow
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
