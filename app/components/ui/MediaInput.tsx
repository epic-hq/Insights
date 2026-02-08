/**
 * MediaInput - Flexible media upload component
 *
 * Supports:
 * - Drag and drop file upload
 * - Click to select file
 * - URL paste for external images
 * - Multiple layout modes (avatar, card, inline)
 * - R2 storage integration
 * - Preview with loading states
 */

import { Camera, Globe, Link2, Loader2, Trash2, Upload, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type MediaInputMode = "avatar" | "card" | "inline";

interface MediaInputProps {
	/** Name for the hidden input field */
	name: string;
	/** Current image URL or R2 key */
	defaultValue?: string | null;
	/** Category for R2 storage path */
	category?: string;
	/** Entity ID for R2 storage path */
	entityId?: string;
	/** Layout mode */
	mode?: MediaInputMode;
	/** Size for avatar mode */
	size?: "sm" | "md" | "lg" | "xl";
	/** Whether the upload is circular (for avatars) */
	circular?: boolean;
	/** Label text */
	label?: string;
	/** Hint text below the uploader */
	hint?: string;
	/** Placeholder when no image */
	placeholder?: "user" | "camera" | "upload";
	/** Accept only images or any files */
	accept?: "image" | "any";
	/** Maximum file size in bytes */
	maxSize?: number;
	/** Allow URL input */
	allowUrl?: boolean;
	/** Additional class names */
	className?: string;
	/** Callback when media is uploaded/changed */
	onChange?: (value: string | null, type: "file" | "url") => void;
	/** Callback when media is removed */
	onRemove?: () => void;
}

const sizeClasses = {
	sm: "h-16 w-16",
	md: "h-24 w-24",
	lg: "h-32 w-32",
	xl: "h-40 w-40",
};

const iconSizeClasses = {
	sm: "h-6 w-6",
	md: "h-8 w-8",
	lg: "h-10 w-10",
	xl: "h-12 w-12",
};

export function MediaInput({
	name,
	defaultValue,
	category = "uploads",
	entityId,
	mode = "avatar",
	size = "md",
	circular = true,
	label,
	hint,
	placeholder = "user",
	accept = "image",
	maxSize = 10 * 1024 * 1024, // 10MB default
	allowUrl = true,
	className,
	onChange,
	onRemove,
}: MediaInputProps) {
	const [value, setValue] = useState<string | null>(defaultValue || null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isLoadingUrl, setIsLoadingUrl] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [urlInputOpen, setUrlInputOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Fetch presigned URL for R2 keys
	useEffect(() => {
		if (defaultValue?.startsWith("images/") && !previewUrl) {
			setIsLoadingUrl(true);
			fetch(`/api/upload-image?key=${encodeURIComponent(defaultValue)}`)
				.then((res) => res.json())
				.then((data) => {
					if (data.success && data.url) {
						setPreviewUrl(data.url);
					}
				})
				.catch(() => {
					// Silently fail - will show placeholder
				})
				.finally(() => {
					setIsLoadingUrl(false);
				});
		}
	}, [defaultValue, previewUrl]);

	// Display URL: use fetched/uploaded preview, or direct URL if not an R2 key
	const displayUrl = previewUrl || (value?.startsWith("images/") ? null : value);

	const handleFileUpload = useCallback(
		async (file: File) => {
			// Validate file type
			if (accept === "image" && !file.type.startsWith("image/")) {
				setError("Please select an image file");
				return;
			}

			// Validate file size
			if (file.size > maxSize) {
				setError(`File must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
				return;
			}

			setError(null);
			setIsUploading(true);

			// Create local preview for images
			if (file.type.startsWith("image/")) {
				const localPreview = URL.createObjectURL(file);
				setPreviewUrl(localPreview);
			}

			try {
				const params = new URLSearchParams({
					category,
					...(entityId && { entityId }),
				});

				const formData = new FormData();
				formData.append("file", file);

				const response = await fetch(`/api/upload-image?${params}`, {
					method: "POST",
					body: formData,
				});

				const result = await response.json();

				if (!response.ok || !result.success) {
					throw new Error(result.error || "Upload failed");
				}

				setValue(result.imageKey);
				setPreviewUrl(result.url);
				onChange?.(result.imageKey, "file");
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
				setPreviewUrl(null);
			} finally {
				setIsUploading(false);
			}
		},
		[category, entityId, maxSize, accept, onChange]
	);

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			const file = acceptedFiles[0];
			if (file) {
				handleFileUpload(file);
			}
		},
		[handleFileUpload]
	);

	const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
		onDrop,
		accept: accept === "image" ? { "image/*": [] } : undefined,
		maxSize,
		multiple: false,
		noClick: mode === "avatar", // Avatar mode uses separate click handling
	});

	const handleUrlSubmit = useCallback(() => {
		const trimmedUrl = urlInput.trim();
		if (!trimmedUrl) return;

		// Basic URL validation
		try {
			new URL(trimmedUrl);
		} catch {
			setError("Please enter a valid URL");
			return;
		}

		setValue(trimmedUrl);
		setPreviewUrl(trimmedUrl);
		setUrlInputOpen(false);
		setUrlInput("");
		setError(null);
		onChange?.(trimmedUrl, "url");
	}, [urlInput, onChange]);

	const handleRemove = useCallback(() => {
		setValue(null);
		setPreviewUrl(null);
		setError(null);
		setUrlInput("");
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		onRemove?.();
		onChange?.(null, "file");
	}, [onRemove, onChange]);

	const handleClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const PlaceholderIcon = placeholder === "camera" ? Camera : placeholder === "upload" ? Upload : User;

	// Avatar mode - compact circular/square display
	if (mode === "avatar") {
		return (
			<div className={cn("space-y-2", className)}>
				{label && <Label className="block font-medium text-sm">{label}</Label>}

				<div className="flex items-center gap-4">
					{/* Avatar preview with drag zone */}
					<div
						{...getRootProps()}
						onClick={handleClick}
						className={cn(
							"relative flex cursor-pointer items-center justify-center overflow-hidden border-2 transition-colors",
							sizeClasses[size],
							circular ? "rounded-full" : "rounded-lg",
							isDragActive && !isDragReject && "border-primary bg-primary/10",
							isDragReject && "border-destructive bg-destructive/10",
							!isDragActive &&
								"border-muted-foreground/25 border-dashed bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted"
						)}
					>
						<input {...getInputProps()} ref={fileInputRef} />

						{isUploading || isLoadingUrl ? (
							<Loader2 className={cn("animate-spin text-muted-foreground", iconSizeClasses[size])} />
						) : displayUrl ? (
							<img src={displayUrl} alt="Preview" className="h-full w-full object-cover" />
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
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-2">
						<div className="flex gap-2">
							<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isUploading}>
								{isUploading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Uploading...
									</>
								) : (
									<>
										<Upload className="mr-2 h-4 w-4" />
										{value ? "Change" : "Upload"}
									</>
								)}
							</Button>

							{allowUrl && (
								<Popover open={urlInputOpen} onOpenChange={setUrlInputOpen}>
									<PopoverTrigger asChild>
										<Button type="button" variant="outline" size="sm" disabled={isUploading}>
											<Link2 className="h-4 w-4" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-80" align="start">
										<div className="space-y-2">
											<Label className="text-sm">Image URL</Label>
											<div className="flex gap-2">
												<Input
													placeholder="https://..."
													value={urlInput}
													onChange={(e) => setUrlInput(e.target.value)}
													onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
												/>
												<Button size="sm" onClick={handleUrlSubmit}>
													<Globe className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</PopoverContent>
								</Popover>
							)}
						</div>

						{value && (
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
				<input type="hidden" name={name} value={value || ""} />

				{/* Error message */}
				{error && <p className="text-destructive text-sm">{error}</p>}

				{/* Hint text */}
				{hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
			</div>
		);
	}

	// Card mode - larger dropzone with preview
	if (mode === "card") {
		return (
			<div className={cn("space-y-2", className)}>
				{label && <Label className="block font-medium text-sm">{label}</Label>}

				<div
					{...getRootProps()}
					className={cn(
						"relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
						isDragActive && !isDragReject && "border-primary bg-primary/10",
						isDragReject && "border-destructive bg-destructive/10",
						!isDragActive && "border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/50 hover:bg-muted/50"
					)}
				>
					<input {...getInputProps()} ref={fileInputRef} />

					{isUploading || isLoadingUrl ? (
						<div className="flex flex-col items-center gap-2">
							<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
							<p className="text-muted-foreground text-sm">Uploading...</p>
						</div>
					) : displayUrl ? (
						<div className="relative">
							<img src={displayUrl} alt="Preview" className="max-h-[160px] rounded-lg object-contain" />
							<Button
								type="button"
								variant="secondary"
								size="icon"
								className="-top-2 -right-2 absolute h-6 w-6"
								onClick={(e) => {
									e.stopPropagation();
									handleRemove();
								}}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					) : (
						<div className="flex flex-col items-center gap-3 text-center">
							<Upload className="h-10 w-10 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">Drop files here or click to upload</p>
								<p className="text-muted-foreground text-xs">
									{accept === "image" ? "PNG, JPG, GIF up to " : "Files up to "}
									{Math.round(maxSize / 1024 / 1024)}MB
								</p>
							</div>
							{allowUrl && (
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<span>or</span>
									<button
										type="button"
										className="text-primary underline hover:no-underline"
										onClick={(e) => {
											e.stopPropagation();
											setUrlInputOpen(true);
										}}
									>
										paste a URL
									</button>
								</div>
							)}
						</div>
					)}
				</div>

				{/* URL input popover for card mode */}
				{allowUrl && (
					<Popover open={urlInputOpen} onOpenChange={setUrlInputOpen}>
						<PopoverTrigger asChild>
							<span />
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-2">
								<Label className="text-sm">Image URL</Label>
								<div className="flex gap-2">
									<Input
										placeholder="https://..."
										value={urlInput}
										onChange={(e) => setUrlInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
									/>
									<Button size="sm" onClick={handleUrlSubmit}>
										Add
									</Button>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				)}

				{/* Hidden input for form submission */}
				<input type="hidden" name={name} value={value || ""} />

				{/* Error message */}
				{error && <p className="text-destructive text-sm">{error}</p>}

				{/* Hint text */}
				{hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
			</div>
		);
	}

	// Inline mode - compact horizontal layout
	return (
		<div className={cn("space-y-2", className)}>
			{label && <Label className="block font-medium text-sm">{label}</Label>}

			<div className="flex items-center gap-3">
				{displayUrl && (
					<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
						<img src={displayUrl} alt="Preview" className="h-full w-full object-cover" />
					</div>
				)}

				<div
					{...getRootProps()}
					className={cn(
						"flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 transition-colors",
						isDragActive && !isDragReject && "border-primary bg-primary/10",
						isDragReject && "border-destructive bg-destructive/10",
						!isDragActive && "border-input hover:border-primary/50"
					)}
				>
					<input {...getInputProps()} ref={fileInputRef} />
					{isUploading ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-muted-foreground text-sm">Uploading...</span>
						</>
					) : (
						<>
							<Upload className="h-4 w-4 text-muted-foreground" />
							<span className="text-muted-foreground text-sm">Drop or click to upload</span>
						</>
					)}
				</div>

				{allowUrl && (
					<Popover open={urlInputOpen} onOpenChange={setUrlInputOpen}>
						<PopoverTrigger asChild>
							<Button type="button" variant="outline" size="icon" disabled={isUploading}>
								<Link2 className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80" align="end">
							<div className="space-y-2">
								<Label className="text-sm">Image URL</Label>
								<div className="flex gap-2">
									<Input
										placeholder="https://..."
										value={urlInput}
										onChange={(e) => setUrlInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
									/>
									<Button size="sm" onClick={handleUrlSubmit}>
										Add
									</Button>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				)}

				{value && (
					<Button type="button" variant="ghost" size="icon" onClick={handleRemove} disabled={isUploading}>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				)}
			</div>

			{/* Hidden input for form submission */}
			<input type="hidden" name={name} value={value || ""} />

			{/* Error message */}
			{error && <p className="text-destructive text-sm">{error}</p>}

			{/* Hint text */}
			{hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
		</div>
	);
}

export default MediaInput;
