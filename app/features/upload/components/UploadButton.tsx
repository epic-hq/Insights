/**
 * Upload button that opens the multi-file upload modal.
 *
 * Replaces the old single-file UploadModal with MultiFileUploadModal
 * to support batch uploads with background processing.
 */

import { useState } from "react";
import { useRevalidator } from "react-router";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useNotification } from "~/contexts/NotificationContext";
import type { BatchUploadResponse } from "~/features/upload/types";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import MultiFileUploadModal from "./MultiFileUploadModal";

export default function UploadButton() {
	const [open, setOpen] = useState(false);
	const revalidator = useRevalidator();
	const { showNotification } = useNotification();
	const { accountId, projectId, projectPath } = useCurrentProject();
	const _routes = useProjectRoutes(projectPath || "");

	const handleComplete = (response: BatchUploadResponse) => {
		revalidator.revalidate();

		if (response.queued > 0) {
			showNotification(
				`${response.queued} interview${response.queued !== 1 ? "s" : ""} queued for processing.${response.failed > 0 ? ` ${response.failed} failed.` : ""}`,
				response.failed > 0 ? "error" : "success",
				5000,
			);
		} else {
			showNotification("Upload failed. Please try again.", "error", 5000);
		}
	};

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			>
				Add interview
			</button>
			<MultiFileUploadModal
				open={open}
				onClose={() => setOpen(false)}
				onComplete={handleComplete}
				projectId={projectId}
				accountId={accountId}
			/>
		</>
	);
}
