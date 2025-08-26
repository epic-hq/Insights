import { useNavigate } from "react-router"
import { Link } from "~/library/link"

// Cute error illustration with broken pieces
const ErrorIllustration = () => (
	<svg viewBox="0 0 400 300" className="mx-auto h-48 w-64">
		{/* Background elements */}
		<circle cx="80" cy="60" r="25" fill="#FFE4B5" opacity="0.6" />
		<circle cx="320" cy="80" r="20" fill="#E6E6FA" opacity="0.6" />
		<circle cx="350" cy="220" r="15" fill="#FFB6C1" opacity="0.6" />
		
		{/* Ground line */}
		<line x1="0" y1="250" x2="400" y2="250" stroke="#DDD" strokeWidth="2" strokeDasharray="5,5" />
		
		{/* Sad character */}
		<g transform="translate(200, 150)">
			{/* Body */}
			<ellipse cx="0" cy="40" rx="35" ry="45" fill="#EF4444" />
			
			{/* Head */}
			<circle cx="0" cy="-10" r="25" fill="#FFE4C7" />
			
			{/* Sad eyes */}
			<circle cx="-8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="-7" cy="-16" r="1" fill="white" />
			<circle cx="9" cy="-16" r="1" fill="white" />
			
			{/* Sad eyebrows */}
			<line x1="-12" y1="-25" x2="-4" y2="-22" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />
			<line x1="4" y1="-22" x2="12" y2="-25" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />
			
			{/* Sad mouth */}
			<path d="M -6,-2 Q 0,4 6,-2" stroke="#2D1B69" strokeWidth="2" fill="none" strokeLinecap="round" />
			
			{/* Arms */}
			<line x1="-25" y1="25" x2="-35" y2="35" stroke="#EF4444" strokeWidth="8" strokeLinecap="round" />
			<line x1="25" y1="25" x2="35" y2="35" stroke="#EF4444" strokeWidth="8" strokeLinecap="round" />
			
			{/* Legs */}
			<line x1="-15" y1="80" x2="-20" y2="100" stroke="#EF4444" strokeWidth="8" strokeLinecap="round" />
			<line x1="15" y1="80" x2="20" y2="100" stroke="#EF4444" strokeWidth="8" strokeLinecap="round" />
		</g>
		
		{/* Broken pieces scattered around */}
		<g opacity="0.7">
			{/* Broken gear pieces */}
			<circle cx="120" cy="80" r="8" fill="#6366F1" />
			<rect x="116" y="72" width="8" height="4" fill="#6366F1" />
			<rect x="116" y="84" width="8" height="4" fill="#6366F1" />
			<rect x="112" y="76" width="4" height="8" fill="#6366F1" />
			<rect x="124" y="76" width="4" height="8" fill="#6366F1" />
			
			{/* Broken circuit lines */}
			<line x1="280" y1="120" x2="320" y2="120" stroke="#F59E0B" strokeWidth="3" strokeDasharray="3,3" />
			<line x1="300" y1="110" x2="300" y2="130" stroke="#F59E0B" strokeWidth="3" strokeDasharray="3,3" />
			
			{/* Broken code symbols */}
			<text x="100" y="200" fontSize="16" fill="#EF4444" opacity="0.8">{"</>"}</text>
			<text x="310" y="180" fontSize="14" fill="#EF4444" opacity="0.6">{"{ }"}</text>
		</g>
		
		{/* Warning symbols */}
		<g fill="#F59E0B" opacity="0.6">
			<polygon points="70,180 80,200 60,200" />
			<text x="70" y="195" fontSize="12" textAnchor="middle" fill="white">!</text>
		</g>
	</svg>
)

interface ErrorBoundaryProps {
	error?: Error
	reset?: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
	const navigate = useNavigate()
	
	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-4 dark:from-slate-900 dark:via-red-900 dark:to-orange-900">
			<div className="w-full max-w-2xl text-center">
				{/* Cute illustration */}
				<div className="mb-8 flex justify-center">
					<ErrorIllustration />
				</div>

				{/* Error message with personality */}
				<div className="mb-10 space-y-4">
					<h1 className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 bg-clip-text text-7xl font-bold text-transparent">
						Oops!
					</h1>
					<h2 className="font-semibold text-3xl text-gray-800 dark:text-gray-100">
						Something went a bit sideways
					</h2>
					<p className="mx-auto max-w-md leading-relaxed text-lg text-gray-600 dark:text-gray-300">
						Don't worry, it's not you—it's us! Our digital gears got a bit tangled up. Let's get you back on track.
					</p>
					
					{/* Error details for debugging (only in development) */}
					{process.env.NODE_ENV === 'development' && error && (
						<details className="mx-auto mt-6 max-w-lg rounded-lg bg-gray-100 p-4 text-left dark:bg-gray-800">
							<summary className="mb-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
								🔍 Error Details (Development)
							</summary>
							<pre className="overflow-auto whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
								{error.message}
								{error.stack && (
									<>
										{'\n\n'}
										{error.stack}
									</>
								)}
							</pre>
						</details>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					{reset && (
						<button
							type="button"
							onClick={reset}
							className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-green-100 to-emerald-200 px-8 py-4 text-base font-medium text-green-700 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg dark:from-green-700 dark:to-emerald-600 dark:text-green-100"
						>
							🔄 Try Again
						</button>
					)}
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-gray-100 to-gray-200 px-8 py-4 text-base font-medium text-gray-700 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg dark:from-gray-700 dark:to-gray-600 dark:text-gray-100"
					>
						← Go Back
					</button>
					<Link
						to="/home"
						className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-red-600 to-orange-600 px-8 py-4 text-base font-medium text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg hover:from-red-700 hover:to-orange-700"
					>
						🏠 Take Me Home
					</Link>
				</div>

				{/* Optional helpful links */}
				<div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
					<p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
						Need help? Try these options:
					</p>
					<div className="flex flex-wrap justify-center gap-3">
						<button 
						onClick={() => window.location.reload()}
						className="rounded-md px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
						>
							Refresh Page
						</button>
						<Link 
						to="/home" 
						className="rounded-md px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
						>
							Dashboard
						</Link>
						<Link 
						to="/auth" 
						className="rounded-md px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
						>
							Sign In
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}
