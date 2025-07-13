import { Dialog, Transition } from "@headlessui/react"
import { type ChangeEvent, Fragment, useState } from "react"
import { useDropzone } from "react-dropzone"

interface UploadModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (payload: {
		files: File[]
		title: string
		date: string
		tags: string[]
		speakerA: string
		speakerB: string
		intervieweeName?: string
		segment?: string
		recruitmentSource?: string
		scriptVersion?: string
	}) => void
	// These props are optional as they're managed internally with useState
	files?: File[]
	title?: string
	date?: string
	tags?: string[]
	speakerA?: string
	speakerB?: string
	intervieweeName?: string
	segment?: string
	recruitmentSource?: string
	scriptVersion?: string
}

// Simplified to just use default speaker labels
const speakerLabels = {
	speakerA: "Interviewer",
	speakerB: "Interviewee",
}

export default function UploadModal({
	open,
	onClose,
	onSubmit,
	files: initialFiles,
	title: initialTitle,
	date: initialDate,
	tags: initialTags,
	speakerA: initialSpeakerA,
	speakerB: initialSpeakerB,
	intervieweeName: initialIntervieweeName,
	segment: initialSegment,
	recruitmentSource: initialRecruitmentSource,
	scriptVersion: initialScriptVersion,
}: UploadModalProps) {
	const [files, setFiles] = useState<File[]>(initialFiles || [])
	const [title, setTitle] = useState(initialTitle || "")
	const [date, setDate] = useState<string>(initialDate || new Date().toISOString().substring(0, 10))
	const [tags, setTags] = useState<string>(initialTags ? initialTags.join(", ") : "")
	const [speakerA, setSpeakerA] = useState(initialSpeakerA || speakerLabels.speakerA)
	const [speakerB, setSpeakerB] = useState(initialSpeakerB || speakerLabels.speakerB)

	// Function to swap speakers - works as a toggle
	const swapSpeakers = () => {
		// Check current values and swap accordingly
		if (speakerA === speakerLabels.speakerA) {
			// If in default position, swap them
			setSpeakerA(speakerLabels.speakerB)
			setSpeakerB(speakerLabels.speakerA)
		} else {
			// If already swapped, restore default
			setSpeakerA(speakerLabels.speakerA)
			setSpeakerB(speakerLabels.speakerB)
		}
	}
	const [intervieweeName, setIntervieweeName] = useState(initialIntervieweeName || "")
	const [segment, setSegment] = useState(initialSegment || "")
	const [recruitmentSource, setRecruitmentSource] = useState(initialRecruitmentSource || "")
	const [scriptVersion, setScriptVersion] = useState(initialScriptVersion || "")

	const onDrop = (accepted: File[]) => setFiles(accepted)
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: { "audio/*": [], "video/*": [] },
		multiple: true,
	})

	const handleSubmit = () => {
		if (!files.length) return
		onSubmit({
			files,
			title,
			date,
			tags: tags
				.split(",")
				.map((t: string) => t.trim())
				.filter(Boolean),
			speakerA,
			speakerB,
			intervieweeName,
			segment,
			recruitmentSource,
			scriptVersion,
		})
		onClose()
	}

	return (
		<Transition.Root show={open} as={Fragment}>
			<Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
				<div className="flex min-h-screen items-center justify-center p-4 text-center">
					<Transition.Child
						as={Fragment}
						enter="ease-out duration-300"
						enterFrom="opacity-0"
						enterTo="opacity-100"
						leave="ease-in duration-200"
						leaveFrom="opacity-100"
						leaveTo="opacity-0"
					>
						<div className="fixed inset-0 bg-gray-900/75" />
					</Transition.Child>
					<Transition.Child
						as={Fragment}
						enter="ease-out duration-300"
						enterFrom="opacity-0 scale-95"
						enterTo="opacity-100 scale-100"
						leave="ease-in duration-200"
						leaveFrom="opacity-100 scale-100"
						leaveTo="opacity-0 scale-95"
					>
						<div className="relative w-full max-w-3xl transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all dark:bg-gray-800">
							<Dialog.Title className="mb-4 font-medium text-gray-900 text-lg dark:text-gray-200">
								Upload Interview
							</Dialog.Title>

							{/* File Dropzone */}
							<div
								{...getRootProps()}
								className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 ${isDragActive ? "border-blue-500" : "border-gray-300 dark:border-gray-600"} mb-4`}
							>
								<input {...getInputProps()} />
								{files.length ? (
									<p className="text-gray-700 text-sm dark:text-gray-300">
										{files.map((f: File) => f.name).join(", ")}
									</p>
								) : (
									<p className="text-gray-500 text-sm dark:text-gray-400">
										Drag & drop audio/video here, or click to browse
									</p>
								)}
							</div>

							{/* Metadata - Grouped into sections with grid layout */}
							<div className="mb-4">
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									{/* Interview Details Section */}
									<div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
										<h3 className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">Interview Details</h3>
										<div className="space-y-3">
											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">Title</label>
												<input
													type="text"
													value={title}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>

											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">Date</label>
												<input
													type="date"
													value={date}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>

											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Script Version
												</label>
												<input
													type="text"
													value={scriptVersion}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setScriptVersion(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
										</div>
									</div>

									{/* Participant Information Section */}
									<div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
										<h3 className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">
											Participant Information
										</h3>
										<div className="space-y-3">
											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Interviewee Name
												</label>
												<input
													type="text"
													value={intervieweeName}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setIntervieweeName(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>

											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Segment/Role
												</label>
												<input
													type="text"
													value={segment}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setSegment(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>

											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Recruitment Source
												</label>
												<input
													type="text"
													value={recruitmentSource}
													onChange={(e: ChangeEvent<HTMLInputElement>) => setRecruitmentSource(e.target.value)}
													className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
												/>
											</div>
										</div>
									</div>
								</div>

								{/* Classification and Speakers in a row */}
								<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
									{/* Classification Section */}
									<div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
										<h3 className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">Classification</h3>
										<div>
											<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
												Tags (comma-separated)
											</label>
											<input
												type="text"
												value={tags}
												onChange={(e: ChangeEvent<HTMLInputElement>) => setTags(e.target.value)}
												className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
											/>
										</div>
									</div>

									{/* Speaker labels - simplified */}
									<div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
										<div className="mb-3 flex items-center justify-between">
											<h3 className="font-medium text-gray-900 text-sm dark:text-gray-100">Speakers</h3>
											<button
												type="button"
												onClick={swapSpeakers}
												className="flex items-center rounded bg-blue-100 px-2 py-1 text-blue-700 text-xs hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													className="mr-1 h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
													/>
												</svg>
												Swap Speakers
											</button>
										</div>
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Speaker A
												</label>
												<input
													type="text"
													value={speakerA}
													disabled
													className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
												/>
											</div>
											<div>
												<label className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300">
													Speaker B
												</label>
												<input
													type="text"
													value={speakerB}
													disabled
													className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
												/>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="mt-6 flex justify-end space-x-3">
								<button onClick={onClose} className="rounded-md border px-4 py-2 text-sm dark:border-gray-600">
									Cancel
								</button>
								<button
									onClick={handleSubmit}
									disabled={!files.length}
									className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
								>
									Upload & Process
								</button>
							</div>
						</div>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition.Root>
	)
}
