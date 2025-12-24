/**
 * Website research card component for project setup
 * Allows users to enter a company website and shows research results for confirmation
 */
import { Check, Globe, Loader2, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"

interface ResearchData {
	customer_problem?: string
	offerings?: string[]
	competitors?: string[]
	target_orgs?: string[]
	target_customers?: string[]
	description?: string
	industry?: string
}

interface WebsiteResearchCardProps {
	onResearchComplete?: (data: ResearchData) => void
}

/**
 * Normalizes a URL by adding https:// if no protocol is present
 */
function normalizeUrl(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) return ""

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed
	}

	return `https://${trimmed}`
}

export function WebsiteResearchCard({ onResearchComplete }: WebsiteResearchCardProps) {
	const [websiteUrl, setWebsiteUrl] = useState("")
	const [researchResults, setResearchResults] = useState<ResearchData | null>(null)
	const [showResults, setShowResults] = useState(false)
	const fetcher = useFetcher()

	const isResearching = fetcher.state !== "idle"
	const hasUrl = websiteUrl.trim().length > 0

	// Handle fetcher response - show results for confirmation
	useEffect(() => {
		if (fetcher.data?.success && fetcher.data?.data) {
			setResearchResults(fetcher.data.data)
			setShowResults(true)
		}
	}, [fetcher.data])

	const handleResearch = () => {
		if (!hasUrl) return

		const normalizedUrl = normalizeUrl(websiteUrl)
		setWebsiteUrl(normalizedUrl)
		setShowResults(false)
		setResearchResults(null)

		fetcher.submit(
			{
				website_url: normalizedUrl,
			},
			{ method: "post", action: "/api/project-setup/website" }
		)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && hasUrl && !isResearching) {
			e.preventDefault()
			handleResearch()
		}
	}

	const handleAcceptResults = () => {
		if (researchResults && onResearchComplete) {
			onResearchComplete(researchResults)
		}
		setShowResults(false)
		setResearchResults(null)
	}

	const handleRejectResults = () => {
		setShowResults(false)
		setResearchResults(null)
	}

	// Show results confirmation view
	if (showResults && researchResults) {
		const targetList = researchResults.target_customers || researchResults.target_orgs
		const hasAnyData =
			researchResults.description ||
			researchResults.customer_problem ||
			(researchResults.offerings?.length ?? 0) > 0 ||
			(targetList?.length ?? 0) > 0

		return (
			<div className="rounded-lg border bg-muted/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-semibold text-sm">
						<Sparkles className="h-4 w-4 text-violet-500" />
						Research Results
					</h3>
					<div className="flex gap-2">
						<Button size="sm" variant="ghost" onClick={handleRejectResults} className="h-7 px-2 text-muted-foreground">
							<X className="mr-1 h-4 w-4" />
							Discard
						</Button>
						<Button
							size="sm"
							onClick={handleAcceptResults}
							disabled={!hasAnyData}
							className="h-7 bg-violet-600 px-2 hover:bg-violet-700"
						>
							<Check className="mr-1 h-4 w-4" />
							Use Results
						</Button>
					</div>
				</div>

				{!hasAnyData ? (
					<p className="text-muted-foreground text-sm">
						No useful information could be extracted. Try a different URL or enter details manually.
					</p>
				) : (
					<div className="space-y-2 text-sm">
						{researchResults.description && (
							<div>
								<span className="font-medium text-muted-foreground">About:</span>{" "}
								<span className="text-foreground">{researchResults.description}</span>
							</div>
						)}
						{researchResults.customer_problem && (
							<div>
								<span className="font-medium text-muted-foreground">Problem solved:</span>{" "}
								<span className="text-foreground">{researchResults.customer_problem}</span>
							</div>
						)}
						{researchResults.offerings && researchResults.offerings.length > 0 && (
							<div>
								<span className="font-medium text-muted-foreground">Products/Services:</span>{" "}
								<span className="text-foreground">{researchResults.offerings.join(", ")}</span>
							</div>
						)}
						{targetList && targetList.length > 0 && (
							<div>
								<span className="font-medium text-muted-foreground">Target customers:</span>{" "}
								<span className="text-foreground">{targetList.join(", ")}</span>
							</div>
						)}
						{researchResults.industry && (
							<div>
								<span className="font-medium text-muted-foreground">Industry:</span>{" "}
								<span className="text-foreground">{researchResults.industry}</span>
							</div>
						)}
						<p className="mt-2 text-muted-foreground text-xs">
							Review above. Click "Use Results" to populate fields, or "Discard" to ignore.
						</p>
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-4">
			{/* Shimmer overlay - only show when not researching */}
			{!isResearching && (
				<div className="-translate-x-full pointer-events-none absolute inset-0 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
			)}

			<div className="relative">
				<div className="mb-3 flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
						<Globe className="h-4 w-4 text-white" />
					</div>
					<div>
						<h3 className="font-semibold text-sm">Speed up with AI Research</h3>
						<p className="text-muted-foreground text-xs">
							Enter your company website to research and review suggested data
						</p>
					</div>
				</div>

				<div className="flex gap-2">
					<Input
						type="text"
						placeholder="company.com"
						value={websiteUrl}
						onChange={(e) => setWebsiteUrl(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isResearching}
						className="flex-1"
					/>
					<Button
						onClick={handleResearch}
						disabled={!hasUrl || isResearching}
						className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50"
					>
						{isResearching ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Researching...
							</>
						) : (
							<>
								<Sparkles className="mr-2 h-4 w-4" />
								Research
								<span className="-translate-x-full absolute inset-0 animate-[shimmer_2s_infinite_0.5s] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
							</>
						)}
					</Button>
				</div>

				{fetcher.data && !fetcher.data.success && <p className="mt-2 text-red-500 text-sm">{fetcher.data.error}</p>}
			</div>
		</div>
	)
}
