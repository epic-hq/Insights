import { motion } from "framer-motion"
import { Hash, Settings2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Link } from "react-router-dom"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Database, Project } from "~/types"

type ProjectSection = Database["public"]["Tables"]["project_sections"]["Row"]

interface ProjectCardProps {
	project: Project
	sections: ProjectSection[] // <- new
	className?: string
	projectPath: string
}

function stringToColor(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
	const c = (hash & 0x00ffffff).toString(16).toUpperCase()
	return `#${"00000".substring(0, 6 - c.length)}${c}`
}

function groupLatestByKind(sections: ProjectSection[]) {
	const byKind = new Map<string, ProjectSection[]>()
	for (const s of sections) {
		const arr = byKind.get(s.kind) ?? []
		arr.push(s)
		byKind.set(s.kind, arr)
	}
	// sort newest first within kind (position asc nulls last already in loader is fine; here prefer created_at desc)
	for (const [k, arr] of byKind) {
		arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
		byKind.set(k, arr)
	}
	return byKind
}

function preview(text: string, n = 140) {
	const t = text.replace(/[*`_#>-]+/g, " ").trim()
	return t.length > n ? `${t.slice(0, n).trim()}…` : t
}

export function ProjectCard({ project, sections, className, projectPath }: ProjectCardProps) {
	const themeColor = stringToColor(project.slug || project.name || "P")
	const initials = (project.slug || project.name || "P")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)
	const routes = useProjectRoutes(projectPath)
	const byKind = groupLatestByKind(sections)

	const order = ["goal", "questions", "findings", "background"]
	const kinds = [...new Set([...order, ...Array.from(byKind.keys())])].filter((k) => byKind.has(k))

	const editBtn = (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to={routes.projects.edit(project.id)}
						onClickCapture={(e) => e.stopPropagation()}
						className="z-20"
						aria-label="Edit project"
						title="Edit project"
					>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<Settings2 className="h-4 w-4" />
						</Button>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="left">Edit</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)

	return (
		<motion.div
			className={`relative overflow-hidden rounded-xl border border-border bg-background shadow-md transition-all duration-300 hover:shadow-lg ${className ?? ""}`}
			whileHover={{ y: -4, scale: 1.02 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

			<div className="flex items-start gap-4 p-6">
				<Avatar className="h-14 w-14 shrink-0 border-2" style={{ borderColor: themeColor }}>
					<AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
						{initials}
					</AvatarFallback>
				</Avatar>

				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="mb-1 flex items-center gap-2 truncate font-bold text-xl" style={{ color: themeColor }}>
								<Link to={projectPath} className="hover:underline" onClick={(e) => e.stopPropagation()}>
									{project.name}
								</Link>
								{project.status && (
									<Badge variant="secondary" className="h-5 px-1.5 text-[10px] leading-none">
										{project.status}
									</Badge>
								)}
							</h3>
							{project.slug && (
								<div className="flex items-center gap-1 text-muted-foreground text-xs">
									<Hash className="h-3.5 w-3.5" />
									{project.slug}
								</div>
							)}
						</div>
						<div className="relative z-20">{editBtn}</div>
					</div>

					{project.description && (
						<div className="mt-2 line-clamp-3 text-sm leading-relaxed">{project.description}</div>
					)}
				</div>
			</div>

			<Separator />

			<div className="p-6">
				<Accordion type="multiple" className="space-y-3">
					{kinds.map((k) => {
						const arr = byKind.get(k)!
						const latest = arr[0]
						return (
							<AccordionItem key={k} value={k}>
								<AccordionTrigger onClick={(e) => e.stopPropagation()}>
									<div className="flex w-full items-center gap-2 text-left">
										<div className="h-4 w-1.5 rounded-full" style={{ backgroundColor: themeColor }} />
										<div className="flex-1">
											<div className="font-semibold text-sm tracking-wide">{k}</div>
											<div className="line-clamp-1 text-muted-foreground text-xs">
												{preview(latest.content_md ?? "")}
											</div>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-4 text-sm leading-relaxed">
										<div className="prose prose-sm dark:prose-invert max-w-none">
											<ReactMarkdown>{latest.content_md ?? ""}</ReactMarkdown>
										</div>
										{arr.length > 1 && (
											<div className="space-y-3">
												{arr.slice(1, 5).map((s) => (
													<div key={s.id} className="prose prose-sm dark:prose-invert max-w-none border-t pt-3">
														<ReactMarkdown>{s.content_md ?? ""}</ReactMarkdown>
													</div>
												))}
											</div>
										)}
									</div>
								</AccordionContent>
							</AccordionItem>
						)
					})}
				</Accordion>
			</div>
		</motion.div>
	)
}
