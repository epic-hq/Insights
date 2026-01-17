import React, { useState } from "react";

const PricingTable = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");

  const plans = [
    {
      name: "Free",
      subtitle: "Get started",
      description: "Record everything, analyze 5 interviews/month",
      price: { monthly: 0, annual: 0 },
      highlight: false,
      cta: "Start Free",
      ctaLink: "/sign-up",
      ctaStyle: "secondary",
      sections: [
        {
          title: "Core",
          features: [
            {
              name: "Recording & transcription",
              value: "Unlimited",
              included: true,
            },
            {
              name: "AI analyses",
              value: "5/month",
              included: true,
              limited: true,
            },
            { name: "Projects", value: "1", included: true, limited: true },
            { name: "Cross-interview themes", included: true },
            {
              name: "Video retention",
              value: "30 days",
              included: true,
              limited: true,
            },
          ],
        },
        {
          title: "Surveys",
          features: [
            {
              name: "Survey responses",
              value: "50/month",
              included: true,
              limited: true,
            },
            { name: "Survey AI analysis", included: false },
          ],
        },
      ],
      note: "UpSight watermark on exports",
    },
    {
      name: "Starter",
      subtitle: "For individuals",
      description: "Unlimited analysis, find themes, organize your discovery",
      price: { monthly: 15, annual: 12 },
      highlight: false,
      cta: "Get Started",
      ctaLink: "/signup?plan=starter",
      ctaStyle: "secondary",
      sections: [
        {
          title: "Core",
          features: [
            {
              name: "Recording & transcription",
              value: "Unlimited",
              included: true,
            },
            { name: "AI analyses", value: "Unlimited", included: true },
            { name: "Projects", value: "3", included: true },
            { name: "Cross-interview themes", included: true },
            { name: "Video retention", value: "90 days", included: true },
            { name: "Realtime voice", value: "60 min/mo", included: true },
          ],
        },
        {
          title: "Intelligence",
          features: [
            {
              name: "Interview Guide",
              value: "AI conversation prompts",
              included: true,
            },
            {
              name: "Smart Insights",
              value: "with evidence traceback",
              included: true,
            },
            { name: "Smart Personas", included: true },
          ],
        },
        {
          title: "Organization",
          features: [
            { name: "AI-native CRM", included: true },
            { name: "Integrated Docs & Sheets", included: true },
          ],
        },
        {
          title: "Surveys",
          features: [
            { name: "Survey responses", value: "500/month", included: true },
            { name: "Survey AI analysis", included: true },
          ],
        },
      ],
      note: "$0.15/min voice overage",
    },
    {
      name: "Pro",
      subtitle: "For power users",
      description: "Full intelligence layer with automation and coaching",
      price: { monthly: 29, annual: 23 },
      highlight: true,
      badge: "Most Popular",
      cta: "Go Pro",
      ctaLink: "/signup?plan=pro",
      ctaStyle: "primary",
      sections: [
        {
          title: "Everything in Starter, plus:",
          features: [
            { name: "Projects", value: "Unlimited", included: true },
            { name: "Video retention", value: "1 year", included: true },
            { name: "Realtime voice", value: "180 min/mo", included: true },
            { name: "Survey responses", value: "2,000/month", included: true },
          ],
        },
        {
          title: "Intelligence",
          features: [
            {
              name: "Custom AI extraction (Lenses)",
              included: true,
              highlight: true,
            },
            { name: "Segment & ICP analysis", included: true, highlight: true },
            { name: "Deal analysis & guidance", included: true },
          ],
        },
        {
          title: "Automation",
          features: [
            { name: "Tasks system", included: true },
            { name: "Daily briefing", included: true, highlight: true },
            { name: "Coaching & guidance", included: true },
            { name: "Followup emails", included: true, highlight: true },
          ],
        },
        {
          title: "Output",
          features: [
            {
              name: "PPTX & report export",
              value: "Coming soon",
              included: true,
              coming: true,
            },
            { name: "Sharing (no watermark)", included: true },
          ],
        },
      ],
      note: "$0.15/min voice overage",
    },
    {
      name: "Team",
      subtitle: "For organizations",
      description: "Every conversation. One source of truth.",
      price: { monthly: 35, annual: 28 },
      perUser: true,
      minUsers: 3,
      highlight: false,
      cta: "Contact Sales",
      ctaLink: "https://cal.com/rickmoy",
      ctaExternal: true,
      ctaStyle: "secondary",
      sections: [
        {
          title: "Everything in Pro, plus:",
          features: [
            { name: "Video retention", value: "Unlimited", included: true },
            { name: "Realtime voice", value: "300 min/user", included: true },
            { name: "Survey responses", value: "5,000 pooled", included: true },
          ],
        },
        {
          title: "Collaboration",
          features: [
            {
              name: "Shared evidence library",
              included: true,
              highlight: true,
            },
            {
              name: "Team comments & annotations",
              included: true,
              highlight: true,
            },
            { name: "Cross-researcher search", included: true },
            {
              name: "Free viewer seats",
              value: "Unlimited",
              included: true,
              highlight: true,
            },
          ],
        },
        {
          title: "Enterprise",
          features: [
            {
              name: "External CRM push",
              value: "Salesforce, HubSpot",
              included: true,
            },
            { name: "SSO / SAML", included: true },
            { name: "Onboarding support", included: true },
          ],
        },
      ],
      note: "Minimum 3 users · $0.15/min voice overage",
    },
  ];

  const CheckIcon = ({ muted }) => (
    <svg
      className={`w-5 h-5 ${muted ? "text-stone-500" : "text-emerald-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  const XIcon = () => (
    <svg
      className="w-4 h-4 text-stone-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );

  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-100 py-20 px-4 sm:px-6"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&display=swap');
        
        .font-serif { font-family: 'Instrument Serif', serif; }
        
        .gradient-border {
          background: linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%);
        }
        
        .card-glow {
          box-shadow: 0 0 80px -20px rgba(245, 158, 11, 0.2);
        }
        
        .feature-highlight {
          background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%);
          margin-left: -8px;
          padding-left: 8px;
          border-left: 2px solid rgba(245, 158, 11, 0.5);
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-amber-500 text-sm font-medium tracking-widest uppercase mb-4">
            Pricing
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 tracking-tight">
            Record everything.
            <br />
            <span className="italic text-stone-400">Pay for intelligence.</span>
          </h1>
          <p className="text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Unlimited recording and transcription on every plan. Upgrade for
            deeper analysis, automation, and team collaboration.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-medium transition-colors ${billingCycle === "monthly" ? "text-stone-100" : "text-stone-500"}`}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")
            }
            className="relative w-14 h-7 bg-stone-800 rounded-full p-1 transition-colors hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <div
              className={`w-5 h-5 rounded-full bg-amber-500 transition-transform duration-300 ${
                billingCycle === "annual" ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${billingCycle === "annual" ? "text-stone-100" : "text-stone-500"}`}
          >
            Annual
          </span>
          <span className="text-xs text-amber-500 font-semibold bg-amber-500/10 px-3 py-1 rounded-full">
            Save 20%
          </span>
        </div>

        {/* Reverse Trial Banner */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/20 rounded-xl px-6 py-4 text-center">
            <p className="text-sm text-stone-300">
              <span className="text-amber-400 font-semibold">
                14-day full access
              </span>{" "}
              — Try all Pro features free, then choose your plan
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5 mb-20">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl transition-all duration-300 ${
                plan.highlight ? "lg:-mt-4 lg:mb-4" : ""
              }`}
            >
              {/* Highlight border wrapper */}
              {plan.highlight && (
                <div className="absolute inset-0 gradient-border rounded-2xl p-[1.5px]">
                  <div className="w-full h-full bg-stone-900 rounded-2xl" />
                </div>
              )}

              <div
                className={`relative h-full rounded-2xl p-6 flex flex-col ${
                  plan.highlight
                    ? "bg-stone-900 card-glow"
                    : "bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition-colors"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold text-stone-900 bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-amber-500/80 text-sm font-medium">
                    {plan.subtitle}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      ${plan.price[billingCycle]}
                    </span>
                    {plan.price.monthly > 0 && (
                      <span className="text-stone-500 text-sm">
                        /{plan.perUser ? "user/" : ""}mo
                      </span>
                    )}
                  </div>
                  {plan.minUsers && (
                    <p className="text-stone-500 text-xs mt-1">
                      Min {plan.minUsers} users · $
                      {plan.price[billingCycle] * plan.minUsers}/mo
                    </p>
                  )}
                  {billingCycle === "annual" && plan.price.monthly > 0 && (
                    <p className="text-emerald-500/70 text-xs mt-1">
                      ${plan.price.annual * 12}
                      {plan.perUser ? "/user" : ""}/year
                    </p>
                  )}
                </div>

                {/* Description */}
                <p className="text-stone-400 text-sm mb-5 leading-relaxed">
                  {plan.description}
                </p>

                {/* CTA Button */}
                <a
                  href={plan.ctaLink}
                  {...(plan.ctaExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 mb-6 text-center block ${
                    plan.ctaStyle === "primary"
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-stone-900 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/25"
                      : "bg-stone-800 text-stone-100 hover:bg-stone-700 border border-stone-700 hover:border-stone-600"
                  }`}
                >
                  {plan.cta}
                </a>

                {/* Feature Sections */}
                <div className="flex-1 space-y-5">
                  {plan.sections.map((section, sIdx) => (
                    <div key={sIdx}>
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                        {section.title}
                      </p>
                      <ul className="space-y-2">
                        {section.features.map((feature, fIdx) => (
                          <li
                            key={fIdx}
                            className={`flex items-start gap-2.5 py-0.5 ${feature.highlight ? "feature-highlight" : ""}`}
                          >
                            <span className="mt-0.5 flex-shrink-0">
                              {feature.included ? (
                                <CheckIcon muted={feature.limited} />
                              ) : (
                                <XIcon />
                              )}
                            </span>
                            <span
                              className={`text-sm ${
                                feature.included
                                  ? "text-stone-300"
                                  : "text-stone-600"
                              }`}
                            >
                              {feature.name}
                              {feature.value && feature.included && (
                                <span
                                  className={`ml-1 ${feature.limited ? "text-stone-500" : "text-stone-400"}`}
                                >
                                  · {feature.value}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Note */}
                {plan.note && (
                  <p className="text-stone-600 text-xs mt-5 pt-4 border-t border-stone-800/50">
                    {plan.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Value Props */}
        <div className="border-t border-stone-800 pt-16">
          <h2 className="font-serif text-3xl text-center mb-12">
            Why teams choose{" "}
            <span className="italic text-amber-500">UpSight</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-lg mb-2">Capture Everything</h4>
              <p className="text-stone-500 text-sm leading-relaxed">
                Unlimited recording and transcription. We'll never charge you to
                capture conversations.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-lg mb-2">
                Intelligence That Works
              </h4>
              <p className="text-stone-500 text-sm leading-relaxed">
                AI that extracts themes, builds ICP profiles, and tells you what
                to do next.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-lg mb-2">Built for Teams</h4>
              <p className="text-stone-500 text-sm leading-relaxed">
                Shared evidence libraries, team annotations, and free viewer
                seats for stakeholders.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ / CTA */}
        <div className="text-center mt-20 pt-16 border-t border-stone-800">
          <h3 className="font-serif text-2xl mb-4">Not sure which plan?</h3>
          <p className="text-stone-400 text-sm mb-6 max-w-md mx-auto">
            Start with the 14-day trial. You'll have full Pro access to see what
            UpSight can do for your discovery process.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/sign-up"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              Start Free Trial
            </a>
            <a
              href="https://cal.com/rickmoy"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold rounded-lg border border-stone-700 transition-colors"
            >
              Talk to Sales
            </a>
          </div>
          <p className="text-stone-600 text-xs mt-6">
            Questions?{" "}
            <a
              href="#"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              Read the FAQ
            </a>{" "}
            or email us at hello@upsight.ai
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;
