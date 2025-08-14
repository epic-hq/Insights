import { Dialog, Transition } from "@headlessui/react"
import { Fragment, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useNavigate } from "react-router-dom"
import { useNotification } from "~/contexts/NotificationContext"
import type { ProcessingResult } from "~/utils/processInterview.server"

interface AddInterviewProps {
	open: boolean
	onClose: () => void
	onSuccess?: (result: ProcessingResult) => void
	accountId: string
	projectId: string
}

export default function AddInterview({ open, onClose, onSuccess, accountId, projectId }: AddInterviewProps) {
	const [isProcessing, setIsProcessing] = useState(false)
	const [processingMessage, setProcessingMessage] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const { showNotification } = useNotification()
	const _navigate = useNavigate()

	const handleFileUpload = async (files: File[]) => {
		if (!files.length) return

		const file = files[0]
		setSelectedFile(file)
		setError(null)
		setIsProcessing(true)
		setProcessingMessage("Uploading file...")

		try {
			const formData = new FormData()
			formData.append("file", file)

			// TODO: Get accountId and projectId from AuthContext
			formData.append("accountId", accountId)
			formData.append("projectId", projectId)
			formData.append("userCustomInstructions", "")

			setProcessingMessage("Processing transcript with AI...")
			const response = await fetch("/api/upload-file", {
				method: "POST",
				body: formData,
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
				throw new Error(errorData.error || `HTTP ${response.status}`)
			}

			const result: ProcessingResult = await response.json()

			setProcessingMessage("Processing complete!")

			// Store results for debugging (accessible via window object in dev tools)
			if (typeof window !== "undefined") {
				;(window as any).lastProcessingResult = result
			}

			// Call success callback if provided
			onSuccess?.(result)

			// Close modal after brief delay
			setTimeout(() => {
				onClose()
				setIsProcessing(false)
				setSelectedFile(null)
				setProcessingMessage("")
			}, 1500)
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
			setError(errorMessage)
			setIsProcessing(false)
			setProcessingMessage("")

			// Show error notification
			showNotification(`Upload failed: ${errorMessage}`, "error", 6000)

			// Store error for debugging (accessible via window object in dev tools)
			if (typeof window !== "undefined") {
				;(window as any).lastUploadError = err
			}
		}
	}

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleFileUpload,
		accept: {
			"text/*": [".txt", ".md"],
			"audio/*": [".mp3", ".wav", ".m4a"],
			"video/*": [".mp4", ".mov", ".avi"],
		},
		multiple: false,
		disabled: isProcessing,
	})

	const handleClose = () => {
		if (!isProcessing) {
			onClose()
			setError(null)
			setSelectedFile(null)
			setProcessingMessage("")
		}
	}

	return (
		<Transition.Root show={open} as={Fragment}>
			<Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={handleClose}>
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
						<div className="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all dark:bg-gray-800">
							<Dialog.Title className="mb-6 font-medium text-gray-900 text-lg dark:text-gray-200">
								Add Interview
							</Dialog.Title>

							{/* Error Message */}
							{error && (
								<div className="mb-4 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
									<div className="flex">
										<div className="mr-3 text-red-400 text-xl">⚠️</div>
										<div>
											<h3 className="font-medium text-red-800 text-sm dark:text-red-200">Processing Error</h3>
											<p className="mt-1 text-red-700 text-sm dark:text-red-300">{error}</p>
										</div>
									</div>
								</div>
							)}
							{/* <Input
								type="text"
								placeholder="Enter URL"
								value={mediaUrl}
								onChange={(e) => setMediaUrl(e.target.value)}
							/> */}

							<div
								{...getRootProps()}
								className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors ${
									isDragActive
										? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
										: "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
								} ${isProcessing ? "cursor-not-allowed opacity-50" : ""}`}
							>
								<input {...getInputProps()} disabled={isProcessing} />
								{selectedFile && !isProcessing ? (
									<div className="text-center">
										<div className="mb-2 text-2xl text-green-600">📄</div>
										<p className="font-medium text-gray-700 text-sm dark:text-gray-300">{selectedFile.name}</p>
										<p className="text-gray-500 text-xs dark:text-gray-400">Ready to process</p>
									</div>
								) : isProcessing ? (
									<div className="text-center">
										<div className="mb-2 text-2xl text-blue-600">⚡</div>
										<p className="font-medium text-gray-700 text-sm dark:text-gray-300">Processing...</p>
										<p className="text-gray-500 text-xs dark:text-gray-400">
											{processingMessage || "Extracting insights and metadata"}
										</p>
									</div>
								) : (
									<div className="text-center">
										<div className="mb-3 text-3xl text-gray-400">📄</div>
										<p className="mb-1 font-medium text-gray-700 text-sm dark:text-gray-300">
											{isDragActive ? "Drop file here" : "Drop transcript file here or click to browse"}
										</p>
										<p className="text-gray-500 text-xs dark:text-gray-400">
											Supports .txt, .md, audio (.mp3, .wav, .m4a), and video (.mp4, .mov, .avi) files
										</p>
									</div>
								)}
							</div>

							{/* Processing Status */}
							{isProcessing && (
								<div className="mb-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
									<div className="flex items-center">
										<div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
										<div>
											<p className="font-medium text-blue-900 text-sm dark:text-blue-100">
												{processingMessage || "Processing transcript..."}
											</p>
											<p className="text-blue-700 text-xs dark:text-blue-300">
												Extracting insights and metadata from your interview
											</p>
										</div>
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="mt-6 flex justify-end">
								<button
									onClick={handleClose}
									disabled={isProcessing}
									className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								>
									Cancel
								</button>
							</div>
						</div>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition.Root>
	)
}
