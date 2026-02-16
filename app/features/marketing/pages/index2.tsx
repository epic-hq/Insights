import { ArrowRight, Clock, Lightbulb, Shield, Users } from "lucide-react";
import { Link, type MetaFunction } from "react-router";
import MarketingNav from "~/components/navigation/MarketingNav";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

import { PATHS } from "~/paths";

export const meta: MetaFunction = () => {
	return [
		{ title: "UpSight - Turn Conversations Into Strategic Decisions" },
		{
			name: "description",
			content:
				"The only research platform that coaches your team, uncovers wedge opportunities, and delivers executive-ready insights—backed by 100% traceable evidence. Built for business users, not researchers.",
		},
	];
};

export default function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
			<MarketingNav />
			<main className="flex-1">
				{/* Hero Section */}
				<section className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 py-12 text-white md:py-24 lg:py-32 xl:py-48">
					<div className="container px-4 text-center md:px-6">
						<div className="space-y-6">
							<div className="inline-block rounded-lg bg-white/10 px-4 py-2 font-medium text-sm backdrop-blur-sm">
								Built for Business Users, Not Researchers
							</div>
							<h1 className="font-bold text-4xl tracking-tight sm:text-5xl md:text-6xl lg:text-7xl/none">
								The only research platform that coaches your team, uncovers wedge opportunities, and delivers
								executive-ready insights
							</h1>
							<p className="mx-auto max-w-[800px] text-lg md:text-xl/relaxed">
								Turn everyday conversations into strategic decisions. From framing better questions to automated persona
								analysis, UpSight makes research effortless, rigorous, and actionable for everyone on your team.
							</p>
							<div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
								<Button asChild className="bg-white px-8 py-4 font-semibold text-blue-600 text-lg hover:bg-gray-100">
									<Link to={PATHS.AUTH.REGISTER}>Start Free Trial</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									className="border-white bg-transparent px-8 py-4 font-semibold text-lg text-white hover:bg-white hover:text-blue-600"
								>
									<Link to="#differentiators">See How It Works</Link>
								</Button>
							</div>
							<p className="text-sm text-white/80">
								✓ 100% traceable evidence &nbsp;&nbsp; ✓ Real-time insights &nbsp;&nbsp; ✓ Executive-ready outputs
							</p>
						</div>
					</div>
				</section>

				{/* Core Differentiators Section */}
				<section id="differentiators" className="w-full bg-white py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<div className="flex flex-col items-center justify-center space-y-4 text-center">
							<div className="space-y-2">
								<div className="inline-block rounded-lg bg-blue-100 px-3 py-1 font-medium text-blue-700 text-sm">
									Core Differentiators
								</div>
								<h2 className="font-bold text-3xl tracking-tighter sm:text-5xl">
									While others turn your team into researchers, we turn your conversations into strategic advantages
								</h2>
								<p className="max-w-[900px] text-gray-600 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
									Built for customer-facing teams who need insights, not research degrees.
								</p>
							</div>
						</div>
						<div className="mx-auto grid max-w-6xl items-start gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
							<Card className="flex h-full flex-col items-center p-6 text-center">
								<div className="flex flex-1 flex-col items-center">
									<div className="mb-4">
										<Lightbulb className="h-12 w-12 text-blue-600" />
									</div>
									<h3 className="mb-3 font-semibold text-lg">Smart Research Strategy Coach</h3>
									<p className="text-gray-600 text-sm">
										Guides framing of right questions to reduce bias. Strategic guidance before research even starts,
										not just analysis after.
									</p>
								</div>
							</Card>
							<Card className="flex h-full flex-col items-center p-6 text-center">
								<div className="flex flex-1 flex-col items-center">
									<div className="mb-4">
										<Users className="h-12 w-12 text-green-600" />
									</div>
									<h3 className="mb-3 font-semibold text-lg">Automated Persona & Theme Generation</h3>
									<p className="text-gray-600 text-sm">
										Persona-theme analysis to find wedge opportunities & core concerns. Direct path to opportunity
										discovery.
									</p>
								</div>
							</Card>
							<Card className="flex h-full flex-col items-center p-6 text-center">
								<div className="flex flex-1 flex-col items-center">
									<div className="mb-4">
										<Shield className="h-12 w-12 text-purple-600" />
									</div>
									<h3 className="mb-3 font-semibold text-lg">Evidence Traceability & Trust</h3>
									<p className="text-gray-600 text-sm">
										100% traceable evidence sources. Links every insight to real evidence for total traceability and
										trust.
									</p>
								</div>
							</Card>
							<Card className="flex h-full flex-col items-center p-6 text-center">
								<div className="flex flex-1 flex-col items-center">
									<div className="mb-4">
										<Clock className="h-12 w-12 text-orange-600" />
									</div>
									<h3 className="mb-3 font-semibold text-lg">Real-time Analysis</h3>
									<p className="text-gray-600 text-sm">
										Works in real time, so you can act while conversations are happening. Realtime insights vs static
										reports.
									</p>
								</div>
							</Card>
						</div>
					</div>
				</section>

				{/* How It Works Section */}
				<section id="how-it-works" className="w-full bg-gray-100 py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
							<div className="space-y-6">
								<div className="inline-block rounded-lg bg-purple-100 px-3 py-1 font-medium text-purple-700 text-sm">
									How It Works
								</div>
								<h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">
									From Conversations to Strategic Decisions
								</h2>
								<p className="text-gray-600 md:text-xl/relaxed">
									UpSight transforms your everyday customer conversations into decision-ready insights with complete
									traceability.
								</p>
								<div className="flex flex-wrap gap-2 text-center text-sm">
									<div className="rounded-full bg-blue-100 px-4 py-2 text-blue-700">Conversations</div>
									<ArrowRight className="h-6 w-6 text-gray-400" />
									<div className="rounded-full bg-green-100 px-4 py-2 text-green-700">Smart Coach</div>
									<ArrowRight className="h-6 w-6 text-gray-400" />
									<div className="rounded-full bg-purple-100 px-4 py-2 text-purple-700">Personas & Themes</div>
									<ArrowRight className="h-6 w-6 text-gray-400" />
									<div className="rounded-full bg-orange-100 px-4 py-2 text-orange-700">Wedge Opportunities</div>
									<ArrowRight className="h-6 w-6 text-gray-400" />
									<div className="rounded-full bg-red-100 px-4 py-2 text-red-700">Executive Summary</div>
								</div>
								<ul className="grid gap-6 text-gray-700">
									<li>
										<div className="flex items-start gap-4">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-semibold text-sm text-white">
												1
											</div>
											<div>
												<h3 className="font-semibold text-lg">Smart Question Coaching</h3>
												<p className="text-gray-600 text-sm">
													AI guides you to ask better questions that reduce bias and uncover real insights before you
													even start.
												</p>
											</div>
										</div>
									</li>
									<li>
										<div className="flex items-start gap-4">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 font-semibold text-sm text-white">
												2
											</div>
											<div>
												<h3 className="font-semibold text-lg">Automated Analysis</h3>
												<p className="text-gray-600 text-sm">
													Real-time persona mapping and theme identification from your conversations with 100% traceable
													evidence.
												</p>
											</div>
										</div>
									</li>
									<li>
										<div className="flex items-start gap-4">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 font-semibold text-sm text-white">
												3
											</div>
											<div>
												<h3 className="font-semibold text-lg">Executive-Ready Outputs</h3>
												<p className="text-gray-600 text-sm">
													Get wedge opportunities and executive summaries that travel well and drive immediate action.
												</p>
											</div>
										</div>
									</li>
								</ul>
							</div>
							<div className="flex justify-center">
								<img
									src="/images/dashboardScreen.jpg"
									width="600"
									height="400"
									alt="Dashboard Screenshot"
									className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center shadow-2xl sm:w-full lg:order-last"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Problem Section */}
				<section className="w-full bg-white py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<div className="mx-auto max-w-4xl text-center">
							<div className="space-y-4">
								<div className="inline-block rounded-lg bg-red-100 px-3 py-1 font-medium text-red-700 text-sm">
									The Problem with Traditional Research
								</div>
								<h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">
									Your team already has customer relationships. Why make research harder than it needs to be?
								</h2>
							</div>
							<div className="mx-auto mt-12 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Building Blind</h3>
									<p className="text-gray-600 text-sm">
										"We're making product bets without knowing which customer needs really matter"
									</p>
								</Card>
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Biased Signals</h3>
									<p className="text-gray-600 text-sm">
										"We talk to a few people, but it's hard to know if we're hearing the truth or just what we want to
										hear"
									</p>
								</Card>
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Fragmented Mess</h3>
									<p className="text-gray-600 text-sm">
										"Notes, calls, transcripts, sticky docs — all scattered and unusable when we need them"
									</p>
								</Card>
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Research Feels Too Hard</h3>
									<p className="text-gray-600 text-sm">
										"We're not researchers, but we need research-quality clarity to survive"
									</p>
								</Card>
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Slow to Clarity</h3>
									<p className="text-gray-600 text-sm">
										"By the time we turn conversations into slides, the moment (and urgency) is already gone"
									</p>
								</Card>
								<Card className="p-6 text-left">
									<h3 className="mb-3 font-semibold text-lg text-red-600">Investor Pressure</h3>
									<p className="text-gray-600 text-sm">
										"We're expected to show evidence of customer insight, but we don't have time to synthesize it all"
									</p>
								</Card>
							</div>
						</div>
					</div>
				</section>

				{/* Call to Action Section */}
				<section className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 py-12 text-center text-white md:py-24 lg:py-32">
					<div className="container space-y-6 px-4 md:px-6">
						<h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">
							Ready to Turn Your Conversations Into Strategic Advantages?
						</h2>
						<p className="mx-auto max-w-[800px] text-lg md:text-xl">
							Join forward-thinking teams who are already making faster, more confident decisions with UpSight.
						</p>
						<div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
							<Button asChild className="bg-white px-10 py-4 font-semibold text-blue-600 text-xl hover:bg-gray-100">
								<Link to={PATHS.AUTH.REGISTER}>Start Free Trial</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								className="border-white bg-transparent px-10 py-4 font-semibold text-lg text-white hover:bg-white hover:text-blue-600"
							>
								<Link to="#differentiators">See How It Works</Link>
							</Button>
						</div>
						<p className="text-sm text-white/80">
							✓ 14-day free trial &nbsp;&nbsp; ✓ Setup in minutes &nbsp;&nbsp; ✓ Cancel anytime
						</p>
					</div>
				</section>
			</main>
			<footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t bg-white px-4 py-6 text-gray-600 sm:flex-row md:px-6">
				<p className="text-xs">&copy; 2024 UpSight. All rights reserved.</p>
				<nav className="flex gap-4 sm:ml-auto sm:gap-6">
					<Link to="#" className="text-xs underline-offset-4 hover:underline">
						Terms of Service
					</Link>
					<Link to="#" className="text-xs underline-offset-4 hover:underline">
						Privacy
					</Link>
					<Link to="#" className="text-xs underline-offset-4 hover:underline">
						Contact
					</Link>
				</nav>
			</footer>
		</div>
	);
}
