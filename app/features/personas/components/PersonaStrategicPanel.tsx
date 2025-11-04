import clsx from "clsx"
import { BadgeInfo, Brain, MessageSquare, Quote, Sparkles, Target, TriangleAlert } from "lucide-react"
import type * as React from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Button } from "~/components/ui/button"

type Strength = {
	name: string // e.g., "Strategic", "Learner"
	description?: string
	triggers?: string[] // what energizes movement
	antiTriggers?: string[] // what stalls progress
}

type Evidence = { quote: string; source?: string; context?: string }

export type PersonaStrategicProps = {
	// Identity
	name: string
	kind: "core" | "provisional" | "contrast"
	role?: string
	tags?: string[]
	// Styles
	strengths?: Strength[] // StrengthsFinder-style
	mbti?: string // e.g., "INTJ-A"
	enneagram?: string // e.g., "5w4"
	temperament?: string // e.g., "Analytical / Relational"
	// Behaviors & emotions
	behaviors?: string[] // observable patterns
	emotional_profile?: string[] // e.g., ["Curious", "Skeptical", "Status-aware"]
	// Sales / strategy intelligence
	effective_strategies?: string[] // approaches that worked
	recommended_questions?: string[] // to move them forward
	common_pitfalls?: string[] // what to avoid
	coaching_prompts?: string[] // for rep enablement / practice
	// Evidence & learning loop
	evidence?: Evidence[]
	learning_loop?: { last_tactics?: string[]; notes?: string }
	// UI
	className?: string
	onAskAI?: (topic: string) => void
}

const KIND_TONE: Record<PersonaStrategicProps["kind"], string> = {
	core: "text-sky-500 border-sky-700/40",
	provisional: "text-indigo-400 border-indigo-700/40",
	contrast: "text-emerald-400 border-emerald-700/40",
}

export const PersonaStrategicPanelMockData: PersonaStrategicProps = {
	name: "John Doe",
	kind: "core",
	role: "Core Persona",
	tags: ["tag1", "tag2"],
	strengths: [
		{
			name: "Woo",
			description: "Enthusiastic and persuasive",
			triggers: ["Excitement", "Inspiration"],
			antiTriggers: ["Skepticism", "Criticism"],
		},
		{
			name: "Learns fast",
			description: "Adaptable and self-motivated",
			triggers: ["Curiosity", "Challenges"],
			antiTriggers: ["Procrastination", "Lack of direction"],
		},
		{
			name: "Likes to tinker",
			description: "Creative and analytical",
			triggers: ["Experimentation", "Opportunities"],
			antiTriggers: ["Risk aversion", "Lack of resources"],
		},
	],
	mbti: "MBTI",
	enneagram: "Enneagram",
	temperament: "Temperament",
	behaviors: ["pattern1", "pattern2"],
	emotional_profile: ["profile1", "profile2"],
	effective_strategies: ["strategy1", "strategy2"],
	recommended_questions: ["question1", "question2"],
	common_pitfalls: ["pitfall1", "pitfall2"],
	coaching_prompts: ["prompt1", "prompt2"],
	evidence: [
		{
			quote: "Evidence quote 1",
			source: "Source 1",
			context: "Context 1",
		},
		{
			quote: "Evidence quote 2",
			source: "Source 2",
			context: "Context 2",
		},
	],
	learning_loop: {
		last_tactics: ["tactic1", "tactic2"],
		notes: "Notes",
	},
}

export default function PersonaStrategicPanel(props: PersonaStrategicProps) {
	const {
		name,
		kind,
		role,
		tags = [],
		strengths = [],
		mbti,
		enneagram,
		temperament,
		behaviors = [],
		emotional_profile = [],
		effective_strategies = [],
		recommended_questions = [],
		common_pitfalls = [],
		coaching_prompts = [],
		evidence = [],
		learning_loop,
		className,
		onAskAI,
	} = props

	const ask = (topic: string) => onAskAI?.(topic)

	return (
		<div className={clsx("rounded-2xl border border-zinc-800 bg-zinc-950 p-4", className)}>
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<div className={clsx("rounded-lg border px-2 py-0.5 text-xs", KIND_TONE[kind])}>{kind?.toUpperCase()}</div>
						<h2 className="truncate font-semibold text-lg text-zinc-100">{name}</h2>
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
						{role && <span>{role}</span>}
						{tags?.slice(0, 5).map((t) => (
							<span key={t} className="rounded bg-zinc-900 px-1.5 py-0.5">
								{t}
							</span>
						))}
					</div>
				</div>

				{/* Quick AI actions */}
				<div className="flex flex-wrap gap-2">
					<Button size="sm" variant="secondary" onClick={() => ask("suggest-questions")}>
						<MessageSquare className="mr-2 h-4 w-4" /> Ask AI: Next Questions
					</Button>
					<Button size="sm" variant="secondary" onClick={() => ask("strategy-recommendations")}>
						<Sparkles className="mr-2 h-4 w-4" /> Ask AI: Strategies
					</Button>
				</div>
			</div>

			{/* Accordion */}
			<Accordion type="multiple" className="mt-4">
				{/* Styles & Strengths */}
				<AccordionItem value="style">
					<AccordionTrigger className="text-sm">Style & Strengths</AccordionTrigger>
					<AccordionContent>
						<div className="grid gap-4 md:grid-cols-3">
							<InfoCard title="Strengths" icon={<Brain className="h-4 w-4" />}>
								{strengths.length ? (
									strengths.map((s) => (
										<div key={s.name} className="mb-3">
											<div className="font-medium text-zinc-200">{s.name}</div>
											{s.description && <div className="text-xs text-zinc-400">{s.description}</div>}
											{(s.triggers?.length || s.antiTriggers?.length) && (
												<div className="mt-1 grid grid-cols-2 gap-2 text-xs">
													{s.triggers?.length ? (
														<div>
															<div className="font-medium text-emerald-400">Triggers</div>
															<ul className="mt-1 list-disc pl-4 text-zinc-300">
																{s.triggers.map((t) => (
																	<li key={t}>{t}</li>
																))}
															</ul>
														</div>
													) : null}
													{s.antiTriggers?.length ? (
														<div>
															<div className="font-medium text-rose-400">Anti‑triggers</div>
															<ul className="mt-1 list-disc pl-4 text-zinc-300">
																{s.antiTriggers.map((t) => (
																	<li key={t}>{t}</li>
																))}
															</ul>
														</div>
													) : null}
												</div>
											)}
										</div>
									))
								) : (
									<Empty>Map 3–5 strengths to unlock coaching cues.</Empty>
								)}
							</InfoCard>

							<InfoCard title="Type" icon={<BadgeInfo className="h-4 w-4" />}>
								<KV label="MBTI" value={mbti} />
								<KV label="Enneagram" value={enneagram} />
								<KV label="Temperament" value={temperament} />
								{!mbti && !enneagram && !temperament && <Empty>Add MBTI/Enneagram to align comms style.</Empty>}
							</InfoCard>

							<InfoCard title="Emotional & Behaviors" icon={<Target className="h-4 w-4" />}>
								<KV label="Emotional profile" value={emotional_profile?.join(" • ")} />
								<KV label="Behaviors" value={behaviors?.join(" • ")} />
								{!emotional_profile?.length && !behaviors?.length && <Empty>Add 3–5 signals you can observe.</Empty>}
							</InfoCard>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Strategies */}
				<AccordionItem value="strategies">
					<AccordionTrigger className="text-sm">Strategic Intelligence</AccordionTrigger>
					<AccordionContent>
						<div className="grid gap-4 md:grid-cols-3">
							<BulletCard title="Effective approaches" items={effective_strategies} />
							<BulletCard title="Questions to advance" items={recommended_questions} />
							<BulletCard title="Common pitfalls" items={common_pitfalls} tone="danger" />
						</div>
						<div className="mt-4">
							<BulletCard
								title="Coaching prompts (practice)"
								items={coaching_prompts}
								icon={<Sparkles className="h-4 w-4" />}
							/>
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Evidence */}
				<AccordionItem value="evidence">
					<AccordionTrigger className="text-sm">Evidence & Quotes</AccordionTrigger>
					<AccordionContent>
						{evidence?.length ? (
							<ul className="space-y-3">
								{evidence.map((e, i) => (
									<li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
										<div className="flex items-start gap-2">
											<Quote className="h-4 w-4 text-zinc-400" />
											<div>
												<div className="text-zinc-200">“{e.quote}”</div>
												<div className="mt-1 text-xs text-zinc-500">
													{e.source ? `Source: ${e.source}` : ""}
													{e.context ? ` • ${e.context}` : ""}
												</div>
											</div>
										</div>
									</li>
								))}
							</ul>
						) : (
							<Empty>Add 2–4 quotes to ground recommendations.</Empty>
						)}
					</AccordionContent>
				</AccordionItem>

				{/* Learning loop */}
				<AccordionItem value="learning">
					<AccordionTrigger className="text-sm">Learning Loop</AccordionTrigger>
					<AccordionContent>
						{learning_loop?.last_tactics?.length ? (
							<div className="grid gap-4 md:grid-cols-2">
								<BulletCard title="Last tactics tried" items={learning_loop.last_tactics} />
								<InfoCard title="Notes">
									<div className="text-sm text-zinc-300">{learning_loop.notes}</div>
								</InfoCard>
							</div>
						) : (
							<Empty>Log tactics and outcomes to refine strategies with AI.</Empty>
						)}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	)
}

function InfoCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
			<div className="mb-2 flex items-center gap-2 font-medium text-sm text-zinc-200">
				{icon} <span>{title}</span>
			</div>
			{children}
		</div>
	)
}

function BulletCard({
	title,
	items = [],
	tone,
	icon,
}: {
	title: string
	items?: string[]
	tone?: "danger"
	icon?: React.ReactNode
}) {
	const toneCls = tone === "danger" ? "text-rose-400" : "text-zinc-200"
	return (
		<InfoCard
			title={title}
			icon={icon ?? <TriangleAlert className={clsx("h-4 w-4", tone === "danger" && "text-rose-400")} />}
		>
			{items.length ? (
				<ul className={clsx("list-disc pl-5 text-sm", toneCls)}>
					{items.map((it) => (
						<li key={it} className="mb-1 text-zinc-300">
							{it}
						</li>
					))}
				</ul>
			) : (
				<Empty>Add a few bullet points here.</Empty>
			)}
		</InfoCard>
	)
}

function KV({ label, value }: { label: string; value?: React.ReactNode }) {
	return (
		<div className="mb-1 text-sm">
			<span className="text-zinc-400">{label}: </span>
			<span className="text-zinc-200">{value || "—"}</span>
		</div>
	)
}

function Empty({ children }: { children: React.ReactNode }) {
	return <div className="text-xs text-zinc-500">{children}</div>
}
