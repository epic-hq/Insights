import { ArrowRight, BarChart2, Lightbulb, MessageSquare, Target, Users, Zap } from "lucide-react"
import { Link, type MetaFunction } from "react-router"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
export const meta: MetaFunction = () => {
	return [{ title: "Insights Platform" }, { name: "description", content: "Insights for conversations" }]
}

import MainNav from "~/components/navigation/MainNav"
import { PATHS } from "~/paths"

export default function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
			<MainNav />
			<main className="flex-1">
				{/* Hero Section */}
				<section className="w-full bg-gradient-to-r from-blue-500 to-purple-600 py-12 text-white md:py-24 lg:py-32 xl:py-48">
					<div className="container px-4 text-center md:px-6">
						<div className="space-y-6">
							<h1 className="font-bold text-4xl tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
								Understand your customers like never before
							</h1>
							<p className="mx-auto max-w-[700px] text-lg md:text-xl">
								Transform Questions, Conversations and Observations into Actionable Intelligence
							</p>
							<div className="space-x-4">
								<Button asChild className="bg-white px-8 py-3 font-semibold text-blue-600 text-lg hover:bg-gray-100">
									<Link to={PATHS.AUTH.REGISTER}>Start Free Trial</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									className="border-white bg-transparent px-8 py-3 font-semibold text-lg text-white hover:bg-white hover:text-blue-600"
								>
									<Link to="#features">Learn More</Link>
								</Button>
							</div>
						</div>
					</div>
				</section>

				{/* Features Section */}
				<section id="features" className="w-full bg-white py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<div className="flex flex-col items-center justify-center space-y-4 text-center">
							<div className="space-y-2">
								<div className="inline-block rounded-lg bg-blue-100 px-3 py-1 font-medium text-blue-700 text-sm">
									Powerful Features
								</div>
								<h2 className="font-bold text-3xl tracking-tighter sm:text-5xl">Unlock Deeper Understanding with AI</h2>
								<p className="max-w-[900px] text-gray-600 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
									Our platform combines advanced AI with intuitive visualizations to give you unparalleled insight into
									your customer data.
								</p>
							</div>
						</div>
						<div className="mx-auto grid max-w-5xl items-start gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<Zap className="mb-4 h-10 w-10 text-blue-600" />
									<CardTitle>Real-time AI Insights</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										Get instant, actionable discoveries pushed directly to you as new data emerges.
									</p>
								</CardContent>
							</Card>
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<Target className="mb-4 h-10 w-10 text-green-600" />
									<CardTitle>Intelligent Suggestions</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										Receive AI-driven recommendations for your next strategic move, guiding your decisions.
									</p>
								</CardContent>
							</Card>
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<BarChart2 className="mb-4 h-10 w-10 text-purple-600" />
									<CardTitle>Clustered Visualization</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										See patterns in your data at a glance with intuitive 2D dimensionality reduction.
									</p>
								</CardContent>
							</Card>
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<Users className="mb-4 h-10 w-10 text-orange-600" />
									<CardTitle>Dynamic User Personas</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										Understand your audience segments with rich, data-driven persona definitions.
									</p>
								</CardContent>
							</Card>
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<MessageSquare className="mb-4 h-10 w-10 text-red-600" />
									<CardTitle>Interactive AI Chat</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										Converse directly with your data and AI assistant for deeper exploration.
									</p>
								</CardContent>
							</Card>
							<Card className="flex flex-col items-center p-6 text-center">
								<CardHeader>
									<Lightbulb className="mb-4 h-10 w-10 text-blue-600" />
									<CardTitle>Track Key Questions</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-gray-600 text-sm">
										Measure insight coverage against your core business questions and research goals.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* How It Works Section */}
				<section id="how-it-works" className="w-full bg-gray-100 py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
							<div className="space-y-4">
								<div className="inline-block rounded-lg bg-purple-100 px-3 py-1 font-medium text-purple-700 text-sm">
									How It Works
								</div>
								<h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">
									From Raw Data to Strategic Decisions
								</h2>
								<p className="text-gray-600 md:text-xl/relaxed">
									InsightFlow AI streamlines your analysis process, turning unstructured feedback into clear, actionable
									intelligence.
								</p>
								<ul className="grid gap-4 text-gray-700">
									<li>
										<div className="flex items-start gap-3">
											<ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
											<div>
												<h3 className="font-semibold">Ingest & Vectorize</h3>
												<p className="text-sm">Automatically process and vectorize your text data.</p>
											</div>
										</div>
									</li>
									<li>
										<div className="flex items-start gap-3">
											<ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
											<div>
												<h3 className="font-semibold">Cluster & Visualize</h3>
												<p className="text-sm">AI identifies natural clusters and maps them to a 2D plot.</p>
											</div>
										</div>
									</li>
									<li>
										<div className="flex items-start gap-3">
											<ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
											<div>
												<h3 className="font-semibold">Analyze & Act</h3>
												<p className="text-sm">
													Interact with AI to get real-time insights and actionable suggestions.
												</p>
											</div>
										</div>
									</li>
								</ul>
							</div>
							<div className="flex justify-center">
								<img
									src="https://cdn.freebiesupply.com/images/large/2x/dashboard-q16.jpg"
									width="600"
									height="400"
									alt="Dashboard Screenshot"
									className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full lg:order-last"
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Call to Action Section */}
				<section className="w-full bg-gradient-to-r from-blue-500 to-purple-600 py-12 text-center text-white md:py-24 lg:py-32">
					<div className="container space-y-6 px-4 md:px-6">
						<h2 className="font-bold text-3xl tracking-tighter sm:text-4xl md:text-5xl">
							Ready to Transform Your Insights?
						</h2>
						<p className="mx-auto max-w-[800px] text-lg md:text-xl">
							Join thousands of businesses already making smarter decisions with InsightFlow AI.
						</p>
						<Button asChild className="bg-white px-10 py-4 font-semibold text-blue-600 text-xl hover:bg-gray-100">
							<Link href="/signup">Get Started Today</Link>
						</Button>
					</div>
				</section>
			</main>
			;
			<footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t bg-white px-4 py-6 text-gray-600 sm:flex-row md:px-6">
				<p className="text-xs">&copy; 2024 InsightFlow AI. All rights reserved.</p>
				<nav className="flex gap-4 sm:ml-auto sm:gap-6">
					<Link href="#" className="text-xs underline-offset-4 hover:underline" prefetch={false}>
						Terms of Service
					</Link>
					<Link href="#" className="text-xs underline-offset-4 hover:underline" prefetch={false}>
						Privacy
					</Link>
					<Link href="#" className="text-xs underline-offset-4 hover:underline" prefetch={false}>
						Contact
					</Link>
				</nav>
			</footer>
		</div>
	)
}
