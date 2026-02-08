import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PLANS } from "../../../config/plans";

const FEATURE_DISPLAY_NAMES = {
	smart_personas: "Smart Personas",
	survey_ai_analysis: "Survey AI Analysis",
	interview_guide: "Interview Guide",
	ai_crm: "AI CRM",
	team_workspace: "Team Workspace",
	sso: "Single Sign-On",
};

const CheckIcon = ({ muted }) => (
	<svg
		className={`h-5 w-5 ${muted ? "text-stone-500" : "text-emerald-400"}`}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={2.5}
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
	</svg>
);

const XIcon = () => (
	<svg className="h-4 w-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
		<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
	</svg>
);

/**
 * PricingTableV4 - Marketing Pricing Page
 *
 * Prices and core limits are imported from ~/config/plans.ts (single source of truth).
 * Feature sections below contain marketing-specific presentation and copy.
 *
 * @see app/config/plans.ts for billing-relevant plan data
 */
const PricingTable = () => {
	const [searchParams] = useSearchParams();
	const [billingCycle, setBillingCycle] = useState("monthly");

	// Read URL params for upgrade flow highlighting
	const highlightPlan = searchParams.get("plan"); // e.g., "starter", "pro"
	const highlightFeature = searchParams.get("feature"); // e.g., "smart_personas"
	const featureDisplayName = highlightFeature ? FEATURE_DISPLAY_NAMES[highlightFeature] || highlightFeature : null;

	// Import prices from single source of truth
	const { free, starter, pro, team } = PLANS;

	const plans = [
		{
			id: "free",
			name: free.name,
			subtitle: "Get started",
			description: free.description,
			price: free.price, // From plans.ts single source of truth
			highlight: false,
			cta: free.cta.label,
			ctaLink: free.cta.link,
			ctaStyle: free.cta.style,
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
			id: "starter",
			name: starter.name,
			subtitle: "For individuals",
			description: starter.description,
			price: starter.price, // From plans.ts single source of truth
			highlight: false,
			cta: starter.cta.label,
			ctaLink: starter.cta.link,
			ctaStyle: starter.cta.style,
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
			id: "pro",
			name: pro.name,
			subtitle: "For power users",
			description: pro.description,
			price: pro.price, // From plans.ts single source of truth
			highlight: true,
			badge: pro.badge,
			cta: pro.cta.label,
			ctaLink: pro.cta.link,
			ctaStyle: pro.cta.style,
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
			id: "team",
			name: team.name,
			subtitle: "For organizations",
			description: team.description,
			price: team.price, // From plans.ts single source of truth
			perUser: team.perUser,
			minUsers: team.minSeats, // From plans.ts single source of truth
			highlight: false,
			cta: team.cta.label,
			ctaLink: team.cta.link,
			ctaExternal: team.cta.external,
			ctaStyle: team.cta.style,
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
			note: `Minimum ${team.minSeats} users · $0.15/min voice overage`,
		},
	];

	return (
		<div
			className="min-h-screen bg-stone-950 px-4 py-20 text-stone-100 sm:px-6"
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

			<div className="mx-auto max-w-7xl">
				{/* Header */}
				<div className="mb-16 text-center">
					<p className="mb-4 font-medium text-amber-500 text-sm uppercase tracking-widest">Pricing</p>
					<h1 className="mb-6 font-serif text-4xl tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
						Capture everything.
						<br />
						<span className="text-stone-400 italic">Pay for intelligence.</span>
					</h1>
					<p className="mx-auto max-w-2xl text-lg text-stone-400 leading-relaxed">
						Unlimited recording and transcription on every plan. Upgrade for deeper analysis, automation, and team
						collaboration.
					</p>
				</div>

				{/* Billing Toggle */}
				<div className="mb-12 flex items-center justify-center gap-4">
					<span
						className={`font-medium text-sm transition-colors ${billingCycle === "monthly" ? "text-stone-100" : "text-stone-500"}`}
					>
						Monthly
					</span>
					<button
						onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
						className="relative h-7 w-14 rounded-full bg-stone-800 p-1 transition-colors hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
					>
						<div
							className={`h-5 w-5 rounded-full bg-amber-500 transition-transform duration-300 ${
								billingCycle === "annual" ? "translate-x-7" : "translate-x-0"
							}`}
						/>
					</button>
					<span
						className={`font-medium text-sm transition-colors ${billingCycle === "annual" ? "text-stone-100" : "text-stone-500"}`}
					>
						Annual
					</span>
					<span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-500 text-xs">Save 20%</span>
				</div>

				{/* Reverse Trial Banner */}
				<div className="mx-auto mb-12 max-w-2xl">
					<div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent px-6 py-4 text-center">
						<p className="text-sm text-stone-300">
							<span className="font-semibold text-amber-400">14-day full access</span> — Try all Pro features free, then
							choose your plan
						</p>
					</div>
				</div>

				{/* Feature Upgrade Banner - shown when redirected from feature gate */}
				{featureDisplayName && highlightPlan && (
					<div className="mx-auto mb-8 max-w-2xl">
						<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-6 py-4 text-center">
							<p className="text-sm text-stone-300">
								<span className="font-semibold text-amber-400">{featureDisplayName}</span> requires{" "}
								<span className="font-semibold text-stone-100">
									{highlightPlan.charAt(0).toUpperCase() + highlightPlan.slice(1)}
								</span>{" "}
								or higher
							</p>
						</div>
					</div>
				)}

				{/* Pricing Cards */}
				<div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
					{plans.map((plan) => {
						// Check if this plan should be highlighted via URL param
						const isUrlHighlighted = highlightPlan === plan.id;
						const shouldHighlight = plan.highlight || isUrlHighlighted;

						return (
							<div
								key={plan.name}
								className={`relative rounded-2xl transition-all duration-300 ${shouldHighlight ? "lg:-mt-4 lg:mb-4" : ""}`}
							>
								{/* Highlight border wrapper */}
								{shouldHighlight && (
									<div className="gradient-border absolute inset-0 rounded-2xl p-[1.5px]">
										<div className="h-full w-full rounded-2xl bg-stone-900" />
									</div>
								)}

								<div
									className={`relative flex h-full flex-col rounded-2xl p-6 ${
										shouldHighlight
											? "card-glow bg-stone-900"
											: "border border-stone-800 bg-stone-900/60 transition-colors hover:border-stone-700"
									}`}
								>
									{/* Badge */}
									{plan.badge && (
										<div className="-top-3 -translate-x-1/2 absolute left-1/2">
											<span className="whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 font-bold text-stone-900 text-xs shadow-lg">
												{plan.badge}
											</span>
										</div>
									)}

									{/* Plan Header */}
									<div className="mb-4">
										<h3 className="mb-1 font-bold text-xl">{plan.name}</h3>
										<p className="font-medium text-amber-500/80 text-sm">{plan.subtitle}</p>
									</div>

									{/* Price */}
									<div className="mb-4">
										<div className="flex items-baseline gap-1">
											<span className="font-bold text-4xl tracking-tight">${plan.price[billingCycle]}</span>
											{plan.price.monthly > 0 && (
												<span className="text-sm text-stone-500">/{plan.perUser ? "user/" : ""}mo</span>
											)}
										</div>
										{plan.minUsers && (
											<p className="mt-1 text-stone-500 text-xs">
												Min {plan.minUsers} users · ${plan.price[billingCycle] * plan.minUsers}/mo
											</p>
										)}
										{billingCycle === "annual" && plan.price.monthly > 0 && (
											<p className="mt-1 text-emerald-500/70 text-xs">
												${plan.price.annual * 12}
												{plan.perUser ? "/user" : ""}/year
											</p>
										)}
									</div>

									{/* Description */}
									<p className="mb-5 text-sm text-stone-400 leading-relaxed">{plan.description}</p>

									{/* CTA Button */}
									<a
										href={
											plan.ctaExternal
												? plan.ctaLink
												: plan.id === "free"
													? plan.ctaLink
													: `/api/billing/checkout?plan=${plan.id}&interval=${billingCycle === "annual" ? "year" : "month"}`
										}
										{...(plan.ctaExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
										className={`block w-full rounded-lg px-4 py-3 text-center font-semibold text-sm transition-all duration-200 ${
											plan.ctaStyle === "primary"
												? "bg-gradient-to-r from-amber-500 to-orange-600 text-stone-900 shadow-amber-500/25 shadow-lg hover:from-amber-400 hover:to-orange-500"
												: "border border-stone-700 bg-stone-800 text-stone-100 hover:border-stone-600 hover:bg-stone-700"
										} ${plan.id === "team" ? "mb-2" : "mb-6"}`}
									>
										{plan.cta}
									</a>
									{/* Get a Demo link for Team plan */}
									{plan.id === "team" && (
										<a
											href="https://cal.com/rickmoy"
											target="_blank"
											rel="noopener noreferrer"
											className="mb-6 block text-center text-sm text-stone-400 underline-offset-2 transition-colors hover:text-amber-400 hover:underline"
										>
											or get a demo
										</a>
									)}

									{/* Feature Sections */}
									<div className="flex-1 space-y-5">
										{plan.sections.map((section, sIdx) => (
											<div key={sIdx}>
												<p className="mb-2 font-semibold text-stone-500 text-xs uppercase tracking-wider">
													{section.title}
												</p>
												<ul className="space-y-2">
													{section.features.map((feature, fIdx) => (
														<li
															key={fIdx}
															className={`flex items-start gap-2.5 py-0.5 ${feature.highlight ? "feature-highlight" : ""}`}
														>
															<span className="mt-0.5 flex-shrink-0">
																{feature.included ? <CheckIcon muted={feature.limited} /> : <XIcon />}
															</span>
															<span className={`text-sm ${feature.included ? "text-stone-300" : "text-stone-600"}`}>
																{feature.name}
																{feature.value && feature.included && (
																	<span className={`ml-1 ${feature.limited ? "text-stone-500" : "text-stone-400"}`}>
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
										<p className="mt-5 border-stone-800/50 border-t pt-4 text-stone-600 text-xs">{plan.note}</p>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Value Props */}
				<div className="border-stone-800 border-t pt-16">
					<h2 className="mb-12 text-center font-serif text-3xl">
						Why teams choose <span className="text-amber-500 italic">UpSight</span>
					</h2>
					<div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-3">
						<div className="text-center">
							<div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
								<svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
									/>
								</svg>
							</div>
							<h4 className="mb-2 font-semibold text-lg">Capture Everything</h4>
							<p className="text-sm text-stone-500 leading-relaxed">
								Unlimited recording and transcription. We'll never charge you to capture conversations.
							</p>
						</div>
						<div className="text-center">
							<div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
								<svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
									/>
								</svg>
							</div>
							<h4 className="mb-2 font-semibold text-lg">Intelligence That Works</h4>
							<p className="text-sm text-stone-500 leading-relaxed">
								AI that extracts themes, builds ICP profiles, and tells you what to do next.
							</p>
						</div>
						<div className="text-center">
							<div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
								<svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</div>
							<h4 className="mb-2 font-semibold text-lg">Built for Teams</h4>
							<p className="text-sm text-stone-500 leading-relaxed">
								Shared evidence libraries, team annotations, and free viewer seats for stakeholders.
							</p>
						</div>
					</div>
				</div>

				{/* FAQ / CTA */}
				<div className="mt-20 border-stone-800 border-t pt-16 text-center">
					<h3 className="mb-4 font-serif text-2xl">Not sure which plan?</h3>
					<p className="mx-auto mb-6 max-w-md text-sm text-stone-400">
						Start with the 14-day trial. You'll have full Pro access to see what UpSight can do for your discovery
						process.
					</p>
					<div className="flex flex-col justify-center gap-4 sm:flex-row">
						<a
							href="/sign-up"
							className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-stone-900 transition-colors hover:bg-amber-400"
						>
							Start Free Trial
						</a>
						<a
							href="https://cal.com/rickmoy"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg border border-stone-700 bg-stone-800 px-6 py-3 font-semibold text-stone-100 transition-colors hover:bg-stone-700"
						>
							Talk to Sales
						</a>
					</div>
					<p className="mt-6 text-stone-600 text-xs">
						Questions?{" "}
						<a href="#" className="text-amber-500 underline underline-offset-2 hover:text-amber-400">
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
