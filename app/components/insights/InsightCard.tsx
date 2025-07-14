import type { InsightView } from "~/types"

export interface InsightCardProps extends InsightView {
	// UI-specific callbacks
	onTagClick?: (tag: string) => void
	onUpvote?: () => void
	onDownvote?: () => void
	onConvertToOpportunity?: () => void
	onArchive?: () => void
	onDontShowMe?: () => void

	/** Optional vote counts */
	upvotes?: number
	downvotes?: number

	// Additional UI-specific fields not in the base InsightView
	sentiment?: string
	source?:
		| string
		| {
				type: string
				id: string
				participant: string
				date: string
		  }
	tags?: string[]

	// UI styling
	className?: string
}

export function InsightCard({
	name,
	category,
	journeyStage,
	impact,
	novelty,
	jtbd, // Fixed property name to match InsightView interface
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
	return (
		<div
			className={`max-w-xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900 ${
				className ?? ""
			}`}
		>
			{/* Main Insight (formerly tag) - Now more prominent */}
			<div className="p-4 pb-2">
				<h2 className="mb-2 font-bold text-gray-900 text-xl leading-tight dark:text-gray-100">{name}</h2>

				{/* Reordered fields: JTBD */}
				<div className="mb-3">
					<h3 className="font-semibold text-gray-800 text-md leading-snug dark:text-gray-200">{jtbd}</h3>
				</div>

				{/* Reordered fields: Category & Journey Stage */}
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => onTagClick?.(category ?? "")}
						className="cursor-pointer font-medium text-blue-600 text-sm transition-colors hover:text-blue-800 dark:text-blue-400"
					>
						{category}
					</button>
					<span className="text-gray-500 text-sm dark:text-gray-400">{journeyStage}</span>
				</div>

				{/* Stats */}
				<div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
					<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
						⚡ Impact {impact}
					</span>
					<span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-fuchsia-800">
						✨ Novelty {novelty}
					</span>
				</div>
			</div>

			{/* Content area with collapsible sections */}
			<div className="border-gray-200 border-t px-4 py-3">
				<details className="group mb-2">
					<summary className="flex cursor-pointer items-center justify-between font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">
						<span>Underlying Motivation</span>
						<span className="transition group-open:rotate-180">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
								stroke="currentColor"
								className="h-4 w-4"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</span>
					</summary>
					<div className="whitespace-pre-line pt-2 text-gray-700 text-sm dark:text-gray-200">
						{underlyingMotivation}
					</div>
				</details>

				<details className="group mb-2">
					<summary className="flex cursor-pointer items-center justify-between font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">
						<span>Pain & Desired Outcome</span>
						<span className="transition group-open:rotate-180">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
								stroke="currentColor"
								className="h-4 w-4"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</span>
					</summary>
					<div className="grid gap-4 pt-2 md:grid-cols-2">
						<div>
							<h4 className="mb-1 font-medium text-gray-600 text-sm">Pain / Friction</h4>
							<p className="whitespace-pre-line text-gray-700 text-sm dark:text-gray-200">{pain}</p>
						</div>
						<div>
							<h4 className="mb-1 font-medium text-gray-600 text-sm">Desired Outcome</h4>
							<p className="whitespace-pre-line text-gray-700 text-sm dark:text-gray-200">{desiredOutcome}</p>
						</div>
					</div>
				</details>

				<details className="group mb-2">
					<summary className="flex cursor-pointer items-center justify-between font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">
						<span>Evidence Quote</span>
						<span className="transition group-open:rotate-180">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={2}
								stroke="currentColor"
								className="h-4 w-4"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</span>
					</summary>
					<div className="pt-2">
						<blockquote className="border-gray-300 border-l-2 pl-2 text-gray-700 text-sm italic dark:text-gray-300">
							{evidence}
						</blockquote>
					</div>
				</details>

				{opportunityIdeas && opportunityIdeas.length > 0 && (
					<details className="group mb-2">
						<summary className="flex cursor-pointer items-center justify-between font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">
							<span>Opportunity Ideas</span>
							<span className="transition group-open:rotate-180">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={2}
									stroke="currentColor"
									className="h-4 w-4"
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
								</svg>
							</span>
						</summary>
						<div className="pt-2">
							<ul className="list-inside list-disc space-y-1 text-sm">
								{opportunityIdeas?.map((idea) => (
									<li key={idea}>{idea}</li>
								))}
							</ul>
						</div>
					</details>
				)}
			</div>

			{/* Footer with actions */}
			<div className="border-gray-200 border-t bg-gray-50 px-4 py-3 dark:bg-gray-800">
				{/* Voting and actions */}
				<div className="flex items-center justify-between">
					{/* Vote buttons */}
					<div className="flex items-center space-x-3">
						<button
							onClick={onUpvote}
							className="flex items-center space-x-1 text-gray-500 transition-colors hover:text-green-600"
							title="Upvote"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className="h-5 w-5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"
								/>
							</svg>
							<span className="text-xs">{upvotes}</span>
						</button>
						<button
							onClick={onDownvote}
							className="flex items-center space-x-1 text-gray-500 transition-colors hover:text-red-600"
							title="Downvote"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className="h-5 w-5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 00.303-.54m.023-8.25H16.48a4.5 4.5 0 01-1.423-.23l-3.114-1.04a4.5 4.5 0 00-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 002.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.5a2.25 2.25 0 002.25 2.25.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384"
								/>
							</svg>
							<span className="text-xs">{downvotes}</span>
						</button>
					</div>

					{/* Action dropdown */}
					<div className="group relative">
						<button className="text-gray-500 transition-colors hover:text-gray-700">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className="h-5 w-5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
								/>
							</svg>
						</button>
						<div className="absolute right-0 bottom-full z-10 mb-2 hidden w-48 rounded-md border border-gray-200 bg-white shadow-lg group-hover:block dark:border-gray-700 dark:bg-gray-800">
							<div className="py-1">
								<button
									type="button"
									onClick={onConvertToOpportunity}
									className="flex w-full items-center px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
										className="mr-2 h-4 w-4"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
										/>
									</svg>
									Convert to Opportunity
								</button>
								<button
									type="button"
									onClick={onArchive}
									className="flex w-full items-center px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
										className="mr-2 h-4 w-4"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
										/>
									</svg>
									Archive
								</button>
								<button
									type="button"
									onClick={onDontShowMe}
									className="flex w-full items-center px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
										className="mr-2 h-4 w-4"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
										/>
									</svg>
									Don't show me this
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Metadata */}
				<div className="mt-3 flex flex-wrap items-center justify-between text-xs">
					<div className="text-gray-500">
						Confidence: <span className="font-medium text-gray-700 dark:text-gray-300">{confidence}</span>
					</div>

					{/* Related Tags */}
					{relatedTags && relatedTags.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1 sm:mt-0">
							{relatedTags.map((t) => (
								<button
									key={t}
									type="button"
									onClick={() => onTagClick?.(t)}
									className="cursor-pointer rounded bg-gray-100 px-2 py-0.5 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								>
									#{t}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Possible Contradictions */}
				{contradictions && (
					<div className="mt-2 flex items-center text-amber-600 text-xs dark:text-amber-400">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="mr-1 h-4 w-4"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
						<span>Possible contradictions: {contradictions}</span>
					</div>
				)}
			</div>
		</div>
	)
}

export default InsightCard
