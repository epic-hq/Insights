import type { TreeNode } from "~/components/charts/TreeMap"
import type { KPI } from "~/components/dashboard/KPIBar"
import type { InsightCardProps } from "~/components/insights/InsightCard"
import type { Opportunity } from "~/components/opportunities/OpportunitiesList"

// Sample hierarchical data for TreeMap - values adjusted to sum to 100%
const themeTree: TreeNode[] = [
	{
		name: "User Experience",
		value: 45,
		fill: "#3b82f6",
		children: [
			{ name: "Onboarding", value: 18, fill: "#60a5fa" },
			{ name: "Navigation", value: 15, fill: "#93c5fd" },
			{ name: "Performance", value: 12, fill: "#bfdbfe" },
		],
	},
	{
		name: "Feature Requests",
		value: 35,
		fill: "#10b981",
		children: [
			{ name: "Integrations", value: 14, fill: "#34d399" },
			{ name: "Reporting", value: 10, fill: "#6ee7b7" },
			{ name: "Customization", value: 11, fill: "#a7f3d0" },
		],
	},
	{
		name: "Technical Issues",
		value: 20,
		fill: "#f59e0b",
		children: [
			{ name: "Bugs", value: 8, fill: "#fbbf24" },
			{ name: "Performance", value: 7, fill: "#fcd34d" },
			{ name: "Compatibility", value: 5, fill: "#fde68a" },
		],
	},
]

// Sample KPIs with links to list views
const kpis: KPI[] = [
	{ label: "Interviews", value: "24", href: "/interviews", icon: "interviews" },
	{ label: "Insights", value: "42", href: "/insights", icon: "insights" },
	{ label: "Opportunities", value: "18", href: "/opportunities", icon: "opportunities" },
]

// Sample personas with counts and links
const personas = [
	{
		name: "Early Adopters",
		percentage: 35,
		count: 28,
		color: "#2563EB",
		href: "/personas/early-adopters",
		slices: [
			{ name: "Feature Usage", value: 70, color: "#3b82f6" },
			{ name: "Feedback", value: 30, color: "#93c5fd" },
		],
	},
	{
		name: "Mainstream Learners",
		percentage: 45,
		count: 36,
		color: "#14B8A6",
		href: "/personas/mainstream-learners",
		slices: [
			{ name: "Feature Usage", value: 50, color: "#2dd4bf" },
			{ name: "Feedback", value: 50, color: "#99f6e4" },
		],
	},
	{
		name: "Skeptics",
		percentage: 20,
		count: 16,
		color: "#E11D48",
		href: "/personas/skeptics",
		slices: [
			{ name: "Feature Usage", value: 30, color: "#f43f5e" },
			{ name: "Feedback", value: 70, color: "#fda4af" },
		],
	},
]

// Sample interviews with detailed participant data
const interviews = [
	{
		id: "participant-1",
		date: "2025-07-01",
		participant: "Alex Johnson",
		status: "ready" as const,
		persona: "Early Adopter",
		role: "Product Manager",
		company: "TechNova Solutions",
		email: "alex.johnson@technova.com",
		yearsExperience: 8,
		personaColor: "#2563EB",
		keyInsights: [
			"Needs better data visualization tools",
			"Wants mobile access to critical metrics",
			"Frustrated with current onboarding process",
		],
		sentimentScore: 78,
		transcriptPreview: "The dashboard is promising but needs work on the mobile experience...",
	},
	{
		id: "participant-2",
		date: "2025-07-02",
		participant: "Maria Rodriguez",
		status: "transcribed" as const,
		persona: "Mainstream Learner",
		role: "Marketing Director",
		company: "Global Brands Inc",
		email: "m.rodriguez@globalbrands.com",
		yearsExperience: 12,
		personaColor: "#14B8A6",
		keyInsights: [
			"Prefers simpler interface with fewer options",
			"Needs better export capabilities for reports",
			"Values stability over new features",
		],
		sentimentScore: 65,
		transcriptPreview:
			"I appreciate the stability of the platform, but sometimes find it difficult to locate specific features...",
	},
	{
		id: "participant-3",
		date: "2025-07-03",
		participant: "David Chen",
		status: "processing" as const,
		persona: "Skeptic",
		role: "IT Director",
		company: "FinSecure Corp",
		email: "d.chen@finsecure.com",
		yearsExperience: 15,
		personaColor: "#E11D48",
		keyInsights: [
			"Concerned about security implications",
			"Needs better admin controls",
			"Wants more detailed documentation",
		],
		sentimentScore: 42,
		transcriptPreview: "My main concerns are around security and compliance requirements...",
	},
	{
		id: "participant-4",
		date: "2025-07-04",
		participant: "Sarah Williams",
		status: "ready" as const,
		persona: "Early Adopter",
		role: "UX Designer",
		company: "Creative Digital",
		email: "s.williams@creativedigital.com",
		yearsExperience: 6,
		personaColor: "#2563EB",
		keyInsights: [
			"Excited about new visualization features",
			"Wants more customization options",
			"Suggests improved color schemes",
		],
		sentimentScore: 85,
		transcriptPreview: "I'm really impressed with the direction you're taking with the new interface...",
	},
	{
		id: "participant-5",
		date: "2025-07-05",
		participant: "Michael Lee",
		status: "ready" as const,
		persona: "Mainstream Learner",
		role: "Operations Manager",
		company: "Logistics Plus",
		email: "m.lee@logisticsplus.com",
		yearsExperience: 10,
		personaColor: "#14B8A6",
		keyInsights: [
			"Needs better integration with existing tools",
			"Wants simplified reporting process",
			"Values reliability over cutting-edge features",
		],
		sentimentScore: 72,
		transcriptPreview: "The reliability is crucial for our operations team, and so far it's been working well...",
	},
]

// Sample insights
const insights: InsightCardProps[] = [
	{
		id: "ins-001",
		tag: "User Onboarding",
		category: "First-time Experience",
		journeyStage: "Awareness",
		impact: 4,
		novelty: 3,
		jtbd: "I want to quickly understand how to use the product without reading documentation",
		underlyingMotivation: "I'm busy and want to get value from the product immediately",
		pain: "Tutorial is too long and complex",
		desiredOutcome: "Feel confident using core features within 2 minutes",
		evidence: "I tried using it but gave up after the third step of the tutorial",
		opportunityIdeas: ["Simplified 3-step onboarding", "Interactive tooltips"],
		confidence: "High",
		createdAt: "2025-07-10",
		relatedTags: ["UX", "Onboarding", "Tutorial"],
	},
	{
		id: "ins-002",
		tag: "Data Visualization",
		category: "Dashboard Experience",
		journeyStage: "Engagement",
		impact: 5,
		novelty: 2,
		jtbd: "I want to understand my data at a glance without complex analysis",
		underlyingMotivation: "I need to make quick decisions based on trends",
		pain: "Charts are too complex and hard to interpret",
		desiredOutcome: "Immediately spot trends and anomalies",
		evidence: "I spend 20 minutes every morning trying to understand what the dashboard is telling me",
		opportunityIdeas: ["Simplified chart views", "AI-powered insights summary"],
		confidence: "Medium",
		createdAt: "2025-07-11",
		relatedTags: ["Dashboard", "Charts", "UX"],
	},
	{
		id: "ins-003",
		tag: "Mobile Experience",
		category: "Cross-platform",
		journeyStage: "Retention",
		impact: 4,
		novelty: 4,
		jtbd: "I want to check key metrics while away from my desk",
		underlyingMotivation: "I need to stay informed even when I'm not at my computer",
		pain: "Mobile view is cramped and hard to navigate",
		desiredOutcome: "Quick access to critical information on mobile",
		evidence: "I tried using the mobile app during a meeting but couldn't find the data I needed",
		opportunityIdeas: ["Mobile-first redesign", "Simplified mobile dashboard"],
		confidence: "High",
		createdAt: "2025-07-12",
		relatedTags: ["Mobile", "Responsive", "On-the-go"],
	},
]

// Sample opportunities
const opportunities: Opportunity[] = [
	{
		id: "OPP-001",
		title: "Simplified Onboarding Flow",
		owner: "Sarah Chen",
		status: "Explore",
		impact: 4,
		effort: 2,
		description: "Create a streamlined onboarding experience focused on the core features",
	},
	{
		id: "OPP-002",
		title: "Mobile Dashboard Redesign",
		owner: "Miguel Rodriguez",
		status: "Validate",
		impact: 5,
		effort: 3,
		description: "Redesign the dashboard for mobile-first experience",
	},
	{
		id: "OPP-003",
		title: "AI-Powered Insights Summary",
		owner: "Priya Sharma",
		status: "Build",
		impact: 4,
		effort: 4,
		description: "Implement AI to generate automatic insights from user data",
	},
	{
		id: "OPP-004",
		title: "Interactive Chart Tooltips",
		owner: "James Wilson",
		status: "Explore",
		impact: 3,
		effort: 1,
		description: "Add contextual tooltips to all dashboard charts",
	},
	{
		id: "OPP-005",
		title: "Customizable Dashboard Layout",
		owner: "Emma Johnson",
		status: "Validate",
		impact: 4,
		effort: 3,
		description: "Allow users to customize their dashboard layout",
	},
]

// Sample themes for TagCloud
const themes = [
	{ tag: "Usability", count: 35 },
	{ tag: "Performance", count: 28 },
	{ tag: "Mobile", count: 22 },
	{ tag: "Integrations", count: 18 },
	{ tag: "Customization", count: 15 },
	{ tag: "Reporting", count: 12 },
	{ tag: "Onboarding", count: 10 },
	{ tag: "Documentation", count: 8 },
]

// Export all sample data
export const sampleData = {
	kpis,
	personas,
	interviews,
	opportunities,
	themeTree,
	themes,
	insights,
}
