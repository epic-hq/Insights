import { FileText, Phone, TestTube, Users } from "lucide-react"
import { cn } from "~/lib/utils"

interface MediaTypeIconProps {
	mediaType?: string | null
	showLabel?: boolean
	className?: string
	iconClassName?: string
	labelClassName?: string
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
	showLabel = true,
	className = "",
	iconClassName = "h-4 w-4",
	labelClassName = "text-sm font-medium",
}: MediaTypeIconProps) {
	const config = mediaType ? mediaTypeConfig[mediaType as keyof typeof mediaTypeConfig] : null

	// Fallback to default interview if no config found
	const { icon: Icon, label, color } = config || mediaTypeConfig.interview

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
