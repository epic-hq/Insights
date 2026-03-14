/**
 * Multi-file upload modal.
 *
 * Supports drag-and-drop of multiple files. Shows a file queue with
 * per-file status indicators, validates types, and sends the batch
 * to /api/upload-files for background processing.
 */

import { AlertCircle, CheckCircle2, FileAudio, FileText, FileVideo, Loader2, Upload, X } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";
import type { BatchUploadResponse, MultiFileItem, MultiFileStatus } from "~/features/upload/types";
import { useMultiFileUpload } from "~/features/upload/hooks/useMultiFileUpload";

interface MultiFileUploadModalProps {
	open: boolean;
	onClose: () => void;
	onComplete?: (response: BatchUploadResponse) => void;
	projectId: string;
	accountId: string;
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

function getFileIcon(file: File) {
	if (file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv)$/i.test(file.name)) {
		return <FileVideo className="h-4 w-4 text-purple-500" />;
	}
	if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|webm)$/i.test(file.name)) {
		return <FileAudio className="h-4 w-4 text-blue-500" />;
	}
	return <FileText className="h-4 w-4 text-gray-500" />;
}

function getStatusBadge(status: MultiFileStatus, error: string | null) {
	switch (status) {
		case "pending":
			return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 text-xs dark:bg-gray-700 dark:text-gray-400">Ready</span>;
		case "optimizing":
			return (
				<span className="flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
					<Loader2 className="h-3 w-3 animate-spin" /> Optimizing
				</span>
			);
		case "uploading":
			return (
				<span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-400">
					<Loader2 className="h-3 w-3 animate-spin" /> Uploading
				</span>
			);
		case "queued":
			return (
				<span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400">
					<CheckCircle2 className="h-3 w-3" /> Processing
				</span>
			);
		case "error":
			return (
				<span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700 text-xs dark:bg-red-900/30 dark:text-red-400" title={error || undefined}>
					<AlertCircle className="h-3 w-3" /> Failed
				</span>
			);
	}
}

function FileListItem({
	item,
	onRemove,
	disabled,
}: {
	item: MultiFileItem;
	onRemove: (id: string) => void;
	disabled: boolean;
}) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
			{getFileIcon(item.file)}
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm" title={item.file.name}>
					{item.file.name}
				</p>
				<p className="text-muted-foreground text-xs">{formatFileSize(item.file.size)}</p>
			</div>
			{getStatusBadge(item.status, item.error)}
			{!disabled && item.status === "pending" && (
				<button
					type="button"
					onClick={() => onRemove(item.id)}
					className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label={`Remove ${item.file.name}`}
				>
					<X className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}

export default function MultiFileUploadModal({
	open,
	onClose,
	onComplete,
	projectId,
	accountId,
}: MultiFileUploadModalProps) {
	const {
		files,
		isUploading,
		error,
		addFiles,
		removeFile,
		reset,
		upload,
		acceptedTypes,
		maxFiles,
	} = useMultiFileUpload({
		projectId,
		accountId,
		onComplete,
	});

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: addFiles,
		accept: acceptedTypes,
		multiple: true,
		disabled: isUploading,
		noClick: files.length > 0,
	});

	const handleClose = useCallback(() => {
		if (!isUploading) {
			reset();
			onClose();
		}
	}, [isUploading, reset, onClose]);

	const allQueued = files.length > 0 && files.every((f) => f.status === "queued" || f.status === "error");
	const queuedCount = files.filter((f) => f.status === "queued").length;
	const failedCount = files.filter((f) => f.status === "error").length;
	const uploadProgress = isUploading ? undefined : allQueued ? 100 : 0;

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Upload Interviews</DialogTitle>
					<DialogDescription>
						Drop multiple files to process them in parallel. Text, audio, and video files are supported.
					</DialogDescription>
				</DialogHeader>

				{/* Error banner */}
				{error && (
					<div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
						<p className="text-red-700 text-sm dark:text-red-300">{error}</p>
					</div>
				)}

				{/* Dropzone */}
				<div
					{...getRootProps()}
					className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
						isDragActive
							? "border-primary bg-primary/5"
							: files.length > 0
								? "border-border bg-muted/30"
								: "border-muted-foreground/25 hover:border-muted-foreground/50"
					} ${isUploading ? "pointer-events-none opacity-50" : ""}`}
				>
					<input {...getInputProps()} disabled={isUploading} />

					{files.length === 0 ? (
						<div className="text-center">
							<Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
							<p className="mb-1 font-medium text-sm">
								{isDragActive ? "Drop files here" : "Drop files here or click to browse"}
							</p>
							<p className="text-muted-foreground text-xs">
								Up to {maxFiles} files. Supports text (.txt, .md, .pdf), audio (.mp3, .wav, .m4a), video (.mp4, .mov)
							</p>
						</div>
					) : (
						<div className="w-full text-center">
							<p className="text-muted-foreground text-xs">
								{isDragActive ? "Drop to add more files" : "Drag more files here to add them"}
							</p>
						</div>
					)}
				</div>

				{/* File list */}
				{files.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="font-medium text-sm">
								{files.length} file{files.length !== 1 ? "s" : ""}
								{allQueued && (
									<span className="ml-2 text-muted-foreground">
										({queuedCount} processing{failedCount > 0 ? `, ${failedCount} failed` : ""})
									</span>
								)}
							</p>
							{!isUploading && !allQueued && files.length > 0 && (
								<Button variant="ghost" size="sm" onClick={reset} className="text-xs">
									Clear all
								</Button>
							)}
						</div>

						{/* Upload progress bar */}
						{isUploading && (
							<Progress className="h-1.5" />
						)}

						<div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
							{files.map((item) => (
								<FileListItem
									key={item.id}
									item={item}
									onRemove={removeFile}
									disabled={isUploading || allQueued}
								/>
							))}
						</div>
					</div>
				)}

				{/* Success summary */}
				{allQueued && (
					<div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
						<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
						<div className="text-sm">
							<p className="font-medium text-green-800 dark:text-green-200">
								{queuedCount} interview{queuedCount !== 1 ? "s" : ""} queued for processing
							</p>
							<p className="text-green-700 dark:text-green-300">
								Transcription and analysis will run in the background. Check the interviews list for progress.
							</p>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isUploading}>
						{allQueued ? "Close" : "Cancel"}
					</Button>
					{!allQueued && (
						<Button
							onClick={upload}
							disabled={files.length === 0 || isUploading}
						>
							{isUploading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Uploading {files.length} file{files.length !== 1 ? "s" : ""}...
								</>
							) : (
								<>
									<Upload className="mr-2 h-4 w-4" />
									Upload {files.length} file{files.length !== 1 ? "s" : ""}
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
