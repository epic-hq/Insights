import { motion } from "framer-motion"
import { Mail } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import type { ResearchLinkQuestion } from "../schemas"

interface ResearchLinkPreviewProps {
	heroTitle?: string | null
	heroSubtitle?: string | null
	heroCtaLabel?: string | null
	heroCtaHelper?: string | null
	questions: ResearchLinkQuestion[]
}

export function ResearchLinkPreview({
	heroTitle,
	heroSubtitle,
	heroCtaLabel,
	heroCtaHelper,
	questions,
}: ResearchLinkPreviewProps) {
	const firstQuestion = questions[0]
	const usesLongText = firstQuestion?.type === "long_text"

	return (
		<div className="sticky top-6">
			<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">Preview</p>
			<div className="rounded-2xl border-2 border-border/60 border-dashed bg-muted/20 p-4">
				{/* Phone-like frame */}
				<div className="mx-auto max-w-[280px] rounded-xl border border-border/80 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-lg ring-1 ring-white/5">
					<div className="space-y-3">
						<h3 className="font-semibold text-sm text-white leading-tight">{heroTitle || "Share your feedback"}</h3>
						{heroSubtitle && <p className="text-white/60 text-xs leading-relaxed">{heroSubtitle}</p>}

						{/* Email input */}
						<div className="space-y-1.5">
							<Input
								value="you@company.com"
								readOnly
								className="h-8 border-white/20 bg-white/10 text-white/70 text-xs"
							/>
							<p className="text-[10px] text-white/40">{heroCtaHelper || "We'll only contact you about this study"}</p>
						</div>

						<Button disabled size="sm" className="h-8 w-full bg-white text-black text-xs">
							<Mail className="mr-1.5 h-3 w-3" />
							{heroCtaLabel || "Continue"}
						</Button>

						{/* First question preview */}
						{firstQuestion && (
							<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 rounded-lg bg-white/5 p-3">
								<p className="mb-2 font-medium text-white/90 text-xs">
									{firstQuestion.prompt || "Your question here..."}
								</p>
								{usesLongText ? (
									<Textarea
										readOnly
										rows={2}
										placeholder="Response..."
										className="h-14 resize-none border-white/20 bg-white/10 text-white/50 text-xs"
									/>
								) : (
									<Input
										readOnly
										placeholder="Response..."
										className="h-7 border-white/20 bg-white/10 text-white/50 text-xs"
									/>
								)}
								{/* Progress dots */}
								<div className="mt-3 flex justify-center gap-1">
									{questions.slice(0, 5).map((_, idx) => (
										<div
											key={idx}
											className={cn("h-1.5 w-1.5 rounded-full", idx === 0 ? "bg-emerald-400" : "bg-white/20")}
										/>
									))}
									{questions.length > 5 && (
										<span className="ml-0.5 text-[8px] text-white/30">+{questions.length - 5}</span>
									)}
								</div>
							</motion.div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
