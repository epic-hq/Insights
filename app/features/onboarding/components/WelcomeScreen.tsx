import { ChevronRight, Users } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

interface WelcomeScreenProps {
	onNext: (data: { icp: string; goal: string; customGoal?: string }) => void
}

export default function WelcomeScreen({ onNext }: WelcomeScreenProps) {
	const [icp, setIcp] = useState("")
	const [goal, setGoal] = useState("needs")
	const [customGoal, setCustomGoal] = useState("")

	const handleNext = () => {
		if (icp.trim()) {
			onNext({
				icp: icp.trim(),
				goal,
				customGoal: goal === "other" ? customGoal.trim() : undefined,
			})
		}
	}

	const isValid = icp.trim() && (goal !== "other" || customGoal.trim())

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-medium text-sm text-white">
							1
						</div>
						<h1 className="font-semibold text-lg text-white">Let's set up your first project</h1>
					</div>
					<div className="text-gray-400 text-sm">Step 1 of 3</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4 pb-24">
				<div className="space-y-6">
					{/* Welcome Message */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-blue-400">
							<Users className="h-5 w-5" />
							<span className="font-medium text-sm">Target Audience</span>
						</div>
						<h2 className="font-bold text-2xl text-white">Who are you researching?</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							Help us understand your target market so we can provide relevant insights from your interviews.
						</p>
					</div>

					{/* ICP Input */}
					<div className="space-y-3">
						<label htmlFor="icp" className="font-medium text-sm text-white">
							Target Market / ICP
						</label>
						<Input
							id="icp"
							value={icp}
							onChange={(e) => setIcp(e.target.value)}
							placeholder="e.g., Small business owners, College students, SaaS founders"
							className="h-12 border-gray-700 bg-gray-900 text-white placeholder-gray-400"
							autoFocus
						/>
					</div>

					{/* Research Goal */}
					<div className="space-y-3">
						<label htmlFor="goal" className="font-medium text-sm text-white">
							What do you want to learn?
						</label>
						<Select value={goal} onValueChange={setGoal}>
							<SelectTrigger className="h-12 border-gray-700 bg-gray-900 text-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-gray-700 bg-gray-900 text-white">
								<SelectItem value="needs">Understand user needs & motivations</SelectItem>
								<SelectItem value="willingness">Evaluate willingness to pay for features</SelectItem>
								<SelectItem value="other">Other (custom)</SelectItem>
							</SelectContent>
						</Select>

						{goal === "other" && (
							<Input
								value={customGoal}
								onChange={(e) => setCustomGoal(e.target.value)}
								placeholder="Describe your research goal..."
								className="h-12 border-gray-700 bg-gray-900 text-white placeholder-gray-400"
							/>
						)}
					</div>

					{/* Value Proposition */}
					<div className="rounded-lg bg-gray-900 p-4">
						<div className="flex items-start gap-3">
							<div className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
							<div>
								<p className="font-medium text-sm text-white">Pro tip</p>
								<p className="text-gray-300 text-xs leading-relaxed">
									The more specific your target audience, the better insights we can provide. Think about demographics,
									roles, or specific use cases.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Action */}
			<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-4">
				<Button
					onClick={handleNext}
					disabled={!isValid}
					className="h-12 w-full bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400"
				>
					Continue
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
