/**
 * Lens Library - Browse all available conversation lenses
 *
 * Shows system lenses and custom lenses with details about each.
 * Users can view lens structure and apply them to interviews.
 */

import {
	BookOpen,
	Briefcase,
	ChevronRight,
	Eye,
	FlaskConical,
	Lightbulb,
	Package,
	Search,
	Sparkles,
	Target,
	Users,
} from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import { type LensTemplate, loadLensTemplates } from "../lib/loadLensAnalyses.server"

export const meta: MetaFunction = () => {
	return [{ title: "Lens Library | Insights" }, { name: "description", content: "Browse conversation analysis lenses" }]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const templates = await loadLensTemplates(supabase as any)

	return { templates }
}

/**
 * Get icon for a lens category
 */
function getCategoryIcon(category: string | null) {
	switch (category) {
		case "research":
			return <FlaskConical className="h-5 w-5" />
		case "sales":
			return <Briefcase className="h-5 w-5" />
		case "product":
			return <Package className="h-5 w-5" />
		default:
			return <Sparkles className="h-5 w-5" />
	}
}

/**
 * Get color scheme for a lens category
 */
function getCategoryColors(category: string | null): {
	bg: string
	text: string
	border: string
	iconBg: string
} {
	switch (category) {
		case "research":
			return {
				bg: "bg-purple-50",
				text: "text-purple-700",
				border: "border-purple-200",
				iconBg: "bg-purple-100",
			}
		case "sales":
			return {
				bg: "bg-blue-50",
				text: "text-blue-700",
				border: "border-blue-200",
				iconBg: "bg-blue-100",
			}
		case "product":
			return {
				bg: "bg-green-50",
				text: "text-green-700",
				border: "border-green-200",
				iconBg: "bg-green-100",
			}
		default:
			return {
				bg: "bg-gray-50",
				text: "text-gray-700",
				border: "border-gray-200",
				iconBg: "bg-gray-100",
			}
	}
}

/**
 * Lens detail dialog showing the full template structure
 */
function LensDetailDialog({ template }: { template: LensTemplate }) {
	const colors = getCategoryColors(template.category)
	const definition = template.template_definition

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm">
					<Eye className="mr-1 h-4 w-4" />
					View Structure
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<div className={`rounded-lg p-2 ${colors.iconBg}`}>{getCategoryIcon(template.category)}</div>
						{template.template_name}
					</DialogTitle>
					<DialogDescription>{template.summary}</DialogDescription>
				</DialogHeader>

				<div className="mt-4 space-y-6">
					{/* Sections */}
					<div>
						<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
							Sections ({definition.sections.length})
						</h4>
						<div className="space-y-4">
							{definition.sections.map((section) => (
								<Card key={section.section_key} className="bg-muted/30">
									<CardHeader className="py-3">
										<CardTitle className="text-base">{section.section_name}</CardTitle>
										{section.description && <CardDescription>{section.description}</CardDescription>}
									</CardHeader>
									<CardContent className="py-2">
										<div className="space-y-2">
											{section.fields.map((field) => (
												<div
													key={field.field_key}
													className="flex items-center justify-between rounded bg-background px-2 py-1 text-sm"
												>
													<span className="font-medium">{field.field_name}</span>
													<Badge variant="outline" className="text-xs">
														{field.field_type}
													</Badge>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					{/* Entities */}
					{definition.entities && definition.entities.length > 0 && (
						<div>
							<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
								Entities Extracted
							</h4>
							<div className="flex flex-wrap gap-2">
								{definition.entities.map((entity) => (
									<Badge key={entity} variant="secondary">
										<Users className="mr-1 h-3 w-3" />
										{entity}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Features */}
					<div>
						<h4 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">Features</h4>
						<div className="flex flex-wrap gap-2">
							{definition.recommendations_enabled && (
								<Badge variant="outline" className="bg-amber-50 text-amber-700">
									<Lightbulb className="mr-1 h-3 w-3" />
									Recommendations
								</Badge>
							)}
							{definition.requires_project_context && (
								<Badge variant="outline" className="bg-indigo-50 text-indigo-700">
									<Target className="mr-1 h-3 w-3" />
									Uses Project Goals
								</Badge>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

/**
 * Lens card component
 */
function LensCard({ template }: { template: LensTemplate }) {
	const colors = getCategoryColors(template.category)
	const definition = template.template_definition

	const fieldCount = definition.sections.reduce((sum, section) => sum + section.fields.length, 0)

	return (
		<Card className={`${colors.border} transition-shadow hover:shadow-md`}>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className={`rounded-lg p-2.5 ${colors.iconBg} ${colors.text}`}>
							{getCategoryIcon(template.category)}
						</div>
						<div>
							<CardTitle className="text-lg">{template.template_name}</CardTitle>
							<Badge variant="outline" className={`mt-1 ${colors.bg} ${colors.text}`}>
								{template.category || "general"}
							</Badge>
						</div>
					</div>
				</div>
				{template.summary && <CardDescription className="mt-2">{template.summary}</CardDescription>}
			</CardHeader>
			<CardContent>
				{/* Stats */}
				<div className="mb-4 flex items-center gap-4 text-muted-foreground text-sm">
					<span>{definition.sections.length} sections</span>
					<span>•</span>
					<span>{fieldCount} fields</span>
					{definition.entities && definition.entities.length > 0 && (
						<>
							<span>•</span>
							<span>{definition.entities.length} entity types</span>
						</>
					)}
				</div>

				{/* Section preview */}
				<div className="mb-4 space-y-1">
					{definition.sections.slice(0, 3).map((section) => (
						<div key={section.section_key} className="flex items-center gap-2 py-1 text-sm">
							<ChevronRight className="h-3 w-3 text-muted-foreground" />
							<span>{section.section_name}</span>
							<span className="text-muted-foreground text-xs">({section.fields.length} fields)</span>
						</div>
					))}
					{definition.sections.length > 3 && (
						<div className="pl-5 text-muted-foreground text-xs">+{definition.sections.length - 3} more sections</div>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center justify-between border-t pt-3">
					<div className="flex gap-2">
						{definition.recommendations_enabled && (
							<Badge variant="outline" className="bg-amber-50/50 text-xs">
								<Lightbulb className="mr-1 h-3 w-3" />
								Recs
							</Badge>
						)}
						{definition.requires_project_context && (
							<Badge variant="outline" className="bg-indigo-50/50 text-xs">
								<Target className="mr-1 h-3 w-3" />
								Goals
							</Badge>
						)}
					</div>
					<LensDetailDialog template={template} />
				</div>
			</CardContent>
		</Card>
	)
}

export default function LensLibrary() {
	const { templates } = useLoaderData<typeof loader>()
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
	const { projectPath } = useCurrentProject()

	// Filter templates
	const filteredTemplates = templates.filter((t) => {
		const matchesSearch =
			!searchQuery ||
			t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.summary?.toLowerCase().includes(searchQuery.toLowerCase())

		const matchesCategory = !selectedCategory || t.category === selectedCategory

		return matchesSearch && matchesCategory
	})

	// Get unique categories
	const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))]

	return (
		<div className="container max-w-6xl py-8">
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center gap-3">
					<div className="rounded-lg bg-primary/10 p-2">
						<BookOpen className="h-6 w-6 text-primary" />
					</div>
					<h1 className="font-bold text-3xl">Lens Library</h1>
				</div>
				<p className="text-lg text-muted-foreground">
					Browse conversation analysis frameworks to extract structured insights from interviews
				</p>
			</div>

			{/* Filters */}
			<div className="mb-6 flex flex-wrap items-center gap-4">
				<div className="relative max-w-sm flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search lenses..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant={selectedCategory === null ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedCategory(null)}
					>
						All
					</Button>
					{categories.map((category) => {
						const colors = getCategoryColors(category)
						return (
							<Button
								key={category}
								variant={selectedCategory === category ? "default" : "outline"}
								size="sm"
								onClick={() => setSelectedCategory(category)}
								className={selectedCategory === category ? "" : `${colors.bg} ${colors.text} border-0`}
							>
								{getCategoryIcon(category)}
								<span className="ml-1 capitalize">{category}</span>
							</Button>
						)
					})}
				</div>
			</div>

			{/* Results count */}
			<div className="mb-4 flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{filteredTemplates.length} lens{filteredTemplates.length !== 1 ? "es" : ""} available
				</p>
			</div>

			{/* Lens grid */}
			{filteredTemplates.length > 0 ? (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{filteredTemplates.map((template) => (
						<LensCard key={template.template_key} template={template} />
					))}
				</div>
			) : (
				<Card className="p-12 text-center">
					<Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
					<h3 className="mb-2 font-semibold text-lg">No lenses found</h3>
					<p className="text-muted-foreground">
						{searchQuery ? "Try adjusting your search terms" : "No lenses available in this category"}
					</p>
				</Card>
			)}

			{/* Coming soon section */}
			<div className="mt-12 rounded-lg border-2 border-dashed bg-muted/30 p-6">
				<div className="mb-3 flex items-center gap-3">
					<Sparkles className="h-5 w-5 text-primary" />
					<h3 className="font-semibold">Coming Soon: Custom Lenses</h3>
				</div>
				<p className="mb-4 text-muted-foreground text-sm">
					Create your own conversation analysis lenses using natural language. Describe what you want to learn from
					conversations and we'll generate a structured template for you.
				</p>
				<Button variant="outline" disabled>
					Create Custom Lens
				</Button>
			</div>
		</div>
	)
}
