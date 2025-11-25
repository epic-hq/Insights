import { FileAudio, FileText, FileVideo, Mic, Phone, TestTube, Upload, Users } from "lucide-react"
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
		icon: Mic,
		label: "Voice Memo",
		color: "text-red-600",
	},
	audio_upload: {
		icon: FileAudio,
		label: "Audio Upload",
		color: "text-blue-600",
	},
	video_upload: {
		icon: FileVideo,
		label: "Video Upload",
		color: "text-purple-600",
	},
	document: {
		icon: Upload,
		label: "Document",
		color: "text-green-600",
	},
	transcript: {
		icon: FileText,
		label: "Transcript",
		color: "text-slate-600",
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
}

export function MediaTypeIcon({
	mediaType,
	sourceType,
	showLabel = true,
	className = "",
	iconClassName = "h-4 w-4",
	labelClassName = "text-sm font-medium",
}: MediaTypeIconProps) {
	// Prioritize source type over media type for more specific information
	const sourceConfig = sourceType ? sourceTypeConfig[sourceType as keyof typeof sourceTypeConfig] : null
	const mediaConfig = mediaType ? mediaTypeConfig[mediaType as keyof typeof mediaTypeConfig] : null

	// Use source type if available, otherwise fall back to media type, then default
	const { icon: Icon, label, color } = sourceConfig || mediaConfig || mediaTypeConfig.interview

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
