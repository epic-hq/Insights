/**
 * FileUploadButton - A compact file upload button for chat interfaces.
 *
 * Supports CSV files for contact/data import. When a file is selected,
 * it reads the content and calls onFileContent with the text for the agent to process.
 */
import { Plus } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

interface FileUploadButtonProps {
	onFileContent: (content: string, fileName: string, fileType: string) => void
	disabled?: boolean
	className?: string
	/** Maximum file size in MB (default: 5MB) */
	maxSizeMB?: number
}

const ACCEPTED_TYPES = {
	"text/csv": "csv",
	"text/tab-separated-values": "tsv",
	"application/vnd.ms-excel": "csv",
	"text/plain": "txt",
} as const

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt"]

export function FileUploadButton({
	onFileContent,
	disabled = false,
	className,
	maxSizeMB = 5,
}: FileUploadButtonProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleClick = () => {
		if (!disabled && !isLoading) {
			inputRef.current?.click()
		}
	}

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		// Reset error state
		setError(null)

		// Validate file size
		const maxBytes = maxSizeMB * 1024 * 1024
		if (file.size > maxBytes) {
			setError(`File too large. Maximum size is ${maxSizeMB}MB.`)
			// Reset input so same file can be selected again
			if (inputRef.current) inputRef.current.value = ""
			return
		}

		// Validate file type
		const ext = "." + file.name.split(".").pop()?.toLowerCase()
		const isAcceptedExt = ACCEPTED_EXTENSIONS.includes(ext)
		const isAcceptedMime = file.type in ACCEPTED_TYPES

		if (!isAcceptedExt && !isAcceptedMime) {
			setError(`Unsupported file type. Please upload a CSV, TSV, or TXT file.`)
			if (inputRef.current) inputRef.current.value = ""
			return
		}

		setIsLoading(true)

		try {
			const content = await readFileAsText(file)
			const fileType = ACCEPTED_TYPES[file.type as keyof typeof ACCEPTED_TYPES] || ext.slice(1)
			onFileContent(content, file.name, fileType)
		} catch (err) {
			setError("Failed to read file. Please try again.")
		} finally {
			setIsLoading(false)
			// Reset input so same file can be selected again
			if (inputRef.current) inputRef.current.value = ""
		}
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleClick}
						disabled={disabled || isLoading}
						className={cn("h-8 w-8", className)}
						aria-label="Upload file"
					>
						<Plus className={cn("h-4 w-4", isLoading && "animate-pulse")} />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top">
					{error ? (
						<p className="text-destructive">{error}</p>
					) : (
						<p>Upload CSV to import contacts</p>
					)}
				</TooltipContent>
			</Tooltip>
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED_EXTENSIONS.join(",")}
				onChange={handleFileChange}
				className="hidden"
				aria-hidden="true"
			/>
		</TooltipProvider>
	)
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result)
			} else {
				reject(new Error("Failed to read file as text"))
			}
		}
		reader.onerror = () => reject(reader.error)
		reader.readAsText(file)
	})
}
