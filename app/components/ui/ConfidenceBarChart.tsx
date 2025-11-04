import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { cn } from "~/lib/utils"

type ConfidenceLevel = "low" | "medium" | "high"
export type ConfidenceVariant = "bars" | "icons"

interface ConfidenceBarChartProps {
	level: ConfidenceLevel | string | number
	className?: string
	size?: "sm" | "md" | "lg"
	variant?: ConfidenceVariant
}

/**
 * Standardized confidence level normalization utility
 * Handles multiple input formats and converts them to consistent "low" | "medium" | "high" levels
 */
function normalizeConfidenceLevel(level: ConfidenceLevel | string | number): ConfidenceLevel {
	if (typeof level === "string") {
		const normalized = level.toLowerCase()
		if (normalized === "high") return "high"
		if (normalized === "medium") return "medium"
		if (normalized === "low") return "low"
		// Fallback for invalid strings
		return "low"
	}

	if (typeof level === "number") {
		// For count-based confidence (e.g., answered_answer_count)
		if (level >= 3) return "high"
		if (level >= 1) return "medium"
		return "low"
	}

	return level
}

/**
 * Standardized confidence level calculation for decimal confidence scores (0-1 range)
 * Used for AI-generated confidence scores
 */
export function getConfidenceLevelFromScore(confidence: number): ConfidenceLevel {
	if (confidence >= 0.8) return "high"
	if (confidence >= 0.5) return "medium"
	return "low"
}

/**
 * Standardized confidence level calculation for answer counts
 * Used for research question metrics
 */
export function getConfidenceLevelFromAnswerCount(answeredCount: number): ConfidenceLevel {
	if (answeredCount >= 3) return "high"
	if (answeredCount >= 1) return "medium"
	return "low"
}

export function ConfidenceBarChart({ level, className, size = "md", variant = "bars" }: ConfidenceBarChartProps) {
	const normalizedLevel = normalizeConfidenceLevel(level)

	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-5 h-5",
		lg: "w-6 h-6",
	}

	// Icon variant - simpler Lucide icons
	if (variant === "icons") {
		const iconProps = {
			className: cn(sizeClasses[size], className),
		}

		const getTooltipText = () => {
			switch (normalizedLevel) {
				case "high":
					return "High"
				case "medium":
					return "Medium"
				case "low":
					return "Low"
				default:
					return "Low"
			}
		}

		switch (normalizedLevel) {
			case "high":
				return (
					<div title={getTooltipText()} className="inline-block">
						<CheckCircle {...iconProps} className={cn(iconProps.className, "text-green-600")} />
					</div>
				)
			case "medium":
				return (
					<div title={getTooltipText()} className="inline-block">
						<AlertCircle {...iconProps} className={cn(iconProps.className, "text-yellow-600")} />
					</div>
				)
			default:
				return (
					<div title={getTooltipText()} className="inline-block">
						<XCircle {...iconProps} className={cn(iconProps.className, "text-red-600")} />
					</div>
				)
		}
	}

	// Bar variant - improved contrast
	const barColors = {
		low: "#dc2626", // red-600 (darker for better contrast)
		medium: "#d97706", // amber-600 (better contrast than yellow)
		high: "#16a34a", // green-600 (darker for better contrast)
	}

	const activeColor = barColors[normalizedLevel]
	const inactiveColor = "#9ca3af" // gray-400 (lighter than gray-500)

	const getTooltipText = () => {
		switch (normalizedLevel) {
			case "high":
				return "High"
			case "medium":
				return "Medium"
			case "low":
				return "Low"
			default:
				return "low"
		}
	}

	return (
		<div title={getTooltipText()} className="inline-block">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className={cn(sizeClasses[size], className)}
			>
				{/* Low bar - always active (all levels include low) */}
				<path
					d="M5 21v-6"
					style={{
						stroke: activeColor,
						strokeWidth: "2.5",
					}}
				/>
				{/* Medium bar - active for medium and high confidence */}
				<path
					d="M12 21V9"
					style={{
						stroke: normalizedLevel === "medium" || normalizedLevel === "high" ? activeColor : inactiveColor,
						strokeWidth: normalizedLevel === "medium" || normalizedLevel === "high" ? "2.5" : "2",
					}}
				/>
				{/* High bar - only active for high confidence */}
				<path
					d="M19 21V3"
					style={{
						stroke: normalizedLevel === "high" ? activeColor : inactiveColor,
						strokeWidth: normalizedLevel === "high" ? "2.5" : "2",
					}}
				/>
			</svg>
		</div>
	)
}
