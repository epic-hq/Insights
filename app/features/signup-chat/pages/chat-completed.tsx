import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react"
import { Link } from "react-router"

export default function ChatCompleted() {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<header className="border-gray-200 border-b bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
				<div className="mx-auto flex max-w-2xl items-center justify-between">
					<Link
						to="/home"
						className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						<ArrowLeft className="h-5 w-5" />
						Back
					</Link>
					<div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
						<CheckCircle className="h-4 w-4 text-green-500" />
						<span className="text-gray-700 text-sm dark:text-gray-300">Complete</span>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex flex-1 items-center justify-center px-4 py-16">
				<div className="w-full max-w-lg text-center">
					<div className="mb-8">
						<CheckCircle className="mx-auto mb-6 h-16 w-16 text-green-500" />
						<h1 className="mb-4 font-bold text-3xl text-gray-900 dark:text-white">Welcome to UpSight!</h1>
						<p className="mb-2 text-gray-600 text-lg leading-relaxed dark:text-gray-300">Let&apos;s go!</p>
					</div>

					{/* Action Button */}
					<Link
						to="/home"
						className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-4 font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg"
					>
						<ArrowRight className="h-5 w-5" />
						Get Started Now
					</Link>

					<div className="mt-3">
						<Link to="/signup-chat?restart=1" className="text-gray-500 text-xs underline">
							Start over (capture fresh answers)
						</Link>
					</div>
				</div>
			</main>
		</div>
	)
}
