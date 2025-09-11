import { motion } from "framer-motion"
import { Hash, Settings2 } from "lucide-react"
import { Link } from "react-router-dom"
import { Streamdown } from "streamdown"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"

// If you're using shadcn/ui, these imports will work.
// Otherwise, swap with your own UI primitives.
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import type { Project } from "~/types"

// -------------------- Types --------------------
// Derive a JSON type from your Supabase column so it always stays in sync.
// (No need to import a separate `Json` type.)
type Jsonish = NonNullable<Project["goal"]>

interface ProjectContextProps {
	project: Project
	className?: string
	projectPath: string
	editPath?: string
	onEdit?: () => void
}

// -------------------- Utilities --------------------
function stringToColor(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
	const c = (hash & 0x00ffffff).toString(16).toUpperCase()
	return `#${"00000".substring(0, 6 - c.length)}${c}`
}

function isPlainObject(v: any): v is Record<string, any> {
	return v && typeof v === "object" && !Array.isArray(v)
}

// Renders arbitrary JSON to readable UI. Strings use markdown.
function RenderJson({ value }: { value: Jsonish }) {
	if (value == null || value === "") return <span className="text-muted-foreground">—</span>
	if (typeof value === "string") {
		return (
			<div className="prose prose-sm dark:prose-invert max-w-none">
				<Streamdown>{value}</Streamdown>
			</div>
		)
	}
	if (Array.isArray(value)) {
		return (
			<ul className="list-disc space-y-1 pl-5">
				{value.map((v, i) => (
					<li key={i}>
						<RenderJson value={v as Jsonish} />
					</li>
				))}
			</ul>
		)
	}
	if (isPlainObject(value)) {
		return (
			<div className="space-y-3">
				{Object.entries(value).map(([k, v]) => (
					<div key={k}>
						<div className="mb-1 text-muted-foreground text-xs uppercase tracking-wide">{k.replace(/_/g, " ")}</div>
						<RenderJson value={v as Jsonish} />
					</div>
				))}
			</div>
		)
	}
	return <span className="font-mono text-sm">{String(value)}</span>
}

// -------------------- Main Card --------------------
// Preview helper: show latest item by default, expand to all.
function getPreviewFor(value: Jsonish): Jsonish {
	if (Array.isArray(value)) return value.length ? (value[value.length - 1] as any) : ("" as any)
	if (isPlainObject(value)) {
		for (const v of Object.values(value)) {
			if (Array.isArray(v)) return v.length ? (v[v.length - 1] as any) : ("" as any)
		}
	}
	return value
}

export function ProjectContextCard({ project, className, projectPath, editPath, onEdit }: ProjectContextProps) {
	const themeColor = stringToColor(project.slug || project.name || "P")
	const initials = (project.slug || project.name || "P")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)

	const editBtn = (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					{editPath ? (
						<Link
							to={editPath}
							onClickCapture={(e) => e.stopPropagation()}
							className="z-20"
							aria-label="Edit project"
							title="Edit project"
						>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<Settings2 className="h-4 w-4" />
							</Button>
						</Link>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="z-20 h-8 w-8"
							onClick={(e) => {
								e.stopPropagation()
								onEdit?.()
							}}
							aria-label="Edit project"
							title="Edit project"
						>
							<Settings2 className="h-4 w-4" />
						</Button>
					)}
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
			{/* Keep whole-card navigation as in your original */}

			{/* Accent strip */}
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

			{/* Header Row */}
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

			{/* Content */}
			<div className="p-6">
				<Accordion type="multiple" className="space-y-3">
					<SectionItem id="goal" title="Goal" color={themeColor} value={(project.goal ?? "No goal set.") as Jsonish} />
					<SectionItem
						id="questions"
						title="Questions"
						color={themeColor}
						value={(project.questions ?? []) as Jsonish}
					/>
					<SectionItem id="findings" title="Findings" color={themeColor} value={(project.findings ?? []) as Jsonish} />
					<SectionItem
						id="background"
						title="Background"
						color={themeColor}
						value={(project.background ?? []) as Jsonish}
					/>
				</Accordion>
			</div>
		</motion.div>
	)
}

function toPlainText(v: any): string {
	if (v == null) return ""
	if (typeof v === "string") return v.replace(/[*`_#>-]+/g, " ").trim()
	if (Array.isArray(v)) return toPlainText(v[v.length - 1])
	if (isPlainObject(v)) {
		const arr = Object.values(v).find(Array.isArray)
		if (arr && (arr as any[]).length) return toPlainText((arr as any[])[(arr as any[]).length - 1])
		return JSON.stringify(v)
	}
	return String(v)
}

function previewText(value: Jsonish, limit = 140) {
	const latest = getPreviewFor(value)
	const text = toPlainText(latest)
	return text.length > limit ? `${text.slice(0, limit).trim()}…` : text
}

function SectionItem({ id, title, color, value }: { id: string; title: string; color: string; value: Jsonish }) {
	return (
		<AccordionItem value={id}>
			<AccordionTrigger onClick={(e) => e.stopPropagation()}>
				<div className="flex w-full items-center gap-2 text-left">
					<div className="h-4 w-1.5 rounded-full" style={{ backgroundColor: color }} />
					<div className="flex-1">
						<div className="font-semibold text-sm tracking-wide">{title}</div>
						<div className="line-clamp-1 text-muted-foreground text-xs">{previewText(value)}</div>
					</div>
				</div>
			</AccordionTrigger>
			<AccordionContent>
				<div className="text-sm leading-relaxed">
					<RenderJson value={value} />
				</div>
			</AccordionContent>
		</AccordionItem>
	)
}

// -------------------- Sample Data + Demo --------------------
const sampleProject: Project = {
	account_id: "acc_abc1234567890def",
	background: {
		stakeholders: ["Product", "Design", "Support"],
		links: [
			{ title: "PRD", url: "https://example.com/doc/prd" },
			{ title: "User Board", url: "https://example.com/mural/board" },
		],
		note: "We have ~200 beta users across EDU and SMB.",
	},
	created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
	description: "AI-driven insights to cluster interview findings and recommend study paths.",
	findings: {
		summary: "Early testers value **fast summarization** and *visual* maps.",
		positives: ["Speed vs manual notes", "Reduced tab overload"],
		risks: ["Onboarding friction", "Cold-start without content"],
		details: ["Students want chapter-level highlights.", "Researchers want deduped themes with confidence scores."],
	},
	goal: {
		mission: "Accelerate understanding for students and researchers.",
		objectives: [
			"Ship MVP onboarding with anonymous try-first",
			"Cluster 1000 notes in < 5s",
			"Surface top 3 actionable insights per project",
		],
	},
	id: "proj_01HZY3T3J9N0XPMV0WQW9FZK4N",
	name: "Knowledge Acceleration – Fall Pilot",
	questions: [
		"What’s the fastest way to reach aha-moments?",
		{ pricing: ["Starter vs Pro?", "Seat-based or usage-based?"] },
		{ data: ["How to import Google Docs?", "Notion sync cadence?"] },
	],
	slug: "knowledge-acceleration-fall-pilot",
	status: "active",
	updated_at: new Date().toISOString(),
}

// Default export: a small preview so you can see it live in Canvas.
export default function DemoProjectCard() {
	return (
		<div className="min-h-[60vh] bg-background p-6">
			<div className="mx-auto max-w-7xl">
				<ProjectContextCard
					project={sampleProject}
					projectPath={`/a/${sampleProject.account_id}/projects/${sampleProject.slug ?? sampleProject.id}`}
					editPath={`/projects/${sampleProject.id}/edit`}
				/>
			</div>
		</div>
	)
}
