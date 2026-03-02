import { cn } from "~/lib/utils";
import { resolveIcon } from "./icon-map";

interface CelebrationCardProps {
	milestone: string;
	description: string;
	icon?: string;
	ctaLabel?: string;
	ctaAction?: "send_message" | "navigate";
	ctaMessage?: string;
	ctaPath?: string;
	dismissed: boolean;
	onSendMessage: (text: string) => void;
	onNavigate: (path: string) => void;
	onDismiss: () => void;
}

export function CelebrationCard({
	milestone,
	description,
	icon,
	ctaLabel,
	ctaAction,
	ctaMessage,
	ctaPath,
	dismissed,
	onSendMessage,
	onNavigate,
	onDismiss,
}: CelebrationCardProps) {
	const Icon = resolveIcon(icon || "sparkles");

	const handleCta = () => {
		if (dismissed) return;
		if (ctaAction === "send_message" && ctaMessage) {
			onSendMessage(ctaMessage);
		} else if (ctaAction === "navigate" && ctaPath) {
			onNavigate(ctaPath);
		}
		onDismiss();
	};

	return (
		<div
			className={cn(
				"mt-2 rounded-lg border border-border/60 border-l-4 border-l-teal-500 bg-muted/50 p-3 transition-opacity",
				dismissed && "opacity-50"
			)}
		>
			<div className="flex items-start gap-3">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-500">
					<Icon className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">{milestone}</p>
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
					{ctaLabel && ctaAction && (
						<div className="mt-2">
							<button
								type="button"
								disabled={dismissed}
								onClick={handleCta}
								className={cn(
									"rounded-md bg-teal-500 px-3 py-1 font-medium text-white text-xs transition-colors",
									dismissed ? "cursor-default opacity-60" : "hover:bg-teal-600"
								)}
							>
								{ctaLabel}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
