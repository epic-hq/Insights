/**
 * Admin Activity Dashboard
 *
 * Shows recent survey and interview activity across all accounts.
 * Surveys table with filter (All/Live/Draft/Archived) and admin actions.
 * Interviews table split by survey responses and regular interviews.
 */

import { Archive, ExternalLink, FileText, MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { AdminNav } from "~/features/admin/components/admin-nav";
import { createSupabaseAdminClient, getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";
import type { Route } from "./+types/activity";

type ResearchLinkRow = {
	id: string;
	name: string | null;
	slug: string;
	is_live: boolean;
	is_archived: boolean;
	created_at: string;
	updated_at: string;
	account_id: string;
	project_id: string | null;
	default_response_mode: string | null;
	identity_mode: string | null;
};

type ResearchLinkResponseRow = {
	id: string;
	research_link_id: string;
	person_id: string | null;
	created_at: string;
	completed: boolean;
	response_mode: string;
	email: string | null;
	responses: Record<string, unknown> | null;
	research_links?: { id: string; name: string | null; slug: string } | null;
	people?: {
		id: string;
		name: string | null;
		firstname: string | null;
		lastname: string | null;
	} | null;
};

function countAnsweredQuestions(responses: Record<string, unknown> | null): number {
	if (!responses) return 0;
	let count = 0;
	for (const value of Object.values(responses)) {
		if (value === null || value === undefined) continue;
		if (typeof value === "string") {
			if (value.trim().length === 0) continue;
			count += 1;
			continue;
		}
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			count += 1;
			continue;
		}
		// booleans, numbers, objects
		count += 1;
	}
	return count;
}

function timeAgo(dateStr: string) {
	const now = new Date();
	const d = new Date(dateStr);
	const diffMs = now.getTime() - d.getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const { client: supabase } = getServerClient(request);

	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("is_platform_admin")
		.eq("user_id", user.sub)
		.single();

	if (!userSettings?.is_platform_admin) {
		throw new Response("Access denied: Platform admin required", {
			status: 403,
		});
	}

	const admin = createSupabaseAdminClient();

	// accounts table is in `accounts` schema, not public — no PostgREST joins.
	const [surveysResult, interviewsResult, recentSubmittedSurveyResponsesResult] = await Promise.all([
		admin
			.from("research_links")
			.select(
				"id, name, slug, is_live, is_archived, created_at, updated_at, account_id, project_id, default_response_mode, identity_mode"
			)
			.order("created_at", { ascending: false })
			.limit(200),

		admin
			.from("interviews")
			.select(
				"id, title, status, source_type, created_at, updated_at, account_id, project_id, research_link_id, person_id, duration_sec"
			)
			.order("created_at", { ascending: false })
			.limit(100),

		admin
			.from("research_link_responses")
			.select("id, research_link_id, person_id, created_at, completed, response_mode, email, responses")
			.order("created_at", { ascending: false })
			.limit(10),
	]);

	if (surveysResult.error) {
		console.error("[admin/activity] failed to load research_links", surveysResult.error);
		throw new Response("Failed to load surveys", { status: 500 });
	}
	if (interviewsResult.error) {
		console.error("[admin/activity] failed to load interviews", interviewsResult.error);
		throw new Response("Failed to load interviews", { status: 500 });
	}
	if (recentSubmittedSurveyResponsesResult.error) {
		console.error(
			"[admin/activity] failed to load research_link_responses",
			recentSubmittedSurveyResponsesResult.error
		);
		throw new Response("Failed to load survey responses", { status: 500 });
	}

	const surveys = (surveysResult.data ?? []) as unknown as ResearchLinkRow[];
	const recentSubmittedSurveyResponses = (recentSubmittedSurveyResponsesResult.data ??
		[]) as unknown as ResearchLinkResponseRow[];

	// Look up account and project names
	const accountIds = new Set<string>();
	const projectIds = new Set<string>();
	for (const s of surveys) {
		if (s.account_id) accountIds.add(s.account_id);
		if (s.project_id) projectIds.add(s.project_id);
	}
	for (const i of interviewsResult.data || []) {
		if (i.account_id) accountIds.add(i.account_id);
		if (i.project_id) projectIds.add(i.project_id);
	}

	const [accountsResult, projectsResult] = await Promise.all([
		accountIds.size > 0
			? admin
					.schema("accounts")
					.from("accounts")
					.select("id, name")
					.in("id", [...accountIds])
			: { data: [] },
		projectIds.size > 0
			? admin
					.from("projects")
					.select("id, name")
					.in("id", [...projectIds])
			: { data: [] },
	]);

	const accountNames: Record<string, string> = {};
	for (const a of (accountsResult as { data: Array<{ id: string; name: string }> | null }).data || []) {
		accountNames[a.id] = a.name;
	}
	const projectNames: Record<string, string> = {};
	for (const p of (projectsResult as { data: Array<{ id: string; name: string }> | null }).data || []) {
		projectNames[p.id] = p.name;
	}

	// Count responses per survey from research_link_responses table
	// (NOT interviews.research_link_id which is unused)
	const { data: allResponses } = await admin.from("research_link_responses").select("research_link_id");

	const responseCounts: Record<string, number> = {};
	for (const r of allResponses || []) {
		if (r.research_link_id) {
			responseCounts[r.research_link_id] = (responseCounts[r.research_link_id] || 0) + 1;
		}
	}

	return {
		surveys,
		interviews: interviewsResult.data || [],
		responseCounts,
		accountNames,
		projectNames,
		recentSubmittedSurveyResponses,
	};
}

export async function action({ request }: Route.ActionArgs) {
	const { user } = await getAuthenticatedUser(request);
	if (!user) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const { client: supabase } = getServerClient(request);
	const { data: userSettings } = await supabase
		.from("user_settings")
		.select("is_platform_admin")
		.eq("user_id", user.sub)
		.single();

	if (!userSettings?.is_platform_admin) {
		throw new Response("Access denied", { status: 403 });
	}

	const formData = await request.formData();
	const intent = formData.get("intent") as string;
	const surveyId = formData.get("surveyId") as string;

	const admin = createSupabaseAdminClient();

	if (intent === "archive" && surveyId) {
		const { error } = await admin
			.from("research_links")
			.update({ is_archived: true, is_live: false } as unknown as Record<string, unknown>)
			.eq("id", surveyId);
		return { success: !error, error: error?.message };
	}

	if (intent === "unarchive" && surveyId) {
		const { error } = await admin
			.from("research_links")
			.update({ is_archived: false } as unknown as Record<string, unknown>)
			.eq("id", surveyId);
		return { success: !error, error: error?.message };
	}

	if (intent === "delete" && surveyId) {
		const { error } = await admin.from("research_links").delete().eq("id", surveyId);
		return { success: !error, error: error?.message };
	}

	if (intent === "delete-zero-response-archived") {
		// Bulk delete: all archived surveys with 0 responses
		const { data: archived } = await admin.from("research_links").select("id").eq("is_archived", true);

		const { data: responses } = await admin.from("research_link_responses").select("research_link_id");

		const counts: Record<string, number> = {};
		for (const r of responses || []) {
			if (r.research_link_id) {
				counts[r.research_link_id] = (counts[r.research_link_id] || 0) + 1;
			}
		}

		const toDelete = (archived || []).filter((s) => !counts[s.id]);
		if (toDelete.length > 0) {
			const { error } = await admin
				.from("research_links")
				.delete()
				.in(
					"id",
					toDelete.map((s) => s.id)
				);
			return {
				success: !error,
				deleted: toDelete.length,
				error: error?.message,
			};
		}
		return { success: true, deleted: 0 };
	}

	return { success: false, error: "Unknown intent" };
}

const sourceTypeBadgeVariant = (sourceType: string): "default" | "secondary" | "outline" | "destructive" => {
	if (sourceType?.startsWith("survey_")) return "default";
	if (sourceType === "audio_upload" || sourceType === "video_upload") return "secondary";
	if (sourceType === "realtime_recording") return "outline";
	return "secondary";
};

const statusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
	if (status === "ready" || status === "tagged") return "default";
	if (status === "error") return "destructive";
	if (status === "processing" || status === "transcribing" || status === "uploading") return "outline";
	return "secondary";
};

type SurveyFilter = "all" | "live" | "draft" | "archived";

export default function AdminActivity() {
	const { surveys, interviews, responseCounts, accountNames, projectNames, recentSubmittedSurveyResponses } =
		useLoaderData<typeof loader>();
	const revalidator = useRevalidator();
	const fetcher = useFetcher();
	const [surveyFilter, setSurveyFilter] = useState<SurveyFilter>("all");
	const survey_recent_responses_id = useId();

	// Filter surveys based on selector
	const filteredSurveys = surveys.filter((s: (typeof surveys)[0]) => {
		if (surveyFilter === "live") return s.is_live;
		if (surveyFilter === "draft") return !s.is_live && !s.is_archived;
		if (surveyFilter === "archived") return s.is_archived;
		return true;
	});

	// Counts for filter labels
	const liveSurveys = surveys.filter((s: (typeof surveys)[0]) => s.is_live);
	const draftSurveys = surveys.filter((s: (typeof surveys)[0]) => !s.is_live && !s.is_archived);
	const archivedSurveys = surveys.filter((s: (typeof surveys)[0]) => s.is_archived);

	// Split interviews
	const surveyResponses = interviews.filter((i: (typeof interviews)[0]) => i.research_link_id);
	const regularInterviews = interviews.filter((i: (typeof interviews)[0]) => !i.research_link_id);

	const surveyNameById = new Map<string, string>();
	for (const s of surveys) {
		surveyNameById.set(s.id, s.name || s.slug || "Untitled");
	}

	return (
		<div className="container mx-auto space-y-8 py-8">
			<AdminNav />
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-3xl">Platform Activity</h1>
					<p className="text-muted-foreground">Recent surveys, responses, and interviews across all accounts</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<a href={`#${survey_recent_responses_id}`}>Survey responses</a>
					</Button>
					<Button variant="outline" size="sm" onClick={() => revalidator.revalidate()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
				</div>
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Live Surveys</CardDescription>
						<CardTitle className="text-2xl">{liveSurveys.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Draft Surveys</CardDescription>
						<CardTitle className="text-2xl">{draftSurveys.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Survey Responses</CardDescription>
						<CardTitle className="text-2xl">{surveyResponses.length}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Interviews</CardDescription>
						<CardTitle className="text-2xl">{regularInterviews.length}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Surveys Table */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<MessageSquare className="h-5 w-5" />
								Surveys
							</CardTitle>
							<CardDescription>
								{filteredSurveys.length} survey
								{filteredSurveys.length !== 1 ? "s" : ""} shown
							</CardDescription>
						</div>
						<Select value={surveyFilter} onValueChange={(v) => setSurveyFilter(v as SurveyFilter)}>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All ({surveys.length})</SelectItem>
								<SelectItem value="live">Live ({liveSurveys.length})</SelectItem>
								<SelectItem value="draft">Draft ({draftSurveys.length})</SelectItem>
								<SelectItem value="archived">Archived ({archivedSurveys.length})</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Survey Name</TableHead>
								<TableHead>Account</TableHead>
								<TableHead>Project</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Responses</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-[100px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredSurveys.map((survey: (typeof surveys)[0]) => (
								<TableRow key={survey.id}>
									<TableCell className="max-w-[250px] font-medium">
										{survey.project_id ? (
											<Link
												to={`/a/${survey.account_id}/${survey.project_id}/ask/${survey.id}/responses`}
												className="flex items-center gap-1 truncate text-primary hover:underline"
											>
												{survey.name || survey.slug || "Untitled"}
												<ExternalLink className="h-3 w-3 shrink-0" />
											</Link>
										) : (
											<span className="truncate">{survey.name || survey.slug || "Untitled"}</span>
										)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{accountNames[survey.account_id] || "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{projectNames[survey.project_id ?? ""] || "—"}
									</TableCell>
									<TableCell>
										{survey.is_live ? (
											<Badge variant="default">Live</Badge>
										) : survey.is_archived ? (
											<Badge variant="secondary">Archived</Badge>
										) : (
											<Badge variant="outline">Draft</Badge>
										)}
									</TableCell>
									<TableCell>
										<Badge variant="outline">{survey.default_response_mode || "form"}</Badge>
									</TableCell>
									<TableCell className="font-mono text-sm">{responseCounts[survey.id] || 0}</TableCell>
									<TableCell className="text-muted-foreground text-sm">{timeAgo(survey.created_at)}</TableCell>
									<TableCell>
										<div className="flex items-center gap-1">
											{survey.is_archived ? (
												<fetcher.Form method="post">
													<input type="hidden" name="intent" value="unarchive" />
													<input type="hidden" name="surveyId" value={survey.id} />
													<Button variant="ghost" size="icon" type="submit" title="Unarchive" className="h-8 w-8">
														<Archive className="h-4 w-4" />
													</Button>
												</fetcher.Form>
											) : (
												<fetcher.Form method="post">
													<input type="hidden" name="intent" value="archive" />
													<input type="hidden" name="surveyId" value={survey.id} />
													<Button variant="ghost" size="icon" type="submit" title="Archive" className="h-8 w-8">
														<Archive className="h-4 w-4" />
													</Button>
												</fetcher.Form>
											)}
											{(responseCounts[survey.id] || 0) === 0 && (
												<fetcher.Form method="post">
													<input type="hidden" name="intent" value="delete" />
													<input type="hidden" name="surveyId" value={survey.id} />
													<Button
														variant="ghost"
														size="icon"
														type="submit"
														title="Delete (0 responses)"
														className="h-8 w-8 text-destructive hover:text-destructive"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</fetcher.Form>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
							{filteredSurveys.length === 0 && (
								<TableRow>
									<TableCell colSpan={8} className="text-center text-muted-foreground">
										No surveys found
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Surveys — Most Recent Responses */}
			<Card id={survey_recent_responses_id}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						Surveys — Most Recent Responses
					</CardTitle>
					<CardDescription>Last 10 submitted survey responses</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Survey</TableHead>
								<TableHead>Person</TableHead>
								<TableHead>Account</TableHead>
								<TableHead>Project</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Submitted</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{recentSubmittedSurveyResponses.map((r) => {
								const surveyId = r.research_link_id as string | null;
								const surveyName =
									(r.research_links as { name: string | null; slug: string })?.name ||
									(surveyId ? surveyNameById.get(surveyId) : null) ||
									"—";

								const personName =
									(
										r.people as {
											name: string | null;
											firstname: string | null;
											lastname: string | null;
										} | null
									)?.name ||
									r.email ||
									"—";

								const survey = surveyId ? surveys.find((s) => s.id === surveyId) : null;

								return (
									<TableRow key={r.id as string}>
										<TableCell className="max-w-[250px] truncate font-medium">
											{survey?.project_id ? (
												<Link
													to={`/a/${survey.account_id}/${survey.project_id}/ask/${surveyId}/responses`}
													className="flex items-center gap-1 truncate text-primary hover:underline"
												>
													{surveyName}
													<ExternalLink className="h-3 w-3 shrink-0" />
												</Link>
											) : (
												<span className="truncate">{surveyName}</span>
											)}
										</TableCell>
										<TableCell className="max-w-[240px] truncate">{personName}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{survey?.account_id ? accountNames[survey.account_id] : "—"}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{survey?.project_id ? projectNames[survey.project_id] || "—" : "—"}
										</TableCell>
										<TableCell>
											<Badge variant="outline">{(r.response_mode as string) || "form"}</Badge>
										</TableCell>
										<TableCell>
											{r.completed ? (
												<Badge variant="default">Submitted</Badge>
											) : (
												<Badge variant="secondary">{countAnsweredQuestions(r.responses)} answered</Badge>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">{timeAgo(r.created_at as string)}</TableCell>
									</TableRow>
								);
							})}
							{recentSubmittedSurveyResponses.length === 0 && (
								<TableRow>
									<TableCell colSpan={7} className="text-center text-muted-foreground">
										No survey responses yet
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Survey Responses Table */}
			{surveyResponses.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5" />
							Recent Survey Responses
						</CardTitle>
						<CardDescription>Interviews linked to surveys, newest first</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Title</TableHead>
									<TableHead>Account</TableHead>
									<TableHead>Project</TableHead>
									<TableHead>Source</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Created</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{surveyResponses.map((interview: (typeof interviews)[0]) => (
									<TableRow key={interview.id}>
										<TableCell className="max-w-[200px] truncate font-medium">
											{interview.title || "Untitled"}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{accountNames[interview.account_id] || "—"}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{projectNames[interview.project_id] || "—"}
										</TableCell>
										<TableCell>
											<Badge variant={sourceTypeBadgeVariant(interview.source_type || "")}>
												{interview.source_type?.replace(/_/g, " ") || "—"}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant={statusBadgeVariant(interview.status || "")}>{interview.status}</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">{timeAgo(interview.created_at)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Regular Interviews Table */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Recent Interviews
					</CardTitle>
					<CardDescription>Non-survey interviews across all accounts, newest first</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Title</TableHead>
								<TableHead>Account</TableHead>
								<TableHead>Project</TableHead>
								<TableHead>Source</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{regularInterviews.map((interview: (typeof interviews)[0]) => (
								<TableRow key={interview.id}>
									<TableCell className="max-w-[200px] truncate font-medium">{interview.title || "Untitled"}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{accountNames[interview.account_id] || "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{projectNames[interview.project_id] || "—"}
									</TableCell>
									<TableCell>
										<Badge variant={sourceTypeBadgeVariant(interview.source_type || "")}>
											{interview.source_type?.replace(/_/g, " ") || "—"}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={statusBadgeVariant(interview.status || "")}>{interview.status}</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{interview.duration_sec ? `${Math.floor(interview.duration_sec / 60)}m` : "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">{timeAgo(interview.created_at)}</TableCell>
								</TableRow>
							))}
							{regularInterviews.length === 0 && (
								<TableRow>
									<TableCell colSpan={7} className="text-center text-muted-foreground">
										No interviews found
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
