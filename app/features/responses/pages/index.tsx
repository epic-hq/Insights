/**
 * Responses page
 *
 * Shows survey and chat responses, grouped by survey (research_link).
 * Separated from the main Conversations page.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import consola from "consola";
import { formatDistance } from "date-fns";
import { ExternalLink, MessageSquareText, Mic, ScrollText, Video } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { PageContainer } from "~/components/layout/PageContainer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { userContext } from "~/server/user-context";

export const meta: MetaFunction = () => {
	return [{ title: "Responses | Insights" }, { name: "description", content: "Survey and chat responses" }];
};

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", {
			status: 400,
		});
	}

	// Fetch survey/chat response interviews
	const { data: responses, error } = await supabase
		.from("interviews")
		.select(
			`
			id,
			title,
			status,
			source_type,
			media_type,
			media_url,
			file_extension,
			created_at,
			updated_at,
			research_link_id,
			interview_people (
				role,
				people (
					id,
					name,
					segment
				)
			)
		`
		)
		.eq("project_id", projectId)
		.in("source_type", ["survey_response", "public_chat"])
		.order("created_at", { ascending: false });

	if (error) {
		consola.error("Responses query error:", error);
		throw new Response(`Error fetching responses: ${(error as PostgrestError).message}`, {
			status: 500,
		});
	}

	// Fetch research links (surveys) for grouping
	const { data: surveys } = await supabase
		.from("research_links")
		.select("id, title, slug, response_mode")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false });

	// Build survey lookup
	const surveyMap = new Map<string, { id: string; title: string; slug: string; response_mode: string | null }>();
	for (const survey of surveys || []) {
		surveyMap.set(survey.id, survey);
	}

	// Group responses by survey
	const grouped = new Map<string, typeof responses>();
	const ungrouped: typeof responses = [];

	for (const response of responses || []) {
		const linkId = (response as { research_link_id?: string | null }).research_link_id;
		if (linkId && surveyMap.has(linkId)) {
			const existing = grouped.get(linkId) || [];
			existing.push(response);
			grouped.set(linkId, existing);
		} else {
			ungrouped.push(response);
		}
	}

	const surveyGroups = Array.from(grouped.entries()).map(([surveyId, items]) => ({
		survey: surveyMap.get(surveyId)!,
		responses: items,
	}));

	return {
		surveyGroups,
		ungroupedResponses: ungrouped,
		totalCount: (responses || []).length,
	};
}

type ResponseItem = {
	id: string;
	title: string;
	status: string | null;
	source_type: string | null;
	media_type: string | null;
	media_url: string | null;
	file_extension: string | null;
	created_at: string;
	updated_at: string | null;
	research_link_id?: string | null;
	interview_people: Array<{
		role: string | null;
		people: {
			id: string;
			name: string | null;
			segment: string | null;
		} | null;
	}>;
};

function ResponseCard({ response, routes }: { response: ResponseItem; routes: ReturnType<typeof useProjectRoutes> }) {
	const participant = response.interview_people?.[0]?.people;
	const participantName = participant?.name || response.title || "Anonymous";

	const getResponseTypeBadge = () => {
		if (response.source_type === "public_chat") {
			return (
				<Badge variant="outline" className="gap-1 text-xs">
					<MessageSquareText className="h-3 w-3" />
					Chat
				</Badge>
			);
		}
		// Survey response - check media type for format
		if (response.media_type === "video" || response.file_extension === "webm") {
			return (
				<Badge variant="outline" className="gap-1 text-xs">
					<Video className="h-3 w-3" />
					Video
				</Badge>
			);
		}
		if (response.media_type === "voice_memo" || response.media_type === "audio") {
			return (
				<Badge variant="outline" className="gap-1 text-xs">
					<Mic className="h-3 w-3" />
					Voice
				</Badge>
			);
		}
		return (
			<Badge variant="outline" className="gap-1 text-xs">
				<ScrollText className="h-3 w-3" />
				Form
			</Badge>
		);
	};

	return (
		<Link
			to={routes.interviews.detail(response.id)}
			className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
				<MediaTypeIcon
					mediaType={response.media_type}
					sourceType={response.source_type}
					iconClassName="h-5 w-5 text-purple-600 dark:text-purple-400"
					showLabel={false}
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<h3 className="truncate font-medium text-foreground">{participantName}</h3>
					{getResponseTypeBadge()}
				</div>
				<div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
					{participant?.segment && (
						<>
							<span>{participant.segment}</span>
							<span>•</span>
						</>
					)}
					<span>
						{formatDistance(new Date(response.created_at), new Date(), {
							addSuffix: true,
						})}
					</span>
				</div>
			</div>
			<ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}

export default function ResponsesIndex() {
	const { surveyGroups, ungroupedResponses, totalCount } = useLoaderData<typeof loader>();
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath);

	return (
		<div className="relative min-h-screen bg-background">
			{/* Header */}
			<div className="border-border border-b bg-card px-6 py-8">
				<PageContainer size="lg" padded={false} className="max-w-6xl">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-3xl text-foreground">
								<MessageSquareText />
								Responses
							</h1>
							{totalCount > 0 && (
								<p className="text-muted-foreground text-sm">
									{totalCount} response{totalCount !== 1 ? "s" : ""} from surveys and chats
								</p>
							)}
						</div>

						<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
							<Button asChild variant="default" className="w-full text-sm sm:w-auto">
								<Link to={routes.ask.index()}>
									<ScrollText className="h-4 w-4" />
									Manage Surveys
								</Link>
							</Button>
						</div>
					</div>
				</PageContainer>
			</div>

			{/* Main Content */}
			<PageContainer size="lg" padded={false} className="max-w-6xl px-6 py-12">
				{totalCount === 0 ? (
					<div className="py-16 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-purple-100 p-6 dark:bg-purple-900/30">
									<MessageSquareText className="h-12 w-12 text-purple-500 dark:text-purple-400" />
								</div>
							</div>
							<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No responses yet</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								Create a survey and share the link to start collecting responses from participants.
							</p>
							<Button asChild className="gap-2">
								<Link to={routes.ask.new()}>
									<ScrollText className="h-4 w-4" />
									Create Your First Survey
								</Link>
							</Button>
						</div>
					</div>
				) : (
					<div className="space-y-8">
						{/* Survey-grouped responses */}
						{surveyGroups.map(({ survey, responses }) => (
							<div key={survey.id}>
								<div className="mb-3 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<h2 className="font-semibold text-foreground text-lg">{survey.title}</h2>
										<Badge variant="secondary" className="text-xs">
											{responses.length} response
											{responses.length !== 1 ? "s" : ""}
										</Badge>
									</div>
									<Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
										<Link to={routes.ask.responses(survey.id)}>
											View All
											<ExternalLink className="h-3 w-3" />
										</Link>
									</Button>
								</div>
								<div className="space-y-2">
									{responses.map((response) => (
										<ResponseCard key={response.id} response={response as ResponseItem} routes={routes} />
									))}
								</div>
							</div>
						))}

						{/* Ungrouped responses (no survey association) */}
						{ungroupedResponses.length > 0 && (
							<div>
								<div className="mb-3 flex items-center gap-2">
									<h2 className="font-semibold text-foreground text-lg">Other Responses</h2>
									<Badge variant="secondary" className="text-xs">
										{ungroupedResponses.length}
									</Badge>
								</div>
								<div className="space-y-2">
									{ungroupedResponses.map((response) => (
										<ResponseCard key={response.id} response={response as ResponseItem} routes={routes} />
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</PageContainer>
		</div>
	);
}
