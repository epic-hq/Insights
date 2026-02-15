import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DollarSign,
  Quote,
  Users,
} from "lucide-react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

export const meta: MetaFunction = () => {
  return [
    {
      title:
        "Customer Discovery for Consultants | Defensible SOW and Implementation Plans | UpSight",
    },
    {
      name: "description",
      content:
        "UpSight helps consulting teams turn stakeholder interviews into decision-ready discovery briefs, defensible SOW inputs, and implementation plans that hold up in executive review.",
    },
    {
      property: "og:title",
      content: "Customer Discovery for Consultants | UpSight",
    },
    {
      property: "og:description",
      content:
        "Interview once, align stakeholders fast, and deliver recommendations with evidence. Built for consulting teams where rework is expensive.",
    },
    { property: "og:type", content: "website" },
    {
      property: "og:url",
      content: "https://getupsight.com/customer-discovery-for-consultants",
    },
  ];
};

export const links: LinksFunction = () => [
  {
    rel: "canonical",
    href: "https://getupsight.com/customer-discovery-for-consultants",
  },
];

const consultantFlow = [
  {
    step: "01",
    title: "Capture",
    hook: "One stream. Every stakeholder.",
    description:
      "Interviews, calls, and discovery conversations across roles and functions — before context gets lost.",
  },
  {
    step: "02",
    title: "Synthesize",
    hook: "Patterns in minutes, not days.",
    description:
      "AI maps alignment gaps, execution constraints, and priorities across every stakeholder conversation.",
  },
  {
    step: "03",
    title: "Defend",
    hook: "Every recommendation has receipts.",
    description:
      "Link your findings to source evidence. When leadership challenges, you point to exactly who said what.",
  },
  {
    step: "04",
    title: "Execute",
    hook: "SOW-ready. Implementation-ready.",
    description:
      "Turn findings into scope boundaries, phased workstreams, and implementation plans your client can trust.",
  },
];

const deliverables = [
  "Stakeholder alignment map with agreement and conflict zones.",
  "Decision-ready discovery brief for sponsor review.",
  "Evidence-backed scope boundaries and risk register.",
  "Phased implementation plan with owners and milestones.",
  "Client-ready artifacts with source-linked recommendations.",
];

const switchReasons = [
  "Leadership challenged recommendations that lacked evidence trails.",
  "Discovery burned senior capacity before planning even started.",
  "Scope drift surfaced late because stakeholder conflicts weren't visible early.",
];

const differentiators = [
  {
    name: "Meeting note takers",
    does: "Single-call summaries",
    gap: "No cross-interview synthesis or defensibility layer",
  },
  {
    name: "Research repositories",
    does: "Storage, tagging, search",
    gap: "Weak support for consulting decision pressure",
  },
  {
    name: "Generic AI copilots",
    does: "Faster drafting",
    gap: "Polished output without source-linked evidence",
  },
];

const faqItems = [
  {
    question: "How does UpSight help consultants write stronger SOWs?",
    answer:
      "UpSight turns stakeholder interviews into a decision-ready discovery brief with evidence-backed priorities and scope boundaries, so SOW drafting is faster and easier to defend.",
  },
  {
    question: "Why is this different from AI meeting notes?",
    answer:
      "Meeting notes summarize one call at a time. UpSight synthesizes across stakeholders and links recommendations to source evidence so decisions hold up under challenge.",
  },
  {
    question: "Can this support implementation planning after discovery?",
    answer:
      "Yes. UpSight helps translate findings into phased workstreams, owners, and milestones so implementation planning is aligned and execution-ready.",
  },
  {
    question: "Who is this workflow for?",
    answer:
      "Fractional leaders, strategy consultants, transformation advisors, and boutique consulting firms handling stakeholder-heavy engagements.",
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

export default function CustomerDiscoveryForConsultants() {
  return (
    <div className="min-h-screen bg-background">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data required for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* ── Hero ── */}
      <section className="border-b bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-white md:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-medium text-sm text-zinc-300">
            <Briefcase className="h-4 w-4 text-amber-300" />
            For Consulting Teams
          </div>

          <h1 className="font-bold text-5xl leading-[1.1] tracking-tight md:text-7xl">
            From interviews to
            <br />
            <span className="text-amber-300">undeniable recommendations.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
            You run 8 stakeholder interviews. Then spend 3 days turning notes
            into a SOW. UpSight does the synthesis in minutes — so you walk in
            with clarity, not chaos.
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
              to="/customer-discovery"
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-8 py-4 font-semibold text-lg transition-colors hover:bg-white/10"
            >
              For Product Teams
            </Link>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Decision-ready in",
                value: "24 hours",
                icon: Clock3,
              },
              {
                label: "Time reclaimed per project",
                value: "8-12 hours",
                icon: DollarSign,
              },
              {
                label: "Built for",
                value: "Stakeholder-heavy engagements",
                icon: Users,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/20 bg-white/5 p-5"
              >
                <div className="flex items-center gap-2 text-amber-300">
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium text-xs uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-lg text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-3xl tracking-tight md:text-5xl">
            Spending more time synthesizing
            <br />
            than advising?
          </h2>

          <div className="mt-10 space-y-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
            <p>
              Discovery is the hard part of consulting. Not because interviews
              are difficult — but because turning 8 conversations into a
              defensible recommendation takes days of stitching,
              cross-referencing, and second-guessing.
            </p>
            <p className="font-medium text-foreground">
              Your senior talent shouldn't be synthesizing notes. They should be
              driving decisions.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Flow ── */}
      <section className="border-y bg-accent/20 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-bold text-3xl tracking-tight md:text-5xl">
            Interview to implementation.
            <br />
            Four steps.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Built for consulting delivery economics — not academic research
            timelines.
          </p>

          <div className="mt-16 space-y-0">
            {consultantFlow.map((step, i) => (
              <div
                key={step.title}
                className={`flex flex-col gap-6 border-l-2 py-8 pl-8 md:flex-row md:items-start md:gap-12 ${i === 2 ? "border-amber-400" : "border-border"}`}
              >
                <div className="shrink-0">
                  <span className="font-mono text-4xl font-light text-muted-foreground/40">
                    {step.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-2xl">{step.title}</h3>
                  <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">
                    {step.hook}
                  </p>
                  <p className="mt-3 max-w-xl text-muted-foreground">
                    {step.description}
                  </p>
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
            Consulting decisions get scrutinized.
            <br />
            Yours will have receipts.
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Click any recommendation and see exactly which stakeholder said it,
            when, in what context. When leadership pushes back, you don't argue
            from memory. You point to evidence.
          </p>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="border-y px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-bold text-3xl tracking-tight md:text-5xl">
            Why not just use
            <br />
            notes + AI?
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Because polished output without source-linked evidence is just an
            expensive guess.
          </p>

          <div className="mt-12 space-y-4">
            {differentiators.map((row) => (
              <div
                key={row.name}
                className="grid gap-4 rounded-lg border p-5 text-sm sm:grid-cols-3 md:text-base"
              >
                <div className="font-medium">{row.name}</div>
                <div className="text-muted-foreground">{row.does}</div>
                <div className="text-muted-foreground">{row.gap}</div>
              </div>
            ))}

            <div className="grid gap-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-5 text-sm dark:bg-amber-950/40 sm:grid-cols-3 md:text-base">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                UpSight
              </div>
              <div className="font-semibold text-amber-800 dark:text-amber-300">
                Cross-conversation intelligence with source-linked outputs
              </div>
              <div className="text-amber-700 dark:text-amber-400">
                Defensible recommendations, lower rework risk
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deliverables + Switch Reasons ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              What you walk away with
            </div>
            <ul className="space-y-4">
              {deliverables.map((item) => (
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
              Why teams switch to UpSight
            </div>
            <ul className="space-y-4">
              {switchReasons.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-lg text-muted-foreground"
                >
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
          <h2 className="mb-12 font-bold text-3xl tracking-tight md:text-4xl">
            Common questions
          </h2>
          <Accordion type="multiple">
            {faqItems.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger className="py-6 text-lg font-semibold">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-bold text-4xl tracking-tight md:text-6xl">
            Record your next
            <br />
            <span className="text-amber-500">client meeting.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            See what happens when your discovery synthesis takes minutes instead
            of days.
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
              to="/customer-discovery"
              className="inline-flex items-center justify-center rounded-lg border px-8 py-4 font-semibold text-lg transition-colors hover:bg-accent"
            >
              For Product Teams
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
