"use client";

import { ArrowLeft, Building2, Calendar, Check, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "~/components/layout/PageContainer";

// Mock data - in real app this would come from params and database
const prospectData = {
	id: "1",
	name: "Sarah Chen",
	company: "TechStart Inc",
	role: "VP of Product",
	interviewDate: "March 15, 2024",
	outcome: 5,
	outcomeLabel: "Opportunities",
	stage: "Pay",
	stageDescription: "Already paying for solution",
	keyInsight: "Currently paying $500/mo for partial solution, willing to pay more for complete fix",

	validationJourney: [
		{
			phase: "Qualify",
			question: "What do you do in relation to project management?",
			answer:
				"I oversee 5 product teams, each running multiple projects simultaneously. We use a combination of tools but nothing gives us the full picture.",
			evidence: [
				"Manages 5 product teams with 30+ active projects",
				"Current tech stack: Jira, Notion, Slack, Google Sheets",
				"Team size has doubled in past year",
			],
		},
		{
			phase: "Discover",
			question: "Tell me about the last time you struggled with project visibility.",
			answer:
				"Just last week, our CEO asked for a status update on all projects. It took me 6 hours to compile everything from different tools. I had to message 5 different people to get accurate information.",
			evidence: [
				"Spends 6+ hours weekly on status reports",
				"Information scattered across 4+ tools",
				"Frequent context switching causes delays",
				"CEO requests visibility reports 2-3x per month",
			],
		},
		{
			phase: "Behavior",
			question: "What did you try? What do you use today?",
			answer:
				"We tried building custom dashboards in Notion, but they get outdated quickly. Now I have a VA who updates a master spreadsheet daily, but it's still manual and error-prone. We also tried Monday.com but it didn't integrate well with our existing tools.",
			evidence: [
				"Paying VA $2,000/month for manual updates",
				"Tried 3 different solutions in past year",
				"Custom Notion dashboards abandoned after 2 months",
				"Monday.com trial lasted 6 weeks before cancellation",
			],
		},
		{
			phase: "Pain",
			question: "What's annoying or expensive about your current approach?",
			answer:
				"The manual work is killing us. My VA spends 20 hours a week just updating spreadsheets. Plus, by the time we compile reports, the information is already outdated. We've missed critical blockers because they weren't visible in real-time.",
			evidence: [
				"VA costs $2,000/month for manual updates",
				"Reports are 24-48 hours behind reality",
				"Missed 2 critical project blockers last quarter",
				"Team morale affected by constant status update requests",
			],
		},
		{
			phase: "Value",
			question: "What would it mean if this were fixed?",
			answer:
				"If I could see all project statuses in real-time with AI-powered insights, I'd save at least 10 hours a week. More importantly, we'd catch issues before they become problems. I estimate we've lost $50K in the past quarter due to delayed visibility on blockers.",
			evidence: [
				"Would save 10+ hours per week personally",
				"Estimated $50K lost last quarter from delayed issue detection",
				"Could reallocate VA to higher-value work",
				"Would improve team velocity by reducing status meetings",
			],
		},
		{
			phase: "Pay",
			question: "Have you paid / would you pay for a solution?",
			answer:
				"We're currently paying $500/month for our project management stack, but it's not solving the visibility problem. I have budget approval for up to $1,500/month if it actually solves this. We've already allocated budget for Q2 to find a better solution.",
			evidence: [
				"Currently spending $500/month on partial solutions",
				"Budget approved for $1,500/month",
				"Q2 budget allocated for new solution",
				"Willing to pay more for complete solution",
				"Has authority to make purchasing decision",
			],
		},
	],
};

export default function ProspectDetailPage() {
	const initials = prospectData.name
		.split(" ")
		.map((n) => n[0])
		.join("");

	return (
		<div className="min-h-screen bg-gray-50">
			<PageContainer size="lg" padded={false} className="max-w-5xl space-y-6 p-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Link to="/">
						<Button variant="ghost" size="sm">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Project
						</Button>
					</Link>
				</div>

				{/* Prospect Overview Card */}
				<Card className="border-2 border-emerald-200 bg-emerald-50/30">
					<div className="p-6">
						<div className="mb-6 flex items-start gap-4">
							<Avatar className="h-16 w-16 flex-shrink-0">
								<AvatarImage src={`/.jpg?key=lvbvw&height=64&width=64&query=${prospectData.name}`} />
								<AvatarFallback className="bg-emerald-100 font-semibold text-emerald-700 text-xl">
									{initials}
								</AvatarFallback>
							</Avatar>

							<div className="flex-1">
								<div className="mb-2 flex items-start justify-between">
									<div>
										<h1 className="mb-1 font-bold text-2xl text-gray-900">{prospectData.name}</h1>
										<div className="flex items-center gap-3 text-gray-600 text-sm">
											<div className="flex items-center gap-2">
												<Building2 className="h-4 w-4" />
												<span>{prospectData.company}</span>
											</div>
											<span>•</span>
											<span>{prospectData.role}</span>
											<span>•</span>
											<div className="flex items-center gap-2">
												<Calendar className="h-4 w-4" />
												<span>{prospectData.interviewDate}</span>
											</div>
										</div>
									</div>
									<Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
										<CheckCircle2 className="mr-1 h-3 w-3" />
										{prospectData.outcomeLabel}
									</Badge>
								</div>

								<div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4">
									<p className="text-gray-700 text-sm leading-relaxed">
										<span className="font-medium">Key Insight:</span> {prospectData.keyInsight}
									</p>
								</div>
							</div>
						</div>

						<div className="overflow-hidden rounded-lg border-2 border-emerald-200 bg-white">
							<div className="grid grid-cols-4 divide-x divide-gray-200">
								<div className="p-4 text-center">
									<div className="mb-2 flex items-center justify-center">
										<Check className="h-5 w-5 text-emerald-600" />
									</div>
									<div className="mb-1 font-medium text-gray-600 text-xs">Pain Exists</div>
									<div className="font-semibold text-gray-900 text-sm">Yes</div>
								</div>
								<div className="p-4 text-center">
									<div className="mb-2 flex items-center justify-center">
										<Check className="h-5 w-5 text-emerald-600" />
									</div>
									<div className="mb-1 font-medium text-gray-600 text-xs">Awareness</div>
									<div className="font-semibold text-gray-900 text-sm">Aware</div>
								</div>
								<div className="p-4 text-center">
									<div className="mb-2 flex items-center justify-center">
										<Check className="h-5 w-5 text-emerald-600" />
									</div>
									<div className="mb-1 font-medium text-gray-600 text-xs">Quantified</div>
									<div className="font-semibold text-gray-900 text-sm">Yes</div>
								</div>
								<div className="p-4 text-center">
									<div className="mb-2 flex items-center justify-center">
										<Check className="h-5 w-5 text-emerald-600" />
									</div>
									<div className="mb-1 font-medium text-gray-600 text-xs">Acting</div>
									<div className="font-semibold text-gray-900 text-sm">Paying</div>
								</div>
							</div>
						</div>
					</div>
				</Card>

				<div>
					<h2 className="mb-4 font-semibold text-2xl text-gray-900">Validation Details</h2>

					<div className="space-y-3">
						{prospectData.validationJourney.map((item) => {
							const phaseInfo = {
								Qualify: { purpose: "Are they your target?", question: "What do you do in relation to X?" },
								Discover: {
									purpose: "Do they actually feel the pain?",
									question: "Tell me about the last time X happened.",
								},
								Behavior: {
									purpose: "Are they actively solving it?",
									question: "What did you try? What do you use today?",
								},
								Pain: {
									purpose: "Is the current solution insufficient?",
									question: "What's annoying/expensive about that?",
								},
								Value: { purpose: "Do they care enough?", question: "What would it mean if this were fixed?" },
								Pay: { purpose: "Will they trade money for relief?", question: "Have you paid / would you pay?" },
							}[item.phase];

							const evidenceItems = item.evidence.map((evidence) => (
								<li key={evidence} className="flex items-start gap-2 text-gray-600 text-sm">
									<span className="mt-0.5 text-emerald-600">•</span>
									<span>{evidence}</span>
								</li>
							));

							return (
								<Card key={item.phase} className="overflow-hidden border-2">
									<div className="p-5">
										<div className="mb-4 flex items-start gap-4">
											<Badge variant="secondary" className="mt-0.5 font-semibold">
												{item.phase}
											</Badge>
											<div className="flex-1">
												<div className="mb-1 font-semibold text-gray-900">{phaseInfo?.purpose}</div>
												<div className="text-gray-600 text-sm italic">"{phaseInfo?.question}"</div>
											</div>
										</div>

										<div className="rounded-lg border bg-gray-50 p-4">
											<p className="text-gray-700 text-sm italic leading-relaxed">"{item.answer}"</p>
										</div>

										{item.evidence.length > 0 && (
											<details className="mt-4">
												<summary className="cursor-pointer font-medium text-gray-700 text-sm hover:text-gray-900">
													Supporting Evidence ({item.evidence.length})
												</summary>
												<ul className="mt-3 space-y-2 pl-4">{evidenceItems}</ul>
											</details>
										)}
									</div>
								</Card>
							);
						})}
					</div>
				</div>
			</PageContainer>
		</div>
	);
}
