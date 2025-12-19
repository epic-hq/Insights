/**
 * Insights Settings Modal
 *
 * A modal dialog for configuring analysis settings (theme deduplication and evidence linking thresholds).
 * Extracted from project settings page to make it accessible from the Insights page actions menu.
 */

import { Save, Settings2 } from "lucide-react"
import { useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { Slider } from "~/components/ui/slider"

// Default thresholds matching SIMILARITY_THRESHOLDS in openai.server.ts
const DEFAULT_THEME_DEDUP = 0.8
const DEFAULT_EVIDENCE_LINK = 0.4

interface InsightsSettingsModalProps {
	projectId: string
	accountId: string
	/** Current settings from project_settings JSONB */
	currentSettings?: {
		theme_dedup_threshold?: number
		evidence_link_threshold?: number
	}
	/** Optional trigger element - defaults to a button */
	trigger?: React.ReactNode
}

export function InsightsSettingsModal({ projectId, accountId, currentSettings, trigger }: InsightsSettingsModalProps) {
	const [open, setOpen] = useState(false)
	const fetcher = useFetcher()

	const initialThemeDedup = currentSettings?.theme_dedup_threshold ?? DEFAULT_THEME_DEDUP
	const initialEvidenceLink = currentSettings?.evidence_link_threshold ?? DEFAULT_EVIDENCE_LINK

	const [themeDedupThreshold, setThemeDedupThreshold] = useState(initialThemeDedup)
	const [evidenceLinkThreshold, setEvidenceLinkThreshold] = useState(initialEvidenceLink)

	const isSaving = fetcher.state !== "idle"
	const success = fetcher.data?.success

	// Reset to initial values when modal closes
	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen)
		if (!newOpen) {
			setThemeDedupThreshold(initialThemeDedup)
			setEvidenceLinkThreshold(initialEvidenceLink)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="ghost" size="sm" className="gap-2">
						<Settings2 className="h-4 w-4" />
						Settings
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings2 className="h-5 w-5" />
						Analysis Settings
					</DialogTitle>
					<DialogDescription>Control how AI analyzes and groups insights from interviews</DialogDescription>
				</DialogHeader>

				<fetcher.Form method="post" action={"/api/update-analysis-settings"} className="space-y-6">
					<input type="hidden" name="project_id" value={projectId} />
					<input type="hidden" name="account_id" value={accountId} />
					<input type="hidden" name="theme_dedup_threshold" value={themeDedupThreshold} />
					<input type="hidden" name="evidence_link_threshold" value={evidenceLinkThreshold} />

					<div className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="theme-dedup">Theme Deduplication</Label>
								<span className="font-medium text-muted-foreground text-sm">
									{Math.round(themeDedupThreshold * 100)}%
								</span>
							</div>
							<Slider
								id="theme-dedup"
								min={50}
								max={95}
								step={5}
								value={[themeDedupThreshold * 100]}
								onValueChange={([val]) => setThemeDedupThreshold(val / 100)}
							/>
							<p className="text-muted-foreground text-xs">
								How similar two themes must be to merge them.{" "}
								<span className="text-foreground/70">Higher = more themes</span>,{" "}
								<span className="text-foreground/70">lower = more consolidation</span>.
							</p>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="evidence-link">Evidence Linking</Label>
								<span className="font-medium text-muted-foreground text-sm">
									{Math.round(evidenceLinkThreshold * 100)}%
								</span>
							</div>
							<Slider
								id="evidence-link"
								min={20}
								max={70}
								step={5}
								value={[evidenceLinkThreshold * 100]}
								onValueChange={([val]) => setEvidenceLinkThreshold(val / 100)}
							/>
							<p className="text-muted-foreground text-xs">
								How similar evidence must be to link to a theme.{" "}
								<span className="text-foreground/70">Higher = fewer but more relevant links</span>.
							</p>
						</div>
					</div>

					{success && (
						<div className="rounded-md bg-green-50 p-3 text-green-700 text-sm dark:bg-green-950/20 dark:text-green-400">
							Settings saved successfully
						</div>
					)}

					<div className="flex justify-end gap-2">
						<Button type="button" variant="ghost" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving} className="gap-2">
							<Save className="h-4 w-4" />
							{isSaving ? "Saving..." : "Save Settings"}
						</Button>
					</div>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	)
}
