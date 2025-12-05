/**
 * LensSelector - UI for selecting and applying conversation lenses to an interview
 *
 * Allows users to manually apply individual lenses or all lenses at once.
 */

import { useEffect, useState } from "react"
import { useFetcher } from "react-router-dom"
import { Check, Loader2, PlayCircle, Sparkles } from "lucide-react"
import { cn } from "~/lib/utils"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import type { LensAnalysisWithTemplate, LensTemplate } from "../lib/loadLensAnalyses.server"

type Props = {
	interviewId: string
	templates: LensTemplate[]
	analyses: Record<string, LensAnalysisWithTemplate>
	onLensApplied?: (templateKey: string) => void
	className?: string
}

/**
 * Get status badge for a lens
 */
function getStatusInfo(analysis?: LensAnalysisWithTemplate): {
	label: string
	color: string
	icon?: React.ReactNode
} {
	if (!analysis) {
		return { label: "Not applied", color: "text-muted-foreground" }
	}

	switch (analysis.status) {
		case "completed":
			return {
				label: "Complete",
				color: "text-green-600",
				icon: <Check className="h-3 w-3" />,
			}
		case "processing":
			return {
				label: "Processing",
				color: "text-blue-600",
				icon: <Loader2 className="h-3 w-3 animate-spin" />,
			}
		case "pending":
			return {
				label: "Pending",
				color: "text-yellow-600",
				icon: <Loader2 className="h-3 w-3 animate-spin" />,
			}
		case "failed":
			return {
				label: "Failed",
				color: "text-destructive",
			}
		default:
			return { label: "Unknown", color: "text-muted-foreground" }
	}
}

export function LensSelector({
	interviewId,
	templates,
	analyses,
	onLensApplied,
	className,
}: Props) {
	const [selectedLens, setSelectedLens] = useState<string>("")
	const fetcher = useFetcher()
	const isApplying = fetcher.state !== "idle"

	// Track which lens is being applied
	const applyingLensKey =
		fetcher.state !== "idle" && fetcher.formData
			? fetcher.formData.get("template_key")?.toString()
			: null

	const isApplyingAll =
		fetcher.state !== "idle" && fetcher.formData?.get("apply_all") === "true"

	// Notify parent when lens application completes
	useEffect(() => {
		if (fetcher.data?.ok && fetcher.data?.templateKey) {
			onLensApplied?.(fetcher.data.templateKey)
			setSelectedLens("")
		}
	}, [fetcher.data, onLensApplied])

	const handleApplyLens = () => {
		if (!selectedLens) return

		fetcher.submit(
			{ interview_id: interviewId, template_key: selectedLens },
			{ method: "POST", action: "/api/apply-lens" }
		)
	}

	const handleApplyAll = () => {
		fetcher.submit(
			{ interview_id: interviewId, apply_all: "true" },
			{ method: "POST", action: "/api/apply-lens" }
		)
	}

	// Group templates by category
	const groupedTemplates = templates.reduce(
		(acc, t) => {
			const cat = t.category || "other"
			if (!acc[cat]) acc[cat] = []
			acc[cat].push(t)
			return acc
		},
		{} as Record<string, LensTemplate[]>
	)

	// Category display names
	const categoryNames: Record<string, string> = {
		research: "Research",
		sales: "Sales",
		product: "Product",
		other: "Other",
	}

	// Count pending/processing lenses
	const pendingCount = Object.values(analyses).filter(
		(a) => a.status === "pending" || a.status === "processing"
	).length

	const completedCount = Object.values(analyses).filter(
		(a) => a.status === "completed"
	).length

	// Calculate how many lenses haven't been applied yet
	const unappliedCount = templates.length - Object.keys(analyses).length

	return (
		<div className={cn("flex flex-wrap items-center gap-3", className)}>
			{/* Lens selector dropdown */}
			<div className="flex items-center gap-2">
				<Select
					value={selectedLens}
					onValueChange={setSelectedLens}
					disabled={isApplying}
				>
					<SelectTrigger className="w-[220px]">
						<SelectValue placeholder="Select a lens..." />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(groupedTemplates).map(([category, lenses]) => (
							<div key={category}>
								<div className="px-2 py-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wide">
									{categoryNames[category] || category}
								</div>
								{lenses.map((lens) => {
									const analysis = analyses[lens.template_key]
									const status = getStatusInfo(analysis)
									const isApplyingThis = applyingLensKey === lens.template_key

									return (
										<SelectItem
											key={lens.template_key}
											value={lens.template_key}
											disabled={analysis?.status === "processing" || analysis?.status === "pending"}
										>
											<div className="flex items-center gap-2">
												<span>{lens.template_name}</span>
												{status.icon && (
													<span className={status.color}>{status.icon}</span>
												)}
												{analysis?.status === "completed" && (
													<Badge variant="outline" className="text-xs bg-green-50">
														Done
													</Badge>
												)}
												{isApplyingThis && (
													<Loader2 className="h-3 w-3 animate-spin text-blue-600" />
												)}
											</div>
										</SelectItem>
									)
								})}
							</div>
						))}
					</SelectContent>
				</Select>

				<Button
					onClick={handleApplyLens}
					disabled={!selectedLens || isApplying}
					size="sm"
				>
					{applyingLensKey && !isApplyingAll ? (
						<Loader2 className="h-4 w-4 animate-spin mr-1" />
					) : (
						<PlayCircle className="h-4 w-4 mr-1" />
					)}
					Apply
				</Button>
			</div>

			{/* Apply all button */}
			{unappliedCount > 0 && (
				<Button
					variant="outline"
					size="sm"
					onClick={handleApplyAll}
					disabled={isApplying}
				>
					{isApplyingAll ? (
						<Loader2 className="h-4 w-4 animate-spin mr-1" />
					) : (
						<Sparkles className="h-4 w-4 mr-1" />
					)}
					Apply All ({unappliedCount})
				</Button>
			)}

			{/* Status indicator */}
			{pendingCount > 0 && (
				<Badge variant="outline" className="bg-blue-50 text-blue-700">
					<Loader2 className="h-3 w-3 mr-1 animate-spin" />
					{pendingCount} processing
				</Badge>
			)}

			{completedCount > 0 && unappliedCount === 0 && pendingCount === 0 && (
				<Badge variant="outline" className="bg-green-50 text-green-700">
					<Check className="h-3 w-3 mr-1" />
					All {completedCount} lenses applied
				</Badge>
			)}
		</div>
	)
}

/**
 * Compact version for use in headers/toolbars
 */
export function LensSelectorCompact({
	interviewId,
	templates,
	analyses,
	onLensApplied,
}: Props) {
	const fetcher = useFetcher()
	const isApplying = fetcher.state !== "idle"

	const handleApplyLens = (templateKey: string) => {
		fetcher.submit(
			{ interview_id: interviewId, template_key: templateKey },
			{ method: "POST", action: "/api/apply-lens" }
		)
	}

	const handleApplyAll = () => {
		fetcher.submit(
			{ interview_id: interviewId, apply_all: "true" },
			{ method: "POST", action: "/api/apply-lens" }
		)
	}

	// Notify parent when lens application completes
	useEffect(() => {
		if (fetcher.data?.ok && fetcher.data?.templateKey) {
			onLensApplied?.(fetcher.data.templateKey)
		}
	}, [fetcher.data, onLensApplied])

	const unappliedLenses = templates.filter(
		(t) => !analyses[t.template_key] || analyses[t.template_key].status === "failed"
	)

	if (unappliedLenses.length === 0) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" disabled={isApplying}>
					{isApplying ? (
						<Loader2 className="h-4 w-4 animate-spin mr-1" />
					) : (
						<Sparkles className="h-4 w-4 mr-1" />
					)}
					Apply Lens
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleApplyAll}>
					<Sparkles className="h-4 w-4 mr-2" />
					Apply All ({unappliedLenses.length})
				</DropdownMenuItem>
				<div className="border-t my-1" />
				{unappliedLenses.map((lens) => (
					<DropdownMenuItem
						key={lens.template_key}
						onClick={() => handleApplyLens(lens.template_key)}
					>
						{lens.template_name}
						{lens.category && (
							<Badge variant="outline" className="ml-2 text-xs">
								{lens.category}
							</Badge>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
