import type React from "react"
import { useParams } from "react-router-dom"
import PageHeader from "../navigation/PageHeader"

// Import types
import type { OpportunityView } from "~/types"

interface OpportunityDetailProps {
	opportunities: OpportunityView[]
}

// Mock data with stable IDs
const mockQuotes = [
	{
		id: "q1",
		text: "This feature would really help our workflow and save us time every day.",
		author: "Interviewee 1",
	},
	{ id: "q2", text: "I've been waiting for something like this.", author: "Interviewee 2" },
	{ id: "q3", text: "This is a game-changer for our team.", author: "Interviewee 3" },
]

const mockInterviews = [
	{ id: "int1", name: "Interview 1", role: "Product Manager", date: new Date(2023, 0, 15) },
	{ id: "int2", name: "Interview 2", role: "Developer", date: new Date(2023, 1, 20) },
	{ id: "int3", name: "Interview 3", role: "Designer", date: new Date(2023, 2, 25) },
]

const OpportunityDetail: React.FC<OpportunityDetailProps> = ({ opportunities }) => {
	const { opportunityId } = useParams<{ opportunityId: string }>()

	// Find the opportunity by ID
	const opportunity = opportunities.find((o, index) => {
		return o.id === opportunityId || index.toString() === opportunityId
	})

	if (!opportunity) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8">
				<PageHeader title="Opportunity Not Found" />
				<div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
					<h1 className="mb-4 font-bold text-2xl text-red-600">Opportunity Not Found</h1>
					<p>The requested opportunity could not be found.</p>
				</div>
			</div>
		)
	}

	// Helper function to get status color
	const getStatusColor = (status?: string) => {
		switch (status) {
			case "Build":
				return "bg-green-500"
			case "Validate":
				return "bg-blue-500"
			default:
				return "bg-yellow-500" // Explore
		}
	}

	// Calculate impact/effort score
	const impactEffortRatio =
		opportunity.impact && opportunity.effort ? (opportunity.impact / opportunity.effort).toFixed(1) : "N/A"

	return (
		<div className="mx-auto max-w-7xl px-4 py-8">
			<PageHeader title={opportunity.title} />

			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				{/* Header with status color */}
				<div className="h-16 w-full" style={{ backgroundColor: getStatusColor(opportunity.status ?? undefined) }} />

				<div className="p-6">
					<div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
						<div>
							<h1 className="font-bold text-2xl">{opportunity.title}</h1>
							<p className="text-gray-600 dark:text-gray-400">Owner: {opportunity.owner}</p>
						</div>

						<div className="mt-4 md:mt-0">
							<span
								className={`rounded-full px-3 py-1 font-medium text-sm ${
									opportunity.status === "Build"
										? "bg-green-100 text-green-800"
										: opportunity.status === "Validate"
											? "bg-blue-100 text-blue-800"
											: "bg-yellow-100 text-yellow-800"
								}`}
							>
								{opportunity.status || "Explore"}
							</span>
						</div>
					</div>

					{/* Opportunity details */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Details</h2>
							<div className="space-y-3 text-left">
								<div>
									<span className="block text-gray-500 text-sm">Description</span>
									<p>{opportunity.description || "No description provided."}</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<span className="block text-gray-500 text-sm">Impact (1-10)</span>
										<p className="font-medium">{opportunity.impact || "Not rated"}</p>
									</div>
									<div>
										<span className="block text-gray-500 text-sm">Effort (1-10)</span>
										<p className="font-medium">{opportunity.effort || "Not rated"}</p>
									</div>
								</div>
								<div>
									<span className="block text-gray-500 text-sm">Impact/Effort Ratio</span>
									<p className="font-medium">{impactEffortRatio}</p>
								</div>
							</div>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Implementation Status</h2>
							<div className="space-y-4">
								<div className="space-y-1">
									<div className="flex justify-between text-sm">
										<span>Progress</span>
										<span>
											{opportunity.status === "Build" ? "75%" : opportunity.status === "Validate" ? "50%" : "25%"}
										</span>
									</div>
									<div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
										<div
											className="h-2.5 rounded-full bg-blue-600"
											style={{
												width:
													opportunity.status === "Build" ? "75%" : opportunity.status === "Validate" ? "50%" : "25%",
											}}
										/>
									</div>
								</div>

								<div className="flex space-x-2">
									<div
										className={`flex-1 rounded-lg p-3 ${opportunity.status === "Explore" || opportunity.status === "Validate" || opportunity.status === "Build" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-700"}`}
									>
										<div className="text-center font-medium">Explore</div>
									</div>
									<div
										className={`flex-1 rounded-lg p-3 ${opportunity.status === "Validate" || opportunity.status === "Build" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-700"}`}
									>
										<div className="text-center font-medium">Validate</div>
									</div>
									<div
										className={`flex-1 rounded-lg p-3 ${opportunity.status === "Build" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-700"}`}
									>
										<div className="text-center font-medium">Build</div>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Related Insights</h2>
							<ul className="list-disc space-y-2 pl-5 text-left">
								<li>This opportunity was mentioned in 5 interviews</li>
								<li>Most frequently mentioned by Early Adopter persona (60% of mentions)</li>
								<li>Associated with themes: User Experience, Performance</li>
							</ul>

							<div className="mt-4">
								<h3 className="mb-2 font-medium">Key Quotes</h3>
								<div className="space-y-3">
									{mockQuotes.map((quote) => (
										<blockquote
											key={quote.id}
											className="border-gray-300 border-l-4 py-2 pl-4 text-gray-600 italic dark:text-gray-300"
										>
											{quote.text}
											<footer className="mt-1 text-gray-500 text-sm">— {quote.author}</footer>
										</blockquote>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Related Interviews Section */}
					<div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Related Interviews</h2>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
							{/* This is mock data - in a real app, you would fetch the actual related interviews */}
							{mockInterviews.map((interview) => (
								<div
									key={interview.id}
									className="rounded bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
								>
									<a href={`/interviews/${interview.id}`} className="font-medium text-blue-600 hover:text-blue-800">
										{interview.name}
									</a>
									<p className="mt-1 text-gray-500 text-sm">Role: {interview.role}</p>
									<p className="text-gray-400 text-xs">Interviewed on {interview.date.toLocaleDateString()}</p>
								</div>
							))}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="mt-6 flex justify-end space-x-3">
						<button className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
							Edit
						</button>
						<button className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
							Update Status
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default OpportunityDetail
