import type { LinksFunction } from "react-router";

export const links: LinksFunction = () => [
  {
    rel: "canonical",
    href: "https://getupsight.com/about",
  },
];

const ROLES = [
  {
    title: "Growth",
    blurb:
      "Own the funnel from first touch to activation. You'll run experiments across content, community, and product-led channels to put UpSight in front of founders and consultants who talk to customers every week.",
  },
  {
    title: "AI Engineer",
    blurb:
      "Build the synthesis and traceability engine that makes every insight provable. You'll work across LLM pipelines, embedding search, and structured extraction — shipping AI that's useful, not just impressive.",
  },
  {
    title: "UX Researcher",
    blurb:
      "Practice what we preach. You'll run continuous discovery with our users, surface patterns, and translate evidence into product decisions — using UpSight itself as your primary tool.",
  },
  {
    title: "Enterprise Sales",
    blurb:
      "Take UpSight into mid-market and enterprise teams who are drowning in unstructured customer signal. Consultative, evidence-driven selling — no scripts, no spam.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-[#eeeef2]">
      {/* ── Hero ── */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.22em]">
          ABOUT UPSIGHT
        </p>
        <h1 className="mt-5 max-w-3xl font-semibold text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] tracking-[-0.025em]">
          Conversations happen.{" "}
          <span className="text-[rgba(238,238,242,0.45)]">
            Insights shouldn't have to disappear.
          </span>
        </h1>
        <p className="mt-8 max-w-xl text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.65)] leading-relaxed">
          We started UpSight because we kept watching the same thing: teams talk
          to customers constantly, then make decisions on opinions anyway.
          Evidence gets lost across five tools and someone's memory.
        </p>
        <p className="mt-4 max-w-xl text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.65)] leading-relaxed">
          We're building the system that closes that gap — so every decision
          shows its receipts.
        </p>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:pb-28">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.18em]">
              PRODUCT
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Workflows that feel obvious on day one. Human + AI, never AI-only.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.18em]">
              EVIDENCE
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Every insight links to who said it, when, and why it matters.
              Grounded, not generated.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.18em]">
              ACTION
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Research that ships. Insights become tasks with owners, not slides
              that collect dust.
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto w-full max-w-5xl px-6">
        <hr className="border-white/[0.06]" />
      </div>

      {/* ── Careers ── */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.22em]">
          CAREERS
        </p>
        <h2 className="mt-5 max-w-2xl font-semibold text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.12] tracking-[-0.02em]">
          Help teams make decisions they can defend.
        </h2>
        <p className="mt-5 max-w-lg text-[rgba(238,238,242,0.55)] text-[clamp(0.95rem,1.2vw,1.05rem)] leading-relaxed">
          Small team, real ownership, customers who care. We're hiring people
          who'd rather ship than deck.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <p className="font-semibold text-base tracking-[-0.01em]">
                {role.title}
              </p>
              <p className="mt-2 text-[rgba(238,238,242,0.6)] text-sm leading-relaxed">
                {role.blurb}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <a
            href="mailto:careers@getupsight.com?subject=Joining%20the%20team"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-medium text-sm text-[#050508] transition-opacity hover:opacity-90"
          >
            Join the team
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </section>
    </div>
  );
}
