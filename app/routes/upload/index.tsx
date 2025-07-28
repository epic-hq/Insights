import type { MetaFunction } from "react-router"
import { Link } from "react-router-dom"
import UploadButton from "~/features/upload/components/UploadButton"

export const meta: MetaFunction = () => {
	return [
		{ title: "Upload | Insights" },
		{ name: "description", content: "Upload interview recordings or transcripts" },
	]
}

export default function Upload() {
	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Upload</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<h2 className="mb-4 font-semibold text-xl">Upload Interview Data</h2>
				<p className="mb-6 text-gray-600 dark:text-gray-400">
					Upload interview recordings, transcripts, or notes to generate insights automatically. Our system will process
					your files and extract key insights.
				</p>

				<div className="flex justify-center py-10">
					<div className="text-center">
						<UploadButton />
						<p className="mt-4 text-gray-500 text-sm dark:text-gray-400">
							Supported formats: MP3, MP4, WAV, DOC, DOCX, PDF, TXT
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
					<h3 className="mb-4 font-medium text-lg">Recent Uploads</h3>
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead>
								<tr>
									<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
										File Name
									</th>
									<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
										Date
									</th>
									<th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
										Status
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
								<tr>
									<td className="whitespace-nowrap px-4 py-3">interview_alex_johnson.mp3</td>
									<td className="whitespace-nowrap px-4 py-3">2025-07-10</td>
									<td className="whitespace-nowrap px-4 py-3">
										<span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900 dark:text-green-300">
											Complete
										</span>
									</td>
								</tr>
								<tr>
									<td className="whitespace-nowrap px-4 py-3">interview_maria_garcia.wav</td>
									<td className="whitespace-nowrap px-4 py-3">2025-07-08</td>
									<td className="whitespace-nowrap px-4 py-3">
										<span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900 dark:text-green-300">
											Complete
										</span>
									</td>
								</tr>
								<tr>
									<td className="whitespace-nowrap px-4 py-3">interview_sam_taylor.mp3</td>
									<td className="whitespace-nowrap px-4 py-3">2025-07-05</td>
									<td className="whitespace-nowrap px-4 py-3">
										<span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
											Processing
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
					<h3 className="mb-4 font-medium text-lg">Upload Tips</h3>
					<ul className="space-y-3 text-gray-600 dark:text-gray-400">
						<li className="flex items-start">
							<span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
								1
							</span>
							<span>Ensure recordings have clear audio quality for best results</span>
						</li>
						<li className="flex items-start">
							<span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
								2
							</span>
							<span>For transcripts, include speaker labels (e.g., "Interviewer:", "Participant:")</span>
						</li>
						<li className="flex items-start">
							<span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
								3
							</span>
							<span>Add participant metadata (role, demographics) for better insights</span>
						</li>
						<li className="flex items-start">
							<span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
								4
							</span>
							<span>Processing time varies based on file size and format</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	)
}
