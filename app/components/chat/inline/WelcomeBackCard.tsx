import { resolveIcon } from "./icon-map";
import { SuggestionBadges } from "./SuggestionBadge";

interface ChangeBullet {
	icon?: string;
	text: string;
}

interface Badge {
	id: string;
	label: string;
	icon?: string;
	action: "send_message" | "navigate";
	message?: string;
	path?: string;
}

interface WelcomeBackCardProps {
	datestamp: string;
	changes: ChangeBullet[];
	badges: Badge[];
	disabled: boolean;
	onSendMessage: (text: string) => void;
	onNavigate: (path: string) => void;
}

export function WelcomeBackCard({
	datestamp,
	changes,
	badges,
	disabled,
	onSendMessage,
	onNavigate,
}: WelcomeBackCardProps) {
	return (
		<div className="mt-2 rounded-lg border border-border/60 bg-muted/50 p-3">
			<p className="mb-2 text-muted-foreground text-xs">{datestamp}</p>
			<ul className="space-y-1.5">
				{changes.slice(0, 4).map((change, i) => {
					const Icon = resolveIcon(change.icon);
					return (
						<li key={`change-${i}`} className="flex items-start gap-2 text-sm">
							<Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span>{change.text}</span>
						</li>
					);
				})}
			</ul>
			{badges.length > 0 && (
				<SuggestionBadges badges={badges} disabled={disabled} onSendMessage={onSendMessage} onNavigate={onNavigate} />
			)}
		</div>
	);
}
