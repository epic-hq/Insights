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
} as const

type TopKey = keyof typeof EmotionsMap

// top-level (Angry, Disgusted, Sad, Happy, Surprised, Bad, Fearful)
export type TopEmotion = keyof typeof EmotionsMap

// subcategory keys under each top (e.g., Frustrated, Vulnerable, Proud…)
type SubKeys<T> = Exclude<keyof T, "emoji" | "color">
type SubEmotion = { [K in TopEmotion]: SubKeys<(typeof EmotionsMap)[K]> }[TopEmotion]

// leaf terms (e.g., Annoyed, Powerless, Confident…)
type LeafEmotion = {
	[K in TopEmotion]: {
		[S in SubKeys<(typeof EmotionsMap)[K]>]: (typeof EmotionsMap)[K][S] extends readonly string[]
			? (typeof EmotionsMap)[K][S][number]
			: never
	}[SubKeys<(typeof EmotionsMap)[K]>]
}[TopEmotion]

// final union = top | subcategory | leaf
export type Emotion = TopEmotion | SubEmotion | LeafEmotion

// Flat, typed list for selects/autocomplete
export const EMOTIONS_ALL = Object.freeze(
	Object.entries(EmotionsMap).flatMap(([top, cfg]) => {
		const out = [top]
		for (const [k, v] of Object.entries(cfg)) {
			if (k === "emoji" || k === "color") continue
			out.push(k)
			if (Array.isArray(v)) out.push(...v)
		}
		return out
	})
) as Emotion[]

// Quick validator
export function isEmotion(x: string): x is Emotion {
	return !!findTopConfig(x)
}

export function getEmotionClasses(e: Emotion, opts?: { muted?: boolean }) {
	const found = findTopConfig(e)
	const c = found?.cfg.color ?? {
		bg: "bg-gray-200",
		hoverBg: "hover:bg-gray-300",
		text: "text-gray-900",
		darkBg: "bg-gray-500",
	}
	return cn(c.bg, c.text, c.hoverBg, `dark:${c.darkBg}`, opts?.muted && "opacity-70 brightness-95 saturate-[.8]")
}

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

export const EmotionBadge = ({ emotion_string, muted = false }: { emotion_string: string; muted?: boolean }) => {
	const found = findTopConfig(emotion_string)
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
			<span className={cn("text-xl", muted && MUTED)} aria-label={emotion_string} title={emotion_string}>
				{emoji}
			</span>
			<Badge className={cn("p-1 text-xs", color.bg, color.text, color.hoverBg, `dark:${color.darkBg}`, muted && MUTED)}>
				{emotion_string}
			</Badge>
		</span>
	)
}
