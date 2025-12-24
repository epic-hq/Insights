import { Calendar, Clock, MessageCircle, Mic, Sparkles, Tag, Users } from "lucide-react"
import type React from "react"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"

const surfaces: Array<{
	key: React.ComponentProps<typeof Card>["surface"]
	title: string
	description: string
}> = [
	{ key: "default", title: "Default", description: "Subtle shadow with border for most layouts." },
	{ key: "elevated", title: "Elevated", description: "Deeper shadow for emphasis in dense grids." },
	{ key: "soft", title: "Soft", description: "Tinted fill with faint glow for featured items." },
	{ key: "muted", title: "Muted", description: "Low-contrast background for secondary content." },
	{ key: "outline", title: "Outline", description: "Border-first style without fill." },
	{ key: "glass", title: "Glass", description: "Frosted look; pairs well over imagery." },
	{ key: "gradient", title: "Gradient", description: "Ambient sheen for hero-style cards." },
	{ key: "glow", title: "Glow", description: "Halo effect for callouts or selections." },
]

function InterviewStyleCard({ className }: { className?: string }) {
	return (
		<Card surface="elevated" className={cn("overflow-hidden", className)}>
			<CardHeader className="flex flex-row items-start justify-between gap-3">
				<div className="space-y-1">
					<CardTitle className="text-base">“Scaling onboarding for enterprise teams”</CardTitle>
					<CardDescription className="flex items-center gap-2 text-xs">
						<Calendar className="h-3.5 w-3.5" />
						<span>Jan 12 • 42 mins</span>
						<Separator orientation="vertical" className="h-4" />
						<Users className="h-3.5 w-3.5" />
						<span>2 participants</span>
					</CardDescription>
				</div>
				<Badge variant="secondary" className="gap-1">
					<Mic className="h-3.5 w-3.5" />
					Interview
				</Badge>
			</CardHeader>
			<CardContent className="space-y-3 pb-4">
				<div className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">
					Customer is struggling to roll out training updates quickly. Needs self-serve templates and better analytics
					for adoption.
				</div>
				<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
					<Badge variant="outline" className="gap-1">
						<Tag className="h-3 w-3" />
						Enablement
					</Badge>
					<Badge variant="secondary" className="gap-1">
						<Sparkles className="h-3 w-3" />3 new themes
					</Badge>
					<span className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-1">
						<MessageCircle className="h-3 w-3" />
						12 notes
					</span>
					<span className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-1">
						<Clock className="h-3 w-3" />
						Latest yesterday
					</span>
				</div>
			</CardContent>
		</Card>
	)
}

export default function CardSurfacesDemo() {
	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl text-foreground">Card Surface Gallery</h1>
				<p className="text-muted-foreground">
					Preview the available <code className="rounded bg-muted px-1 py-0.5 text-xs">surface</code> variants on the
					shared Card component. Use this page as a sandbox when picking a style for insights, tasks, lenses, or chat
					surfaces.
				</p>
			</header>

			<section className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{surfaces.map((surface) => (
					<Card
						key={surface.key}
						surface={surface.key}
						className="border-border/40 border-dashed hover:border-primary/40 hover:border-solid hover:shadow-lg"
					>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<span className="inline-flex h-2 w-2 rounded-full bg-primary/60" aria-hidden />
								{surface.title}
							</CardTitle>
							<CardDescription>{surface.description}</CardDescription>
						</CardHeader>
						<CardContent className="pb-4">
							<div className="rounded-lg bg-background/60 p-3 text-sm leading-relaxed">
								Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus
								ante dapibus diam.
							</div>
						</CardContent>
					</Card>
				))}
			</section>

			<section className="space-y-3">
				<div>
					<h2 className="font-semibold text-lg">Interview-style layout</h2>
					<p className="text-muted-foreground text-sm">
						A richer layout similar to interviews/personas: header metadata, pill badges, and a muted body for
						summaries.
					</p>
				</div>
				<InterviewStyleCard />
			</section>
		</div>
	)
}
