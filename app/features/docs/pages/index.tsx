/**
 * Documentation hub for UpSight.
 * Organized by workflow: Getting Started, Surveys, CRM & People, Analysis.
 */
import {
	ArrowRight,
	BarChart3,
	Bot,
	Briefcase,
	Compass,
	FileSpreadsheet,
	GitBranch,
	Layers3,
	Lightbulb,
	Mail,
	Package,
	Users,
	Zap,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

interface DocCardProps {
	to: string;
	icon: React.ReactNode;
	title: string;
	description: string;
	badge?: string;
}

function DocCard({ to, icon, title, description, badge }: DocCardProps) {
	return (
		<Link to={to} className="group">
			<Card className="h-full transition-all hover:border-primary/30 hover:shadow-md">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base group-hover:text-primary">
						{icon}
						{title}
						{badge && (
							<Badge variant="secondary" className="ml-auto text-xs">
								{badge}
							</Badge>
						)}
					</CardTitle>
					<CardDescription className="text-sm">{description}</CardDescription>
				</CardHeader>
			</Card>
		</Link>
	);
}

interface SectionProps {
	title: string;
	description: string;
	children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
	return (
		<div className="space-y-4">
			<div>
				<h2 className="font-semibold text-xl tracking-tight">{title}</h2>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<div className="grid gap-4 md:grid-cols-2">{children}</div>
		</div>
	);
}

export default function DocsIndex() {
	return (
		<div className="container mx-auto max-w-5xl px-4 py-12">
			{/* Header */}
			<div className="mb-12">
				<h1 className="mb-2 font-bold text-4xl tracking-tight">Documentation</h1>
				<p className="text-lg text-muted-foreground">
					Guides for running research, importing contacts, sending surveys, and turning conversations into insights.
				</p>
			</div>

			{/* Quick Start Banner */}
			<Link to="/docs/getting-started" className="group mb-12 block">
				<div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-6 transition-all hover:bg-primary/10">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
							<Compass className="h-6 w-6" />
						</div>
						<div>
							<h3 className="font-semibold text-foreground text-lg">New to UpSight?</h3>
							<p className="text-muted-foreground text-sm">
								Set up your first project, import contacts, and start collecting insights
							</p>
						</div>
					</div>
					<ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
				</div>
			</Link>

			<div className="space-y-12">
				{/* Surveys & Distribution */}
				<Section
					title="Surveys & Distribution"
					description="Create surveys, personalize the experience, and distribute to your audience."
				>
					<DocCard
						to="/docs/sending-surveys"
						icon={<Mail className="h-5 w-5" />}
						title="Send Surveys via Email"
						description="Distribute personalized surveys via Mailchimp or any email platform with identity pre-fill and CRM-powered personalization"
						badge="New"
					/>
					<DocCard
						to="/docs/survey-branching"
						icon={<GitBranch className="h-5 w-5" />}
						title="Survey Branching & AI Modes"
						description="Route respondents with skip logic, AND/OR conditions, and control AI autonomy in chat surveys"
					/>
				</Section>

				{/* CRM & People */}
				<Section title="CRM & People" description="Import contacts, manage organizations, and track opportunities.">
					<DocCard
						to="/docs/importing-people"
						icon={<FileSpreadsheet className="h-5 w-5" />}
						title="Import People & Organizations"
						description="Bring contacts, companies, and custom fields (membership, segment, etc.) into UpSight via CSV"
						badge="New"
					/>
					<DocCard
						to="/docs/crm-opportunities"
						icon={<Briefcase className="h-5 w-5" />}
						title="CRM & Opportunities"
						description="Turn discovery conversations into deal intelligence with AI-powered coaching"
					/>
					<DocCard
						to="/docs/crm-quick-reference"
						icon={<Zap className="h-5 w-5" />}
						title="CRM Quick Reference"
						description="One-page cheat sheet for the complete discovery-to-deal workflow"
					/>
				</Section>

				{/* Research & Analysis */}
				<Section title="Research & Analysis" description="Plan research, analyze conversations, and discover patterns.">
					<DocCard
						to="/docs/research-workflow"
						icon={<Users className="h-5 w-5" />}
						title="Research Workflow"
						description="The complete research process from planning to insights"
					/>
					<DocCard
						to="/docs/analyzing-insights"
						icon={<Lightbulb className="h-5 w-5" />}
						title="Analyzing Insights"
						description="Discover patterns, validate hypotheses, and extract actionable findings"
					/>
					<DocCard
						to="/docs/conversation-lenses"
						icon={<Layers3 className="h-5 w-5" />}
						title="Conversation Lenses"
						description="SPICED, BANT, MEDDIC, MAP and team perspectives for structured extraction"
					/>
					<DocCard
						to="/docs/product-lens"
						icon={<Package className="h-5 w-5" />}
						title="Product Lens"
						description="Prioritize what to build using a pain-by-user-type matrix from conversations"
					/>
				</Section>
			</div>

			{/* Footer */}
			<div className="mt-16 text-center text-muted-foreground text-sm">
				<p>
					Need help? Email us at{" "}
					<a href="mailto:support@getupsight.com" className="text-primary underline">
						support@getupsight.com
					</a>
				</p>
			</div>
		</div>
	);
}
