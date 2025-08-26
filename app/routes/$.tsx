import { useNavigate } from "react-router"
import { Link } from "~/library/link"

// Cute low-fidelity SVG illustration
const LostIllustration = () => (
	<svg viewBox="0 0 400 300" className="h-48 w-64 mx-auto">
		{/* Background elements */}
		<circle cx="80" cy="60" r="25" fill="#FFE4B5" opacity="0.6" />
		<circle cx="320" cy="80" r="20" fill="#E6E6FA" opacity="0.6" />
		<circle cx="350" cy="220" r="15" fill="#FFB6C1" opacity="0.6" />
		
		{/* Ground line */}
		<line x1="0" y1="250" x2="400" y2="250" stroke="#DDD" strokeWidth="2" strokeDasharray="5,5" />
		
		{/* Lost character */}
		<g transform="translate(200, 150)">
			{/* Body */}
			<ellipse cx="0" cy="40" rx="35" ry="45" fill="#4F46E5" />
			
			{/* Head */}
			<circle cx="0" cy="-10" r="25" fill="#FFE4C7" />
			
			{/* Eyes */}
			<circle cx="-8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="-7" cy="-16" r="1" fill="white" />
			<circle cx="9" cy="-16" r="1" fill="white" />
			
			{/* Confused eyebrows */}
			<line x1="-12" y1="-22" x2="-4" y2="-20" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />
			<line x1="4" y1="-20" x2="12" y2="-22" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />
			
			{/* Small mouth */}
			<ellipse cx="0" cy="-2" rx="4" ry="2" fill="#2D1B69" />
			
			{/* Arms */}
			<line x1="-25" y1="25" x2="-40" y2="15" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
			<line x1="25" y1="25" x2="40" y2="35" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
			
			{/* Legs */}
			<line x1="-15" y1="80" x2="-20" y2="100" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
			<line x1="15" y1="80" x2="20" y2="100" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
		</g>
		
		{/* Question marks floating around */}
		<text x="120" y="80" fontSize="24" fill="#6366F1" opacity="0.7">?</text>
		<text x="290" y="130" fontSize="18" fill="#6366F1" opacity="0.5">?</text>
		<text x="100" y="180" fontSize="20" fill="#6366F1" opacity="0.6">?</text>
		
		{/* Map pieces scattered */}
		<rect x="60" y="200" width="20" height="15" fill="#34D399" opacity="0.7" rx="2" />
		<rect x="90" y="210" width="15" height="20" fill="#F59E0B" opacity="0.7" rx="2" />
		<rect x="320" y="190" width="18" height="12" fill="#EF4444" opacity="0.7" rx="2" />
	</svg>
)

export default function Route404() {
	const navigate = useNavigate()
	
	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
			<div className="w-full max-w-2xl text-center">
				{/* Cute illustration */}
				<div className="mb-8 flex justify-center">
					<LostIllustration />
				</div>

				{/* Error message with personality */}
				<div className="space-y-4 mb-10">
					<h1 className="font-bold text-7xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
						404
					</h1>
					<h2 className="font-semibold text-3xl text-gray-800 dark:text-gray-100">
						Oops! We're a bit lost too
					</h2>
					<p className="text-gray-600 text-lg dark:text-gray-300 max-w-md mx-auto leading-relaxed">
						The page you're looking for seems to have wandered off. Don't worry though, we can help you find your way back!
					</p>
				</div>

				{/* Action buttons */}
				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-gray-100 to-gray-200 px-8 py-4 font-medium text-base text-gray-700 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 dark:from-gray-700 dark:to-gray-600 dark:text-gray-100"
					>
						← Go Back
					</button>
					<Link
						to="/home"
						className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 font-medium text-base text-white shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 hover:from-indigo-700 hover:to-purple-700"
					>
						🏠 Take Me Home
					</Link>
				</div>

				{/* Optional helpful links */}
				<div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
						Or try one of these popular sections:
					</p>
					<div className="flex flex-wrap justify-center gap-3">
						<Link 
							to="/home" 
							className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors px-3 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
						>
							Dashboard
						</Link>
						<Link 
							to="/login" 
							className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors px-3 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
						>
							Login
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}
