/**
 * GenericLensView - Renders any conversation lens analysis based on template definition
 *
 * Dynamically renders sections and fields based on the template structure,
 * supporting text, text_array, numeric, date, and boolean field types.
 */

import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import type { LensAnalysisWithTemplate, LensTemplate } from "../lib/loadLensAnalyses.server"

type Props = {
	analysis: LensAnalysisWithTemplate | null
	template?: LensTemplate
	isLoading?: boolean
}

/**
 * Render a field value based on its type
 */
function FieldValue({ value, fieldType }: { value: any; fieldType: string }) {
	if (value === null || value === undefined) {
		return <span className="text-muted-foreground italic">Not captured</span>
	}

	switch (fieldType) {
		case "text_array":
			if (!Array.isArray(value) || value.length === 0) {
				return <span className="text-muted-foreground italic">None</span>
			}
			return (
				<ul className="list-inside list-disc space-y-1">
					{value.map((item, i) => (
						<li key={i} className="text-sm">
							{item}
						</li>
					))}
				</ul>
			)

		case "boolean":
			return value ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>

		case "numeric":
			return <span className="font-mono">{value}</span>

		case "date":
			return (
				<span>
					{new Date(value).toLocaleDateString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					})}
				</span>
			)

		default:
			return <span>{String(value)}</span>
	}
}

/**
 * Render confidence indicator
 */
function ConfidenceIndicator({ confidence }: { confidence: string | number | null }) {
	if (!confidence) return null

	const level =
		typeof confidence === "number"
			? confidence > 0.7
				? "high"
				: confidence > 0.4
					? "medium"
					: "low"
			: confidence.toLowerCase()

	const colors = {
		high: "bg-green-100 text-green-700",
		medium: "bg-yellow-100 text-yellow-700",
		low: "bg-red-100 text-red-700",
		inconclusive: "bg-gray-100 text-gray-700",
	}

	return (
		<Badge variant="outline" className={colors[level as keyof typeof colors] || colors.medium}>
			{typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : confidence}
		</Badge>
	)
}

/**
 * Render a section from the template
 */
function SectionView({
	sectionDef,
	items,
}: {
	sectionDef: LensTemplate["template_definition"]["sections"][0]
	items: any[]
}) {
	if (!items || items.length === 0) {
		return <div className="py-4 text-muted-foreground text-sm italic">No data extracted for this section</div>
	}

	return (
		<div className="space-y-4">
			{items.map((item, itemIndex) => (
				<div key={itemIndex} className="space-y-3 rounded-lg border bg-card p-4">
					{sectionDef.fields.map((field) => {
						const value = item[field.field_key]
						if (value === null || value === undefined) return null

						return (
							<div key={field.field_key}>
								<div className="mb-1 flex items-center gap-2">
									<span className="font-medium text-muted-foreground text-sm">{field.field_name}</span>
									{field.field_key === "confidence" && <ConfidenceIndicator confidence={value} />}
								</div>
								{field.field_key !== "confidence" && (
									<div className="text-sm">
										<FieldValue value={value} fieldType={field.field_type} />
									</div>
								)}
							</div>
						)
					})}

					{/* Show evidence count if present */}
					{item.evidence_ids?.length > 0 && (
						<div className="border-t pt-2 text-muted-foreground text-xs">
							{item.evidence_ids.length} evidence item(s)
						</div>
					)}
				</div>
			))}
		</div>
	)
}

/**
 * Status indicator for pending/processing/failed analyses
 */
function StatusIndicator({ status, errorMessage }: { status: string; errorMessage?: string | null }) {
	switch (status) {
		case "pending":
			return (
				<div className="flex items-center gap-2 py-8 text-muted-foreground">
					<Clock className="h-5 w-5" />
					<span>Analysis pending...</span>
				</div>
			)
		case "processing":
			return (
				<div className="flex items-center gap-2 py-8 text-blue-600">
					<Loader2 className="h-5 w-5 animate-spin" />
					<span>Analyzing conversation...</span>
				</div>
			)
		case "failed":
			return (
				<div className="flex items-center gap-2 py-8 text-destructive">
					<AlertCircle className="h-5 w-5" />
					<span>{errorMessage || "Analysis failed"}</span>
				</div>
			)
		case "completed":
			return null
		default:
			return null
	}
}

export function GenericLensView({ analysis, template, isLoading }: Props) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	// Use template from analysis if not provided separately
	const templateDef = template?.template_definition || analysis?.template.template_definition

	if (!analysis && !template) {
		return <div className="py-12 text-center text-muted-foreground">No analysis available</div>
	}

	// Show status for non-completed analyses
	if (analysis && analysis.status !== "completed") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{analysis.template.template_name}</CardTitle>
					{analysis.template.summary && <CardDescription>{analysis.template.summary}</CardDescription>}
				</CardHeader>
				<CardContent className="flex justify-center">
					<StatusIndicator status={analysis.status} errorMessage={analysis.error_message} />
				</CardContent>
			</Card>
		)
	}

	// No template definition
	if (!templateDef) {
		return <div className="py-12 text-center text-muted-foreground">Template definition not available</div>
	}

	const analysisData = analysis?.analysis_data || {}
	const sections = analysisData.sections || []

	// Build a map of section data by section_key
	const sectionDataMap: Record<string, any[]> = {}
	for (const section of sections) {
		if (section.section_key && section.items) {
			sectionDataMap[section.section_key] = section.items
		}
	}

	return (
		<div className="space-y-6">
			{/* Header with confidence */}
			{analysis && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						<span className="text-muted-foreground text-sm">
							Analyzed {analysis.processed_at ? new Date(analysis.processed_at).toLocaleDateString() : "recently"}
						</span>
					</div>
					{analysis.confidence_score !== null && <ConfidenceIndicator confidence={analysis.confidence_score} />}
				</div>
			)}

			{/* Render each section */}
			{templateDef.sections.map((sectionDef) => (
				<Card key={sectionDef.section_key}>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">{sectionDef.section_name}</CardTitle>
						{sectionDef.description && <CardDescription>{sectionDef.description}</CardDescription>}
					</CardHeader>
					<CardContent>
						<SectionView sectionDef={sectionDef} items={sectionDataMap[sectionDef.section_key] || []} />
					</CardContent>
				</Card>
			))}

			{/* Recommendations if enabled */}
			{templateDef.recommendations_enabled && analysisData.recommendations?.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">Recommendations</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="space-y-2">
							{analysisData.recommendations.map((rec: any, i: number) => (
								<li key={i} className="flex items-start gap-2">
									<Badge
										variant={
											rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"
										}
										className="mt-0.5"
									>
										{rec.priority || "medium"}
									</Badge>
									<span className="text-sm">{rec.description}</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Key insights if present */}
			{analysisData.key_insights?.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">Key Insights</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="list-inside list-disc space-y-1">
							{analysisData.key_insights.map((insight: string, i: number) => (
								<li key={i} className="text-sm">
									{insight}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}

			{/* Research learnings for project-research lens */}
			{analysisData.research_learnings?.length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">Research Learnings</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{analysisData.research_learnings.map((learning: any, i: number) => (
								<div key={i} className="border-primary/30 border-l-2 pl-3">
									<p className="font-medium text-sm">{learning.learning_statement}</p>
									{learning.relevance_to_goals && (
										<p className="mt-1 text-muted-foreground text-xs">{learning.relevance_to_goals}</p>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Goal completion score for project-research lens */}
			{analysisData.goal_completion_score !== undefined && (
				<div className="text-muted-foreground text-sm">
					Goal completion: {Math.round(analysisData.goal_completion_score * 100)}%
				</div>
			)}
		</div>
	)
}
