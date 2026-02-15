import { ArrowRight, Check, LogIn, MessageCircle } from "lucide-react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { useAuth } from "~/contexts/AuthContext";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { PATHS } from "~/paths";

export const meta: MetaFunction = () => {
  return [
    { title: "Pricing | UpSight" },
    {
      name: "description",
      content:
        "Start free with full access. Unlimited recording and transcription on every plan. Paid plans from $15/mo.",
    },
    { property: "og:title", content: "Pricing | UpSight" },
    {
      property: "og:description",
      content:
        "14 days of full access, no credit card. See what UpSight does for your discovery process.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://getupsight.com/pricing" },
  ];
};

export const links: LinksFunction = () => [
  { rel: "canonical", href: "https://getupsight.com/pricing" },
];

const included = [
  "Unlimited recording and transcription",
  "AI-powered synthesis with evidence traceability",
  "Cross-conversation themes and patterns",
  "Smart surveys with AI analysis",
  "Interview guides and coaching",
  "People and organization tracking",
];

const faqItems = [
  {
    question: "What happens after 14 days?",
    answer:
      "You choose a plan. If you don't, you drop to Free — unlimited recording, 5 AI analyses per month, 1 project. No data lost.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. Start your trial instantly. We only ask for payment when you choose a paid plan.",
  },
  {
    question: "What's included in the free plan?",
    answer:
      "Unlimited recording and transcription, 5 AI analyses per month, 1 project, and cross-interview themes. Enough to see if UpSight fits your workflow.",
  },
  {
    question: "How does pricing work for teams?",
    answer:
      "Team plans start at $49/user/month with shared evidence libraries, cross-researcher search, and free viewer seats for stakeholders. Talk to us for details.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Anytime. Upgrade, downgrade, or cancel with no lock-in. Changes take effect at your next billing cycle.",
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

export default function Pricing() {
  const { user } = useAuth();
  const { accountId, projectId, projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");
  const hasProjectContext = Boolean(accountId && projectId);
  const dashboardLink = hasProjectContext ? routes.dashboard() : PATHS.HOME;

  return (
    <div className="min-h-screen bg-background">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data required for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* ── Hero ── */}
      <section className="border-b bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-white md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-bold text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-7xl">
            {user ? (
              <>Choose your plan.</>
            ) : (
              <>
                Try everything.
                <br />
                <span className="text-amber-300">Pay when you're ready.</span>
              </>
            )}
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-300 sm:text-xl md:text-2xl">
            {user
              ? "Unlimited recording and transcription on every plan. Upgrade for deeper analysis and team features."
              : "14 days of full access. No credit card. See what happens when every insight has receipts."}
          </p>

          {!user && (
            <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-8 py-4 font-semibold text-black text-lg transition-colors hover:bg-amber-300"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="https://cal.com/rickmoy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-8 py-4 font-semibold text-lg transition-colors hover:bg-white/10"
              >
                <MessageCircle className="h-5 w-5" />
                Book a Demo
              </a>
            </div>
          )}

          {user && (
            <div className="mt-10">
              <Link
                to={dashboardLink}
                className="inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── What's Included ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="font-bold text-3xl tracking-tight md:text-5xl">
              Everything you need.
              <br />
              Nothing you don't.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Every plan includes unlimited recording and transcription. We'll
              never charge you to capture conversations.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-lg">
            <ul className="space-y-5">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-4 text-lg">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Simple Pricing ── */}
      <section className="border-y bg-accent/20 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Free */}
            <div className="rounded-2xl border bg-card p-8">
              <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Free
              </p>
              <p className="mt-3 font-bold text-4xl tracking-tight">$0</p>
              <p className="mt-2 text-muted-foreground">Forever</p>
              <p className="mt-6 text-muted-foreground">
                Unlimited recording. 5 AI analyses/month. 1 project. Enough to
                see if it fits.
              </p>
              {user ? (
                <Link
                  to={dashboardLink}
                  className="mt-8 block rounded-lg border px-6 py-3 text-center font-semibold transition-colors hover:bg-accent"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <Link
                  to="/sign-up?plan=free"
                  className="mt-8 block rounded-lg border px-6 py-3 text-center font-semibold transition-colors hover:bg-accent"
                >
                  Start Free
                </Link>
              )}
            </div>

            {/* Starter */}
            <div className="rounded-2xl border-2 border-amber-400 bg-card p-8">
              <p className="font-medium text-amber-600 text-sm uppercase tracking-wide dark:text-amber-400">
                Starter
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-bold text-4xl tracking-tight">$15</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                Billed monthly. $12/mo annual.
              </p>
              <p className="mt-6 text-muted-foreground">
                Unlimited AI analyses. 3 projects. Smart personas and interview
                guides. Built for solo discovery.
              </p>
              {user ? (
                <Link
                  to={dashboardLink}
                  className="mt-8 block rounded-lg bg-amber-400 px-6 py-3 text-center font-semibold text-black transition-colors hover:bg-amber-300"
                >
                  Upgrade
                </Link>
              ) : (
                <Link
                  to="/sign-up"
                  className="mt-8 block rounded-lg bg-amber-400 px-6 py-3 text-center font-semibold text-black transition-colors hover:bg-amber-300"
                >
                  Start 14-Day Trial
                </Link>
              )}
            </div>

            {/* Teams */}
            <div className="rounded-2xl border bg-card p-8">
              <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Teams & Enterprise
              </p>
              <p className="mt-3 font-bold text-4xl tracking-tight">
                Let's talk
              </p>
              <p className="mt-2 text-muted-foreground">Custom for your team</p>
              <p className="mt-6 text-muted-foreground">
                Shared evidence libraries, team annotations, SSO, unlimited
                viewer seats, and onboarding support.
              </p>
              <a
                href="https://cal.com/rickmoy"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 block rounded-lg border px-6 py-3 text-center font-semibold transition-colors hover:bg-accent"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 py-24 md:py-32">
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
      {!user && (
        <section className="px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-bold text-4xl tracking-tight md:text-6xl">
              The best way to decide
              <br />
              <span className="text-amber-500">is to try it.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Upload five conversations. See the synthesis. Check the receipts.
              Then decide.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-8 py-4 font-semibold text-black text-lg transition-colors hover:bg-amber-300"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="https://cal.com/rickmoy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border px-8 py-4 font-semibold text-lg transition-colors hover:bg-accent"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
