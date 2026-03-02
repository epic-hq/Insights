import { cn } from "~/lib/utils";
import { resolveIcon } from "./icon-map";

interface Badge {
	id: string;
	label: string;
	icon?: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
}

interface SuggestionBadgeProps {
	badges: Badge[];
	disabled: boolean;
	onSendMessage: (text: string) => void;
	onNavigate: (path: string) => void;
}

export function SuggestionBadges({ badges, disabled, onSendMessage, onNavigate }: SuggestionBadgeProps) {
	const handleClick = (badge: Badge) => {
		if (disabled) return;
		if (badge.action === "send_message" && badge.message) {
			onSendMessage(badge.message);
		} else if (badge.action === "navigate" && badge.path) {
			onNavigate(badge.path);
		}
	};

	return (
		<div className="mt-2 grid grid-cols-2 gap-2">
			{badges.slice(0, 4).map((badge) => {
				const Icon = resolveIcon(badge.icon);
				return (
					<button
						key={badge.id}
						type="button"
						disabled={disabled}
						onClick={() => handleClick(badge)}
						className={cn(
							"flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm transition-all duration-200",
							"border-border/60 bg-card/80 shadow-sm",
							disabled
								? "cursor-default opacity-50"
								: "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg active:translate-y-0",
							"focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
							"dark:bg-slate-900/60"
						)}
					>
						<Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span className="truncate">{badge.label}</span>
					</button>
				);
			})}
		</div>
	);
}
