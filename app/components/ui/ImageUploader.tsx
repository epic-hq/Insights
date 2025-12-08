/**
 * ImageUploader - Image file upload component
 *
 * Handles image selection, preview, and upload to R2.
 * Returns the R2 key via a hidden input for form submission.
 */

import { Camera, Loader2, Trash2, Upload, User } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface ImageUploaderProps {
	/** Name for the hidden input field */
	name: string
	/** Current image URL or R2 key */
	defaultValue?: string | null
	/** Category for R2 storage path */
	category?: string
	/** Entity ID for R2 storage path */
	entityId?: string
	/** Placeholder icon when no image */
	placeholder?: "user" | "camera" | "upload"
	/** Size of the preview */
	size?: "sm" | "md" | "lg"
	/** Whether the upload is circular (for avatars) */
	circular?: boolean
	/** Label text */
	label?: string
	/** Hint text below the uploader */
	hint?: string
	/** Additional class names */
	className?: string
	/** Callback when image is uploaded */
	onUpload?: (imageKey: string, url: string) => void
	/** Callback when image is removed */
	onRemove?: () => void
}

const sizeClasses = {
	sm: "h-16 w-16",
	md: "h-24 w-24",
	lg: "h-32 w-32",
}

const iconSizeClasses = {
	sm: "h-6 w-6",
	md: "h-8 w-8",
	lg: "h-10 w-10",
}

export function ImageUploader({
	name,
	defaultValue,
	category = "uploads",
	entityId,
	placeholder = "user",
	size = "md",
	circular = true,
	label,
	hint,
	className,
	onUpload,
	onRemove,
}: ImageUploaderProps) {
	const [imageKey, setImageKey] = useState<string | null>(defaultValue || null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [isUploading, setIsUploading] = useState(false)
	const [isLoadingUrl, setIsLoadingUrl] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// If we have a default value that looks like an R2 key, fetch its presigned URL
	useEffect(() => {
		if (defaultValue?.startsWith("images/") && !previewUrl) {
			setIsLoadingUrl(true)
			fetch(`/api/upload-image?key=${encodeURIComponent(defaultValue)}`)
				.then((res) => res.json())
				.then((data) => {
					if (data.success && data.url) {
						setPreviewUrl(data.url)
					}
				})
				.catch(() => {
					// Silently fail - will show placeholder
				})
				.finally(() => {
					setIsLoadingUrl(false)
				})
		}
	}, [defaultValue, previewUrl])

	// Display URL: use fetched/uploaded preview, or direct URL if not an R2 key
	const displayUrl = previewUrl || (defaultValue?.startsWith("images/") ? null : defaultValue)

	const handleFileSelect = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]
			if (!file) return

			// Validate file type
			if (!file.type.startsWith("image/")) {
				setError("Please select an image file")
				return
			}

			// Validate file size (10MB)
			if (file.size > 10 * 1024 * 1024) {
				setError("Image must be less than 10MB")
				return
			}

			setError(null)
			setIsUploading(true)

			// Create local preview
			const localPreview = URL.createObjectURL(file)
			setPreviewUrl(localPreview)

			try {
				// Build upload URL
				const params = new URLSearchParams({
					category,
					...(entityId && { entityId }),
				})

				const formData = new FormData()
				formData.append("file", file)

				const response = await fetch(`/api/upload-image?${params}`, {
					method: "POST",
					body: formData,
				})

				const result = await response.json()

				if (!response.ok || !result.success) {
					throw new Error(result.error || "Upload failed")
				}

				setImageKey(result.imageKey)
				setPreviewUrl(result.url)
				onUpload?.(result.imageKey, result.url)
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed")
				setPreviewUrl(null)
				URL.revokeObjectURL(localPreview)
			} finally {
				setIsUploading(false)
			}
		},
		[category, entityId, onUpload]
	)

	const handleRemove = useCallback(() => {
		setImageKey(null)
		setPreviewUrl(null)
		setError(null)
		if (inputRef.current) {
			inputRef.current.value = ""
		}
		onRemove?.()
	}, [onRemove])

	const handleClick = useCallback(() => {
		inputRef.current?.click()
	}, [])

	const PlaceholderIcon = placeholder === "camera" ? Camera : placeholder === "upload" ? Upload : User

	return (
		<div className={cn("space-y-2", className)}>
			{label && <label className="block font-medium text-sm">{label}</label>}

			<div className="flex items-center gap-4">
				{/* Image preview / upload button */}
				<button
					type="button"
					onClick={handleClick}
					disabled={isUploading}
					className={cn(
						"relative flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
						sizeClasses[size],
						circular ? "rounded-full" : "rounded-lg"
					)}
				>
					{isUploading || isLoadingUrl ? (
						<Loader2 className={cn("animate-spin text-muted-foreground", iconSizeClasses[size])} />
					) : displayUrl || previewUrl ? (
						<img
							src={previewUrl || displayUrl || ""}
							alt="Preview"
							className="h-full w-full object-cover"
						/>
					) : (
						<PlaceholderIcon className={cn("text-muted-foreground/50", iconSizeClasses[size])} />
					)}

					{/* Hover overlay */}
					{!isUploading && (
						<div
							className={cn(
								"absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100",
								circular ? "rounded-full" : "rounded-lg"
							)}
						>
							<Camera className="h-5 w-5 text-white" />
						</div>
					)}
				</button>

				{/* Actions */}
				<div className="flex flex-col gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleClick}
						disabled={isUploading}
					>
						{isUploading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Uploading...
							</>
						) : (
							<>
								<Upload className="mr-2 h-4 w-4" />
								{imageKey || defaultValue ? "Change" : "Upload"}
							</>
						)}
					</Button>

					{(imageKey || defaultValue) && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleRemove}
							disabled={isUploading}
							className="text-destructive hover:text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove
						</Button>
					)}
				</div>
			</div>

			{/* Hidden input for form submission */}
			<input type="hidden" name={name} value={imageKey || ""} />

			{/* File input (hidden) */}
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				onChange={handleFileSelect}
				className="hidden"
			/>

			{/* Error message */}
			{error && <p className="text-destructive text-sm">{error}</p>}

			{/* Hint text */}
			{hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
		</div>
	)
}

export default ImageUploader
