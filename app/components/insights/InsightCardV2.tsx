import { useState } from "react"
import type { InsightCardProps } from "./InsightCard"

export function InsightCardV2({
	name,
	tag,
	category,
	journeyStage,
	impact,
	novelty,
	jtbD,
	underlyingMotivation,
	pain,
	desiredOutcome,
	evidence,
	opportunityIdeas,
	confidence,
	relatedTags,
	contradictions,
	className,
	onTagClick,
	onUpvote,
	onDownvote,
	onConvertToOpportunity,
	onArchive,
	onDontShowMe,
	upvotes = 0,
	downvotes = 0,
}: InsightCardProps) {
	const [expanded, setExpanded] = useState(false)
	const [showActions, setShowActions] = useState(false)

	// Calculate impact and novelty colors
	const getImpactColor = (value: number | string) => {
		const v = Number(value) || 0
		const colors = ["bg-gray-100", "bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400"]
		const textColors = ["text-gray-600", "text-blue-600", "text-blue-700", "text-blue-800", "text-blue-900"]
		return { bg: colors[v - 1] || colors[0], text: textColors[v - 1] || textColors[0] }
	}

	const getNoveltyColor = (value: number | string) => {
		const v = Number(value) || 0
		const colors = ["bg-gray-100", "bg-purple-100", "bg-purple-200", "bg-purple-300", "bg-purple-400"]
		const textColors = ["text-gray-600", "text-purple-600", "text-purple-700", "text-purple-800", "text-purple-900"]
		return { bg: colors[v - 1] || colors[0], text: textColors[v - 1] || textColors[0] }
	}

	const impactColor = getImpactColor(impact ?? 0)
	const noveltyColor = getNoveltyColor(novelty ?? 0)

	return (
		<div
			className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${className || ""}`}
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => setShowActions(false)}
		>
			{/* Card header with accent color based on category */}
			<div className="h-2 bg-gradient-to-r from-blue-500 to-violet-500" />

			<div className="p-5">
				{/* Top metadata row */}
				<div className="mb-3 flex items-center justify-between">
					<div
						onClick={() => onTagClick?.(category ?? "")}
						className="cursor-pointer font-medium text-blue-600 text-sm transition-colors hover:text-blue-800 dark:text-blue-400"
					>
						{category}
					</div>
					<div className="text-gray-500 text-xs dark:text-gray-400">{journeyStage}</div>
				</div>

				{/* Main insight content */}
				<h3 className="mb-2 font-bold text-gray-900 text-xl leading-tight dark:text-gray-100">{name ?? tag}</h3>

				{jtbD && <p className="mb-4 text-gray-700 text-md leading-relaxed dark:text-gray-300">{jtbD}</p>}

				{/* Stats row */}
				<div className="mb-4 flex flex-wrap gap-2">
					<div
						className={`rounded-full px-2.5 py-1 font-medium text-xs ${impactColor.bg} ${impactColor.text} flex items-center`}
					>
						<svg
							className="mr-1 h-3.5 w-3.5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
						</svg>
						Impact {impact}
					</div>
					<div
						className={`rounded-full px-2.5 py-1 font-medium text-xs ${noveltyColor.bg} ${noveltyColor.text} flex items-center`}
					>
						<svg
							className="mr-1 h-3.5 w-3.5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684z" />
						</svg>
						Novelty {novelty}
					</div>
					<div className="flex items-center rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 text-xs">
						<svg
							className="mr-1 h-3.5 w-3.5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fillRule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
								clipRule="evenodd"
							/>
						</svg>
						{confidence}
					</div>
				</div>

				{/* Expandable content */}
				<div
					className={`space-y-4 transition-all duration-300 ${expanded ? "max-h-[1000px] opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}
				>
					{/* Motivation section */}
					<div>
						<h4 className="mb-1 font-semibold text-gray-700 text-sm dark:text-gray-300">Underlying Motivation</h4>
						<p className="text-gray-600 text-sm dark:text-gray-400">{underlyingMotivation}</p>
					</div>

					{/* Pain & Outcome section */}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<h4 className="mb-1 font-semibold text-gray-700 text-sm dark:text-gray-300">Pain / Friction</h4>
							<p className="text-gray-600 text-sm dark:text-gray-400">{pain}</p>
						</div>
						<div>
							<h4 className="mb-1 font-semibold text-gray-700 text-sm dark:text-gray-300">Desired Outcome</h4>
							<p className="text-gray-600 text-sm dark:text-gray-400">{desiredOutcome}</p>
						</div>
					</div>

					{/* Evidence section */}
					<div>
						<h4 className="mb-1 font-semibold text-gray-700 text-sm dark:text-gray-300">Evidence</h4>
						<blockquote className="border-gray-300 border-l-2 pl-3 text-gray-600 text-sm italic dark:border-gray-600 dark:text-gray-400">
							{evidence ?? ""}
						</blockquote>
					</div>

					{/* Opportunity Ideas section */}
					{opportunityIdeas && opportunityIdeas.length > 0 && (
						<div>
							<h4 className="mb-1 font-semibold text-gray-700 text-sm dark:text-gray-300">Opportunity Ideas</h4>
							<ul className="list-inside list-disc space-y-1 text-gray-600 text-sm dark:text-gray-400">
								{opportunityIdeas?.map((idea) => (
									<li key={idea}>{idea}</li>
								))}
							</ul>
						</div>
					)}

					{/* Contradictions section */}
					{contradictions && (
						<div className="flex items-start space-x-2 text-amber-600 dark:text-amber-400">
							<svg
								className="mt-0.5 h-4 w-4 flex-shrink-0"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
									clipRule="evenodd"
								/>
							</svg>
							<span className="text-sm">Possible contradictions: {contradictions}</span>
						</div>
					)}
				</div>

				{/* Related tags */}
				{relatedTags && relatedTags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{relatedTags.map((tag) => (
							<button
								type="button"
								key={tag}
								onClick={() => onTagClick?.(tag)}
								className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 text-xs transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
							>
								{tag}
							</button>
						))}
					</div>
				)}

				{/* Expand/collapse button */}
				<button
					onClick={() => setExpanded(!expanded)}
					className="mt-4 flex items-center font-medium text-blue-600 text-sm hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
				>
					{expanded ? (
						<>
							<svg className="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path
									fillRule="evenodd"
									d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
									clipRule="evenodd"
								/>
							</svg>
							Show less
						</>
					) : (
						<>
							<svg className="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path
									fillRule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clipRule="evenodd"
								/>
							</svg>
							Show more
						</>
					)}
				</button>
			</div>

			{/* Action bar */}
			<div
				className={`border-gray-200 border-t bg-gray-50 px-5 py-3 transition-all duration-300 dark:border-gray-700 dark:bg-gray-800/50 ${showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
			>
				<div className="flex items-center justify-between">
					{/* Vote buttons */}
					<div className="flex items-center space-x-4">
						<button
							onClick={onUpvote}
							className="flex items-center space-x-1 text-gray-500 transition-colors hover:text-green-600"
							title="Upvote"
						>
							<svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 01-1.341-.317l-2.734-1.366A3 3 0 006.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 012.166-1.73c.432-.143.853-.386 1.011-.814.16-.432.248-.9.248-1.388z" />
							</svg>
							<span className="font-medium text-xs">{upvotes}</span>
						</button>
						<button
							onClick={onDownvote}
							className="flex items-center space-x-1 text-gray-500 transition-colors hover:text-red-600"
							title="Downvote"
						>
							<svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path d="M18.905 12.75a1.25 1.25 0 01-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 015.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.242 0-2.26-1.01-2.146-2.247a23.864 23.864 0 011.341-5.974C2.752 3.678 3.833 3 5.005 3h3.192a3 3 0 011.342.317l2.733 1.366A3 3 0 0013.613 5h1.292v7h-.963c-.685 0-1.258.483-1.612 1.068a4.011 4.011 0 01-2.166 1.73c-.432.143-.853.386-1.011.814-.16.432-.248.9-.248 1.388z" />
							</svg>
							<span className="font-medium text-xs">{downvotes}</span>
						</button>
					</div>

					{/* Action buttons */}
					<div className="flex items-center space-x-2">
						<button
							onClick={onConvertToOpportunity}
							className="text-gray-500 transition-colors hover:text-blue-600"
							title="Convert to Opportunity"
						>
							<svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.08 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
								<path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
							</svg>
						</button>
						<button
							onClick={onArchive}
							className="text-gray-500 transition-colors hover:text-yellow-600"
							title="Archive"
						>
							<svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
								<path
									fillRule="evenodd"
									d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zm5.22 1.72a.75.75 0 011.06 0L10 10.94l1.72-1.72a.75.75 0 111.06 1.06L11.06 12l1.72 1.72a.75.75 0 11-1.06 1.06L10 13.06l-1.72 1.72a.75.75 0 01-1.06-1.06L8.94 12l-1.72-1.72a.75.75 0 010-1.06z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
						<button
							onClick={onDontShowMe}
							className="text-gray-500 transition-colors hover:text-red-600"
							title="Don't show me this"
						>
							<svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path
									fillRule="evenodd"
									d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
									clipRule="evenodd"
								/>
								<path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default InsightCardV2
