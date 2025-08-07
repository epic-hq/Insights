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

export const EmotionBadge = ({ emotion }: { emotion: string }) => {
	const mainEmotion = Object.keys(EmotionsMap).find((key) => key.toLowerCase() === emotion.toLowerCase()) as
		| keyof typeof EmotionsMap
		| undefined
	const emoji =
		mainEmotion && EmotionsMap[mainEmotion] && "emoji" in EmotionsMap[mainEmotion]
			? EmotionsMap[mainEmotion].emoji
			: "💡"
	return (
		<span className="badge flex items-center gap-1">
			<span className="text-lg" aria-label={emotion} title={emotion}>
				{emoji}
			</span>
			<span>{emotion}</span>
		</span>
	)
}
