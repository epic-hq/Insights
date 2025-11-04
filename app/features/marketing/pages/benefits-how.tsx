import { motion } from "framer-motion"
import {
	ArrowRight,
	CheckCircle2,
	Compass,
	Lightbulb,
	ListChecks,
	MessageSquare,
	Sparkles,
	Target,
	Users,
} from "lucide-react"
import type React from "react"
import { Link } from "react-router-dom"
import NavPageLayout from "~/components/layout/NavPageLayout"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { PATHS } from "~/paths"

// --- Animation helpers
const container = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.12, delayChildren: 0.1 },
	},
}

const item = {
	hidden: { opacity: 0, y: 18 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 1, 0.5, 1] } },
}

// --- Types
type Benefit = {
	title: string
	description: string
	icon?: React.ElementType
}

type Step = {
	title: string
	description: string
	icon?: React.ElementType
	ctaLabel?: string
	onClick?: () => void
}

// --- Defaults (edit to fit getupsight.com)
const defaultBenefits: Benefit[] = [
	{
		title: "Turn conversations into clarity",
		description: "Structured prompts and tagging convert raw interviews into direction you can act on.",
		icon: Lightbulb,
	},
	{
		title: "Find your ideal customers",
		description: "Spot patterns, segments, and jobs-to-be-done to focus roadmap and messaging.",
		icon: Users,
	},
	{
		title: "Validate what to build next",
		description: "Prioritize features based on pain, frequency, and willingness to pay — not vibes.",
		icon: Target,
	},
	{
		title: "Ship with proof, not assumptions",
		description: "Export evidence, excerpts, and insights for stakeholders, investors, and your own sanity.",
		icon: CheckCircle2,
	},
]

const defaultSteps: Step[] = [
	{
		title: "Plan questions",
		description: "Pick a goal, get tailored question sets, and avoid leading prompts.",
		icon: ListChecks,
	},
	{
		title: "Run interviews with confidence",
		description: "Lightweight guide, live notes, and smart cues keep you on track.",
		icon: MessageSquare,
	},
	{
		title: "Tag evidence & auto-extract insights",
		description: "Map quotes to pains, behaviors, and segments; generate takeaways you can defend.",
		icon: Sparkles,
	},
	{
		title: "Decide what's next",
		description: "Rank opportunities by impact × effort and align your team.",
		icon: Compass,
	},
]

// --- Components
export function KeyBenefits({
	headline = "Key Benefits",
	eyebrow = "Why Upsight",
	benefits = defaultBenefits,
}: {
	headline?: string
	eyebrow?: string
	benefits?: Benefit[]
}) {
	return (
		<section id="benefits" className="space-y-12">
			<motion.div
				initial={{ opacity: 0, y: 18 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
				className="text-center"
			>
				<Badge
					variant="secondary"
					className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5 font-medium text-secondary-foreground/80 text-xs backdrop-blur"
				>
					<Sparkles className="h-4 w-4" />
					{eyebrow}
				</Badge>
				<h2 className="mt-6 text-balance font-semibold text-4xl text-foreground tracking-tight md:text-5xl">
					{headline}
				</h2>
				<p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground leading-relaxed md:text-lg">
					Build with proof at any stage — idea, MVP, or post-launch.
				</p>
			</motion.div>

			<motion.ul
				variants={container}
				initial="hidden"
				whileInView="show"
				viewport={{ once: true, amount: 0.2 }}
				className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
			>
				{benefits.map((benefit) => (
					<motion.li key={benefit.title} variants={item}>
						<Card className="group hover:-translate-y-2 h-full border border-border/50 bg-white/90 shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-xl dark:border-border/40 dark:bg-slate-900/80">
							<CardHeader className="pb-4">
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
									{benefit.icon ? <benefit.icon className="h-6 w-6" aria-hidden="true" /> : null}
								</div>
								<CardTitle className="text-balance text-left font-semibold text-slate-900 text-xl leading-tight dark:text-white">
									{benefit.title}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-pretty text-base text-slate-700 leading-relaxed md:text-lg">{benefit.description}</p>
							</CardContent>
						</Card>
					</motion.li>
				))}
			</motion.ul>
		</section>
	)
}

export function HowItWorks({
	headline = "How It Works",
	eyebrow = "Workflow",
	steps = defaultSteps,
	ctaLabel = "Start my first interview plan",
	onCtaClick,
}: {
	headline?: string
	eyebrow?: string
	steps?: Step[]
	ctaLabel?: string
	onCtaClick?: () => void
}) {
	return (
		<section className="space-y-12">
			<motion.div
				initial={{ opacity: 0, y: 18 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
				className="text-center"
			>
				<Badge
					variant="outline"
					className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-1.5 font-medium text-foreground/70 text-xs backdrop-blur"
				>
					<Compass className="h-4 w-4" />
					{eyebrow}
				</Badge>
				<h2 className="mt-6 text-balance font-semibold text-4xl text-foreground tracking-tight md:text-5xl">
					{headline}
				</h2>
				<p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground leading-relaxed md:text-lg">
					From question planning to analysis — one simple, guided flow.
				</p>
			</motion.div>

			<motion.ol
				variants={container}
				initial="hidden"
				whileInView="show"
				viewport={{ once: true, amount: 0.2 }}
				className="grid gap-6 lg:grid-cols-2"
			>
				{steps.map((step, index) => (
					<motion.li key={step.title} variants={item}>
						<Card className="group hover:-translate-y-2 h-full border border-border/50 bg-white/90 shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-xl dark:border-border/40 dark:bg-slate-900/80">
							<CardHeader className="pb-4">
								<div className="flex items-start gap-4">
									<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-lg transition-transform duration-300 group-hover:scale-110">
										{step.icon ? (
											<step.icon className="h-7 w-7 text-white" aria-hidden="true" />
										) : (
											<Compass className="h-7 w-7 text-white" aria-hidden="true" />
										)}
									</div>
									<div className="min-w-0 flex-1 pt-1">
										<div className="mb-2 flex items-center gap-2">
											{/* <span className="font-mono text-muted-foreground text-xs uppercase tracking-wide">
												Step {index + 1}
											</span> */}
										</div>
										<CardTitle className="flex flex-row gap-2 text-balance text-left font-semibold text-slate-900 text-xl leading-tight md:text-2xl dark:text-white">
											<span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 font-bold text-foreground text-xs shadow-sm">
												{index + 1}
											</span>
											{step.title}
										</CardTitle>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-pretty text-base text-slate-700 leading-relaxed md:text-lg">{step.description}</p>
								{step.ctaLabel ? (
									<Button
										variant="ghost"
										className="mt-4 rounded-sm bg-amber-500 px-0 text-primary hover:bg-transparent"
										onClick={step.onClick}
									>
										{step.ctaLabel} →
									</Button>
								) : null}
							</CardContent>
						</Card>
					</motion.li>
				))}
			</motion.ol>

			<motion.div
				initial={{ opacity: 0, y: 14 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1], delay: 0.05 }}
				className="flex justify-center"
			>
				<Button
					size="lg"
					className="group hover:-translate-y-0.5 rounded-sm bg-yellow-500 px-8 py-6 font-medium text-base shadow-primary/20 transition-all duration-300 hover:bg-amber-500 hover:shadow-lg"
					onClick={onCtaClick}
				>
					<span className="flex items-center gap-2">
						{ctaLabel}
						<ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
					</span>
				</Button>
			</motion.div>
		</section>
	)
}

// --- Default export renders both blocks stacked inside NavPageLayout
function _UpsightBenefitsAndHowItWorks() {
	return (
		<NavPageLayout
			title="Benefits & Workflow"
			description="See how teams move from messy interviews to confident product decisions inside Upsight."
			headerBadge={
				<Badge variant="outline" className="rounded-full border border-border/60 px-3 py-1 text-xs">
					Marketing
				</Badge>
			}
			primaryAction={
				<Button asChild size="sm" className="">
					<Link to={PATHS.AUTH.REGISTER}>Start Free Trial</Link>
				</Button>
			}
			maxWidth="7xl"
		>
			<div className="space-y-12 py-8">
				<KeyBenefits />
				<HowItWorks />
			</div>
		</NavPageLayout>
	)
}
