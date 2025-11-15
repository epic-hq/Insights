import type { ElementType, ReactNode } from "react"
import { useId } from "react"
import { Link } from "react-router-dom"
import type { SparklineDatum } from "~/components/charts/SparklineKPI"
import SparklineKPI from "~/components/charts/SparklineKPI"

interface StatCardProps {
	label: string
	value: string | number
	change?: string // e.g., "+12%"
	/** Optional sparkline data; if omitted we render a simple card like before */
	trendData?: SparklineDatum[]
	/** Optional baseline reference for sparkline */
	baseline?: number
	href?: string
	onClick?: () => void
	className?: string
	/** Optional icon name (e.g., 'users', 'lightbulb', 'chart-bar', 'clipboard') */
	icon?: string
	/** Optional description text */
	description?: string
	/** Optional highlight color for the card border */
	highlightColor?: string
	/** Compact mode - lean display with just text, number, and small icon (default: true) */
	compact?: boolean
}

// Helper function to render icon based on name
const renderIcon = (iconName?: string, compact = true, titleId?: string) => {
	if (!iconName || !titleId) return null
	const iconSize = compact ? "h-4 w-4" : "h-5 w-5"

	const icons: Record<string, ReactNode> = {
		users: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Users</title>
				<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
			</svg>
		),
		lightbulb: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Lightbulb</title>
				<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
			</svg>
		),
		"chart-bar": (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Chart Bar</title>
				<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
			</svg>
		),
		clipboard: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Clipboard</title>
				<path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
				<path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
			</svg>
		),
		insights: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Insights</title>
				<path
					fillRule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
					clipRule="evenodd"
				/>
			</svg>
		),
		opportunities: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Opportunities</title>
				<path
					fillRule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clipRule="evenodd"
				/>
			</svg>
		),
		interviews: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				className={iconSize}
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-labelledby={titleId}
			>
				<title id={titleId}>Interviews</title>
				<path
					fillRule="evenodd"
					d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
					clipRule="evenodd"
				/>
			</svg>
		),
	}

	return icons[iconName] || null
}

export default function StatCard({
	label,
	value,
	change,
	trendData,
	baseline,
	href,
	onClick,
	className,
	icon,
	description,
	highlightColor = "#3b82f6", // Default to blue
	compact = true, // Default to compact mode
}: StatCardProps) {
	// Use appropriate wrapper based on props
	const Wrapper: ElementType = href
		? href.startsWith("/")
			? Link
			: "a"
		: // Use Link for internal routes, 'a' for external
			onClick
			? "button"
			: "div"
	const iconTitleId = useId()
	const trendUpTitleId = useId()
	const trendDownTitleId = useId()
	const linkIndicatorTitleId = useId()
	const isUp = change?.startsWith("+")

	// Determine border style based on highlightColor
	const borderStyle = highlightColor ? { borderLeft: `4px solid ${highlightColor}` } : {}

	if (compact) {
		const next = href ? (href.startsWith("/") ? { to: href } : { href }) : {}
		const clickable = href || onClick

		return (
			<Wrapper
				{...next}
				{...(onClick ? { onClick } : {})}
				// ultra-compact, minimal chrome, tiny padding
				className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] leading-none dark:bg-gray-800 ${clickable ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" : ""} ${className ?? ""}`}
				// minimal left accent if you still want highlight
				style={highlightColor ? { borderLeft: `1px solid ${highlightColor}` } : undefined}
			>
				{icon && (
					<span className="flex-shrink-0 text-gray-500">
						{renderIcon(icon, /* compact */ true /* -> h-4 w-4 */, iconTitleId)}
					</span>
				)}

				{/* shorter label width */}
				<span className="max-w-[4rem] truncate text-gray-600">{label}</span>

				{/* smaller value */}
				<span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>

				{/* tiny change indicator */}
				{change && <span className={`ml-0.5 text-[9px] ${isUp ? "text-emerald-600" : "text-rose-600"}`}>{change}</span>}
			</Wrapper>
		)
	}

	// Full mode - original display with graphs and more spacing
	return (
		<Wrapper
			{...(href ? (href.startsWith("/") ? { to: href } : { href }) : {})}
			{...(onClick ? { onClick } : {})}
			className={`rounded-lg border bg-white shadow transition-all duration-200 dark:bg-gray-900 ${href || onClick ? "hover:-translate-y-1 transform cursor-pointer hover:bg-gray-50 hover:shadow-md dark:hover:bg-gray-800" : ""} ${className ?? ""}`}
			style={borderStyle}
		>
			<div className="p-4">
				{/* Header with label and icon */}
				<div className="mb-2 flex items-center justify-between">
					<div className="font-medium text-gray-500 text-sm">{label}</div>
					{icon && <div className="text-gray-400">{renderIcon(icon, compact, iconTitleId)}</div>}
				</div>

				{/* Main content */}
				{trendData ? (
					<SparklineKPI data={trendData} kpiValue={value} change={change} baseline={baseline} />
				) : (
					<>
						<div className="font-semibold text-2xl text-gray-900 dark:text-gray-100">{value}</div>
						{change && (
							<div className={`mt-1 flex items-center text-xs ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
								{/* Trend arrow */}
								{isUp ? (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="mr-1 h-3 w-3"
										viewBox="0 0 20 20"
										fill="currentColor"
										aria-labelledby={trendUpTitleId}
									>
										<title id={trendUpTitleId}>Trending Up</title>
										<path
											fillRule="evenodd"
											d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
											clipRule="evenodd"
										/>
									</svg>
								) : (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="mr-1 h-3 w-3"
										viewBox="0 0 20 20"
										fill="currentColor"
										aria-labelledby={trendDownTitleId}
									>
										<title id={trendDownTitleId}>Trending Down</title>
										<path
											fillRule="evenodd"
											d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z"
											clipRule="evenodd"
										/>
									</svg>
								)}
								{change}
							</div>
						)}
					</>
				)}

				{/* Optional description */}
				{description && <div className="mt-2 text-gray-500 text-xs">{description}</div>}

				{/* Link indicator for cards with href */}
				{href && (
					<div className="mt-3 flex justify-end">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-4 w-4 text-gray-400"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-labelledby={linkIndicatorTitleId}
						>
							<title id={linkIndicatorTitleId}>View Details</title>
							<path
								fillRule="evenodd"
								d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
								clipRule="evenodd"
							/>
						</svg>
					</div>
				)}
			</div>
		</Wrapper>
	)
}
