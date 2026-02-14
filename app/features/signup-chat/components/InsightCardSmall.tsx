import { Card } from "~/components/ui/card";
import { EmotionBadge } from "~/components/ui/emotion-badge";
import type { Insight } from "~/types";

// Insight card (collapsed)
export function InsightCard({ item }: { item: Insight }) {
	return (
		<Card className="rounded-2xl border shadow-sm transition hover:shadow">
			<div className="p-2">
				{/* <div className="text-muted-foreground text-xs">{item.category}</div> */}
				<h3 className="mt-1 line-clamp-2 font-semibold text-base">{item.name}</h3>
				{/* {item.details && <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">{item.details}</p>} */}
				<div className="mt-2 flex flex-row justify-end">
					<EmotionBadge emotion_string={item.emotional_response || ""} muted={true} />
					{/* {item.evidence ? <span className="text-muted-foreground text-xs">📎 {item.evidence}</span> : null} */}
				</div>
			</div>
		</Card>
	);
}
