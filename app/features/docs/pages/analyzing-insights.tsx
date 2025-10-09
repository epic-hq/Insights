import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"

export default function AnalyzingInsights() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-4 font-bold text-4xl tracking-tight">Analyzing Insights</h1>
			<p className="mb-8 text-lg text-muted-foreground">
				Learn how to discover patterns and extract actionable findings
			</p>

			<div className="prose prose-slate dark:prose-invert max-w-none">
				<p className="lead">Coming soon: Analysis techniques and best practices</p>
			</div>
		</div>
	)
}
