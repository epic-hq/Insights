/**
 * Embed Code Generator Component
 *
 * Provides UI to configure and copy embed codes for research links.
 * Supports multiple layout options and customization.
 */
import { Check, Code2, Copy, ExternalLink, Eye, Laptop, Smartphone } from "lucide-react"
import { useCallback, useId, useMemo, useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"

type EmbedLayout = "inline-email" | "inline-full" | "email-first" | "compact" | "video-first"
type EmbedTheme = "dark" | "light" | "transparent"

interface EmbedConfig {
	layout: EmbedLayout
	theme: EmbedTheme
	accentColor: string
	borderRadius: number
	showBranding: boolean
	buttonText: string
	placeholder: string
	successMessage: string
	emailPreviewImageUrl: string
}

interface EmbedCodeGeneratorProps {
	slug: string
	heroTitle?: string | null
	heroCtaLabel?: string | null
	walkthroughVideoUrl?: string | null
}

const LAYOUT_OPTIONS: {
	value: EmbedLayout
	label: string
	description: string
}[] = [
	{
		value: "compact",
		label: "Compact",
		description: "Minimal single-line email capture",
	},
	{
		value: "inline-email",
		label: "Email Capture",
		description: "Email field with optional video thumbnail",
	},
	{
		value: "video-first",
		label: "Video First (Recommended)",
		description: "Video plays first, then email capture below",
	},
	{
		value: "email-first",
		label: "Email First",
		description: "Email capture that reveals video after submission",
	},
	{
		value: "inline-full",
		label: "Full Form",
		description: "Complete form with video and all content",
	},
]

const USE_CASE_PRESETS: { label: string; config: Partial<EmbedConfig> }[] = [
	{
		label: "Video Intro",
		config: {
			layout: "video-first",
			buttonText: "Get Started",
			successMessage: "Thanks! Check your inbox.",
			placeholder: "you@company.com",
		},
	},
	{
		label: "Waitlist",
		config: {
			layout: "inline-email",
			buttonText: "Join",
			successMessage: "You're on the list!",
			placeholder: "you@company.com",
		},
	},
	{
		label: "Beta Signup",
		config: {
			layout: "email-first",
			buttonText: "Get Early Access",
			successMessage: "Thanks! We'll be in touch.",
			placeholder: "your@email.com",
		},
	},
	{
		label: "Newsletter",
		config: {
			layout: "compact",
			buttonText: "Subscribe",
			successMessage: "Subscribed!",
			placeholder: "Enter your email",
		},
	},
	{
		label: "Feedback",
		config: {
			layout: "inline-full",
			buttonText: "Share Feedback",
			successMessage: "Thanks for your feedback!",
		},
	},
]

export function EmbedCodeGenerator({ slug, heroTitle, heroCtaLabel, walkthroughVideoUrl }: EmbedCodeGeneratorProps) {
	const previewId = useId()
	const [copiedHtml, setCopiedHtml] = useState(false)
	const [copiedScript, setCopiedScript] = useState(false)
	const [copiedIframe, setCopiedIframe] = useState(false)
	const [copiedEmailPreview, setCopiedEmailPreview] = useState(false)
	const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")

	// Embed configuration state
	const [config, setConfig] = useState<EmbedConfig>({
		layout: "inline-email",
		theme: "transparent",
		accentColor: "#ffffff",
		borderRadius: 12,
		showBranding: true,
		buttonText: heroCtaLabel || "Get Started",
		placeholder: "you@company.com",
		successMessage: "Thanks for signing up!",
		emailPreviewImageUrl: "",
	})

	// Generate the embed URL
  const embedUrl = useMemo(() => {
		const base = typeof window !== "undefined" ? window.location.origin : "https://getupsight.com"
		const url = new URL(`${base}/embed/${slug}`)
		url.searchParams.set("layout", config.layout)
		url.searchParams.set("theme", config.theme)
		url.searchParams.set("accent", config.accentColor)
		url.searchParams.set("radius", String(config.borderRadius))
		url.searchParams.set("branding", config.showBranding ? "true" : "false")
		if (config.buttonText) url.searchParams.set("buttonText", config.buttonText)
		url.searchParams.set("placeholder", config.placeholder)
		url.searchParams.set("success", config.successMessage)
		return url.toString()
  }, [slug, config])

  const publicUrl = useMemo(() => {
		const base = typeof window !== "undefined" ? window.location.origin : "https://getupsight.com"
    return `${base}/ask/${slug}`
  }, [slug])

	const emailPreviewHeadline = heroTitle || "Share your feedback"
	const emailPreviewButtonLabel = heroCtaLabel || config.buttonText || "Open survey"
	const emailPreviewImageUrl = config.emailPreviewImageUrl.trim()
	const emailPreviewFallbackVideoUrl = walkthroughVideoUrl || null

  // Generate HTML embed code
  const htmlCode = useMemo(() => {
		const attrs = [
			`id="upsight-form"`,
			`data-upsight-slug="${slug}"`,
			`data-upsight-layout="${config.layout}"`,
			`data-upsight-theme="${config.theme}"`,
			`data-upsight-accent="${config.accentColor}"`,
			`data-upsight-radius="${config.borderRadius}"`,
			`data-upsight-branding="${config.showBranding}"`,
		]
		if (config.buttonText) {
			attrs.push(`data-upsight-button-text="${config.buttonText}"`)
		}
		attrs.push(`data-upsight-placeholder="${config.placeholder}"`)
		attrs.push(`data-upsight-success="${config.successMessage}"`)

		return `<!-- UpSight Embed -->
<div ${attrs.join("\n     ")}></div>
<script src="https://getupsight.com/embed.js" async></script>`
  }, [slug, config])

	const emailPreviewCode = useMemo(() => {
		const emailPreviewPlaceholder = "IMAGE_URL_HERE"
		const hasThumbnail = Boolean(emailPreviewImageUrl)
		const emailPreviewImageSrc = hasThumbnail ? emailPreviewImageUrl : emailPreviewPlaceholder
		const imageBlock = `<tr>
      <td align="center" style="padding: 0 24px 16px;">
        <a href="${publicUrl}" target="_blank" rel="noreferrer">
          ${hasThumbnail ? "" : "<!-- Replace IMAGE_URL_HERE with a thumbnail or GIF of your video -->\n          "}
          <img
            src="${emailPreviewImageSrc}"
            width="600"
            alt="${emailPreviewHeadline}"
            style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;"
          />
        </a>
      </td>
    </tr>`

		return `<!-- UpSight Email Preview -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td align="center" style="padding: 24px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px;">
        <tr>
          <td align="center" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 600; color: #111827; padding: 0 24px 16px;">
            ${emailPreviewHeadline}
          </td>
        </tr>
        ${imageBlock}
        <tr>
          <td align="center" style="padding: 0 24px 20px;">
            <a
              href="${publicUrl}"
              target="_blank"
              rel="noreferrer"
              style="display: inline-block; padding: 12px 22px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: Arial, sans-serif; font-size: 14px;"
            >
              ${emailPreviewButtonLabel}
            </a>
          </td>
        </tr>
		<tr>
			<td align="center" style="font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; padding: 0 24px;">
				Watch the video + respond here:
				<br />
				<a href="${publicUrl}" target="_blank" rel="noreferrer" style="color: #111827; text-decoration: underline;">
					Open the video survey
				</a>
				<br />
				<span style="color: #9ca3af; font-size: 11px;">${publicUrl}</span>
			</td>
		</tr>
      </table>
    </td>
  </tr>
</table>`
  }, [emailPreviewButtonLabel, emailPreviewHeadline, emailPreviewImageUrl, publicUrl])

	// Generate iframe code
	const iframeCode = useMemo(() => {
		const height =
			config.layout === "compact"
				? "60"
				: config.layout === "inline-email"
					? "200"
					: config.layout === "email-first"
						? "280"
						: config.layout === "video-first"
							? "420"
							: "400"

		return `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  frameborder="0"
  scrolling="no"
  allowtransparency="true"
  style="border: none; overflow: hidden; background: transparent;"
  allow="camera; microphone"
  title="${heroTitle || "UpSight Form"}"
></iframe>`
	}, [embedUrl, config.layout, heroTitle])

	// Generate script-only code for advanced users
	const scriptCode = useMemo(() => {
		return `<script>
  // Initialize UpSight form programmatically
  window.UpSight = window.UpSight || {};
  window.UpSight.create("upsight-container", "${slug}", {
    layout: "${config.layout}",
    theme: "${config.theme}",
    accent: "${config.accentColor}",
    radius: ${config.borderRadius},
    branding: ${config.showBranding},
    buttonText: "${config.buttonText}",
    placeholder: "${config.placeholder}",
    success: "${config.successMessage}"
  });
</script>
<script src="https://getupsight.com/embed.js" async></script>
<div id="upsight-container"></div>`
	}, [slug, config])

	const handleCopy = useCallback(async (text: string, setter: (v: boolean) => void) => {
		try {
			await navigator.clipboard.writeText(text)
			setter(true)
			setTimeout(() => setter(false), 2000)
		} catch {
			// Fallback
			const textarea = document.createElement("textarea")
			textarea.value = text
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand("copy")
			document.body.removeChild(textarea)
			setter(true)
			setTimeout(() => setter(false), 2000)
		}
	}, [])

	const applyPreset = useCallback((preset: (typeof USE_CASE_PRESETS)[0]) => {
		setConfig((prev) => ({ ...prev, ...preset.config }))
	}, [])

	return (
		<div className="min-w-0 space-y-4">
			{/* Use Case Presets */}
			<div className="space-y-2">
				<Label className="text-muted-foreground text-xs">Quick Start</Label>
				<div className="flex flex-wrap gap-2">
					{USE_CASE_PRESETS.map((preset) => (
						<Button
							key={preset.label}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => applyPreset(preset)}
							className="h-7 text-xs"
						>
							{preset.label}
						</Button>
					))}
				</div>
			</div>

			{/* Layout Selection */}
			<div className="space-y-2">
				<Label className="text-muted-foreground text-xs">Layout</Label>
				<div className="grid grid-cols-2 gap-2">
					{LAYOUT_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => setConfig((prev) => ({ ...prev, layout: option.value }))}
							className={cn(
								"rounded-lg border p-3 text-left transition-all",
								config.layout === option.value
									? "border-primary bg-primary/5 ring-1 ring-primary/20"
									: "border-border hover:border-primary/40"
							)}
						>
							<p className="font-medium text-sm">{option.label}</p>
							<p className="text-muted-foreground text-xs">{option.description}</p>
						</button>
					))}
				</div>
			</div>

			{/* Customization Options */}
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label className="text-muted-foreground text-xs">Theme</Label>
					<Select
						value={config.theme}
						onValueChange={(v) => setConfig((prev) => ({ ...prev, theme: v as EmbedTheme }))}
					>
						<SelectTrigger className="h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="transparent">Transparent (Default)</SelectItem>
							<SelectItem value="dark">Dark</SelectItem>
							<SelectItem value="light">Light</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label className="text-muted-foreground text-xs">Border Radius</Label>
					<Select
						value={String(config.borderRadius)}
						onValueChange={(v) => setConfig((prev) => ({ ...prev, borderRadius: Number(v) }))}
					>
						<SelectTrigger className="h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="0">None (0px)</SelectItem>
							<SelectItem value="4">Small (4px)</SelectItem>
							<SelectItem value="8">Medium (8px)</SelectItem>
							<SelectItem value="12">Large (12px)</SelectItem>
							<SelectItem value="16">Extra Large (16px)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label className="text-muted-foreground text-xs">Button Text</Label>
					<Input
						value={config.buttonText}
						onChange={(e) => setConfig((prev) => ({ ...prev, buttonText: e.target.value }))}
						placeholder="Get Started"
						className="h-9"
					/>
				</div>

				<div className="space-y-2">
					<Label className="text-muted-foreground text-xs">Placeholder</Label>
					<Input
						value={config.placeholder}
						onChange={(e) => setConfig((prev) => ({ ...prev, placeholder: e.target.value }))}
						placeholder="you@company.com"
						className="h-9"
					/>
				</div>

				<div className="space-y-2 sm:col-span-2">
					<Label className="text-muted-foreground text-xs">Success Message</Label>
					<Input
						value={config.successMessage}
						onChange={(e) => setConfig((prev) => ({ ...prev, successMessage: e.target.value }))}
						placeholder="Thanks for signing up!"
						className="h-9"
					/>
				</div>

				<div className="space-y-2 sm:col-span-2">
					<Label className="text-muted-foreground text-xs">Email thumbnail image URL (optional)</Label>
					<Input
						value={config.emailPreviewImageUrl}
						onChange={(e) =>
							setConfig((prev) => ({
								...prev,
								emailPreviewImageUrl: e.target.value,
							}))
						}
						placeholder="https://... (PNG/JPG/GIF with a play button)"
						className="h-9"
					/>
					<p className="text-muted-foreground text-xs">
						Email clients can’t play video. Use a thumbnail or GIF that links to your survey. If you leave this
						empty, the HTML uses a placeholder you should replace.
					</p>
				</div>

				<div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
					<div>
						<p className="font-medium text-sm">Show branding</p>
						<p className="text-muted-foreground text-xs">Display "Powered by UpSight"</p>
					</div>
					<Switch
						checked={config.showBranding}
						onCheckedChange={(v) => setConfig((prev) => ({ ...prev, showBranding: v }))}
					/>
				</div>
			</div>

			{/* Preview */}
			<Card className="overflow-hidden">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<div>
						<CardTitle className="text-sm">Preview</CardTitle>
						<CardDescription className="text-xs">How your embed will look</CardDescription>
					</div>
					<div className="flex items-center gap-1 rounded-lg border p-0.5">
						<Button
							type="button"
							variant={previewDevice === "desktop" ? "secondary" : "ghost"}
							size="icon"
							className="h-7 w-7"
							onClick={() => setPreviewDevice("desktop")}
						>
							<Laptop className="h-4 w-4" />
						</Button>
						<Button
							type="button"
							variant={previewDevice === "mobile" ? "secondary" : "ghost"}
							size="icon"
							className="h-7 w-7"
							onClick={() => setPreviewDevice("mobile")}
						>
							<Smartphone className="h-4 w-4" />
						</Button>
					</div>
				</CardHeader>
				<CardContent className="bg-muted/30 p-4">
					<div
						className={cn(
							"mx-auto overflow-hidden rounded-lg border bg-background",
							previewDevice === "desktop" ? "max-w-md" : "max-w-[320px]"
						)}
					>
						<iframe
							src={embedUrl}
							className="w-full border-none"
							style={{
								height:
									config.layout === "compact"
										? "60px"
										: config.layout === "inline-email"
											? "200px"
											: config.layout === "email-first"
												? "280px"
												: config.layout === "video-first"
													? "420px"
													: "400px",
							}}
							title="Embed Preview"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Embed Codes */}
			<Card className="min-w-0 overflow-hidden">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 text-sm">
						<Code2 className="h-4 w-4" />
						Embed Code
					</CardTitle>
				</CardHeader>
				<CardContent className="min-w-0 overflow-hidden">
					<Tabs defaultValue="html" className="w-full min-w-0 overflow-hidden">
						<TabsList className="w-full justify-start">
							<TabsTrigger value="html" className="text-xs">
								HTML + Script
							</TabsTrigger>
							<TabsTrigger value="iframe" className="text-xs">
								iFrame
							</TabsTrigger>
							<TabsTrigger value="email" className="text-xs">
								Email Preview
							</TabsTrigger>
							<TabsTrigger value="advanced" className="text-xs">
								Advanced
							</TabsTrigger>
						</TabsList>

						<TabsContent value="html" className="min-w-0 space-y-2">
							<p className="text-muted-foreground text-xs">
								Best for most websites. Add this code where you want the form to appear.
							</p>
							<div className="relative min-w-0 overflow-hidden">
								<pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{htmlCode}</pre>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="absolute top-2 right-2 h-7 gap-1.5"
									onClick={() => handleCopy(htmlCode, setCopiedHtml)}
								>
									{copiedHtml ? (
										<>
											<Check className="h-3.5 w-3.5" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											Copy
										</>
									)}
								</Button>
							</div>
						</TabsContent>

						<TabsContent value="iframe" className="min-w-0 space-y-2">
							<p className="text-muted-foreground text-xs">
								Use an iframe if the script doesn't work or you need isolation.
							</p>
							<div className="relative min-w-0 overflow-hidden">
								<pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
									{iframeCode}
								</pre>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="absolute top-2 right-2 h-7 gap-1.5"
									onClick={() => handleCopy(iframeCode, setCopiedIframe)}
								>
									{copiedIframe ? (
										<>
											<Check className="h-3.5 w-3.5" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											Copy
										</>
									)}
								</Button>
							</div>
						</TabsContent>

        <TabsContent value="email" className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-xs">
            Email clients block video and embeds. Use a thumbnail image that
            links to your survey.
          </p>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
              Email preview
            </p>
							<div className="mt-2 overflow-hidden rounded-md border bg-muted/30">
								{emailPreviewImageUrl ? (
									<img src={emailPreviewImageUrl} alt={emailPreviewHeadline} className="h-auto w-full" />
								) : emailPreviewFallbackVideoUrl ? (
									<video
										src={emailPreviewFallbackVideoUrl}
										className="h-auto w-full"
										controls
										playsInline
										preload="metadata"
									/>
								) : (
									<div className="flex items-center justify-center gap-2 px-4 py-10 text-muted-foreground text-xs">
										<Eye className="h-4 w-4" />
										Add a thumbnail image to personalize this preview
									</div>
								)}
							</div>
            <div className="mt-3 text-center">
              <p className="font-medium text-sm text-foreground">
                {emailPreviewHeadline}
              </p>
              <div className="mt-2 inline-flex rounded-md bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">
                {emailPreviewButtonLabel}
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                Watch the video + respond:
              </p>
              <p className="text-[11px] font-medium text-foreground">
                Open the video survey
              </p>
              <p className="break-all font-mono text-[11px] text-muted-foreground">
                {publicUrl}
              </p>
            </div>
          </div>
          <div className="relative min-w-0 overflow-hidden">
            <pre className="max-h-[240px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {emailPreviewCode}
								</pre>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="absolute top-2 right-2 h-7 gap-1.5"
									onClick={() => handleCopy(emailPreviewCode, setCopiedEmailPreview)}
								>
									{copiedEmailPreview ? (
										<>
											<Check className="h-3.5 w-3.5" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											Copy
										</>
									)}
								</Button>
							</div>
						</TabsContent>

						<TabsContent value="advanced" className="min-w-0 space-y-2">
							<p className="text-muted-foreground text-xs">Programmatic API for SPAs and custom integrations.</p>
							<div className="relative min-w-0 overflow-hidden">
								<pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
									{scriptCode}
								</pre>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="absolute top-2 right-2 h-7 gap-1.5"
									onClick={() => handleCopy(scriptCode, setCopiedScript)}
								>
									{copiedScript ? (
										<>
											<Check className="h-3.5 w-3.5" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-3.5 w-3.5" />
											Copy
										</>
									)}
								</Button>
							</div>
						</TabsContent>
					</Tabs>

					{/* Direct link */}
					<div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
						<div className="min-w-0 flex-1">
							<p className="text-muted-foreground text-xs">Direct embed URL:</p>
							<p className="truncate font-mono text-xs">{embedUrl}</p>
						</div>
						<Button type="button" variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
							<a href={embedUrl} target="_blank" rel="noreferrer">
								<ExternalLink className="h-3.5 w-3.5" />
								Open
							</a>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Integration Tips */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">Tips</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-muted-foreground text-xs">
					<p>
						<strong className="text-foreground">For waitlists:</strong> Use the Compact or Email Capture layout. Set a
						compelling button text like "Join Waitlist" or "Get Early Access".
					</p>
					<p>
						<strong className="text-foreground">For feedback:</strong> Use the Full Form layout to show your video
						introduction and collect detailed responses.
					</p>
					<p>
						<strong className="text-foreground">Custom events:</strong> Listen for{" "}
						<code className="rounded bg-muted px-1">upsight:signup</code> events to trigger custom actions when someone
						submits their email.
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
