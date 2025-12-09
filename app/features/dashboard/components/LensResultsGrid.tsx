/**
 * LensResultsGrid - Grid display of active lens results
 *
 * Shows all enabled lenses for a project with their analysis summaries.
 * Responsive grid: 1 column on mobile, 2 on tablet+.
 */

import { Glasses } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { LensResultCard } from "./LensResultCard"

export interface LensSummary {
	templateKey: string
	name: string
	category: "sales" | "research" | "product" | string
	conversationCount: number
	summary?: string
	href: string
	hasData?: boolean
}

export interface LensResultsGridProps {
	/** Array of lens summaries to display */
	lenses: LensSummary[]
	/** Link to lens library for configuration */
	lensLibraryHref: string
	/** Maximum number of lenses to show (rest collapsed) */
	maxVisible?: number
}

export function LensResultsGrid({ lenses, lensLibraryHref, maxVisible = 4 }: LensResultsGridProps) {
	// Filter to lenses with data first, then sort by conversation count
	const sortedLenses = [...lenses].sort((a, b) => {
		// Prioritize lenses with data
		if (a.hasData && !b.hasData) return -1
		if (!a.hasData && b.hasData) return 1
		// Then by conversation count
		return b.conversationCount - a.conversationCount
	})

	const visibleLenses = sortedLenses.slice(0, maxVisible)
	const hasMore = sortedLenses.length > maxVisible

	if (lenses.length === 0) {
		return (
			<div className="py-8 text-center">
				<div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4">
					<Glasses className="h-8 w-8 text-muted-foreground" />
				</div>
				<h3 className="mb-2 font-medium text-foreground">No lenses configured</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					Enable analysis lenses to automatically extract insights from conversations
				</p>
				<Button asChild variant="outline">
					<Link to={lensLibraryHref}>Configure Lenses</Link>
				</Button>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{/* Section header */}
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-foreground text-lg">Lens Results</h2>
				<Button asChild variant="ghost" size="sm" className="text-muted-foreground">
					<Link to={lensLibraryHref}>
						<Glasses className="mr-1.5 h-4 w-4" />
						All Lenses
					</Link>
				</Button>
			</div>

			{/* Lens cards grid */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{visibleLenses.map((lens) => (
					<LensResultCard
						key={lens.templateKey}
						templateKey={lens.templateKey}
						name={lens.name}
						category={lens.category}
						conversationCount={lens.conversationCount}
						summary={lens.summary}
						href={lens.href}
						hasData={lens.hasData}
					/>
				))}
			</div>

			{/* Show more link */}
			{hasMore && (
				<div className="text-center">
					<Button asChild variant="ghost" size="sm">
						<Link to={lensLibraryHref}>View {sortedLenses.length - maxVisible} more lenses</Link>
					</Button>
				</div>
			)}
		</div>
	)
}

export default LensResultsGrid
