import { Book, Briefcase, Compass, Layers3, Lightbulb, Package, Users, Zap } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function DocsIndex() {
	return (
		<div className="container mx-auto max-w-5xl px-4 py-12">
			{/* Header */}
			<div className="mb-12">
				<h1 className="mb-4 font-bold text-4xl tracking-tight">Documentation</h1>
				<p className="text-lg text-muted-foreground">
					Learn how to get the most out of Insights for your research projects
				</p>
			</div>

			{/* Introduction */}
			<Card className="mb-12">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Book className="h-5 w-5" />
						Welcome to Insights
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-muted-foreground">
					<p>
						<strong className="text-foreground">Insights</strong> is your AI-powered research companion that helps you
						conduct, organize, and analyze customer research at scale. Whether you're validating a product idea,
						understanding user needs, or discovering market opportunities, Insights streamlines your entire research
						workflow.
					</p>

					<div className="space-y-3">
						<h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">How It Works</h3>

						<div className="space-y-4">
							<div>
								<h4 className="mb-1 font-medium text-foreground">1. Plan Your Research</h4>
								<p className="text-sm">
									Define your research goals, decision questions, and target personas. Our AI helps you craft better
									questions and structure your research for maximum impact.
								</p>
							</div>

							<div>
								<h4 className="mb-1 font-medium text-foreground">2. Recruit & Connect</h4>
								<p className="text-sm">
									Track your research participants and conduct interviews. Upload audio, video, or text transcripts—our
									AI automatically extracts insights, identifies themes, and links findings to your research questions.
								</p>
							</div>

							<div>
								<h4 className="mb-1 font-medium text-foreground">3. Discover Patterns</h4>
								<p className="text-sm">
									Explore themes across interviews, group insights by persona, and visualize patterns in your data. Our
									AI surfaces hidden connections and helps you understand what matters most to your users.
								</p>
							</div>
						</div>
					</div>

					<div className="rounded-lg border-primary border-l-4 bg-primary/5 p-4">
						<p className="font-medium text-foreground text-sm">💡 Pro Tip</p>
						<p className="mt-1 text-sm">
							Start with a clear research goal and 2-3 key decision questions. This helps the AI provide more relevant
							insights and keeps your research focused.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Quick Links */}
			<div className="mb-8">
				<h2 className="mb-6 font-semibold text-2xl">Quick Start Guides</h2>
				<div className="grid gap-6 md:grid-cols-2">
					<Link to="/docs/getting-started" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Compass className="h-5 w-5" />
									Getting Started
								</CardTitle>
								<CardDescription>
									Set up your first project, define research goals, and prepare for interviews
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>

					<Link to="/docs/research-workflow" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Users className="h-5 w-5" />
									Research Workflow
								</CardTitle>
								<CardDescription>Learn the complete research process from planning to analysis</CardDescription>
							</CardHeader>
						</Card>
					</Link>

					<Link to="/docs/analyzing-insights" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Lightbulb className="h-5 w-5" />
									Analyzing Insights
								</CardTitle>
								<CardDescription>
									Discover patterns, validate hypotheses, and extract actionable findings
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>
					<Link to="/docs/conversation-lenses" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Layers3 className="h-5 w-5" />
									Conversation Lenses
								</CardTitle>
								<CardDescription>
									Understand how SPICED, BANT, MEDDIC, MAP, and team perspectives are stored, edited, and refreshed
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>

					<Link to="/docs/product-lens" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Package className="h-5 w-5" />
									Product Lens
								</CardTitle>
								<CardDescription>
									Prioritize what to build next using a pain × user type matrix from customer conversations
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>

					<Link to="/docs/crm-opportunities" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Briefcase className="h-5 w-5" />
									CRM & Opportunities
								</CardTitle>
								<CardDescription>
									Turn discovery conversations into actionable deal intelligence with AI-powered coaching
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>

					<Link to="/docs/crm-quick-reference" className="group">
						<Card className="h-full transition-shadow hover:shadow-lg">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
									<Zap className="h-5 w-5" />
									CRM Quick Reference
								</CardTitle>
								<CardDescription>One-page cheat sheet for the complete discovery-to-deal workflow</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				</div>
			</div>

			{/* Key Features */}
			<Card>
				<CardHeader>
					<CardTitle>Key Features</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<h4 className="mb-2 font-medium text-foreground">AI-Powered Analysis</h4>
							<p className="text-muted-foreground text-sm">
								Automatically extract insights, identify themes, and surface patterns across all your interviews
							</p>
						</div>
						<div>
							<h4 className="mb-2 font-medium text-foreground">Smart Personas</h4>
							<p className="text-muted-foreground text-sm">
								Automatically group participants into personas based on their responses and behaviors
							</p>
						</div>
						<div>
							<h4 className="mb-2 font-medium text-foreground">Evidence Tracking</h4>
							<p className="text-muted-foreground text-sm">
								Every insight is linked to specific quotes and timestamps for easy verification
							</p>
						</div>
						<div>
							<h4 className="mb-2 font-medium text-foreground">Collaborative Research</h4>
							<p className="text-muted-foreground text-sm">
								Share projects with your team, assign tasks, and work together on research analysis
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Footer */}
			<div className="mt-12 text-center text-muted-foreground text-sm">
				<p>Need help? Contact support or check our community forum for answers.</p>
			</div>
		</div>
	);
}
