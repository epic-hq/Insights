import consola from "consola";
import {
	AlertTriangle,
	ArrowRight,
	Brain,
	CheckCircle,
	Clock,
	Lightbulb,
	Sparkles,
	Target,
	TrendingUp,
	Users,
} from "lucide-react";
import { useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { getServerClient } from "~/lib/supabase/client.server";

export const meta: MetaFunction = () => {
	return [
		{ title: "Auto-Takeaways | Insights Platform" },
		{ name: "description", content: "AI-powered takeaways from your conversations and insights" },
	];
};

interface LoaderData {
	hasMinimumData: boolean;
	insightsCount: number;
	interviewsCount: number;
	message: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const projectId = params.projectId || "";
	try {
		consola.log("[AUTO-INSIGHTS LOADER] Starting loader...");
		const { client: supabase } = getServerClient(request);
		consola.log("[AUTO-INSIGHTS LOADER] Got supabase client");

		const { data: jwt } = await supabase.auth.getClaims();
		// consola.log("[AUTO-INSIGHTS LOADER] JWT claims:", jwt)

		const accountId = jwt?.claims.sub;
		// consola.log("[AUTO-INSIGHTS LOADER] Account ID:", accountId)

		if (!accountId) {
			consola.error("[AUTO-INSIGHTS LOADER] No account ID found in JWT claims");
			throw new Response("Unauthorized", { status: 401 });
		}

		// Check if we have enough data for meaningful insights
		consola.log("[AUTO-INSIGHTS LOADER] Fetching data counts...");
		const [insightsCount, interviewsCount] = await Promise.all([
			supabase.from("themes").select("id", { count: "exact", head: true }).eq("project_id", projectId),
			supabase.from("interviews").select("id", { count: "exact", head: true }).eq("project_id", projectId),
		]);

		consola.log("[AUTO-INSIGHTS LOADER] Data counts:", {
			insights: insightsCount.count,
			interviews: interviewsCount.count,
		});

		const hasMinimumData = (insightsCount.count || 0) >= 5 && (interviewsCount.count || 0) >= 2;

		return {
			hasMinimumData,
			insightsCount: insightsCount.count || 0,
			interviewsCount: interviewsCount.count || 0,
			message: hasMinimumData
				? "Ready to generate auto-takeaways"
				: "Need at least 5 insights from 2+ interviews for meaningful analysis",
		};
	} catch (error) {
		consola.error("[AUTO-INSIGHTS LOADER] Error:", error);
		throw new Response("Internal server error", { status: 500 });
	}
}

export default function AutoInsights() {
	const { hasMinimumData, insightsCount, interviewsCount, message } = useLoaderData<LoaderData>();
	const fetcher = useFetcher();
	const [competitiveContext, setCompetitiveContext] = useState("");
	const [businessGoals, setBusinessGoals] = useState("");

	const isGenerating = fetcher.state === "submitting" && fetcher.formData?.get("action") === "generate";
	const isExecutingAction = fetcher.state === "submitting" && fetcher.formData?.get("action") === "execute_action";

	const autoInsightsData = fetcher.data?.success ? fetcher.data.data : null;
	const error = fetcher.data?.success === false ? fetcher.data.error : null;

	const handleActionClick = (actionType: string, parameters: any) => {
		const formData = new FormData();
		formData.append("action", "execute_action");
		formData.append("action_type", actionType);
		formData.append("parameters", JSON.stringify(parameters));

		fetcher.submit(formData, { method: "post", action: "/api/auto-insights" });
	};

	return (
		<div className="container mx-auto max-w-2xl space-y-6 py-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-3xl">
						<Brain className="h-8 w-8 text-blue-600" />
						Auto-Takeaways
					</h1>
					<p className="mt-1 text-muted-foreground">Suggested next steps from your data and goals.</p>
				</div>
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Badge variant="outline">{insightsCount} insights</Badge>
					<Badge variant="outline">{interviewsCount} interviews</Badge>
				</div>
			</div>

			{/* Readiness Check */}
			{!hasMinimumData && (
				<Card className="border-amber-200 bg-amber-50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-amber-800">
							<AlertTriangle className="h-5 w-5" />
							Insufficient Data
						</CardTitle>
						<CardDescription className="text-amber-700">{message}</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-amber-700 text-sm">
							Upload more interviews and ensure insights are extracted to generate meaningful auto-insights.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Generation Form */}
			{hasMinimumData && !autoInsightsData && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-purple-600" />
							Generate Auto-Takeaways
						</CardTitle>
						<CardDescription>Provide context to generate more targeted insights and recommendations</CardDescription>
					</CardHeader>
					<CardContent>
						<fetcher.Form method="post" action="/api/auto-insights" className="space-y-4">
							<input type="hidden" name="action" value="generate" />

							<div className="space-y-2">
								<Label htmlFor="competitive_context">Competitive Context (Optional)</Label>
								<Textarea
									id="competitive_context"
									name="competitive_context"
									placeholder="Describe your competitive landscape, key competitors, and market positioning..."
									value={competitiveContext}
									onChange={(e) => setCompetitiveContext(e.target.value)}
									rows={3}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="business_goals">Business Goals (Optional)</Label>
								<Textarea
									id="business_goals"
									name="business_goals"
									placeholder="Describe your key business objectives, revenue targets, and strategic priorities..."
									value={businessGoals}
									onChange={(e) => setBusinessGoals(e.target.value)}
									rows={3}
								/>
							</div>

							<Button type="submit" disabled={isGenerating} className="w-full">
								{isGenerating ? (
									<>
										<Brain className="mr-2 h-4 w-4 animate-spin" />
										Generating Takeaways...
									</>
								) : (
									<>
										<Sparkles className="mr-2 h-4 w-4" />
										Generate Auto-Takeaways
									</>
								)}
							</Button>
						</fetcher.Form>
					</CardContent>
				</Card>
			)}

			{/* Error Display */}
			{error && (
				<Card className="border-red-200 bg-red-50">
					<CardHeader>
						<CardTitle className="text-red-800">Error</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-red-700">{error}</p>
					</CardContent>
				</Card>
			)}

			{/* Generated Insights */}
			{autoInsightsData && (
				<div className="space-y-6">
					{/* Executive Summary */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-green-600" />
								Executive Summary
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-lg leading-relaxed">{autoInsightsData.executive_summary}</p>
						</CardContent>
					</Card>

					{/* Immediate Actions */}
					{autoInsightsData.immediate_actions?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Clock className="h-5 w-5 text-orange-600" />
									Immediate Actions (Next 30 Days)
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3">
									{autoInsightsData.immediate_actions.map((action: any, index: number) => (
										<div key={index} className="flex items-center justify-between rounded-lg border p-3">
											<div className="flex-1">
												<p className="font-medium">{action.label}</p>
												<Badge variant="outline" className="mt-1">
													{action.priority} Priority
												</Badge>
											</div>
											<Button
												onClick={() => handleActionClick(action.action_type, action.parameters)}
												disabled={isExecutingAction}
												size="sm"
											>
												Execute
												<ArrowRight className="ml-1 h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Top Opportunities */}
					{autoInsightsData.top_opportunities?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5 text-blue-600" />
									Top Revenue Opportunities
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4">
									{autoInsightsData.top_opportunities.map((opportunity: any, index: number) => (
										<div key={index} className="space-y-3 rounded-lg border p-4">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<h3 className="font-semibold text-lg">{opportunity.title}</h3>
													<p className="mt-1 text-muted-foreground">{opportunity.description}</p>
												</div>
												<div className="ml-4 flex gap-2">
													<Badge variant={opportunity.revenue_potential === "High" ? "default" : "secondary"}>
														{opportunity.revenue_potential} Revenue
													</Badge>
													<Badge variant={opportunity.effort_estimate === "Low" ? "default" : "secondary"}>
														{opportunity.effort_estimate} Effort
													</Badge>
												</div>
											</div>

											<div className="space-y-2">
												<p>
													<strong>Target Personas:</strong> {opportunity.target_personas?.join(", ")}
												</p>
												<p>
													<strong>Competitive Advantage:</strong> {opportunity.competitive_advantage}
												</p>
												<p>
													<strong>Supporting Insights:</strong> {opportunity.supporting_insights?.join(", ")}
												</p>
											</div>

											{opportunity.recommended_actions?.length > 0 && (
												<div className="flex gap-2 border-t pt-2">
													{opportunity.recommended_actions.map((action: any, actionIndex: number) => (
														<Button
															key={actionIndex}
															variant="outline"
															size="sm"
															onClick={() => handleActionClick(action.action_type, action.parameters)}
															disabled={isExecutingAction}
														>
															{action.label}
														</Button>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Critical Insights */}
					{autoInsightsData.critical_insights?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lightbulb className="h-5 w-5 text-yellow-600" />
									Critical Strategic Insights
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4">
									{autoInsightsData.critical_insights.map((insight: any, index: number) => (
										<div key={index} className="space-y-3 rounded-lg border p-4">
											<div className="flex items-start justify-between">
												<h3 className="flex-1 font-semibold text-lg">{insight.title}</h3>
												<div className="ml-4 flex gap-2">
													<Badge variant={insight.impact_level === "High" ? "default" : "secondary"}>
														{insight.impact_level} Impact
													</Badge>
													<Badge variant={insight.confidence_level === "High" ? "default" : "secondary"}>
														{insight.confidence_level} Confidence
													</Badge>
												</div>
											</div>

											<p className="text-muted-foreground">{insight.insight}</p>

											<div className="space-y-2">
												<p>
													<strong>Business Impact:</strong> {insight.business_impact}
												</p>
												<p>
													<strong>Personas Affected:</strong> {insight.personas_affected?.join(", ")}
												</p>
												<p>
													<strong>Category:</strong> {insight.category}
												</p>
											</div>

											{insight.evidence?.length > 0 && (
												<div>
													<p className="mb-2 font-medium">Supporting Evidence:</p>
													<ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
														{insight.evidence.map((evidence: string, evidenceIndex: number) => (
															<li key={evidenceIndex}>{evidence}</li>
														))}
													</ul>
												</div>
											)}

											{insight.recommended_actions?.length > 0 && (
												<div className="flex gap-2 border-t pt-2">
													{insight.recommended_actions.map((action: any, actionIndex: number) => (
														<Button
															key={actionIndex}
															variant="outline"
															size="sm"
															onClick={() => handleActionClick(action.action_type, action.parameters)}
															disabled={isExecutingAction}
														>
															{action.label}
														</Button>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Persona Analysis */}
					{autoInsightsData.persona_analysis?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-5 w-5 text-purple-600" />
									Persona Analysis
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4">
									{autoInsightsData.persona_analysis.map((persona: any, index: number) => (
										<div key={index} className="space-y-3 rounded-lg border p-4">
											<div className="flex items-center justify-between">
												<h3 className="font-semibold text-lg">{persona.persona_name}</h3>
												<div className="flex gap-2">
													<Badge variant={persona.revenue_potential === "High" ? "default" : "secondary"}>
														{persona.revenue_potential} Revenue
													</Badge>
													<Badge variant={persona.willingness_to_pay === "High" ? "default" : "secondary"}>
														{persona.willingness_to_pay} WTP
													</Badge>
												</div>
											</div>

											<div className="grid gap-4 md:grid-cols-2">
												<div>
													<p className="mb-2 font-medium">Key Pain Points:</p>
													<ul className="list-inside list-disc space-y-1 text-sm">
														{persona.key_pain_points?.map((pain: string, painIndex: number) => (
															<li key={painIndex}>{pain}</li>
														))}
													</ul>
												</div>

												<div>
													<p className="mb-2 font-medium">Unmet Needs:</p>
													<ul className="list-inside list-disc space-y-1 text-sm">
														{persona.unmet_needs?.map((need: string, needIndex: number) => (
															<li key={needIndex}>{need}</li>
														))}
													</ul>
												</div>
											</div>

											<div>
												<p className="mb-2 font-medium">Recommended Solutions:</p>
												<ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
													{persona.recommended_solutions?.map((solution: string, solutionIndex: number) => (
														<li key={solutionIndex}>{solution}</li>
													))}
												</ul>
											</div>

											{persona.competitive_threats?.length > 0 && (
												<div>
													<p className="mb-2 font-medium">Competitive Threats:</p>
													<ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
														{persona.competitive_threats.map((threat: string, threatIndex: number) => (
															<li key={threatIndex}>{threat}</li>
														))}
													</ul>
												</div>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Strategic Recommendations */}
					{autoInsightsData.strategic_recommendations?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Long-term Strategic Recommendations</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									{autoInsightsData.strategic_recommendations.map((recommendation: string, index: number) => (
										<li key={index} className="flex items-start gap-2">
											<CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
											<span>{recommendation}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					)}

					{/* Competitive Considerations */}
					{autoInsightsData.competitive_considerations?.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Competitive Considerations</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									{autoInsightsData.competitive_considerations.map((consideration: string, index: number) => (
										<li key={index} className="flex items-start gap-2">
											<AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
											<span>{consideration}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					)}

					{/* Regenerate Button */}
					<div className="flex justify-center pt-6">
						<Button
							onClick={() => {
								// Reset the data and show the form again
								window.location.reload();
							}}
							variant="outline"
						>
							<Sparkles className="mr-2 h-4 w-4" />
							Generate New Insights
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
