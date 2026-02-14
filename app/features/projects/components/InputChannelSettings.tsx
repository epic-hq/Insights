/**
 * MethodSettingsModal - Configure public collection methods for a project
 *
 * Button + Modal pattern for configuring Survey (form) and AI Chat channels
 * for collecting responses from external participants via a shareable public link.
 */

import { Check, Copy, ExternalLink, FileText, Loader2, MessageSquare, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { createClient } from "~/lib/supabase/client";

interface MethodSettingsProps {
	projectId: string;
	accountId: string;
	projectName?: string;
}

interface ResearchLink {
	id: string;
	slug: string;
	allow_chat: boolean;
	default_response_mode: "form" | "chat";
	is_live: boolean;
}

export function MethodSettingsButton({ projectId, accountId, projectName }: MethodSettingsProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<Settings2 className="h-4 w-4" />
					Method
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Collection Method</DialogTitle>
					<DialogDescription>
						Configure how external participants can provide feedback via a shareable public link.
					</DialogDescription>
				</DialogHeader>
				<MethodSettingsContent
					projectId={projectId}
					accountId={accountId}
					projectName={projectName}
					onClose={() => setOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}

function MethodSettingsContent({
	projectId,
	accountId,
	projectName,
	onClose,
}: MethodSettingsProps & { onClose: () => void }) {
	const supabase = createClient();
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [researchLink, setResearchLink] = useState<ResearchLink | null>(null);
	const [copied, setCopied] = useState(false);

	// Channel states
	const [surveyEnabled, setSurveyEnabled] = useState(false);
	const [chatEnabled, setChatEnabled] = useState(false);
	const [isLive, setIsLive] = useState(false);
	const [slug, setSlug] = useState("");

	// Generate default slug from project name
	const generateSlug = useCallback((name: string) => {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.substring(0, 50);
	}, []);

	// Load existing research link for this project
	useEffect(() => {
		const load = async () => {
			setIsLoading(true);
			try {
				const { data, error } = await supabase
					.from("research_links")
					.select("id, slug, allow_chat, default_response_mode, is_live")
					.eq("project_id", projectId)
					.maybeSingle();

				if (error) {
					console.warn("[MethodSettings] Failed to load research link:", error);
					return;
				}

				if (data) {
					setResearchLink({
						...data,
						default_response_mode: data.default_response_mode as "form" | "chat",
					});
					setSurveyEnabled(true);
					setChatEnabled(data.allow_chat);
					setIsLive(data.is_live);
					setSlug(data.slug);
				} else {
					setSlug(generateSlug(projectName || `project-${projectId.slice(0, 8)}`));
				}
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [projectId, projectName, supabase, generateSlug]);

	// Create or update research link
	const saveSettings = useCallback(async () => {
		if (!surveyEnabled && !chatEnabled) {
			if (researchLink) {
				setIsSaving(true);
				try {
					const { error } = await supabase.from("research_links").update({ is_live: false }).eq("id", researchLink.id);

					if (error) throw error;

					setResearchLink({ ...researchLink, is_live: false });
					setIsLive(false);
					toast.success("Collection methods disabled");
					onClose();
				} catch (err) {
					const message = err instanceof Error ? err.message : "Failed to save";
					toast.error(message);
				} finally {
					setIsSaving(false);
				}
			}
			return;
		}

		setIsSaving(true);
		try {
			if (researchLink) {
				const { error } = await supabase
					.from("research_links")
					.update({
						slug,
						allow_chat: chatEnabled,
						default_response_mode: chatEnabled ? "chat" : "form",
						is_live: isLive,
					})
					.eq("id", researchLink.id);

				if (error) throw error;

				setResearchLink({
					...researchLink,
					slug,
					allow_chat: chatEnabled,
					default_response_mode: chatEnabled ? "chat" : "form",
					is_live: isLive,
				});
				toast.success("Settings saved");
				onClose();
			} else {
				const { data, error } = await supabase
					.from("research_links")
					.insert({
						account_id: accountId,
						project_id: projectId,
						name: projectName || "Project Survey",
						slug,
						hero_title: "Share your feedback",
						hero_subtitle: "Help us understand your needs better.",
						allow_chat: chatEnabled,
						default_response_mode: chatEnabled ? "chat" : "form",
						is_live: isLive,
						questions: [],
					})
					.select("id, slug, allow_chat, default_response_mode, is_live")
					.single();

				if (error) {
					if (error.code === "23505") {
						toast.error("That URL slug is already in use. Please choose a different one.");
						return;
					}
					throw error;
				}

				setResearchLink({
					...data,
					default_response_mode: data.default_response_mode as "form" | "chat",
				});
				toast.success("Collection method enabled");
				onClose();
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to save";
			toast.error(message);
		} finally {
			setIsSaving(false);
		}
	}, [surveyEnabled, chatEnabled, isLive, slug, researchLink, projectId, accountId, projectName, supabase, onClose]);

	// Copy link to clipboard
	const copyLink = useCallback(() => {
		const url = `${window.location.origin}/r/${slug}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		toast.success("Link copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	}, [slug]);

	// Open link in new tab
	const openLink = useCallback(() => {
		const url = `${window.location.origin}/r/${slug}`;
		window.open(url, "_blank");
	}, [slug]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const hasChanges = researchLink
		? researchLink.allow_chat !== chatEnabled || researchLink.is_live !== isLive || researchLink.slug !== slug
		: surveyEnabled || chatEnabled;

	return (
		<div className="space-y-6">
			{/* Channel Toggles */}
			<div className="space-y-3">
				<div className="flex items-center justify-between rounded-lg border p-3">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
							<FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<h3 className="font-medium text-sm">Survey (Form)</h3>
							<p className="text-muted-foreground text-xs">Structured questions, one at a time</p>
						</div>
					</div>
					<Switch
						checked={surveyEnabled}
						onCheckedChange={(checked) => {
							setSurveyEnabled(checked);
							if (!checked) setChatEnabled(false);
						}}
					/>
				</div>

				<div className="flex items-center justify-between rounded-lg border p-3">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
							<MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
						</div>
						<div>
							<h3 className="font-medium text-sm">AI Chat</h3>
							<p className="text-muted-foreground text-xs">Conversational AI guides discussion</p>
						</div>
					</div>
					<Switch checked={chatEnabled} onCheckedChange={setChatEnabled} disabled={!surveyEnabled} />
				</div>
			</div>

			{/* URL Configuration - only show if at least one channel is enabled */}
			{(surveyEnabled || researchLink) && (
				<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
					<div className="space-y-2">
						<Label htmlFor="slug">Public URL</Label>
						<div className="flex gap-2">
							<div className="flex flex-1 items-center rounded-md border bg-background">
								<span className="px-3 text-muted-foreground text-sm">/r/</span>
								<Input
									id="slug"
									value={slug}
									onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
									className="rounded-l-none border-0 border-l"
									placeholder="your-survey-slug"
								/>
							</div>
						</div>
					</div>

					{/* Live toggle */}
					<div className="flex items-center justify-between">
						<div>
							<h4 className="font-medium text-sm">Make link live</h4>
							<p className="text-muted-foreground text-xs">Only live links are accessible to participants</p>
						</div>
						<Switch checked={isLive} onCheckedChange={setIsLive} disabled={!surveyEnabled} />
					</div>

					{/* Copy/Open buttons */}
					{slug && (
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={copyLink} className="flex-1">
								{copied ? (
									<>
										<Check className="mr-2 h-4 w-4" />
										Copied
									</>
								) : (
									<>
										<Copy className="mr-2 h-4 w-4" />
										Copy Link
									</>
								)}
							</Button>
							<Button variant="outline" size="sm" onClick={openLink} disabled={!isLive}>
								<ExternalLink className="mr-2 h-4 w-4" />
								Preview
							</Button>
						</div>
					)}

					{!isLive && researchLink && (
						<p className="text-amber-600 text-xs dark:text-amber-400">
							This link is not live. Enable "Make link live" to allow participants to access it.
						</p>
					)}
				</div>
			)}

			{/* Save button */}
			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button
					onClick={saveSettings}
					disabled={isSaving || !hasChanges || (!surveyEnabled && !chatEnabled && !researchLink)}
				>
					{isSaving ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						"Save"
					)}
				</Button>
			</div>
		</div>
	);
}

// Keep backward compatibility export
export const InputChannelSettings = MethodSettingsButton;
