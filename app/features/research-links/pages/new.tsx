import slugify from "@sindresorhus/slugify"
import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router"
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/client.server"
import { createRouteDefinitions } from "~/utils/route-definitions"
import { QuestionListEditor } from "../components/QuestionListEditor"
import { ResearchLinkPreview } from "../components/ResearchLinkPreview"
import {
	createEmptyQuestion,
	ResearchLinkPayloadSchema,
	type ResearchLinkQuestion,
	ResearchLinkQuestionSchema,
} from "../schemas"

export const meta: MetaFunction = () => {
	return [
		{ title: "Create research link" },
		{ name: "description", content: "Craft a research link that collects high-intent responses." },
	]
}

export async function loader({ params }: LoaderFunctionArgs) {
	const accountId = params.accountId
	if (!accountId) {
		throw new Response("Account id required", { status: 400 })
	}
	return { accountId }
}

interface ActionError {
	errors: Record<string, string>
	values?: {
		name?: string
		slug?: string
		description?: string | null
		heroTitle?: string | null
		heroSubtitle?: string | null
		heroCtaLabel?: string | null
		heroCtaHelper?: string | null
		calendarUrl?: string | null
		redirectUrl?: string | null
		allowChat?: boolean
		defaultResponseMode?: "form" | "chat"
		isLive?: boolean
		questions?: ResearchLinkQuestion[]
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const accountId = params.accountId
	if (!accountId) {
		throw new Response("Account id required", { status: 400 })
	}

	const formData = await request.formData()
	const rawPayload = {
		name: formData.get("name") ?? "",
		slug: formData.get("slug") ?? "",
		description: formData.get("description") ?? "",
		heroTitle: formData.get("hero_title") ?? "",
		heroSubtitle: formData.get("hero_subtitle") ?? "",
		heroCtaLabel: formData.get("hero_cta_label") ?? "",
		heroCtaHelper: formData.get("hero_cta_helper") ?? "",
		calendarUrl: formData.get("calendar_url") ?? "",
		redirectUrl: formData.get("redirect_url") ?? "",
		allowChat: formData.get("allow_chat"),
		defaultResponseMode: formData.get("default_response_mode"),
		isLive: formData.get("is_live"),
		questions: formData.get("questions") ?? "[]",
	}

	let fallbackQuestions: ResearchLinkQuestion[] = []
	try {
		const candidate = JSON.parse(String(rawPayload.questions ?? "[]"))
		const validated = ResearchLinkQuestionSchema.array().safeParse(candidate)
		if (validated.success) {
			fallbackQuestions = validated.data
		}
	} catch {
		fallbackQuestions = []
	}

	const parsed = ResearchLinkPayloadSchema.safeParse(rawPayload)
	if (!parsed.success) {
		const issues = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
			if (issue.path.length > 0) {
				acc[issue.path[0] as string] = issue.message
			} else {
				acc._form = issue.message
			}
			return acc
		}, {})
		return Response.json<ActionError>(
			{
				errors: issues,
				values: {
					name: String(rawPayload.name),
					slug: String(rawPayload.slug),
					description: String(rawPayload.description || ""),
					heroTitle: String(rawPayload.heroTitle || ""),
					heroSubtitle: String(rawPayload.heroSubtitle || ""),
					heroCtaLabel: String(rawPayload.heroCtaLabel || ""),
					heroCtaHelper: String(rawPayload.heroCtaHelper || ""),
					calendarUrl: String(rawPayload.calendarUrl || ""),
					redirectUrl: String(rawPayload.redirectUrl || ""),
					allowChat: rawPayload.allowChat === "true" || rawPayload.allowChat === "on",
					defaultResponseMode: rawPayload.defaultResponseMode === "chat" ? "chat" : "form",
					isLive: rawPayload.isLive === "true" || rawPayload.isLive === "on",
					questions: fallbackQuestions,
				},
			},
			{ status: 400 }
		)
	}

	const payload = parsed.data
	const { client: supabase } = getServerClient(request)
	const routes = createRouteDefinitions(`/a/${accountId}`)

	const insertPayload = {
		account_id: accountId,
		name: payload.name,
		slug: payload.slug,
		description: payload.description,
		hero_title: payload.heroTitle,
		hero_subtitle: payload.heroSubtitle,
		hero_cta_label: payload.heroCtaLabel,
		hero_cta_helper: payload.heroCtaHelper,
		calendar_url: payload.calendarUrl,
		redirect_url: payload.redirectUrl,
		questions: payload.questions,
		allow_chat: payload.allowChat,
		default_response_mode: payload.defaultResponseMode,
		is_live: payload.isLive,
	}

	const { data, error } = await supabase.from("research_links").insert(insertPayload).select("id").maybeSingle()

	if (error) {
		if (error.code === "23505") {
			return Response.json<ActionError>(
				{
					errors: { slug: "That slug is already in use" },
					values: { ...payload, questions: payload.questions },
				},
				{ status: 400 }
			)
		}
		return Response.json<ActionError>(
			{
				errors: { _form: error.message },
				values: { ...payload, questions: payload.questions },
			},
			{ status: 500 }
		)
	}

	if (!data) {
		return Response.json<ActionError>(
			{
				errors: { _form: "Unable to save research link" },
				values: { ...payload, questions: payload.questions },
			},
			{ status: 500 }
		)
	}

	return redirect(routes.ask.edit(data.id))
}

export default function NewResearchLinkPage() {
	const { accountId } = useLoaderData<typeof loader>()
	const actionData = useActionData<ActionError>()
	const routes = createRouteDefinitions(`/a/${accountId}`)
	const navigation = useNavigation()
	const isSubmitting = navigation.state === "submitting"

	const [name, setName] = useState(actionData?.values?.name ?? "")
	const [slug, setSlug] = useState(actionData?.values?.slug ?? "")
	const [slugEdited, setSlugEdited] = useState(Boolean(actionData?.values?.slug))
	const [heroTitle, setHeroTitle] = useState(actionData?.values?.heroTitle ?? "")
	const [heroSubtitle, setHeroSubtitle] = useState(actionData?.values?.heroSubtitle ?? "")
	const [heroCtaLabel, setHeroCtaLabel] = useState(actionData?.values?.heroCtaLabel ?? "Continue")
	const [heroCtaHelper, setHeroCtaHelper] = useState(actionData?.values?.heroCtaHelper ?? "Let's get started")
	const [calendarUrl, setCalendarUrl] = useState(actionData?.values?.calendarUrl ?? "")
	const [redirectUrl, setRedirectUrl] = useState(actionData?.values?.redirectUrl ?? "")
	const [allowChat, setAllowChat] = useState(actionData?.values?.allowChat ?? false)
	const [defaultResponseMode, setDefaultResponseMode] = useState<"form" | "chat">(
		actionData?.values?.defaultResponseMode ?? "form"
	)
	const [isLive, setIsLive] = useState(actionData?.values?.isLive ?? false)
	const [questions, setQuestions] = useState<ResearchLinkQuestion[]>(() => {
		if (actionData?.values?.questions && actionData.values.questions.length > 0) {
			return actionData.values.questions
		}
		return [createEmptyQuestion()]
	})

	useEffect(() => {
		if (!slugEdited) {
			const nextSlug = slugify(name || "research-link", { lowercase: true })
			setSlug(nextSlug)
		}
	}, [name, slugEdited])

	useEffect(() => {
		if (!allowChat && defaultResponseMode === "chat") {
			setDefaultResponseMode("form")
		}
	}, [allowChat, defaultResponseMode])

	useEffect(() => {
		if (actionData?.values?.questions) {
			setQuestions(actionData.values.questions.length ? actionData.values.questions : [createEmptyQuestion()])
		}
	}, [actionData?.values?.questions])

	const questionsJson = useMemo(() => JSON.stringify(questions), [questions])

	return (
		<PageContainer className="space-y-6">
			<Form method="post" className="grid gap-6 lg:grid-cols-[2fr,1fr]">
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Research link basics</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{actionData?.errors?._form ? (
								<Alert variant="destructive">
									<AlertTitle>Unable to save</AlertTitle>
									<AlertDescription>{actionData.errors._form}</AlertDescription>
								</Alert>
							) : null}
							<div className="space-y-2">
								<Label htmlFor="name">Internal name</Label>
								<Input
									id="name"
									name="name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder="Pricing discovery link"
									required
								/>
								{actionData?.errors?.name ? <p className="text-destructive text-sm">{actionData.errors.name}</p> : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="slug">Public slug</Label>
								<Input
									id="slug"
									name="slug"
									value={slug}
									onChange={(event) => {
										setSlug(event.target.value)
										setSlugEdited(true)
									}}
									placeholder="pricing-discovery"
									required
								/>
								<p className="text-muted-foreground text-xs">
									Shareable link: {routes.ask.public(slug || "your-slug")}
								</p>
								{actionData?.errors?.slug ? <p className="text-destructive text-sm">{actionData.errors.slug}</p> : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									name="description"
									defaultValue={actionData?.values?.description ?? ""}
									placeholder="Explain who should join and what they'll receive."
									rows={3}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Hero section</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="hero_title">Headline</Label>
								<Input
									id="hero_title"
									name="hero_title"
									value={heroTitle}
									onChange={(event) => setHeroTitle(event.target.value)}
									placeholder="Unlock early access to Upsight"
								/>
								{actionData?.errors?.heroTitle ? (
									<p className="text-destructive text-sm">{actionData.errors.heroTitle}</p>
								) : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="hero_subtitle">Supporting copy</Label>
								<Textarea
									id="hero_subtitle"
									name="hero_subtitle"
									value={heroSubtitle}
									onChange={(event) => setHeroSubtitle(event.target.value)}
									placeholder="Share why this study matters and how you'll use their answers."
									rows={3}
								/>
								{actionData?.errors?.heroSubtitle ? (
									<p className="text-destructive text-sm">{actionData.errors.heroSubtitle}</p>
								) : null}
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="hero_cta_label">CTA label</Label>
									<Input
										id="hero_cta_label"
										name="hero_cta_label"
										value={heroCtaLabel}
										onChange={(event) => setHeroCtaLabel(event.target.value)}
									/>
									{actionData?.errors?.heroCtaLabel ? (
										<p className="text-destructive text-sm">{actionData.errors.heroCtaLabel}</p>
									) : null}
								</div>
								<div className="space-y-2">
									<Label htmlFor="hero_cta_helper">CTA helper</Label>
									<Input
										id="hero_cta_helper"
										name="hero_cta_helper"
										value={heroCtaHelper}
										onChange={(event) => setHeroCtaHelper(event.target.value)}
										placeholder="e.g., Join hundreds of teams"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="calendar_url">Calendar scheduling link</Label>
								<Input
									id="calendar_url"
									name="calendar_url"
									value={calendarUrl}
									onChange={(event) => setCalendarUrl(event.target.value)}
									placeholder="https://cal.com/your-team"
								/>
								{actionData?.errors?.calendarUrl ? (
									<p className="text-destructive text-sm">{actionData.errors.calendarUrl}</p>
								) : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="redirect_url">Redirect URL</Label>
								<Input
									id="redirect_url"
									name="redirect_url"
									value={redirectUrl}
									onChange={(event) => setRedirectUrl(event.target.value)}
									placeholder="https://"
								/>
								{actionData?.errors?.redirectUrl ? (
									<p className="text-destructive text-sm">{actionData.errors.redirectUrl}</p>
								) : null}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Survey questions</CardTitle>
						</CardHeader>
						<CardContent>
							<QuestionListEditor questions={questions} onChange={setQuestions} />
							{actionData?.errors?.questions ? (
								<p className="mt-3 text-destructive text-sm">{actionData.errors.questions}</p>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Experience options</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between rounded-md border px-4 py-3">
								<div>
									<h3 className="font-medium text-sm">Allow chat responses</h3>
									<p className="text-muted-foreground text-xs">
										Offer a conversational alternative that mirrors our sign-up chat after the form.
									</p>
								</div>
								<Switch checked={allowChat} onCheckedChange={setAllowChat} />
								<input type="hidden" name="allow_chat" value={String(allowChat)} />
							</div>
							<div className="flex items-center justify-between rounded-md border px-4 py-3">
								<div>
									<h3 className="font-medium text-sm">Default response mode</h3>
									<p className="text-muted-foreground text-xs">Choose the default experience when the link opens.</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant={defaultResponseMode === "form" ? "default" : "outline"}
										size="sm"
										onClick={() => setDefaultResponseMode("form")}
									>
										Form
									</Button>
									<Button
										type="button"
										variant={defaultResponseMode === "chat" ? "default" : "outline"}
										size="sm"
										onClick={() => setDefaultResponseMode("chat")}
										disabled={!allowChat}
									>
										Chat
									</Button>
								</div>
								<input type="hidden" name="default_response_mode" value={defaultResponseMode} />
							</div>
							<div className="flex items-center justify-between rounded-md border px-4 py-3">
								<div>
									<h3 className="font-medium text-sm">Mark as live</h3>
									<p className="text-muted-foreground text-xs">Only live links are available on the public slug.</p>
								</div>
								<Switch checked={isLive} onCheckedChange={setIsLive} />
								<input type="hidden" name="is_live" value={String(isLive)} />
							</div>
						</CardContent>
					</Card>

					<input type="hidden" name="questions" value={questionsJson} />
					<div className="flex items-center justify-end gap-3">
						<Button asChild variant="outline">
							<Link to={routes.ask.index()}>Cancel</Link>
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : "Create research link"}
						</Button>
					</div>
				</div>

				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
					<ResearchLinkPreview
						heroTitle={heroTitle}
						heroSubtitle={heroSubtitle}
						heroCtaLabel={heroCtaLabel}
						heroCtaHelper={heroCtaHelper}
						questions={questions}
					/>
				</motion.div>
			</Form>
		</PageContainer>
	)
}
