import { File, FileAudio, FileText, FileVideo, Mic, Phone, TestTube, Users } from "lucide-react"
import { cn } from "~/lib/utils"

interface MediaTypeIconProps {
	mediaType?: string | null
	sourceType?: string | null
	showLabel?: boolean
	className?: string
	iconClassName?: string
	labelClassName?: string
}

const sourceTypeConfig = {
	realtime_recording: {
		// This is overridden by logic that checks media_type
		// voice_memo → Mic "Voice Memo" (red)
		// interview → Users "Live Conversation" (blue)
		icon: Mic,
		label: "Voice Memo",
		color: "text-red-600",
	},
	audio_upload: {
		icon: FileAudio,
		label: "Audio",
		color: "text-blue-600",
	},
	video_upload: {
		icon: FileVideo,
		label: "Video",
		color: "text-purple-600",
	},
	document: {
		icon: File,
		label: "Document",
		color: "text-green-600",
	},
	transcript: {
		icon: FileText,
		label: "Transcript",
		color: "text-slate-600",
	},
	note: {
		icon: FileText,
		label: "Note",
		color: "text-amber-600",
	},
}

const mediaTypeConfig = {
	interview: {
		icon: FileText,
		label: "Interview",
		color: "text-blue-600",
	},
	"focus-group": {
		icon: Users,
		label: "Focus Group",
		color: "text-purple-600",
	},
	"customer-call": {
		icon: Phone,
		label: "Customer Call",
		color: "text-green-600",
	},
	"user-testing": {
		icon: TestTube,
		label: "User Testing",
		color: "text-orange-600",
	},
	note: {
		icon: FileText,
		label: "Note",
		color: "text-amber-600",
	},
	meeting_notes: {
		icon: Users,
		label: "Meeting Notes",
		color: "text-blue-600",
	},
	observation: {
		icon: TestTube,
		label: "Observation",
		color: "text-purple-600",
	},
	insight: {
		icon: FileText,
		label: "Insight",
		color: "text-green-600",
	},
	followup: {
		icon: Phone,
		label: "Follow-up",
		color: "text-orange-600",
	},
	voice_memo: {
		icon: Mic,
		label: "Voice Memo",
		color: "text-red-600",
	},
}

export function MediaTypeIcon({
	mediaType,
	sourceType,
	showLabel = true,
	className = "",
	iconClassName = "h-4 w-4",
	labelClassName = "text-sm font-medium",
}: MediaTypeIconProps) {
	// Handle special case: voice_memo with realtime recording (solo) vs interview with realtime recording (conversation)
	let config: { icon: any; label: string; color: string } | null = null

	if (mediaType === "voice_memo" && sourceType === "realtime_recording") {
		// Solo voice memo
		config = {
			icon: Mic,
			label: "Voice Memo",
			color: "text-red-600",
		}
	} else if (mediaType === "interview" && sourceType === "realtime_recording") {
		// Live conversation recording
		config = {
			icon: Users,
			label: "Live Conversation",
			color: "text-blue-600",
		}
	} else {
		// Prioritize source type over media type for other cases
		const sourceConfig = sourceType ? sourceTypeConfig[sourceType as keyof typeof sourceTypeConfig] : null
		const mediaConfig = mediaType ? mediaTypeConfig[mediaType as keyof typeof mediaTypeConfig] : null
		config = sourceConfig || mediaConfig || mediaTypeConfig.interview
	}

	const { icon: Icon, label, color } = config

	if (!showLabel) {
		return <Icon className={cn(color, iconClassName)} />
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Icon className={cn(color, iconClassName)} />
			<span className={cn(color, labelClassName)}>{label}</span>
		</div>
	)
}

export default MediaTypeIcon
