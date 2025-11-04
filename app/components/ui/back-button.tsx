import { Button } from "./button"

interface BackButtonProps {
	className?: string
}

export function BackButton({ className = "" }: BackButtonProps) {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => window.history.back()}
			className={`flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 ${className}`}
		>
			<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
			</svg>
			Back
		</Button>
	)
}
