import slugify from "@sindresorhus/slugify";
import {
	Archive,
	ArrowLeft,
	Check,
	ChevronDown,
	ChevronRight,
	Code,
	Copy,
	ExternalLink,
	Link2,
	Loader2,
	Mail,
	Pencil,
	QrCode,
	Send,
	Share2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useRevalidator } from "react-router-dom";
import { toast } from "sonner";
import { PicaConnectButton } from "~/components/integrations/PicaConnectButton";
import { PageContainer } from "~/components/layout/PageContainer";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getGmailConnection } from "~/lib/integrations/gmail.server";
import { getServerClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";
import { createR2PresignedUrl } from "~/utils/r2.server";
import { createRouteDefinitions } from "~/utils/route-definitions";
import { EmbedCodeGenerator } from "../components/EmbedCodeGenerator";
import { QRCodeButton } from "../components/QRCodeButton";
import { QRCodeModal } from "../components/QRCodeModal";
import { QuestionListEditor } from "../components/QuestionListEditor";
import { SendSurveyDialog } from "../components/SendSurveyDialog";
import { WalkthroughRecorder } from "../components/WalkthroughRecorder";
import { getResearchLinkById } from "../db";
import { extractFormFields, useOptimisticForm } from "../hooks/useOptimisticForm";
import { RESPONDENT_FIELD_DEFINITIONS } from "../respondent-fields";
import {
	createEmptyQuestion,
	ResearchLinkPayloadSchema,
	type ResearchLinkQuestion,
	ResearchLinkQuestionSchema,
} from "../schemas";

/** Multi-picker for selecting which respondent fields to collect */
function RespondentFieldsPicker({
	fields,
	onChange,
	identityType,
}: {
	fields: string[];
	onChange: (fields: string[]) => void;
	identityType: "anonymous" | "email" | "phone";
}) {
	const [expanded, setExpanded] = useState(fields.length > 0);
	const activeCount = fields.length;

	// Filter out phone if identity is already phone-based
	const options = RESPONDENT_FIELD_DEFINITIONS.filter((opt) => !(opt.key === "phone" && identityType === "phone"));

	const toggleField = (key: string) => {
		const next = fields.includes(key) ? fields.filter((f) => f !== key) : [...fields, key];
		onChange(next);
	};

	return (
		<div className="rounded-md border px-3 py-2.5">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center justify-between gap-4"
			>
				<div className="min-w-0">
					<span className="block font-medium text-sm">Respondent fields</span>
					<span className="block text-muted-foreground text-xs">
						{identityType === "anonymous"
							? "Collect info before the survey"
							: `Collect additional info after ${identityType}`}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{activeCount > 0 && (
						<span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
							{activeCount}
						</span>
					)}
					{expanded ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</div>
			</button>
			{expanded && (
				<div className="mt-2 space-y-1 border-t pt-2">
					{options.map((opt) => (
						<label
							key={opt.key}
							className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/30"
						>
							<Checkbox checked={fields.includes(opt.key)} onCheckedChange={() => toggleField(opt.key)} />
							<span className="text-sm">{opt.label}</span>
						</label>
					))}
				</div>
			)}
		</div>
	);
}

export const meta: MetaFunction = () => {
	return [{ title: "Edit Ask Link" }, { name: "description", content: "Customize your Ask link experience." }];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
	const { accountId, projectId, listId } = params;
	if (!accountId || !projectId || !listId) {
		throw new Response("Missing route parameters", { status: 400 });
	}
	const { client: supabase } = getServerClient(request);
	const ctx = context.get(userContext);
	const userId = ctx?.claims?.sub;
	const [listResult, responseCountResult] = await Promise.all([
		getResearchLinkById({ supabase, accountId, listId }),
		supabase
			.from("research_link_responses")
			.select("id", { count: "exact", head: true })
			.eq("research_link_id", listId),
	]);
	const { data, error } = listResult;
	if (error) {
		throw new Response(error.message, { status: 500 });
	}
	if (!data) {
		throw new Response("Ask link not found", { status: 404 });
	}
	const responseCount = responseCountResult.count ?? 0;
	const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
	const parsedQuestions: ResearchLinkQuestion[] = [];
	let invalidQuestionCount = 0;
	for (const rawQuestion of rawQuestions) {
		const parsedQuestion = ResearchLinkQuestionSchema.safeParse(rawQuestion);
		if (parsedQuestion.success) {
			parsedQuestions.push(parsedQuestion.data);
		} else {
			invalidQuestionCount += 1;
		}
	}
	if (invalidQuestionCount > 0) {
		console.warn("edit.$listId loader: dropped invalid survey questions", {
			listId,
			invalidQuestionCount,
			totalRawQuestions: rawQuestions.length,
		});
	}

	// Generate signed URLs for walkthrough video + thumbnail if they exist
	let walkthroughSignedUrl: string | null = null;
	let walkthroughThumbnailUrl: string | null = null;
	if (data.walkthrough_video_url) {
		const key = data.walkthrough_video_url;
		const ext = key.split(".").pop()?.toLowerCase();
		const contentType = ext === "mp4" ? "video/mp4" : ext === "mov" ? "video/quicktime" : "video/webm";
		const presigned = createR2PresignedUrl({
			key,
			expiresInSeconds: 3600,
			responseContentType: contentType,
		});
		walkthroughSignedUrl = presigned?.url ?? null;
	}
	if (data.walkthrough_thumbnail_url) {
		const presigned = createR2PresignedUrl({
			key: data.walkthrough_thumbnail_url,
			expiresInSeconds: 3600,
			responseContentType: "image/jpeg",
		});
		const origin = new URL(request.url).origin;
		const publicUrl = data.is_live ? `${origin}/ask/${data.slug}/thumbnail` : null;
		walkthroughThumbnailUrl = publicUrl ?? presigned?.url ?? null;
	}

	// Check Gmail connection for email distribution prompt
	let gmailConnected = false;
	let gmailEmail: string | null = null;
	if (userId) {
		const gmail = await getGmailConnection(supabase, userId, accountId);
		if (gmail) {
			gmailConnected = true;
			gmailEmail = gmail.email;
		}
	}

	// Load people with emails for recipient picker (only if gmail connected)
	let peopleWithEmails: Array<{
		id: string;
		name: string | null;
		primary_email: string | null;
		person_type: string | null;
	}> = [];
	if (gmailConnected) {
		const { data: peopleData } = await supabase
			.from("people")
			.select("id, name, primary_email, person_type")
			.eq("project_id", projectId)
			.not("primary_email", "is", null)
			.order("name", { ascending: true })
			.limit(200);
		peopleWithEmails = peopleData ?? [];
	}

	return {
		accountId,
		projectId,
		listId,
		userId: userId ?? "",
		list: data,
		questions: parsedQuestions,
		walkthroughSignedUrl,
		walkthroughThumbnailUrl,
		gmailConnected,
		gmailEmail,
		peopleWithEmails,
		responseCount,
		aiAnalysis: (data as { ai_analysis?: unknown }).ai_analysis ?? null,
		aiAnalysisUpdatedAt: (data as { ai_analysis_updated_at?: string }).ai_analysis_updated_at ?? null,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const accountId = params.accountId;
	const listId = params.listId;
	if (!accountId || !listId) {
		throw new Response("Missing route parameters", { status: 400 });
	}

	const formData = await request.formData();
	const rawPayload = {
		name: formData.get("name") ?? "",
		slug: formData.get("slug") ?? "",
		description: formData.get("description") ?? undefined,
		heroTitle: formData.get("hero_title") ?? undefined,
		heroSubtitle: formData.get("hero_subtitle") ?? undefined,
		instructions: formData.get("instructions") ?? undefined,
		heroCtaLabel: formData.get("hero_cta_label") ?? undefined,
		heroCtaHelper: formData.get("hero_cta_helper") ?? undefined,
		calendarUrl: formData.get("calendar_url") ?? undefined,
		redirectUrl: formData.get("redirect_url") ?? undefined,
		allowChat: formData.get("allow_chat"),
		allowVoice: formData.get("allow_voice"),
		allowVideo: formData.get("allow_video"),
		defaultResponseMode: formData.get("default_response_mode"),
		isLive: formData.get("is_live"),
		isArchived: formData.get("is_archived"),
		collectTitle: formData.get("collect_title"),
		respondentFields: formData.get("respondent_fields") ?? undefined,
		questions: formData.get("questions") ?? "[]",
	};

	const parsed = ResearchLinkPayloadSchema.safeParse(rawPayload);
	if (!parsed.success) {
		const issues = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
			if (issue.path.length > 0) {
				acc[issue.path[0] as string] = issue.message;
			} else {
				acc._form = issue.message;
			}
			return acc;
		}, {});
		return Response.json({ errors: issues }, { status: 400 });
	}

	const payload = parsed.data;
	const { client: supabase } = getServerClient(request);

	const updatePayload: Record<string, unknown> = {
		name: payload.name,
		slug: payload.slug,
	};

	if (formData.has("description")) updatePayload.description = payload.description;
	if (formData.has("hero_title")) updatePayload.hero_title = payload.heroTitle;
	if (formData.has("hero_subtitle")) updatePayload.hero_subtitle = payload.heroSubtitle;
	if (formData.has("instructions")) updatePayload.instructions = payload.instructions;
	if (formData.has("hero_cta_label")) updatePayload.hero_cta_label = payload.heroCtaLabel;
	if (formData.has("hero_cta_helper")) updatePayload.hero_cta_helper = payload.heroCtaHelper;
	if (formData.has("calendar_url")) updatePayload.calendar_url = payload.calendarUrl;
	if (formData.has("redirect_url")) updatePayload.redirect_url = payload.redirectUrl;
	if (formData.has("questions")) updatePayload.questions = payload.questions;
	if (formData.has("allow_chat")) updatePayload.allow_chat = payload.allowChat;
	if (formData.has("allow_voice")) updatePayload.allow_voice = payload.allowVoice;
	if (formData.has("allow_video")) updatePayload.allow_video = payload.allowVideo;
	if (formData.has("default_response_mode")) updatePayload.default_response_mode = payload.defaultResponseMode;
	if (formData.has("is_live")) updatePayload.is_live = payload.isLive;
	if (formData.has("is_archived")) updatePayload.is_archived = payload.isArchived;
	if (formData.has("collect_title")) updatePayload.collect_title = payload.collectTitle;
	if (formData.has("respondent_fields")) {
		updatePayload.respondent_fields = payload.respondentFields;
		// Keep collect_title in sync for backwards compatibility
		const fields = payload.respondentFields ?? [];
		updatePayload.collect_title = fields.includes("title");
	}
	if (formData.has("ai_autonomy")) {
		const autonomy = formData.get("ai_autonomy");
		if (autonomy === "strict" || autonomy === "moderate" || autonomy === "adaptive") {
			updatePayload.ai_autonomy = autonomy;
		}
	}
	// Convert simplified identity_type back to identity_mode + identity_field
	if (formData.has("identity_type")) {
		const type = formData.get("identity_type");
		if (type === "anonymous") {
			updatePayload.identity_mode = "anonymous";
			updatePayload.identity_field = "email"; // default, not used
		} else if (type === "email") {
			updatePayload.identity_mode = "identified";
			updatePayload.identity_field = "email";
		} else if (type === "phone") {
			updatePayload.identity_mode = "identified";
			updatePayload.identity_field = "phone";
		}
	}

	const { data, error } = await supabase
		.from("research_links")
		.update(updatePayload)
		.eq("account_id", accountId)
		.eq("id", listId)
		.select("id")
		.maybeSingle();

	if (error) {
		if (error.code === "23505") {
			return Response.json({ errors: { slug: "That slug is already in use" } }, { status: 400 });
		}
		return Response.json({ errors: { _form: error.message } }, { status: 500 });
	}

	if (!data) {
		return Response.json({ errors: { _form: "Unable to update research link" } }, { status: 500 });
	}

	return { ok: true };
}

export default function EditResearchLinkPage() {
	const {
		accountId,
		projectId,
		listId,
		userId,
		list,
		questions: initialQuestions,
		walkthroughSignedUrl: initialWalkthroughUrl,
		walkthroughThumbnailUrl: initialWalkthroughThumbnailUrl,
		gmailConnected,
		gmailEmail,
		peopleWithEmails,
		responseCount,
		aiAnalysis,
	} = useLoaderData<typeof loader>();
	const routes = createRouteDefinitions(`/a/${accountId}/${projectId}`);

	// Loader-first state: dirty edits overlay on top of loader data
	const questionsWithDefault = useMemo(
		() => (initialQuestions.length > 0 ? initialQuestions : [createEmptyQuestion()]),
		[initialQuestions]
	);
	const loaderFields = useMemo(() => extractFormFields(list, questionsWithDefault), [list, questionsWithDefault]);
	const { fields, setText, setImmediate, setDirtyOnly, clearDirtyField, setQuestions, status, errors } =
		useOptimisticForm(loaderFields);
	const revalidator = useRevalidator();

	// UI-only state (not form fields)
	const [slugEdited, setSlugEdited] = useState(true);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const titleInputRef = useRef<HTMLInputElement>(null);
	const [walkthroughVideoUrl, setWalkthroughVideoUrl] = useState<string | null>(initialWalkthroughUrl ?? null);
	const [walkthroughThumbnailUrl, setWalkthroughThumbnailUrl] = useState<string | null>(
		initialWalkthroughThumbnailUrl ?? null
	);
	const [copiedLink, setCopiedLink] = useState(false);
	const [sendDialogOpen, setSendDialogOpen] = useState(false);
	const [isQRModalOpen, setIsQRModalOpen] = useState(false);

	// Auto-slug from name
	useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus();
			titleInputRef.current.select();
		}
	}, [isEditingTitle]);

	useEffect(() => {
		if (!slugEdited) {
			const nextSlug = slugify(fields.name || "research-link", {
				lowercase: true,
			});
			setDirtyOnly("slug", nextSlug);
		}
	}, [fields.name, slugEdited, setDirtyOnly]);

	// Reset default response mode if its modality is disabled
	useEffect(() => {
		if (!fields.allowChat && fields.defaultResponseMode === "chat") {
			setImmediate("defaultResponseMode", "form");
		}
		if (!fields.allowVoice && fields.defaultResponseMode === "voice") {
			setImmediate("defaultResponseMode", "form");
		}
	}, [fields.allowChat, fields.allowVoice, fields.defaultResponseMode, setImmediate]);

	const publicLink = useMemo(() => {
		const path = routes.ask.public(fields.slug || "your-slug");
		if (typeof window === "undefined") return path;
		return `${window.location.origin}${path}`;
	}, [routes, fields.slug]);

	const surveyCoachingContext = useMemo(() => {
		const parts = [
			`Survey name: ${fields.name || "Untitled survey"}`,
			`Survey description: ${(list.description as string | null) ?? "Not provided"}`,
			`Landing subtitle: ${fields.heroSubtitle || "Not provided"}`,
			`Instructions: ${fields.instructions || "Not provided"}`,
			`Identity mode: ${fields.identityType}`,
			`Respondent fields: ${fields.respondentFields.join(", ") || "none"}`,
			"Assume low-commitment respondents unless context says otherwise (new audience, no incentives).",
		];
		return parts.join("\n");
	}, [
		fields.name,
		fields.heroSubtitle,
		fields.instructions,
		fields.identityType,
		fields.respondentFields,
		list.description,
	]);

	useEffect(() => {
		const handleSurveyQuestionsUpdated = (event: Event) => {
			const custom = event as CustomEvent<{ surveyId?: string }>;
			const updatedSurveyId = custom.detail?.surveyId;
			if (updatedSurveyId && updatedSurveyId !== listId) return;
			clearDirtyField("questions");
			revalidator.revalidate();
		};

		window.addEventListener("upsight:survey-questions-updated", handleSurveyQuestionsUpdated);
		return () => {
			window.removeEventListener("upsight:survey-questions-updated", handleSurveyQuestionsUpdated);
		};
	}, [listId, clearDirtyField, revalidator]);

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(publicLink);
			setCopiedLink(true);
			window.setTimeout(() => setCopiedLink(false), 2000);
		} catch {
			setCopiedLink(false);
		}
	};

	return (
		<PageContainer className="max-w-3xl space-y-4">
			<div className="space-y-4">
				{/* Sticky top bar with actions */}
				<div className="-mx-4 sticky top-0 z-20 border-border/40 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
					<div className="flex items-center justify-between gap-3">
						<div className="group/title flex items-center gap-2 overflow-hidden">
							<Link to={routes.ask.index()} className="shrink-0 text-muted-foreground hover:text-foreground">
								<ArrowLeft className="h-4 w-4" />
							</Link>
							{isEditingTitle ? (
								<input
									ref={titleInputRef}
									value={fields.name}
									onChange={(e) => setText("name", e.target.value)}
									onBlur={() => setIsEditingTitle(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter") setIsEditingTitle(false);
										if (e.key === "Escape") setIsEditingTitle(false);
									}}
									className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-0.5 font-medium text-sm focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							) : (
								<button
									type="button"
									onClick={() => setIsEditingTitle(true)}
									className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/50"
								>
									<span className="truncate font-medium text-sm">{fields.name || "Untitled"}</span>
									<Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" />
								</button>
							)}
							{status === "saving" && (
								<span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
									<Loader2 className="h-3 w-3 animate-spin" />
									Saving...
								</span>
							)}
							{status === "saved" && <span className="shrink-0 text-green-600 text-xs">Saved</span>}
							{status === "error" && <span className="shrink-0 text-destructive text-xs">Error</span>}
						</div>
						<div className="flex items-center gap-2">
							<Button asChild variant="ghost" size="sm">
								<Link to={routes.ask.responses(list.id)}>Responses</Link>
							</Button>
						</div>
					</div>
					{errors?._form && <p className="mt-1.5 text-destructive text-xs">{errors._form}</p>}
				</div>

				<div className="space-y-4">
					<div className="min-w-0 space-y-4">
						<Tabs defaultValue="questions" className="space-y-4">
							<TabsList className="w-full justify-start">
								<TabsTrigger value="landing">Landing page</TabsTrigger>
								<TabsTrigger value="questions">Questions</TabsTrigger>
								<TabsTrigger value="options">Options</TabsTrigger>
								<TabsTrigger value="distribute">Distribute</TabsTrigger>
							</TabsList>

							<TabsContent value="landing" className="space-y-1.5">
								<h3 className="font-medium text-foreground/80 text-sm">Landing Page</h3>
								<Card>
									<CardContent className="space-y-3 py-3">
										<div className="space-y-1.5">
											<Label htmlFor="hero_title" className="text-muted-foreground text-xs">
												Headline
											</Label>
											<Input
												id="hero_title"
												value={fields.heroTitle}
												onChange={(event) => setText("heroTitle", event.target.value)}
												placeholder="Share your thoughts"
												className="h-9"
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="hero_subtitle" className="text-muted-foreground text-xs">
												Description
											</Label>
											<Textarea
												id="hero_subtitle"
												value={fields.heroSubtitle}
												onChange={(event) => setText("heroSubtitle", event.target.value)}
												rows={2}
												placeholder="Brief description shown on landing page"
												className="resize-none"
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="instructions" className="text-muted-foreground text-xs">
												Instructions
											</Label>
											<Textarea
												id="instructions"
												value={fields.instructions}
												onChange={(event) => setText("instructions", event.target.value)}
												rows={3}
												placeholder="Detailed instructions shown before starting the survey (optional)"
												className="resize-none"
											/>
										</div>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-1.5">
												<Label htmlFor="hero_cta_label" className="text-muted-foreground text-xs">
													Button text
												</Label>
												<Input
													id="hero_cta_label"
													value={fields.heroCtaLabel}
													onChange={(event) => setText("heroCtaLabel", event.target.value)}
													className="h-9"
												/>
											</div>
											<div className="space-y-1.5">
												<Label htmlFor="hero_cta_helper" className="text-muted-foreground text-xs">
													Helper text
												</Label>
												<Input
													id="hero_cta_helper"
													value={fields.heroCtaHelper}
													onChange={(event) => setText("heroCtaHelper", event.target.value)}
													className="h-9"
												/>
											</div>
										</div>
										{/* Intro video — part of the landing page */}
										<div className="border-t pt-3">
											<Label className="text-muted-foreground text-xs">Intro video</Label>
											<div className="mt-1.5">
												<WalkthroughRecorder
													listId={list.id}
													existingVideoUrl={walkthroughVideoUrl}
													onUploadComplete={(url) => {
														setWalkthroughVideoUrl(url);
														setWalkthroughThumbnailUrl(null);
													}}
													onDelete={() => {
														setWalkthroughVideoUrl(null);
														setWalkthroughThumbnailUrl(null);
													}}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="questions" className="space-y-1.5">
								{/* Respondent fields summary — shows what data is being collected */}
								{fields.respondentFields.length > 0 && (
									<div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-3 py-2">
										<span className="mr-1 text-muted-foreground text-xs">Collecting:</span>
										{fields.identityType === "email" && (
											<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
												Email
											</span>
										)}
										{fields.identityType === "phone" && (
											<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
												Phone
											</span>
										)}
										{fields.respondentFields.map((key) => {
											const opt = RESPONDENT_FIELD_DEFINITIONS.find((o) => o.key === key);
											return (
												<span key={key} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
													{opt?.label ?? key}
												</span>
											);
										})}
									</div>
								)}
								<Card>
									<CardContent className="py-3">
										<QuestionListEditor
											questions={fields.questions}
											onChange={setQuestions}
											listId={listId}
											coachingContext={surveyCoachingContext}
											aiAnalysis={aiAnalysis}
											responseCount={responseCount}
										/>
										{errors?.questions ? <p className="mt-3 text-destructive text-xs">{errors.questions}</p> : null}
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="options" className="space-y-1.5">
								<h3 className="font-medium text-foreground/80 text-sm">Options</h3>
								<Card>
									<CardContent className="space-y-2 py-3">
										{/* Identity Type - simplified to three options (FIRST - what users see first) */}
										<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
											<div className="min-w-0">
												<p className="font-medium text-sm">Identification</p>
												<p className="truncate text-muted-foreground text-xs">How respondents identify themselves</p>
											</div>
											<div className="flex items-center gap-1.5">
												<Button
													type="button"
													variant={fields.identityType === "anonymous" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("identityType", "anonymous")}
												>
													Anonymous
												</Button>
												<Button
													type="button"
													variant={fields.identityType === "email" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("identityType", "email")}
												>
													Email
												</Button>
												<Button
													type="button"
													variant={fields.identityType === "phone" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("identityType", "phone")}
												>
													Phone
												</Button>
											</div>
										</div>
										<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
											<div className="min-w-0">
												<p className="font-medium text-sm">Chat mode</p>
												<p className="truncate text-muted-foreground text-xs">Let respondents talk instead of type</p>
											</div>
											<Switch checked={fields.allowChat} onCheckedChange={(v) => setImmediate("allowChat", v)} />
										</div>
										<div className="flex items-center justify-between gap-4 rounded-md border border-violet-500/30 border-dashed bg-violet-500/5 px-3 py-2.5">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<p className="font-medium text-sm">Voice mode</p>
													<span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-medium text-[10px] text-violet-600">
														Experimental
													</span>
												</div>
												<p className="truncate text-muted-foreground text-xs">
													AI voice agent for conversational interviews
												</p>
											</div>
											<Switch checked={fields.allowVoice} onCheckedChange={(v) => setImmediate("allowVoice", v)} />
										</div>
										<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
											<div className="min-w-0">
												<p className="font-medium text-sm">Video responses</p>
												<p className="truncate text-muted-foreground text-xs">Let respondents record video feedback</p>
											</div>
											<Switch checked={fields.allowVideo} onCheckedChange={(v) => setImmediate("allowVideo", v)} />
										</div>
										<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
											<div className="min-w-0">
												<p className="font-medium text-sm">Default mode</p>
											</div>
											<div className="flex items-center gap-1.5">
												<Button
													type="button"
													variant={fields.defaultResponseMode === "form" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("defaultResponseMode", "form")}
												>
													Form
												</Button>
												<Button
													type="button"
													variant={fields.defaultResponseMode === "chat" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("defaultResponseMode", "chat")}
													disabled={!fields.allowChat}
												>
													Chat
												</Button>
												<Button
													type="button"
													variant={fields.defaultResponseMode === "voice" ? "default" : "ghost"}
													size="sm"
													className="h-7 px-2.5"
													onClick={() => setImmediate("defaultResponseMode", "voice")}
													disabled={!fields.allowVoice}
												>
													Voice
												</Button>
											</div>
										</div>
										{/* AI Autonomy - only show when chat or voice enabled */}
										{(fields.allowChat || fields.allowVoice) && (
											<div className="flex items-center justify-between gap-4 rounded-md border border-blue-500/30 border-dashed bg-blue-500/5 px-3 py-2.5">
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<p className="font-medium text-sm">AI autonomy</p>
														{fields.aiAutonomy === "adaptive" && (
															<span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-medium text-[10px] text-blue-600">
																Pro
															</span>
														)}
													</div>
													<p className="text-muted-foreground text-xs">
														{fields.aiAutonomy === "strict" && "Follows questions exactly"}
														{fields.aiAutonomy === "moderate" && "Can ask brief follow-ups"}
														{fields.aiAutonomy === "adaptive" && "Adapts based on respondent context"}
													</p>
												</div>
												<div className="flex items-center gap-1.5">
													<Button
														type="button"
														variant={fields.aiAutonomy === "strict" ? "default" : "ghost"}
														size="sm"
														className="h-7 px-2.5"
														onClick={() => setImmediate("aiAutonomy", "strict")}
													>
														Strict
													</Button>
													<Button
														type="button"
														variant={fields.aiAutonomy === "moderate" ? "default" : "ghost"}
														size="sm"
														className="h-7 px-2.5"
														onClick={() => setImmediate("aiAutonomy", "moderate")}
													>
														Moderate
													</Button>
													<Button
														type="button"
														variant={fields.aiAutonomy === "adaptive" ? "default" : "ghost"}
														size="sm"
														className="h-7 px-2.5"
														onClick={() => setImmediate("aiAutonomy", "adaptive")}
													>
														Adaptive
													</Button>
												</div>
											</div>
										)}
										<RespondentFieldsPicker
											fields={fields.respondentFields}
											onChange={(v) => setImmediate("respondentFields", v)}
											identityType={fields.identityType}
										/>
										<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
											<div className="min-w-0">
												<p className="font-medium text-sm">Live</p>
												<p className="truncate text-muted-foreground text-xs">Accessible via public link</p>
											</div>
											<Switch checked={fields.isLive} onCheckedChange={(v) => setImmediate("isLive", v)} />
										</div>
										<div className="flex items-center justify-between gap-4 rounded-md border border-amber-500/30 border-dashed bg-amber-500/5 px-3 py-2.5">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<Archive className="h-4 w-4 text-amber-600" />
													<p className="font-medium text-sm">Archived</p>
												</div>
												<p className="truncate text-muted-foreground text-xs">Hide from survey list (keeps data)</p>
											</div>
											<Switch checked={fields.isArchived} onCheckedChange={(v) => setImmediate("isArchived", v)} />
										</div>
										<div className="grid gap-3 pt-2 sm:grid-cols-2">
											<div className="space-y-1.5">
												<Label htmlFor="calendar_url" className="text-foreground text-xs">
													Calendar link
												</Label>
												<Input
													id="calendar_url"
													value={fields.calendarUrl}
													onChange={(event) => setText("calendarUrl", event.target.value)}
													placeholder="https://cal.com/..."
													className="h-9"
												/>
												{errors?.calendarUrl ? <p className="text-destructive text-xs">{errors.calendarUrl}</p> : null}
											</div>
											<div className="space-y-1.5">
												<Label htmlFor="redirect_url" className="text-foreground text-xs">
													Redirect after
												</Label>
												<Input
													id="redirect_url"
													value={fields.redirectUrl}
													onChange={(event) => setText("redirectUrl", event.target.value)}
													placeholder="https://..."
													className="h-9"
												/>
												{errors?.redirectUrl ? <p className="text-destructive text-xs">{errors.redirectUrl}</p> : null}
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="distribute" className="min-w-0 space-y-5 overflow-hidden">
								{/* Your Survey Link */}
								<Card>
									<CardContent className="space-y-3 py-3">
										<div className="flex items-center gap-2">
											<Link2 className="h-4 w-4 text-primary" />
											<p className="font-semibold text-sm">Your Survey Link</p>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="slug" className="text-muted-foreground text-xs">
												URL slug
											</Label>
											<Input
												id="slug"
												value={fields.slug}
												onChange={(event) => {
													const slugified = slugify(event.target.value, {
														lowercase: true,
														preserveLeadingUnderscore: false,
													});
													setText("slug", slugified);
													setSlugEdited(true);
												}}
												required
												className="h-9"
											/>
											{errors?.slug ? <p className="text-destructive text-xs">{errors.slug}</p> : null}
										</div>
										<div className="rounded-md border bg-muted/40 px-2.5 py-2 text-foreground/70 text-xs">
											<span className="break-all font-mono">{publicLink}</span>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button type="button" variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
												{copiedLink ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
												{copiedLink ? "Copied" : "Copy link"}
											</Button>
											<Button asChild variant="outline" size="sm" className="gap-2">
												<a href={publicLink} target="_blank" rel="noreferrer">
													<ExternalLink className="h-4 w-4" />
													Open in new tab
												</a>
											</Button>
										</div>
									</CardContent>
								</Card>

								{/* Share via QR Code */}
								<Card>
									<CardContent className="py-3">
										<div className="flex items-center justify-between gap-3">
											<div className="flex items-center gap-3">
												<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
													<QrCode className="h-4 w-4 text-muted-foreground" />
												</div>
												<div>
													<p className="font-medium text-sm">Share via QR code</p>
													<p className="text-muted-foreground text-xs">
														Print or display at events, on packaging, or in presentations.
													</p>
												</div>
											</div>
											<QRCodeButton url={publicLink} onClick={() => setIsQRModalOpen(true)} />
										</div>
									</CardContent>
								</Card>

								{/* Send via Email (Gmail) */}
								<Card>
									<CardContent className="space-y-3 py-3">
										<div className="flex items-center gap-2">
											<Mail className="h-4 w-4 text-primary" />
											<p className="font-semibold text-sm">Send via Email</p>
										</div>

										{/* Gmail direct send */}
										{gmailConnected ? (
											<div className="flex items-center gap-3 rounded-md border bg-green-50/50 p-3 dark:bg-green-950/20">
												<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
													<Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
												</div>
												<div className="flex-1">
													<p className="font-medium text-sm">
														Gmail connected
														{gmailEmail && (
															<span className="ml-1 font-normal text-muted-foreground">({gmailEmail})</span>
														)}
													</p>
													<p className="text-muted-foreground text-xs">Send survey invites directly from UpSight.</p>
												</div>
												<Button type="button" size="sm" onClick={() => setSendDialogOpen(true)} className="gap-2">
													<Send className="h-4 w-4" />
													Send Survey
												</Button>
											</div>
										) : (
											<div className="flex items-center justify-between gap-3 rounded-md border p-3">
												<div className="flex items-center gap-3">
													<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
														<Mail className="h-4 w-4 text-muted-foreground" />
													</div>
													<div>
														<p className="font-medium text-sm">Send from Gmail</p>
														<p className="text-muted-foreground text-xs">
															Connect Gmail to send invites directly from UpSight.
														</p>
													</div>
												</div>
												<PicaConnectButton
													userId={userId}
													accountId={accountId}
													platform="gmail"
													saveAction="/api/gmail/save-connection"
													icon={Mail}
													onSuccess={() => {
														toast.success("Gmail connected");
														window.location.reload();
													}}
													onError={(err) => toast.error(err)}
													size="sm"
													variant="outline"
												>
													Connect Gmail
												</PicaConnectButton>
											</div>
										)}

										{/* External email platforms */}
										<div className="rounded-lg border bg-muted/20 p-3">
											<p className="mb-1 font-medium text-foreground text-xs">Using Mailchimp, SendGrid, or another platform?</p>
											<p className="text-muted-foreground text-xs">
												Copy your survey link above and add it to your email campaign. Append{" "}
												<code className="rounded bg-muted px-1 text-[11px]">?email=*|EMAIL|*</code> (Mailchimp) or{" "}
												<code className="rounded bg-muted px-1 text-[11px]">{"?email={{email}}"}</code> (SendGrid/Postmark) to
												pre-fill the respondent's email for automatic identity matching.
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												You can also pass{" "}
												<code className="rounded bg-muted px-1 text-[11px]">name</code>,{" "}
												<code className="rounded bg-muted px-1 text-[11px]">company</code>,{" "}
												<code className="rounded bg-muted px-1 text-[11px]">title</code>, and more to pre-fill profile fields.
											</p>
											<Link to="/docs/survey-distribution" className="mt-2 inline-block text-primary text-xs underline">
												See full email platform setup guide
											</Link>
										</div>
									</CardContent>
								</Card>

								{/* Embed on Website */}
								<Card>
									<CardContent className="space-y-2 py-3">
										<div className="flex items-center gap-2">
											<Code className="h-4 w-4 text-primary" />
											<p className="font-semibold text-sm">Embed on Your Website</p>
										</div>
										<p className="text-muted-foreground text-xs">
											Add this survey to your website for waitlists, feedback collection, or lead capture.
										</p>
										<EmbedCodeGenerator
											slug={fields.slug}
											heroTitle={fields.heroTitle}
											heroCtaLabel={fields.heroCtaLabel}
											walkthroughVideoUrl={walkthroughVideoUrl}
											walkthroughThumbnailUrl={walkthroughThumbnailUrl}
										/>
									</CardContent>
								</Card>

								{/* Share on Social / Messaging */}
								<Card>
									<CardContent className="py-3">
										<div className="flex items-center gap-3">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
												<Share2 className="h-4 w-4 text-muted-foreground" />
											</div>
											<div>
												<p className="font-medium text-sm">Share on Slack, Teams, or Social</p>
												<p className="text-muted-foreground text-xs">
													Paste your survey link in channels, DMs, or social posts. Respondents will self-identify when they start.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</div>

			{/* Send Survey Dialog */}
			{gmailConnected && gmailEmail && (
				<SendSurveyDialog
					open={sendDialogOpen}
					onOpenChange={setSendDialogOpen}
					accountId={accountId}
					projectId={projectId}
					surveyId={listId}
					surveySlug={fields.slug}
					surveyName={fields.name}
					fromEmail={gmailEmail}
					people={peopleWithEmails}
				/>
			)}
			{/* QR Code Modal */}
			<QRCodeModal
				isOpen={isQRModalOpen}
				onClose={() => setIsQRModalOpen(false)}
				url={publicLink}
				title={fields.name}
			/>
		</PageContainer>
	);
}
