import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"

export default function ResearchWorkflow() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-4 font-bold text-4xl tracking-tight">Research Workflow</h1>
			<p className="mb-8 text-muted-foreground text-lg">
				A complete guide to conducting research from planning to insights
			</p>

			<div className="prose prose-slate max-w-none dark:prose-invert">
				<p className="lead">Coming soon: Detailed workflow documentation</p>
			</div>
		</div>
	)
}
