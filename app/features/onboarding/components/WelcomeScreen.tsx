import { ChevronRight, Users } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

interface WelcomeScreenProps {
	onNext: (data: { icp: string; role: string; goal: string; customGoal?: string }) => void
}

export default function WelcomeScreen({ onNext }: WelcomeScreenProps) {
	const [icp, setIcp] = useState("")
	const [role, setRole] = useState("")
	const [goal, setGoal] = useState("needs")
	const [customGoal, setCustomGoal] = useState("")

	const handleNext = () => {
		if (icp.trim() && role.trim()) {
			onNext({
				icp: icp.trim(),
				role: role.trim(),
				goal,
				customGoal: goal === "other" ? customGoal.trim() : undefined,
			})
		}
	}

	const isValid = icp.trim() && role.trim() && (goal !== "other" || customGoal.trim())

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-medium text-sm text-white">
							1
						</div>
						<h1 className="font-semibold text-lg text-white">Project Goals</h1>
					</div>
					{/* <div className="text-gray-400 text-sm">Step 1 of 3</div> */}
				</div>
			</div>

			{/* Main Content */}
			<div className="p-4">
				<div className="space-y-6">
					{/* Welcome Message */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-blue-400">
							<Users className="h-5 w-5" />
							<span className="font-medium text-sm">Target Audience</span>
						</div>
						{/* <h2 className="font-bold text-2xl text-white">Who are you researching?</h2>
						<p className="text-gray-300 text-sm leading-relaxed">
							Help us understand both the companies (ICP) and the specific roles you're targeting.
						</p> */}
					</div>

					{/* ICP Input */}
					<div className="space-y-3">
						<label htmlFor="icp" className="font-medium text-sm text-white">
							Ideal organization profile
						</label>
						<Input
							id="icp"
							value={icp}
							onChange={(e) => setIcp(e.target.value)}
							placeholder="e.g., Small B2B SaaS companies, Early-stage startups, Healthcare clinics"
							className="h-12 border-gray-700 bg-gray-900 text-white placeholder-gray-400"
							autoFocus
						/>
					</div>

					{/* Role Input */}
					<div className="space-y-3">
						<label htmlFor="role" className="font-medium text-sm text-white">
							Persona Roles/Titles
						</label>
						<Input
							id="role"
							value={role}
							onChange={(e) => setRole(e.target.value)}
							placeholder="e.g., Product Managers, CTOs, Marketing Directors, Founders"
							className="h-12 border-gray-700 bg-gray-900 text-white placeholder-gray-400"
						/>
					</div>

					{/* Research Goal */}
					<div className="space-y-3">
						<label htmlFor="goal" className="font-medium text-sm text-white">
							Project Goal
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
									Be specific about both company type and role. Example: "Series A SaaS companies" + "VP of Sales" gives
									better insights than just "SaaS companies".
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Action */}
			<div className="mt-8 mb-20 border-gray-800 border-t bg-black p-4">
				<Button
					onClick={handleNext}
					disabled={!isValid}
					className="h-12 w-full bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-400"
				>
					Continue
					<ChevronRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
