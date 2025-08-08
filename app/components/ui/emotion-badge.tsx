import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

export const EmotionsMap = {
	Angry: {
		emoji: "😠",
		color: {
			bg: "bg-red-500",
			hoverBg: "hover:bg-red-600",
			text: "text-white",
			darkBg: "bg-red-700",
		},
		"Let down": ["Betrayed", "Resentful"],
		Humiliated: ["Disrespected", "Ridiculed"],
		Bitter: ["Indignant", "Violated"],
		Mad: ["Furious", "Jealous"],
		Aggressive: ["Provoked", "Hostile"],
		Frustrated: ["Infuriated", "Annoyed"],
		Distant: ["Withdrawn", "Numb"],
		Critical: ["Skeptical", "Dismissive"],
	},
	Disgusted: {
		emoji: "🤢",
		color: {
			bg: "bg-gray-600",
			hoverBg: "hover:bg-gray-700",
			text: "text-white",
			darkBg: "bg-gray-800",
		},
		Disapproving: ["Judgmental", "Embarrassed"],
		Disappointed: ["Appalled", "Revolted"],
		Awful: ["Nauseated", "Detestable"],
		Repelled: ["Horrified", "Hesitant"],
	},
	Sad: {
		emoji: "😢",
		color: {
			bg: "bg-blue-500",
			hoverBg: "hover:bg-blue-600",
			text: "text-white",
			darkBg: "bg-blue-700",
		},
		Hurt: ["Disappointed", "Embarrassed"],
		Depressed: ["Inferior", "Empty"],
		Guilty: ["Remorseful", "Ashamed"],
		Despair: ["Powerless", "Grief"],
		Vulnerable: ["Victimized", "Fragile"],
		Lonely: ["Abandoned", "Isolated"],
	},
	Happy: {
		emoji: "😊",
		color: {
			bg: "bg-yellow-300",
			hoverBg: "hover:bg-yellow-400",
			text: "text-black",
			darkBg: "bg-yellow-500",
		},
		Playful: ["Cheeky", "Aroused"],
		Content: ["Free", "Joyful"],
		Interested: ["Curious", "Inquisitive"],
		Proud: ["Successful", "Confident"],
		Accepted: ["Respected", "Valued"],
		Powerful: ["Courageous", "Creative"],
		Peaceful: ["Loving", "Thankful"],
		Trusting: ["Sensitive", "Intimate"],
		Optimistic: ["Hopeful", "Inspired"],
	},
	Surprised: {
		emoji: "😲",
		color: {
			bg: "bg-purple-400",
			hoverBg: "hover:bg-purple-500",
			text: "text-white",
			darkBg: "bg-purple-600",
		},
		Excited: ["Energetic", "Eager"],
		Amazed: ["Awe", "Astonished"],
		Confused: ["Perplexed", "Disillusioned"],
		Startled: ["Shocked", "Dismayed"],
	},
	Bad: {
		emoji: "😕",
		color: {
			bg: "bg-green-500",
			hoverBg: "hover:bg-green-600",
			text: "text-white",
			darkBg: "bg-green-700",
		},
		Bored: ["Indifferent", "Apathetic"],
		Busy: ["Pressured", "Rushed"],
		Stressed: ["Overwhelmed", "Out of control"],
		Tired: ["Sleepy", "Unfocussed"],
	},
	Fearful: {
		emoji: "😨",
		color: {
			bg: "bg-orange-400",
			hoverBg: "hover:bg-orange-500",
			text: "text-black",
			darkBg: "bg-orange-600",
		},
		Scared: ["Helpless", "Frightened"],
		Anxious: ["Overwhelmed", "Worried"],
		Insecure: ["Inadequate", "Inferior"],
		Weak: ["Worthless", "Insignificant"],
		Rejected: ["Excluded", "Persecuted"],
		Threatened: ["Nervous", "Exposed"],
	},
}

type TopKey = keyof typeof EmotionsMap

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Returns the top-level emotion config that contains `emotion`
 * whether it's a top key, a subcategory key, or a leaf value.
 */
function findTopConfig(emotion: string) {
	for (const [topKey, cfg] of Object.entries(EmotionsMap) as [TopKey, (typeof EmotionsMap)[TopKey]][]) {
		// direct top-level match
		if (eq(topKey, emotion)) return { topKey, cfg }

		// scan subcategories & leaves
		for (const [k, v] of Object.entries(cfg)) {
			if (k === "emoji" || k === "color") continue
			if (eq(k, emotion)) return { topKey, cfg } // subcategory match
			if (Array.isArray(v) && v.some((leaf) => eq(leaf, emotion))) {
				return { topKey, cfg } // leaf match
			}
		}
	}
	return null
}

const _FALLBACK = {
	emoji: "💡",
	color: { bg: "bg-gray-200", hoverBg: "hover:bg-gray-300", text: "text-gray-900", darkBg: "bg-gray-500" },
}

const MUTED = "opacity-70 brightness-95 saturate-[.8]"

export const EmotionBadge = ({ emotion, muted = false }: { emotion: string; muted?: boolean }) => {
	const found = findTopConfig(emotion)
	const emoji = found?.cfg.emoji ?? "💡"
	const color = found?.cfg.color ?? {
		bg: "bg-gray-200",
		text: "text-gray-900",
		hoverBg: "hover:bg-gray-300",
		darkBg: "bg-gray-500",
	}

	return (
		<span className="inline-flex items-center gap-1">
			<span className="text-xs">Emotion:</span>
			<span className={cn("text-xl", muted && MUTED)} aria-label={emotion} title={emotion}>
				{emoji}
			</span>
			<Badge className={cn("p-1 text-xs", color.bg, color.text, color.hoverBg, `dark:${color.darkBg}`, muted && MUTED)}>
				{emotion}
			</Badge>
		</span>
	)
}
