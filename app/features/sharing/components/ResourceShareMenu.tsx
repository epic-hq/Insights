import { Check, Copy, Globe, LinkIcon, Share2, UserPlus } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export type ShareableResourceType = "interview" | "insight" | "evidence" | "lens" | "opportunity"

interface ResourceShareMenuProps {
	projectPath: string
	accountId: string
	resourceId: string
	resourceName: string
	resourceType: ShareableResourceType
	align?: "start" | "center" | "end"
	buttonLabel?: string
	// Public sharing state (only for interviews currently)
	shareEnabled?: boolean
	shareToken?: string | null
	shareExpiresAt?: string | null
	onShareChange?: () => void
}

function buildRelativePath(
	resourceType: ShareableResourceType,
	resourceId: string,
	projectPath: string,
	routes: ReturnType<typeof useProjectRoutes>
): string {
	switch (resourceType) {
		case "interview":
			return routes.interviews.detail(resourceId)
		case "insight":
			return routes.insights.detail(resourceId)
		case "evidence":
			return routes.evidence.detail(resourceId)
		case "lens":
			return routes.lenses.byTemplateKey(resourceId)
		case "opportunity":
			return routes.opportunities.detail(resourceId)
		default:
			return `${projectPath}`
	}
}

function toShareUrl(relativePath: string): string {
	if (typeof window === "undefined") return relativePath
	const origin = window.location.origin || ""
	return `${origin}${relativePath}`
}

function toPublicShareUrl(token: string): string {
	if (typeof window === "undefined") return `/s/${token}`
	const origin = window.location.origin || ""
	return `${origin}/s/${token}`
}

export function ResourceShareMenu({
	projectPath,
	accountId,
	resourceId,
	resourceName,
	resourceType,
	align = "end",
	buttonLabel = "Share",
	shareEnabled: initialShareEnabled = false,
	shareToken: initialShareToken = null,
	shareExpiresAt: initialShareExpiresAt = null,
	onShareChange,
}: ResourceShareMenuProps) {
	const routes = useProjectRoutes(projectPath)
	const fetcher = useFetcher<{ ok?: boolean; error?: string }>()
	const shareFetcher = useFetcher<{
		ok?: boolean
		error?: string
		shareToken?: string
		shareUrl?: string
		expiresAt?: string | null
	}>()

	const [email, setEmail] = useState("")
	const [note, setNote] = useState("")
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
	const [publicShareDialogOpen, setPublicShareDialogOpen] = useState(false)
	const [copied, setCopied] = useState(false)
	const [publicCopied, setPublicCopied] = useState(false)

	// Public share state
	const [publicShareEnabled, setPublicShareEnabled] = useState(initialShareEnabled)
	const [publicShareToken, setPublicShareToken] = useState(initialShareToken)
	const [expirationDays, setExpirationDays] = useState<"7" | "30" | "never">("30")

	// Sync initial props
	useEffect(() => {
		setPublicShareEnabled(initialShareEnabled)
		setPublicShareToken(initialShareToken)
	}, [initialShareEnabled, initialShareToken])

	// Handle share API response
	useEffect(() => {
		if (shareFetcher.data?.ok && shareFetcher.data.shareToken) {
			setPublicShareEnabled(true)
			setPublicShareToken(shareFetcher.data.shareToken)
			onShareChange?.()
		}
		if (shareFetcher.data?.ok && !shareFetcher.data.shareToken) {
			// Disable response
			setPublicShareEnabled(false)
			onShareChange?.()
		}
	}, [shareFetcher.data, onShareChange])

	const relativePath = useMemo(
		() => buildRelativePath(resourceType, resourceId, projectPath, routes),
		[projectPath, resourceId, resourceType, routes]
	)
	const shareUrl = useMemo(() => toShareUrl(relativePath), [relativePath])
	const publicShareUrl = useMemo(
		() => (publicShareToken ? toPublicShareUrl(publicShareToken) : null),
		[publicShareToken]
	)
	const isSubmitting = fetcher.state === "submitting"
	const isShareUpdating = shareFetcher.state === "submitting"

	// Only show public sharing for interviews
	const supportsPublicSharing = resourceType === "interview"

	useEffect(() => {
		if (fetcher.data?.ok) {
			setEmail("")
			setNote("")
			setInviteDialogOpen(false)
		}
	}, [fetcher.data])

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			// noop: clipboard may be blocked
		}
	}

	const handleCopyPublicLink = async () => {
		if (!publicShareUrl) return
		try {
			await navigator.clipboard.writeText(publicShareUrl)
			setPublicCopied(true)
			setTimeout(() => setPublicCopied(false), 1500)
		} catch {
			// noop: clipboard may be blocked
		}
	}

	const handleTogglePublicShare = (enabled: boolean) => {
		if (enabled) {
			// Enable sharing
			const formData = new FormData()
			formData.set("interviewId", resourceId)
			formData.set("expirationDays", expirationDays)
			shareFetcher.submit(formData, {
				method: "post",
				action: "/api/share/enable",
			})
		} else {
			// Disable sharing
			const formData = new FormData()
			formData.set("interviewId", resourceId)
			shareFetcher.submit(formData, {
				method: "post",
				action: "/api/share/disable",
			})
		}
	}

	const handleUpdateExpiration = (newExpiration: "7" | "30" | "never") => {
		setExpirationDays(newExpiration)
		// If already enabled, update the expiration
		if (publicShareEnabled) {
			const formData = new FormData()
			formData.set("interviewId", resourceId)
			formData.set("expirationDays", newExpiration)
			shareFetcher.submit(formData, {
				method: "post",
				action: "/api/share/enable",
			})
		}
	}

	const handleSend = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!email.trim()) return

		const formData = new FormData(event.currentTarget)
		formData.set("resourceLink", shareUrl)
		formData.set("resourceName", resourceName)
		formData.set("resourceType", resourceType)
		formData.set("accountId", accountId)

		fetcher.submit(formData, { method: "post", action: "/api/share-invite" })
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="flex items-center gap-2">
					<Share2 className="h-4 w-4" />
					{buttonLabel}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-52">
				<DropdownMenuItem onClick={handleCopy} className="flex items-center gap-2">
					<LinkIcon className="h-4 w-4" />
					{copied ? "Link copied" : "Copy link"}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setInviteDialogOpen(true)} className="flex items-center gap-2">
					<UserPlus className="h-4 w-4" />
					Invite to team
				</DropdownMenuItem>

				{supportsPublicSharing && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => setPublicShareDialogOpen(true)} className="flex items-center gap-2">
							<Globe className="h-4 w-4" />
							Public share link
							{publicShareEnabled && (
								<span className="ml-auto rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400">
									On
								</span>
							)}
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>

			{/* Team Invite Dialog */}
			<Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite to team</DialogTitle>
						<DialogDescription>They'll join your team and be taken directly to this {resourceType}.</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleSend}>
						<div className="space-y-2">
							<Label htmlFor="invite-email">Email address</Label>
							<Input
								id="invite-email"
								name="targetEmail"
								type="email"
								placeholder="name@company.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="invite-note">Message (optional)</Label>
							<Textarea
								id="invite-note"
								name="note"
								placeholder={`Hi, check out this ${resourceType}!`}
								value={note}
								onChange={(event) => setNote(event.target.value)}
							/>
						</div>
						<input type="hidden" name="projectPath" value={projectPath} />
						<input type="hidden" name="shareUrl" value={shareUrl} />
						<DialogFooter className="gap-2 sm:justify-between">
							<div className="text-muted-foreground text-xs">
								{fetcher.data?.ok && (
									<span className="flex items-center gap-1 text-green-600">
										<Check className="h-3 w-3" /> Invitation sent
									</span>
								)}
								{fetcher.data?.error && <span className="text-destructive">{fetcher.data.error}</span>}
							</div>
							<div className="flex items-center gap-2">
								<Button type="button" variant="ghost" onClick={() => setInviteDialogOpen(false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting || !email.trim()}>
									{isSubmitting ? "Sending..." : "Send invitation"}
								</Button>
							</div>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Public Share Dialog */}
			<Dialog open={publicShareDialogOpen} onOpenChange={setPublicShareDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Public Share Link</DialogTitle>
						<DialogDescription>
							Create a public link to share this interview with anyone, no login required.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Enable/Disable Toggle */}
						<div className="flex items-center justify-between">
							<Label htmlFor="public-share-toggle" className="flex-1">
								Enable public sharing
							</Label>
							<Switch
								id="public-share-toggle"
								checked={publicShareEnabled}
								onCheckedChange={handleTogglePublicShare}
								disabled={isShareUpdating}
							/>
						</div>

						{publicShareEnabled && (
							<>
								{/* Expiration Select */}
								<div className="space-y-2">
									<Label htmlFor="expiration-select">Link expires after</Label>
									<Select
										value={expirationDays}
										onValueChange={(value) => handleUpdateExpiration(value as "7" | "30" | "never")}
										disabled={isShareUpdating}
									>
										<SelectTrigger id="expiration-select">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="7">7 days</SelectItem>
											<SelectItem value="30">30 days</SelectItem>
											<SelectItem value="never">Never</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* Public URL */}
								{publicShareUrl && (
									<div className="space-y-2">
										<Label>Public link</Label>
										<div className="flex items-center gap-2">
											<Input value={publicShareUrl} readOnly className="font-mono text-sm" />
											<Button
												type="button"
												variant="outline"
												size="icon"
												onClick={handleCopyPublicLink}
												disabled={isShareUpdating}
											>
												{publicCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
											</Button>
										</div>
									</div>
								)}

								{/* Warning */}
								<p className="text-muted-foreground text-xs">
									Anyone with this link can view the interview transcript, recording, and AI analysis. User notes and
									team comments are not visible.
								</p>
							</>
						)}

						{shareFetcher.data?.error && <p className="text-destructive text-sm">{shareFetcher.data.error}</p>}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setPublicShareDialogOpen(false)}>
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DropdownMenu>
	)
}
