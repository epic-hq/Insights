import { Link, type LinksFunction } from "react-router";

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
          Know your customers.{" "}
          <span className="text-[rgba(238,238,242,0.45)]">
            Serve them better.
          </span>
        </h1>
        <p className="mt-8 max-w-xl text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.65)] leading-relaxed">
          We started UpSight because we kept watching the same thing: teams talk
          to customers, but they're not always reaching the right people or
          asking the right questions. And whatever they do learn scatters across
          five tools and someone's memory.
        </p>
        <p className="mt-4 max-w-xl text-[clamp(1rem,1.3vw,1.15rem)] text-[rgba(238,238,242,0.65)] leading-relaxed">
          We're building the system that helps you{" "}
          <span className="text-amber-400/90">engage</span> the right people,{" "}
          <span className="text-sky-400/90">understand</span> what matters, and
          make decisions you can{" "}
          <span className="text-emerald-400/90">defend</span>.
        </p>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:pb-28">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 border-l-amber-500/40 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-amber-400/80 tracking-[0.18em]">
              ENGAGE
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Know who to talk to, what to ask, and what you've already learned.
              Reach the right people on the right topics.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 border-l-sky-400/40 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-sky-400/80 tracking-[0.18em]">
              UNDERSTAND
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Every insight links to who said it, when, and why it matters.
              Grounded, not generated. Cross-source, not siloed.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 border-l-emerald-400/40 bg-white/[0.03] p-6">
            <p className="font-medium text-[0.7rem] text-emerald-400/80 tracking-[0.18em]">
              DEFEND
            </p>
            <p className="mt-3 text-[rgba(238,238,242,0.72)] text-sm leading-relaxed">
              Research that ships. Insights become tasks with owners, and every
              decision shows its receipts.
            </p>
          </div>
        </div>
      </section>

      {/* ── Leadership ── */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:pb-28">
        <div className="border-t border-white/[0.06] pt-16">
          <p className="font-medium text-[0.7rem] text-[rgba(238,238,242,0.45)] tracking-[0.22em] mb-10">
            LEADERSHIP
          </p>
          <div className="flex flex-col gap-10 md:flex-row md:gap-14">
            <div className="flex-shrink-0">
              <img
                src="/images/rick-moy.jpg"
                alt="Rick Moy, Founder & CEO"
                className="w-48 h-60 object-cover rounded-lg grayscale brightness-110 contrast-105"
              />
            </div>
            <div className="max-w-2xl">
              <h2 className="font-semibold text-2xl tracking-[-0.02em]">
                Rick Moy
              </h2>
              <p className="mt-1.5 text-sm font-medium text-[rgba(238,238,242,0.5)]">
                Founder & CEO
              </p>
              <p className="mt-6 text-[clamp(0.9rem,1.15vw,1.05rem)] text-[rgba(238,238,242,0.72)] leading-[1.7]">
                Multi-exit founder, CEO, CPO, and CMO with over two decades
                building and scaling B2B SaaS companies in cybersecurity, AI,
                and cloud networking.
              </p>
              <p className="mt-4 text-[clamp(0.9rem,1.15vw,1.05rem)] text-[rgba(238,238,242,0.72)] leading-[1.7]">
                As co-founder and CEO of NSS Labs, Rick created an entirely new
                market category by talking to hundreds of IT security
                professionals and discovering they were making million-dollar
                purchasing decisions with zero empirical data. That
                insight-driven approach to customer discovery has been the
                through-line of his career.
              </p>
              <p className="mt-4 text-[clamp(0.9rem,1.15vw,1.05rem)] text-[rgba(238,238,242,0.72)] leading-[1.7]">
                Rick has held executive roles at ESET, Accuknox, Acalvio,
                Tempered Networks, and Websense, and is currently building{" "}
                <Link
                  to="https://getupsight.com"
                  target="_blank"
                  className="text-amber-400/90 hover:text-amber-300 transition-colors"
                >
                  UpSight
                </Link>
                , an AI-powered customer intelligence platform to help teams get
                their customer. He is an active startup advisor and investor in
                the San Diego ecosystem, and a regular speaker on AI, product
                strategy and go-to-market.
              </p>
              <p className="mt-4 text-[clamp(0.9rem,1.15vw,1.05rem)] text-[rgba(238,238,242,0.72)] leading-[1.7]">
                As a Techstars mentor, Rick brings a founder's instinct for
                finding the real problem behind the stated problem — and helping
                teams build conviction through evidence, not assumptions.
              </p>
            </div>
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
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 font-medium text-sm text-[#050508] transition-colors hover:bg-amber-300"
          >
            Join the team
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </section>
    </div>
  );
}
