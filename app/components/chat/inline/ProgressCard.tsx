import { Check, Circle } from "lucide-react";
import { cn } from "~/lib/utils";

interface ProgressStep {
	id: string;
	label: string;
	status: "pending" | "active" | "done";
}

interface ProgressCardProps {
	title: string;
	steps: ProgressStep[];
	progressPercent?: number;
	isStreaming: boolean;
}

export function ProgressCard({ title, steps, progressPercent, isStreaming }: ProgressCardProps) {
	return (
		<div className="mt-2 rounded-lg border border-border/60 bg-muted/50 p-3" aria-live="polite">
			<p className="mb-2 font-medium text-sm">{title}</p>
			<div className="space-y-1.5">
				{steps.map((step) => (
					<div key={step.id} className="flex items-center gap-2">
						{step.status === "done" && <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />}
						{step.status === "active" && (
							<Circle
								className={cn("h-3.5 w-3.5 shrink-0 fill-primary text-primary", isStreaming && "animate-pulse")}
							/>
						)}
						{step.status === "pending" && <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
						<span
							className={cn(
								"text-xs",
								step.status === "done" && "text-muted-foreground line-through",
								step.status === "active" && "font-medium text-foreground",
								step.status === "pending" && "text-muted-foreground"
							)}
						>
							{step.label}
						</span>
					</div>
				))}
			</div>
			{progressPercent != null && (
				<div className="mt-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-300"
							style={{
								width: `${Math.min(100, Math.max(0, progressPercent))}%`,
							}}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
