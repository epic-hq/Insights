import { cn } from "~/lib/utils";
import { resolveIcon } from "./icon-map";

interface ActionSuggestionCardProps {
	icon: string;
	title: string;
	description: string;
	ctaLabel: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
	skipLabel?: string;
	dismissed: boolean;
	onSendMessage: (text: string) => void;
	onNavigate: (path: string) => void;
	onDismiss: () => void;
}

export function ActionSuggestionCard({
	icon,
	title,
	description,
	ctaLabel,
	action,
	message,
	path,
	skipLabel,
	dismissed,
	onSendMessage,
	onNavigate,
	onDismiss,
}: ActionSuggestionCardProps) {
	const Icon = resolveIcon(icon);

	const handleCta = () => {
		if (dismissed) return;
		if (action === "send_message" && message) {
			onSendMessage(message);
		} else if (action === "navigate" && path) {
			onNavigate(path);
		}
		onDismiss();
	};

	return (
		<div
			className={cn(
				"mt-2 rounded-lg border border-border/60 bg-muted/50 p-3 transition-opacity",
				dismissed && "opacity-50"
			)}
		>
			<div className="flex items-start gap-3">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Icon className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">{title}</p>
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
					<div className="mt-2 flex items-center gap-3">
						<button
							type="button"
							disabled={dismissed}
							onClick={handleCta}
							className={cn(
								"rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground text-xs transition-colors",
								dismissed ? "cursor-default opacity-60" : "hover:bg-primary/90"
							)}
						>
							{ctaLabel}
						</button>
						{skipLabel && !dismissed && (
							<button
								type="button"
								onClick={onDismiss}
								className="text-muted-foreground text-xs transition-colors hover:text-foreground"
							>
								{skipLabel}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
