/**
 * ICP Discovery - Identify Ideal Customer Profiles
 * Analyzes pain points, bullseye scores, and customer segments to recommend target ICPs
 */

import consola from "consola";
import { useState } from "react";
import { type LoaderFunctionArgs, useFetcher, useLoaderData, useNavigate, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getSegmentKindSummaries } from "~/features/segments/services/segmentData.server";
import { userContext } from "~/server/user-context";
import { PainMatrixComponent } from "../components/PainMatrix";
import { generatePainMatrix, type PainMatrixCell } from "../services/generatePainMatrix.server";

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const projectId = params.projectId as string;

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 });
	}

	// Get selected segment kind from query params
	const url = new URL(request.url);
	let segmentKindSlug = url.searchParams.get("segment");

	try {
		const segments = await getSegmentKindSummaries(supabase, projectId);

		// If no segment specified, default to first one with people
		if (!segmentKindSlug) {
			const segmentWithPeople = segments.find((s) => s.person_count > 0);
			segmentKindSlug = segmentWithPeople?.kind || "preference"; // Fallback to preference if none found
		}

		const matrix = await generatePainMatrix({
			supabase,
			projectId,
			segmentKindSlug,
			minEvidencePerPain: 1, // Lowered from 2 to capture more themes
			minGroupSize: 1,
		});

		// Fetch existing ICP recommendations
		const { data: icpRecs } = await supabase
			.from("icp_recommendations")
			.select("*")
			.eq("project_id", projectId)
			.single();

		return {
			matrix,
			projectId,
			segments,
			selectedSegmentSlug: segmentKindSlug,
			icpRecommendations: icpRecs?.recommendations || null,
		};
	} catch (error) {
		consola.error("Product Lens loader error:", error);
		throw new Response("Failed to generate pain matrix", { status: 500 });
	}
}

export default function ProductLens() {
	const { matrix, segments, selectedSegmentSlug, icpRecommendations, projectId } = useLoaderData<typeof loader>();
	const [selectedCell, setSelectedCell] = useState<PainMatrixCell | null>(null);
	const navigate = useNavigate();
	const navigation = useNavigation();

	const isLoading = navigation.state === "loading";

	const handleSegmentChange = (kindSlug: string) => {
		navigate(`?segment=${kindSlug}`);
	};

	if (!matrix) {
		return (
			<div className="rounded-lg border bg-muted p-6 text-center">
				<p className="text-muted-foreground">No pain matrix data available</p>
			</div>
		);
	}

	const generateFetcher = useFetcher();
	const isGenerating = generateFetcher.state !== "idle";

	const createPersonaFetcher = useFetcher();

	const handleCreatePersona = (icp: any) => {
		// Create persona with ICP data
		const formData = new FormData();
		formData.append("name", icp.name);
		formData.append(
			"description",
			`Target customer: ${icp.name}\n\nMarket size: ${icp.stats.count} people\nAvg Bullseye: ${icp.stats.bullseye_avg?.toFixed(1) || "N/A"}\n\nTop Pains:\n${icp.stats.top_pains?.map((p: string) => `• ${p}`).join("\n") || "None"}`
		);
		formData.append("facets", JSON.stringify(icp.facets));
		formData.append("projectId", projectId);

		createPersonaFetcher.submit(formData, {
			method: "post",
			action: "/api/create-persona-from-icp",
		});
	};

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl">ICP Discovery</h1>
					<p className="text-muted-foreground">
						Identify your Ideal Customer Profile by analyzing pain intensity, bullseye scores, and market segments.
					</p>
				</div>
			</div>

			{/* ICP Recommendations Section */}
			<Card>
				<CardHeader>
					<CardTitle>Ideal Customer Profile Recommendations</CardTitle>
					<CardDescription>
						AI-suggested customer segments with high pain intensity and market potential
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!icpRecommendations ? (
						<div className="flex flex-col items-center gap-4 py-8">
							<p className="text-center text-muted-foreground text-sm">
								Generate AI-powered ICP recommendations based on your pain matrix data
							</p>
							<generateFetcher.Form method="post" action="/api/generate-icp-recommendations">
								<input type="hidden" name="projectId" value={projectId} />
								<Button type="submit" disabled={isGenerating}>
									{isGenerating ? "Generating..." : "Generate ICP Recommendations"}
								</Button>
							</generateFetcher.Form>
						</div>
					) : (
						<div className="space-y-4">
							<div className="grid gap-4 md:grid-cols-3">
								{(icpRecommendations as any[]).slice(0, 3).map((icp: any, idx: number) => (
									<Card key={idx} className="border-2">
										<CardHeader className="pb-3">
											<CardTitle className="text-lg">{icp.name}</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span className="text-muted-foreground">Market Size:</span>
													<span className="font-semibold">{icp.stats.count} people</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Avg Bullseye:</span>
													<span className="font-semibold">{icp.stats.bullseye_avg?.toFixed(1) || "N/A"}</span>
												</div>
												{icp.stats.top_pains && icp.stats.top_pains.length > 0 && (
													<div className="pt-2">
														<span className="text-muted-foreground text-xs">Top Pains:</span>
														<ul className="mt-1 space-y-1">
															{icp.stats.top_pains.slice(0, 2).map((pain: string, i: number) => (
																<li key={i} className="text-xs">
																	• {pain}
																</li>
															))}
														</ul>
													</div>
												)}
											</div>
											<Button
												size="sm"
												className="w-full"
												variant="outline"
												onClick={() => handleCreatePersona(icp)}
												disabled={createPersonaFetcher.state !== "idle"}
											>
												{createPersonaFetcher.state !== "idle" ? "Creating..." : "Create Persona from This"}
											</Button>
										</CardContent>
									</Card>
								))}
							</div>
							<div className="flex justify-end">
								<generateFetcher.Form method="post" action="/api/generate-icp-recommendations">
									<input type="hidden" name="projectId" value={projectId} />
									<Button type="submit" variant="ghost" size="sm" disabled={isGenerating}>
										{isGenerating ? "Regenerating..." : "Regenerate Recommendations"}
									</Button>
								</generateFetcher.Form>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Loading Overlay */}
			{isLoading && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-3">
						<div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
						<p className="font-medium text-sm">Loading pain matrix...</p>
					</div>
				</div>
			)}

			{/* Pain Matrix */}
			<div className={isLoading ? "pointer-events-none opacity-50" : ""}>
				<PainMatrixComponent
					matrix={matrix}
					onCellClick={setSelectedCell}
					segments={segments}
					selectedSegmentSlug={selectedSegmentSlug}
					onSegmentChange={handleSegmentChange}
				/>
			</div>

			{/* Selected Cell Detail Modal */}
			{selectedCell && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => setSelectedCell(null)}
				>
					<div
						className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-6 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-start justify-between">
							<div>
								<h2 className="font-bold text-2xl">{selectedCell.pain_theme_name}</h2>
								<p className="text-muted-foreground">
									{selectedCell.user_group.name} ({selectedCell.user_group.member_count} people)
								</p>
							</div>
							<button onClick={() => setSelectedCell(null)} className="rounded p-2 hover:bg-muted">
								×
							</button>
						</div>

						<div className="space-y-4">
							{/* Metrics */}
							<div className="grid grid-cols-2 gap-4">
								<MetricDisplay label="Impact Score" value={selectedCell.metrics.impact_score.toFixed(2)} />
								<MetricDisplay label="Frequency" value={`${Math.round(selectedCell.metrics.frequency * 100)}%`} />
								<MetricDisplay label="Intensity" value={selectedCell.metrics.intensity || "N/A"} />
								<MetricDisplay label="WTP" value={selectedCell.metrics.willingness_to_pay || "N/A"} />
							</div>

							{/* Evidence */}
							<div>
								<h3 className="mb-2 font-semibold">Evidence</h3>
								<p className="text-muted-foreground text-sm">
									{selectedCell.evidence.count} items from {selectedCell.evidence.person_count} people
								</p>
								<div className="mt-4 space-y-3">
									{selectedCell.evidence.sample_verbatims.map((quote) => (
										<blockquote key={quote} className="border-primary border-l-2 pl-4 italic">
											"{quote}"
										</blockquote>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex gap-2">
								<button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary/90">
									Create Feature Request
								</button>
								<button className="rounded-lg border px-4 py-2 font-semibold text-sm hover:bg-muted">
									View All Evidence
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function MetricDisplay({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="text-muted-foreground text-sm">{label}</div>
			<div className="mt-1 font-bold text-2xl">{value}</div>
		</div>
	);
}
