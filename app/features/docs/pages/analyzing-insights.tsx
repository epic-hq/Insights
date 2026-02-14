import { ArrowLeft, CheckCircle2, Flame, Quote, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function AnalyzingInsights() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-4 font-bold text-4xl tracking-tight">Analyzing Insights & Themes</h1>
			<p className="mb-8 text-lg text-muted-foreground">
				Learn how evidence is automatically extracted from interviews and transformed into actionable insight themes
			</p>

			<div className="space-y-8">
				{/* How Evidence is Extracted */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Quote className="h-6 w-6 text-primary" />
							How Evidence is Automatically Extracted
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							When you upload an interview (audio/video or transcript), our AI automatically processes it through
							multiple stages to extract meaningful evidence:
						</p>

						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-sm">
									1
								</span>
								<div className="space-y-1">
									<div className="font-medium">Transcription & Diarization</div>
									<p className="text-muted-foreground text-sm">
										Audio/video is transcribed with speaker identification, timestamps, and turn-by-turn dialogue
										segmentation.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-sm">
									2
								</span>
								<div className="space-y-1">
									<div className="font-medium">Evidence Extraction</div>
									<p className="text-muted-foreground text-sm">
										AI identifies <strong>verbatim quotes</strong> that contain valuable insights - customer pain
										points, needs, motivations, outcomes, workflows, and contexts.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-sm">
									3
								</span>
								<div className="space-y-1">
									<div className="font-medium">Facet Detection</div>
									<p className="text-muted-foreground text-sm">
										Each piece of evidence is tagged with <strong>facets</strong> - structured attributes like pain
										points, jobs-to-be-done, desired outcomes, emotions, motivations, contexts, and workflows.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-sm">
									4
								</span>
								<div className="space-y-1">
									<div className="font-medium">People & Organization Linking</div>
									<p className="text-muted-foreground text-sm">
										Evidence is automatically linked to the people and organizations mentioned, creating traceability
										from raw quotes to specific customers.
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-4 dark:bg-blue-950/20">
							<p className="font-medium text-sm">💡 Fully Automatic</p>
							<p className="mt-1 text-muted-foreground text-sm">
								This entire process happens automatically when you upload an interview. No manual tagging or coding
								required—just upload and let the AI extract the evidence.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* How Themes Are Generated */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkles className="h-6 w-6 text-primary" />
							How Themes Are Generated
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Themes are strategic, high-level patterns that emerge from clustering similar evidence across multiple
							interviews. The system targets 3-7 major themes per project, not 30+ micro-themes.
						</p>

						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600/10 font-medium text-green-600 text-sm">
									1
								</span>
								<div className="space-y-1">
									<div className="font-medium">Semantic Clustering</div>
									<p className="text-muted-foreground text-sm">
										Evidence with similar meanings is automatically grouped together using embeddings. The AI
										aggressively consolidates related pain points, workflow steps, and industry variations into
										strategic themes.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600/10 font-medium text-green-600 text-sm">
									2
								</span>
								<div className="space-y-1">
									<div className="font-medium">Strategic Consolidation</div>
									<p className="text-muted-foreground text-sm">
										The AI merges symptoms into root causes, combines workflow steps, and focuses on business-decision
										driving patterns. Each theme represents 5-20+ pieces of evidence, not individual micro-issues.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600/10 font-medium text-green-600 text-sm">
									3
								</span>
								<div className="space-y-1">
									<div className="font-medium">Theme Naming & Linking</div>
									<p className="text-muted-foreground text-sm">
										AI generates clear, strategic names for each theme and automatically links them to people and
										organizations for segmentation analysis.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600/10 font-medium text-green-600 text-sm">
									4
								</span>
								<div className="space-y-1">
									<div className="font-medium">Metadata Enrichment</div>
									<p className="text-muted-foreground text-sm">
										Click <strong>"Enrich Themes"</strong> to automatically add rich metadata including pain points,
										jobs-to-be-done, desired outcomes, emotional responses, and categories.
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-green-500 border-l-4 bg-green-50 p-4 dark:bg-green-950/20">
							<p className="font-medium text-sm">✨ When to Enrich Themes</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Run theme enrichment after you've uploaded 5-10 interviews and themes have been auto-generated.
								Enrichment is computationally expensive, so you typically only need to run it once themes are stable,
								then refresh every month or when you add significant new evidence.
							</p>
						</div>

						<div className="rounded-lg border-amber-500 border-l-4 bg-amber-50 p-4 dark:bg-amber-950/20">
							<p className="font-medium text-sm">🎯 Theme Count Guidelines</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Expect <strong>3-7 strategic themes</strong> for most projects. If you see 20+ themes, the system is
								being too granular. Very large projects (100+ interviews across multiple product lines) might justify
								8-12 themes, but rarely more.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Understanding Theme Metadata */}
				<Card>
					<CardHeader>
						<CardTitle>Understanding Theme Metadata</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							When themes are enriched, they gain structured metadata that helps you quickly understand and act on
							customer insights:
						</p>

						<div className="grid gap-4 md:grid-cols-2">
							<Card className="border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
								<CardContent className="space-y-2 p-4">
									<div className="flex items-center gap-2">
										<div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
											<Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
										</div>
										<h4 className="font-semibold text-sm">Pain Point</h4>
									</div>
									<p className="text-muted-foreground text-sm">
										The specific problem or frustration customers experience. Use this to prioritize fixes and
										improvements.
									</p>
								</CardContent>
							</Card>

							<Card className="border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10">
								<CardContent className="space-y-2 p-4">
									<div className="flex items-center gap-2">
										<div className="rounded-full bg-green-100 p-2 dark:bg-green-900/20">
											<Target className="h-4 w-4 text-green-600 dark:text-green-400" />
										</div>
										<h4 className="font-semibold text-sm">Job To Be Done</h4>
									</div>
									<p className="text-muted-foreground text-sm">
										The underlying goal customers are trying to accomplish. Use this to design features that truly help
										customers succeed.
									</p>
								</CardContent>
							</Card>

							<Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/10">
								<CardContent className="space-y-2 p-4">
									<div className="flex items-center gap-2">
										<div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/20">
											<TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
										</div>
										<h4 className="font-semibold text-sm">Desired Outcome</h4>
									</div>
									<p className="text-muted-foreground text-sm">
										What success looks like for the customer. Use this to measure feature impact and validate solutions.
									</p>
								</CardContent>
							</Card>

							<Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/10">
								<CardContent className="space-y-2 p-4">
									<div className="flex items-center gap-2">
										<div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/20">
											<Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
										</div>
										<h4 className="font-semibold text-sm">Emotional Response</h4>
									</div>
									<p className="text-muted-foreground text-sm">
										How customers feel about the situation. Use this to understand urgency and prioritize emotional
										impact.
									</p>
								</CardContent>
							</Card>
						</div>
					</CardContent>
				</Card>

				{/* Segmentation & Coverage Analysis */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-6 w-6 text-primary" />
							Segmentation & Coverage Analysis
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Every theme is automatically linked to the people and organizations that mentioned it, enabling powerful
							segmentation analysis:
						</p>

						<div className="space-y-3">
							<div className="rounded-lg border bg-card p-4">
								<h4 className="mb-2 font-semibold">📊 What You Can Analyze:</h4>
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>Organizations:</strong> See which companies experience each theme and how frequently
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>People:</strong> Identify which individuals mentioned specific themes
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>Personas:</strong> Compare pain points across different customer roles (CEO, VP, etc.)
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>Industries:</strong> Understand if themes are universal or industry-specific
										</span>
									</div>
								</div>
							</div>

							<div className="rounded-lg border bg-card p-4">
								<h4 className="mb-2 font-semibold">🔍 Where to Find Coverage Data:</h4>
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>Theme Detail Page:</strong> Scroll to the "Coverage" section to see all linked people and
											organizations
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>Evidence Page:</strong> Filter by theme, person, or organization to see specific quotes
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											<strong>People/Org Pages:</strong> View all themes associated with a specific customer or company
										</span>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-4 dark:bg-blue-950/20">
							<p className="font-medium text-sm">💡 Example Insights</p>
							<p className="mt-1 text-muted-foreground text-sm">
								"5 healthcare companies mentioned CRM Efficiency issues, but only 2 tech startups did" → Healthcare
								vertical needs different CRM features. "CTOs care most about Reliability, VPs care about Analytics" →
								Tailor messaging by persona.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* When to Use Evidence vs Themes */}
				<Card>
					<CardHeader>
						<CardTitle>When to Use Evidence vs. Themes</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-4">
							<div className="rounded-lg border bg-card p-4">
								<h4 className="mb-2 font-semibold">📝 Use Evidence When:</h4>
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You need the <strong>exact verbatim quote</strong> to validate an insight
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You want to trace insights back to <strong>specific customers</strong> or interviews
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You need to share <strong>customer voice</strong> in presentations or documents
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You're doing deep qualitative analysis on <strong>individual data points</strong>
										</span>
									</div>
								</div>
							</div>

							<div className="rounded-lg border bg-card p-4">
								<h4 className="mb-2 font-semibold">🎯 Use Themes When:</h4>
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You want to see <strong>patterns across many interviews</strong>
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You need to <strong>prioritize features</strong> based on frequency and impact
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You're creating <strong>strategic roadmaps</strong> or making product decisions
										</span>
									</div>
									<div className="flex items-start gap-2">
										<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
										<span className="text-sm">
											You want to understand <strong>persona-specific</strong> pain points and needs
										</span>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border-amber-500 border-l-4 bg-amber-50 p-4 dark:bg-amber-950/20">
							<p className="font-medium text-sm">💡 Best Practice</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Start with themes to identify high-level patterns and priorities. Then drill down into evidence when you
								need to validate findings, gather quotes for presentations, or understand the nuances of a specific
								theme.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Workflow Tips */}
				<Card>
					<CardHeader>
						<CardTitle>Recommended Analysis Workflow</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									1
								</span>
								<div className="space-y-1">
									<div className="font-medium">Upload 5-10 Interviews</div>
									<p className="text-muted-foreground text-sm">
										Build a meaningful evidence base. Each interview is automatically transcribed, evidence extracted,
										and facets tagged.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									2
								</span>
								<div className="space-y-1">
									<div className="font-medium">Review Auto-Generated Themes (3-7 themes)</div>
									<p className="text-muted-foreground text-sm">
										Navigate to Themes page. The system automatically creates strategic themes from your evidence. New
										interviews link to existing themes or create new ones if truly novel.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									3
								</span>
								<div className="space-y-1">
									<div className="font-medium">Enrich Theme Metadata (Once)</div>
									<p className="text-muted-foreground text-sm">
										Click "Enrich Themes" button to add pain points, jobs-to-be-done, desired outcomes, and emotional
										responses. Refresh monthly or when adding significant new evidence.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									4
								</span>
								<div className="space-y-1">
									<div className="font-medium">Analyze Coverage & Segmentation</div>
									<p className="text-muted-foreground text-sm">
										View theme detail pages to see which organizations and people mentioned each theme. Identify
										persona-specific or industry-specific patterns.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									5
								</span>
								<div className="space-y-1">
									<div className="font-medium">Drill Into Evidence for Validation</div>
									<p className="text-muted-foreground text-sm">
										Click evidence links to see raw verbatim quotes, validate insights, and gather customer voice for
										presentations or stakeholder reports.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
									6
								</span>
								<div className="space-y-1">
									<div className="font-medium">Continuous Upload (No Manual Intervention)</div>
									<p className="text-muted-foreground text-sm">
										Keep uploading interviews as you conduct them. Evidence automatically extracts and links to existing
										themes. System stays self-organizing without manual theme management.
									</p>
								</div>
							</div>
						</div>

						<div className="mt-6 rounded-lg border-green-500 border-l-4 bg-green-50 p-4 dark:bg-green-950/20">
							<p className="font-medium text-sm">✅ Fully Automated After Initial Setup</p>
							<p className="mt-1 text-muted-foreground text-sm">
								After your first enrichment, the system runs hands-free. New interviews → Evidence extraction → Theme
								linking happens automatically. You only intervene to enrich new themes or when you want updated metadata
								after major evidence growth.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
