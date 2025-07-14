import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Filter, MoreHorizontal, Target, User, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableRow } from "~/components/ui/table"
import type { InsightView } from "~/types"

const ALL = "__all__"

type SortConfig = {
	key: keyof InsightView | null
	direction: "asc" | "desc"
}

type ColumnFilters = {
	tag: string
	category: string
	journeyStage: string
	impact: string
	novelty: string
	confidence: string
}

interface InsightsDataTableProps {
	insights: InsightView[]
}

export function InsightsDataTable({ insights }: InsightsDataTableProps) {
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		key: "impact",
		direction: "desc",
	})
	const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
		tag: "",
		category: ALL,
		journeyStage: ALL,
		impact: ALL,
		novelty: ALL,
		confidence: ALL,
	})

	const categories = [...new Set(insights.map((i) => i.category))].filter((v): v is string => typeof v === "string")
	const journeyStages = [...new Set(insights.map((i) => i.journeyStage))].filter(
		(v): v is string => typeof v === "string"
	)
	const confidenceLevels = [...new Set(insights.map((i) => i.confidence))].filter(
		(v): v is string => typeof v === "string"
	)
	const impactLevels = [...new Set(insights.map((i) => i.impact))].filter(
		(v): v is number => typeof v === "number" && !Number.isNaN(v)
	)
	const noveltyLevels = [...new Set(insights.map((i) => i.novelty))].filter(
		(v): v is number => typeof v === "number" && !Number.isNaN(v)
	)

	const filteredAndSortedInsights = useMemo(() => {
		const filtered = insights.filter((insight) => {
			const searchWords = columnFilters.tag.toLowerCase().split(" ").filter(Boolean)
			const matchesTag = searchWords.every((word) => (insight.name ?? "").toLowerCase().includes(word))
			const matchesJtbd = searchWords.every((word) => (insight.jtbd ?? "").toLowerCase().includes(word))
			return (
				(matchesTag || matchesJtbd) &&
				(columnFilters.category === ALL || insight.category === columnFilters.category) &&
				(columnFilters.journeyStage === ALL || insight.journeyStage === columnFilters.journeyStage) &&
				(columnFilters.impact === ALL || String(insight.impact) === columnFilters.impact) &&
				(columnFilters.novelty === ALL || String(insight.novelty) === columnFilters.novelty) &&
				(columnFilters.confidence === ALL || insight.confidence === columnFilters.confidence)
			)
		})

		if (sortConfig.key) {
			const key = sortConfig.key
			filtered.sort((a, b) => {
				const aValue = a[key]
				const bValue = b[key]

				if (aValue == null && bValue == null) return 0
				if (aValue == null) return sortConfig.direction === "asc" ? -1 : 1
				if (bValue == null) return sortConfig.direction === "asc" ? 1 : -1

				if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
				if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
				return 0
			})
		}

		return filtered
	}, [insights, columnFilters, sortConfig])

	const handleSort = (key: keyof InsightView) => {
		setSortConfig((current) => ({
			key,
			direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
		}))
	}

	const updateColumnFilter = (column: keyof ColumnFilters, value: string | null | undefined) => {
		const newValue = value?.trim() === "" ? ALL : value
		setColumnFilters((prev) => ({ ...prev, [column]: newValue }))
	}

	const clearColumnFilter = (column: keyof ColumnFilters) => {
		setColumnFilters((prev) => ({ ...prev, [column]: ALL }))
	}

	const getSortIcon = (column: keyof InsightView) => {
		if (sortConfig.key !== column) return <ArrowUpDown className="h-4 w-4" />
		return sortConfig.direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
	}

	const getImpactColor = (impact: number) => {
		if (impact >= 4) return "bg-red-100 text-red-800 border-red-200"
		if (impact >= 3) return "bg-orange-100 text-orange-800 border-orange-200"
		return "bg-yellow-100 text-yellow-800 border-yellow-200"
	}

	const getNoveltyColor = (novelty: number) => {
		if (novelty >= 4) return "bg-purple-100 text-purple-800 border-purple-200"
		if (novelty >= 3) return "bg-blue-100 text-blue-800 border-blue-200"
		return "bg-gray-100 text-gray-800 border-gray-200"
	}

	const getConfidenceColor = (confidence: string) => {
		switch (confidence) {
			case "high":
				return "bg-green-100 text-green-800 border-green-200"
			case "medium":
				return "bg-yellow-100 text-yellow-800 border-yellow-200"
			case "low":
				return "bg-red-100 text-red-800 border-red-200"
			default:
				return "bg-gray-100 text-gray-800 border-gray-200"
		}
	}

	return (
		<Card className="overflow-hidden">
			<div className="overflow-x-auto">
				<Table>
					<TableHead className="min-w-[180px]">
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("tag")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Insight {getSortIcon("tag")}
							</Button>
							<div className="flex items-center gap-1">
								<Input
									placeholder="Filter insights..."
									value={columnFilters.tag === ALL ? "" : columnFilters.tag}
									onChange={(e) => updateColumnFilter("tag", e.target.value)}
									className="h-8 text-xs"
								/>
								{columnFilters.tag !== ALL && (
									<Button variant="ghost" size="sm" onClick={() => clearColumnFilter("tag")} className="h-8 w-8 p-0">
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>
					<TableHead>
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("category")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Category {getSortIcon("category")}
							</Button>
							<div className="flex items-center gap-1">
								<Select value={columnFilters.category} onValueChange={(value) => updateColumnFilter("category", value)}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>All Categories</SelectItem>
										{categories.map((category) => (
											<SelectItem key={category} value={category}>
												{category}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{columnFilters.category !== ALL && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => clearColumnFilter("category")}
										className="h-8 w-8 p-0"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>
					<TableHead className="min-w-[140px]">
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("journeyStage")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Journey Stage {getSortIcon("journeyStage")}
							</Button>
							<div className="flex items-center gap-1">
								<Select
									value={columnFilters.journeyStage}
									onValueChange={(value) => updateColumnFilter("journeyStage", value)}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>All Stages</SelectItem>
										{journeyStages.map((stage) => (
											<SelectItem key={stage} value={stage}>
												{stage}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{columnFilters.journeyStage !== ALL && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => clearColumnFilter("journeyStage")}
										className="h-8 w-8 p-0"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>

					<TableHead className="min-w-[100px]">
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("impact")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Impact {getSortIcon("impact")}
							</Button>
							<div className="flex items-center gap-1">
								<Select value={columnFilters.impact} onValueChange={(value) => updateColumnFilter("impact", value)}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>All</SelectItem>
										{impactLevels.map((level) => (
											<SelectItem key={level} value={String(level)}>
												{level}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{columnFilters.impact !== ALL && (
									<Button variant="ghost" size="sm" onClick={() => clearColumnFilter("impact")} className="h-8 w-8 p-0">
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>

					<TableHead className="min-w-[100px]">
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("novelty")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Novelty {getSortIcon("novelty")}
							</Button>
							<div className="flex items-center gap-1">
								<Select value={columnFilters.novelty} onValueChange={(value) => updateColumnFilter("novelty", value)}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>All</SelectItem>
										{noveltyLevels.map((level) => (
											<SelectItem key={level} value={String(level)}>
												{level}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{columnFilters.novelty !== ALL && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => clearColumnFilter("novelty")}
										className="h-8 w-8 p-0"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>

					<TableHead className="min-w-[120px]">
						<div className="space-y-2">
							<Button
								variant="ghost"
								onClick={() => handleSort("confidence")}
								className="h-auto p-0 font-semibold hover:bg-transparent"
							>
								Confidence {getSortIcon("confidence")}
							</Button>
							<div className="flex items-center gap-1">
								<Select
									value={columnFilters.confidence}
									onValueChange={(value) => updateColumnFilter("confidence", value)}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>All</SelectItem>
										{confidenceLevels.map((level) => (
											<SelectItem key={level} value={String(level)}>
												{level}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{columnFilters.confidence !== ALL && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => clearColumnFilter("confidence")}
										className="h-8 w-8 p-0"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>
						</div>
					</TableHead>

					<TableBody>
						{filteredAndSortedInsights.map((insight) => (
							<TableRow key={insight.id}>
								<TableCell>
									<div className="mb-1 font-medium">{insight.name}</div>
									<div className="line-clamp-2 text-muted-foreground text-xs">{insight.jtbd}</div>
								</TableCell>
								<TableCell>
									<Badge variant="outline">{insight.category}</Badge>
								</TableCell>
								<TableCell>
									<Badge variant="outline">{insight.journeyStage}</Badge>
								</TableCell>
								<TableCell>
									<Badge className={getImpactColor(Number(insight.impact))}>{insight.impact}</Badge>
								</TableCell>
								<TableCell>
									<Badge className={getNoveltyColor(Number(insight.novelty))}>{insight.novelty}</Badge>
								</TableCell>
								<TableCell>
									<Badge className={getConfidenceColor(String(insight.confidence))}>{insight.confidence}</Badge>
								</TableCell>
								<TableCell className="line-clamp-2 text-muted-foreground text-xs">{insight.evidence}</TableCell>
								<TableCell>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem>
												<Eye className="mr-2 h-4 w-4" /> View
											</DropdownMenuItem>
											<DropdownMenuItem>
												<Target className="mr-2 h-4 w-4" /> Opportunity
											</DropdownMenuItem>
											<DropdownMenuItem>
												<User className="mr-2 h-4 w-4" /> Persona
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{filteredAndSortedInsights.length === 0 && insights.length > 0 && (
				<div className="py-8 text-center">
					<Filter className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<p className="text-muted-foreground">No insights match your current filters.</p>
					<p className="mt-1 text-muted-foreground text-sm">Try adjusting your filter criteria.</p>
				</div>
			)}
		</Card>
	)
}
