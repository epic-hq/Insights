import { ArrowLeft, Package, Target, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function ProductLensGuide() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-3 font-bold text-4xl tracking-tight">Product Lens</h1>
			<p className="mb-10 text-lg text-muted-foreground">
				Prioritize what to build next using a pain × user type matrix built from actual customer conversations
			</p>

			<div className="space-y-10">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5 text-primary" />
							What is the Product Lens?
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							The Product Lens is an interactive heat map showing which customer pains matter most for each user
							segment. Instead of guessing priorities from gut feel, you see impact scores based on:
						</p>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">•</span>
								<span>
									<strong>How many people</strong> in each segment experience the pain
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">•</span>
								<span>
									<strong>How intensely</strong> they feel it (low, medium, high, critical)
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">•</span>
								<span>
									<strong>How willing they are to pay</strong> for a solution
								</span>
							</li>
						</ul>
						<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
							<p className="font-medium text-sm text-foreground">Example</p>
							<p className="mt-2 text-sm text-muted-foreground">
								If 100% of your Artist segment mentions "lack of creative time" with high intensity and high
								willingness to pay, that cell gets a high impact score (e.g., 3.0) and appears in red on the heat map.
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							How user groups are built
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<p>
							User groups come from <strong>personas</strong> and <strong>roles</strong> you've tagged in your
							evidence. Each piece of evidence linked to a person with a persona creates a segment in the matrix.
						</p>
						<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm">
							<p className="font-medium text-foreground">Tip</p>
							<p className="mt-1">
								More interviews with diverse segments = more confident insights. The Product Lens will warn you when
								sample sizes are too small (&lt; 3 people per segment or &lt; 30 evidence items total).
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Package className="h-5 w-5 text-primary" />
							How pain themes are discovered
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<p>
							Pain themes are automatically extracted from your empathy maps (the "pains" field in evidence). Similar
							pains are clustered using AI embeddings so you don't see dozens of tiny variations.
						</p>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
								<h3 className="mb-2 font-semibold text-sm text-foreground">Raw pains from evidence:</h3>
								<ul className="space-y-1 text-xs text-muted-foreground">
									<li>• "Not enough time for creativity"</li>
									<li>• "Struggle to find time to create"</li>
									<li>• "Can't make space for creative work"</li>
								</ul>
							</div>
							<div className="rounded-lg border border-border/60 bg-primary/10 p-4">
								<h3 className="mb-2 font-semibold text-sm text-foreground">Clustered theme:</h3>
								<div className="rounded bg-primary/20 px-3 py-2 text-center text-sm font-medium text-foreground">
									"lack of creative time"
								</div>
								<p className="mt-2 text-xs text-muted-foreground">3 evidence items from 2 people</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-primary" />
							Reading the heat map
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Each cell shows an <strong>impact score</strong> and <strong>frequency</strong>. The color tells you
							priority at a glance:
						</p>
						<div className="space-y-2">
							<div className="flex items-center gap-3">
								<div className="h-8 w-16 rounded border" style={{ backgroundColor: "rgba(239, 68, 68, 0.3)" }} />
								<div className="text-sm">
									<Badge variant="destructive" className="mr-2">
										Critical (2.0+)
									</Badge>
									<span className="text-muted-foreground">Build this first</span>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="h-8 w-16 rounded border" style={{ backgroundColor: "rgba(249, 115, 22, 0.3)" }} />
								<div className="text-sm">
									<Badge variant="secondary" className="mr-2 bg-orange-500/10">
										High (1.5-2.0)
									</Badge>
									<span className="text-muted-foreground">Strong opportunity</span>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="h-8 w-16 rounded border" style={{ backgroundColor: "rgba(234, 179, 8, 0.3)" }} />
								<div className="text-sm">
									<Badge variant="secondary" className="mr-2 bg-yellow-500/10">
										Medium (1.0-1.5)
									</Badge>
									<span className="text-muted-foreground">Consider for roadmap</span>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="h-8 w-16 rounded border" style={{ backgroundColor: "rgba(34, 197, 94, 0.3)" }} />
								<div className="text-sm">
									<Badge variant="outline" className="mr-2">
										Low (0.5-1.0)
									</Badge>
									<span className="text-muted-foreground">Nice to have</span>
								</div>
							</div>
						</div>
						<p className="text-sm text-muted-foreground">
							The <strong>💰 icon</strong> marks pains where users showed high willingness to pay for a solution.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Package className="h-5 w-5 text-primary" />
							Using the controls
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<ol className="list-decimal space-y-3 pl-6 text-sm">
							<li>
								<strong>Sort by Impact Score</strong> (default) – Shows highest-priority pains at the top
							</li>
							<li>
								<strong>Sort by Frequency</strong> – Shows most commonly mentioned pains at the top
							</li>
							<li>
								<strong>Min Impact filter</strong> – Use the slider to hide low-impact pains and focus on what
								matters. Start at 1.0 to see only medium/high/critical opportunities.
							</li>
							<li>
								<strong>Click any cell</strong> – Opens a detail modal with metrics, sample quotes, and a link to
								view all supporting evidence
							</li>
						</ol>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-primary" />
							Key Insights panel
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<p>
							At the top of the matrix, the <strong>Key Insights</strong> panel shows an AI-generated summary with:
						</p>
						<ul className="space-y-2 text-sm">
							<li>
								<strong>1-2 sentence summary</strong> – The biggest opportunity based on impact scores
							</li>
							<li>
								<strong>Top 3 Actions</strong> – Specific features to build or problems to solve, ranked by impact
								with actual numbers
							</li>
							<li>
								<strong>Sample size warnings</strong> – If you need more interviews to increase confidence
							</li>
						</ul>
						<div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
							<p className="font-medium text-foreground">Example output</p>
							<div className="mt-2 space-y-1 text-xs text-muted-foreground">
								<p>
									"The most significant opportunity is addressing the 'lack of creative time' for Creative
									Individuals, which has a high impact score of 0.5."
								</p>
								<p className="mt-2 font-medium text-foreground">Top 3 Actions:</p>
								<ol className="list-decimal space-y-1 pl-4">
									<li>'lack of elderly representation in media' for Creative Individual: 0.5 impact</li>
									<li>'performance pressures' for Musician: 0.5 impact</li>
									<li>'lack of creative time' for Parent: 0.5 impact</li>
								</ol>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5 text-primary" />
							When to use the Product Lens
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-muted-foreground">
						<ul className="space-y-3 text-sm">
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">✓</span>
								<span>
									<strong>Quarterly roadmap planning</strong> – See which features have the highest customer demand
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">✓</span>
								<span>
									<strong>Feature prioritization debates</strong> – Ground discussions in actual customer pain data
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">✓</span>
								<span>
									<strong>Segment-specific features</strong> – Decide if a feature is worth building for one segment
									vs. all users
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-primary">✓</span>
								<span>
									<strong>Pricing & packaging</strong> – High WTP signals (💰) show which features users will pay
									premium for
								</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
