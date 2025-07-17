import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Filter, MoreHorizontal, Target, User } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import type { InsightView } from "~/types"

type SortConfig = {
	key: keyof InsightView | null
	direction: "asc" | "desc"
}

type ColumnFilters = {
	tag: string
	category: string | null
	journeyStage: string | null
	impact: string | null
	novelty: string | null
	confidence: string | null
}

interface InsightsDataTableProps {
	insights: InsightView[]
}

export function InsightsDataTable({ insights }: InsightsDataTableProps) {
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		key: "impact",
		direction: "desc",
	})
	const [filters, setFilters] = useState<ColumnFilters>({
		tag: "",
		category: null,
		journeyStage: null,
		impact: null,
		novelty: null,
		confidence: null,
	})

	const filteredAndSortedInsights = useMemo(() => {
		const filtered = insights.filter((insight) => {
			const searchLower = filters.tag.toLowerCase()
			const nameMatch = insight.name?.toLowerCase().includes(searchLower)
			const jtbdMatch = insight.jtbd?.toLowerCase().includes(searchLower)
			const tagMatch = nameMatch || jtbdMatch

			const categoryMatch = !filters.category || insight.category === filters.category
			const journeyStageMatch = !filters.journeyStage || insight.journeyStage === filters.journeyStage
			const impactMatch = !filters.impact || String(insight.impact) === filters.impact
			const noveltyMatch = !filters.novelty || String(insight.novelty) === filters.novelty
			const confidenceMatch = !filters.confidence || String(insight.confidence) === filters.confidence

			return tagMatch && categoryMatch && journeyStageMatch && impactMatch && noveltyMatch && confidenceMatch
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
	}, [insights, filters, sortConfig])

	const handleSort = (key: keyof InsightView) => {
		setSortConfig((current) => ({
			key,
			direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
		}))
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
					<TableHeader>
						<TableRow>
							<TableHead className="min-w-[180px]">
								<Button variant="ghost" onClick={() => handleSort("name")}>
									Name {getSortIcon("name")}
								</Button>
							</TableHead>
							<TableHead>
								<Button variant="ghost" onClick={() => handleSort("category")}>
									Category {getSortIcon("category")}
								</Button>
							</TableHead>
							<TableHead>
								<Button variant="ghost" onClick={() => handleSort("journeyStage")}>
									Journey Stage {getSortIcon("journeyStage")}
								</Button>
							</TableHead>
							<TableHead>
								<Button variant="ghost" onClick={() => handleSort("impact")}>
									Impact {getSortIcon("impact")}
								</Button>
							</TableHead>
							<TableHead>
								<Button variant="ghost" onClick={() => handleSort("novelty")}>
									Novelty {getSortIcon("novelty")}
								</Button>
							</TableHead>
							<TableHead>
								<Button variant="ghost" onClick={() => handleSort("confidence")}>
									Confidence {getSortIcon("confidence")}
								</Button>
							</TableHead>
							<TableHead>Evidence</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell>
								<Input
									placeholder="Filter by name/JTBD..."
									value={filters.tag}
									onChange={(e) => setFilters((prev) => ({ ...prev, tag: e.target.value }))}
									className="max-w-sm"
								/>
							</TableCell>
							<TableCell>
								<Select
									onValueChange={(value) => {
										setFilters((prev) => ({ ...prev, category: value === "all" ? null : value }))
									}}
									value={filters.category || "all"}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Filter by category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Categories</SelectItem>
										{[...new Set(insights.map((i) => i.category))]
											.filter((c): c is string => !!c)
											.map((category) => (
												<SelectItem key={category} value={category}>
													{category}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Select
									onValueChange={(value) => {
										setFilters((prev) => ({ ...prev, journeyStage: value === "all" ? null : value }))
									}}
									value={filters.journeyStage || "all"}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Filter by journey stage" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Stages</SelectItem>
										{[...new Set(insights.map((i) => i.journeyStage))]
											.filter((s): s is string => !!s)
											.map((stage) => (
												<SelectItem key={stage} value={stage}>
													{stage}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Select
									onValueChange={(value) => {
										setFilters((prev) => ({ ...prev, impact: value === "all" ? null : value }))
									}}
									value={String(filters.impact || "all")}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Filter by impact" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										{[...new Set(insights.map((i) => i.impact))]
											.filter((i): i is number => i !== null && i !== undefined)
											.map((impact) => (
												<SelectItem key={String(impact)} value={String(impact)}>
													{impact}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Select
									onValueChange={(value) => {
										setFilters((prev) => ({ ...prev, novelty: value === "all" ? null : value }))
									}}
									value={String(filters.novelty || "all")}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Filter by novelty" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										{[...new Set(insights.map((i) => i.novelty))]
											.filter((i): i is number => i !== null && i !== undefined)
											.map((novelty) => (
												<SelectItem key={String(novelty)} value={String(novelty)}>
													{novelty}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell>
								<Select
									onValueChange={(value) => {
										setFilters((prev) => ({ ...prev, confidence: value === "all" ? null : value }))
									}}
									value={filters.confidence || "all"}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Filter by confidence" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										{[...new Set(insights.map((i) => i.confidence))]
											.filter((c): c is string => !!c)
											.map((confidence) => (
												<SelectItem key={confidence} value={confidence}>
													{confidence}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell colSpan={2}>
								<Button
									variant="outline"
									onClick={() =>
										setFilters({
											tag: "",
											category: null,
											journeyStage: null,
											impact: null,
											novelty: null,
											confidence: null,
										})
									}
								>
									Clear Filters
								</Button>
							</TableCell>
						</TableRow>
						{filteredAndSortedInsights.map((insight) => (
							<TableRow key={insight.id}>
								<TableCell>
									<Link to={`/insights/${insight.id}`} className="hover:underline">
										<div className="mb-1 font-medium">{insight.name}</div>
										<div className="line-clamp-2 text-muted-foreground text-xs">{insight.jtbd}</div>
									</Link>
								</TableCell>
								<TableCell>{insight.category && <Badge variant="outline">{insight.category}</Badge>}</TableCell>
								<TableCell>{insight.journeyStage && <Badge variant="outline">{insight.journeyStage}</Badge>}</TableCell>
								<TableCell>
									{insight.impact != null && (
										<Badge className={getImpactColor(Number(insight.impact))}>{insight.impact}</Badge>
									)}
								</TableCell>
								<TableCell>
									{insight.novelty != null && (
										<Badge className={getNoveltyColor(Number(insight.novelty))}>{insight.novelty}</Badge>
									)}
								</TableCell>
								<TableCell>
									{insight.confidence != null && (
										<Badge className={getConfidenceColor(String(insight.confidence))}>{insight.confidence}</Badge>
									)}
								</TableCell>
								<TableCell className="line-clamp-2 text-muted-foreground text-xs">{insight.evidence}</TableCell>
								<TableCell className="text-right">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem asChild>
												<Link to={`/insights/${insight.id}`} className="flex items-center">
													<Eye className="mr-2 h-4 w-4" /> View
												</Link>
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

			{filteredAndSortedInsights.length === 0 && (
				<div className="py-8 text-center">
					<Filter className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<p className="text-muted-foreground">No insights match your current filters.</p>
				</div>
			)}
		</Card>
	)
}
