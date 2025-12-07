/**
 * LensTabs - Tabbed view of all available conversation lenses for an interview
 *
 * Shows tabs for each lens template with status indicators.
 * Renders GenericLensView for the selected tab.
 */

import { CheckCircle2, Clock, Loader2, Sparkles, XCircle } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"
import type { LensAnalysisWithTemplate, LensTemplate } from "../lib/loadLensAnalyses.server"
import { GenericLensView } from "./GenericLensView"

type EvidenceRecord = {
	id: string
	anchors?: unknown
	start_ms?: number | null
	gist?: string | null
}

type Props = {
	templates: LensTemplate[]
	analyses: Record<string, LensAnalysisWithTemplate>
	defaultTab?: string
	className?: string
	/** Enable inline editing of lens fields */
	editable?: boolean
	/** Map of evidence ID to evidence record for hydrating timestamps */
	evidenceMap?: Map<string, EvidenceRecord>
}

/**
 * Status icon for a lens
 */
function LensStatusIcon({ analysis }: { analysis?: LensAnalysisWithTemplate }) {
	if (!analysis) {
		return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
	}

	switch (analysis.status) {
		case "completed":
			return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
		case "processing":
			return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
		case "failed":
			return <XCircle className="h-3.5 w-3.5 text-destructive" />
		case "pending":
		default:
			return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
	}
}

/**
 * Category badge with color coding
 */
function CategoryBadge({ category }: { category: string | null }) {
	if (!category) return null

	const colors: Record<string, string> = {
		research: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
		sales: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		product: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
	}

	return (
		<Badge variant="outline" className={cn("text-xs", colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300")}>
			{category}
		</Badge>
	)
}

export function LensTabs({ templates, analyses, defaultTab, className, editable, evidenceMap }: Props) {
	// Sort templates by display_order
	const sortedTemplates = [...templates].sort((a, b) => a.display_order - b.display_order)

	// Default to first template or project-research if available
	const initialTab =
		defaultTab ||
		(analyses["project-research"] ? "project-research" : sortedTemplates[0]?.template_key) ||
		"project-research"

	const [activeTab, setActiveTab] = useState(initialTab)

	if (templates.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				<Sparkles className="mx-auto mb-3 h-8 w-8 opacity-50" />
				<p>No lens templates available</p>
			</div>
		)
	}

	return (
		<div className={cn("space-y-4", className)}>
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="h-auto w-full flex-wrap gap-1 p-1">
					{sortedTemplates.map((template) => {
						const analysis = analyses[template.template_key]
						return (
							<TabsTrigger
								key={template.template_key}
								value={template.template_key}
								className="flex items-center gap-1.5 data-[state=active]:shadow-sm"
							>
								<LensStatusIcon analysis={analysis} />
								<span className="hidden sm:inline">{template.template_name}</span>
								<span className="sm:hidden">{template.template_name.split(" ")[0]}</span>
							</TabsTrigger>
						)
					})}
				</TabsList>

				{sortedTemplates.map((template) => {
					const analysis = analyses[template.template_key]
					return (
						<TabsContent key={template.template_key} value={template.template_key} className="mt-4">
							<div className="space-y-4">
								{/* Template header */}
								<div className="flex items-center justify-between">
									<div>
										<h4 className="font-medium">{template.template_name}</h4>
										{template.summary && <p className="text-muted-foreground text-sm">{template.summary}</p>}
									</div>
									<CategoryBadge category={template.category} />
								</div>

								{/* Lens content */}
								<GenericLensView
									analysis={analysis}
									template={template}
									editable={editable}
									evidenceMap={evidenceMap}
								/>
							</div>
						</TabsContent>
					)
				})}
			</Tabs>
		</div>
	)
}

/**
 * Compact lens indicator for showing in headers/lists
 */
export function LensStatusSummary({
	analyses,
	className,
}: {
	analyses: Record<string, LensAnalysisWithTemplate>
	className?: string
}) {
	const values = Object.values(analyses)
	const completed = values.filter((a) => a.status === "completed").length
	const processing = values.filter((a) => a.status === "processing").length
	const failed = values.filter((a) => a.status === "failed").length

	if (values.length === 0) return null

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{completed > 0 && (
				<Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs">
					<CheckCircle2 className="mr-1 h-3 w-3" />
					{completed}
				</Badge>
			)}
			{processing > 0 && (
				<Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs">
					<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					{processing}
				</Badge>
			)}
			{failed > 0 && (
				<Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs">
					<XCircle className="mr-1 h-3 w-3" />
					{failed}
				</Badge>
			)}
		</div>
	)
}
