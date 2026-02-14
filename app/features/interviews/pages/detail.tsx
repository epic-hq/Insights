import { convertMessages } from "@mastra/core/agent";
import consola from "consola";
import {
	AlertTriangle,
	ArrowUpRight,
	Briefcase,
	Edit2,
	Filter,
	Loader2,
	MoreVertical,
	Pencil,
	RefreshCw,
	Sparkles,
	Trash2,
	User,
	Users,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ActionFunctionArgs,
	Link,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
	useFetcher,
	useLoaderData,
	useNavigate,
	useNavigation,
	useRevalidator,
} from "react-router";
import { toast } from "sonner";
import type { Database } from "~/../supabase/types";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { BackButton } from "~/components/ui/back-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import InlineEdit from "~/components/ui/inline-edit";
import { MediaPlayer } from "~/components/ui/MediaPlayer";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useCurrentProject } from "~/contexts/current-project-context";
import { getVoteCountsForEntities } from "~/features/annotations/db";
import { PlayByPlayTimeline } from "~/features/evidence/components/ChronologicalEvidenceList";
import { getInterviewById, getInterviewInsights, getInterviewParticipants } from "~/features/interviews/db";
import { LensAccordion } from "~/features/lenses/components/LensAccordion";
import { loadInterviewSalesLens } from "~/features/lenses/lib/interviewLens.server";
import {
	type LensAnalysisWithTemplate,
	type LensTemplate,
	loadLensAnalyses,
	loadLensTemplates,
} from "~/features/lenses/lib/loadLensAnalyses.server";
import type { InterviewLensView } from "~/features/lenses/types";
import { getPeopleOptions, verifyPersonBelongsToProject } from "~/features/people/db";
import { syncTitleToJobTitleFacet } from "~/features/people/syncTitleToFacet.server";
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu";
import { useInterviewProgress } from "~/hooks/useInterviewProgress";
import { usePostHogFeatureFlag } from "~/hooks/usePostHogFeatureFlag";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { getSupabaseClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";
import { createR2PresignedUrl, getR2KeyFromPublicUrl } from "~/utils/r2.server";
import { DocumentViewer } from "../components/DocumentViewer";
import { EvidenceVerificationDrawer } from "../components/EvidenceVerificationDrawer";
import { InterviewInsights } from "../components/InterviewInsights";
import { InterviewQuestionsAccordion } from "../components/InterviewQuestionsAccordion";
import { InterviewRecommendations } from "../components/InterviewRecommendations";
import { InterviewScorecard } from "../components/InterviewScorecard";
import { InterviewSourcePanel } from "../components/InterviewSourcePanel";
import { LazyTranscriptResults } from "../components/LazyTranscriptResults";
import { ManagePeopleAssociations } from "../components/ManagePeopleAssociations";
import { NoteViewer } from "../components/NoteViewer";
import { useCustomLensDefaults } from "../hooks/useCustomLensDefaults";
import { useEmpathySpeakers } from "../hooks/useEmpathySpeakers";
import { usePersonalFacetSummary } from "../hooks/usePersonalFacetSummary";
import { useTranscriptSpeakers } from "../hooks/useTranscriptSpeakers";
import type { AnalysisJobSummary, EvidenceRecord } from "../lib/interviewDetailHelpers";
import {
	deriveMediaFormat,
	extractAnalysisFromInterview,
	matchTakeawaysToEvidence,
	normalizeMultilineText,
	parseFullName,
} from "../lib/interviewDetailHelpers";
import {
	CONVERSATION_OVERVIEW_TEMPLATE_KEY,
	parseConversationAnalysisLegacy,
	parseConversationOverviewLens,
} from "../lib/parseConversationAnalysis.server";
import { processEmpathyMap } from "../lib/processEmpathyMap.server";

// parseFullName imported from ../lib/interviewDetailHelpers

// normalizeMultilineText imported from ../lib/interviewDetailHelpers

// deriveMediaFormat imported from ../lib/interviewDetailHelpers

// AnalysisJobSummary type and extractAnalysisFromInterview imported from ../lib/interviewDetailHelpers

const ACTIVE_ANALYSIS_STATUSES = new Set<Database["public"]["Enums"]["job_status"]>([
	"pending",
	"in_progress",
	"retry",
]);
const TERMINAL_ANALYSIS_STATUSES = new Set<Database["public"]["Enums"]["job_status"]>(["done", "error"]);

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.interview?.title || "Interview"} | Insights` },
		{ name: "description", content: "Interview details and transcript" },
	];
};

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;
	const accountId = params.accountId;
	const projectId = params.projectId;
	const interviewId = params.interviewId;

	if (!accountId || !projectId || !interviewId) {
		return Response.json({ ok: false, error: "Account, project, and interview are required" }, { status: 400 });
	}

	const formData = await request.formData();
	// Support both "intent" (existing forms) and "_action" (LinkPersonDialog)
	const intent = (formData.get("intent") || formData.get("_action"))?.toString();

	try {
		switch (intent) {
			case "assign-participant": {
				const interviewPersonId = formData.get("interviewPersonId")?.toString();
				if (!interviewPersonId) {
					return Response.json({ ok: false, error: "Missing participant identifier" }, { status: 400 });
				}

				const parsedInterviewPersonId = Number.parseInt(interviewPersonId, 10);
				if (Number.isNaN(parsedInterviewPersonId)) {
					return Response.json({ ok: false, error: "Invalid participant identifier" }, { status: 400 });
				}

				const personId = formData.get("personId")?.toString().trim() || null;
				const role = formData.get("role")?.toString().trim() || null;
				const transcriptKey = formData.get("transcriptKey")?.toString().trim() || null;
				const displayName = formData.get("displayName")?.toString().trim() || null;

				if (!personId) {
					const { error } = await supabase.from("interview_people").delete().eq("id", parsedInterviewPersonId);
					if (error) throw new Error(error.message);
					return Response.json({ ok: true, removed: true });
				}

				// Guard: ensure selected person belongs to this project
				const verifyResult = await verifyPersonBelongsToProject({
					supabase,
					personId,
					projectId,
				});
				if (!verifyResult.ok) return verifyResult.response;

				const { error } = await supabase
					.from("interview_people")
					.update({
						person_id: personId,
						role,
						transcript_key: transcriptKey,
						display_name: displayName,
					})
					.eq("id", parsedInterviewPersonId);

				if (error) throw new Error(error.message);
				return Response.json({ ok: true });
			}
			case "remove-participant": {
				const interviewPersonId = formData.get("interviewPersonId")?.toString();
				if (!interviewPersonId) {
					return Response.json({ ok: false, error: "Missing participant identifier" }, { status: 400 });
				}
				const { error } = await supabase
					.from("interview_people")
					.delete()
					.eq("id", Number.parseInt(interviewPersonId, 10));
				if (error) throw new Error(error.message);
				return Response.json({ ok: true, removed: true });
			}
			case "add-participant":
			case "link-person": {
				// Handle both existing form (add-participant) and LinkPersonDialog (link-person)
				const createPerson = formData.get("create_person")?.toString() === "true";
				let personId = (formData.get("personId") || formData.get("person_id"))?.toString();
				const role = formData.get("role")?.toString().trim() || null;
				// Support both snake_case (from ManagePeopleAssociations) and camelCase (from LinkPersonDialog)
				const transcriptKey =
					(formData.get("transcript_key") || formData.get("transcriptKey"))?.toString().trim() || null;
				const displayName = formData.get("displayName")?.toString().trim() || null;

				// If creating a new person, do that first
				if (createPerson) {
					const personName = formData.get("person_name")?.toString()?.trim();
					const personFirst = formData.get("person_firstname")?.toString()?.trim() || null;
					const personLast = formData.get("person_lastname")?.toString()?.trim() || null;
					const personCompany = formData.get("person_company")?.toString()?.trim() || null;
					const personTitle = formData.get("person_title")?.toString()?.trim() || null;
					if (!personName && !personFirst) {
						return Response.json({ ok: false, error: "Person name is required when creating" }, { status: 400 });
					}

					const { firstname, lastname } = personFirst
						? { firstname: personFirst, lastname: personLast }
						: parseFullName(personName || "");

					let defaultOrganizationId: string | null = null;
					if (personCompany) {
						const { data: existingOrg, error: existingOrgError } = await supabase
							.from("organizations")
							.select("id")
							.eq("project_id", projectId)
							.eq("name", personCompany)
							.maybeSingle();
						if (existingOrgError) throw new Error(existingOrgError.message);

						if (existingOrg?.id) {
							defaultOrganizationId = existingOrg.id;
						} else {
							const { data: createdOrg, error: createOrgError } = await supabase
								.from("organizations")
								.insert({
									account_id: accountId,
									project_id: projectId,
									name: personCompany,
								})
								.select("id")
								.single();
							if (createOrgError || !createdOrg) {
								throw new Error(createOrgError?.message || "Failed to create organization");
							}
							defaultOrganizationId = createdOrg.id;
						}
					}

					const { data: newPerson, error: createError } = await supabase
						.from("people")
						.insert({
							account_id: accountId,
							project_id: projectId,
							firstname,
							lastname,
							default_organization_id: defaultOrganizationId,
							title: personTitle,
						})
						.select()
						.single();

					if (createError || !newPerson) {
						consola.error("Failed to create person:", createError);
						return Response.json({ ok: false, error: "Failed to create person" }, { status: 500 });
					}

					// Link person to project
					await supabase.from("project_people").insert({
						project_id: projectId,
						person_id: newPerson.id,
					});

					if (defaultOrganizationId) {
						await supabase.from("people_organizations").upsert(
							{
								account_id: accountId,
								project_id: projectId,
								person_id: newPerson.id,
								organization_id: defaultOrganizationId,
								is_primary: true,
							},
							{ onConflict: "person_id,organization_id" }
						);
					}

					personId = newPerson.id;
				}

				if (!personId) {
					return Response.json({ ok: false, error: "Select a person to add" }, { status: 400 });
				}

				// Guard: ensure selected person belongs to this project (skip if we just created it)
				if (!createPerson) {
					const verifyResult = await verifyPersonBelongsToProject({
						supabase,
						personId,
						projectId,
					});
					if (!verifyResult.ok) return verifyResult.response;
				}

				// Use upsert to handle case where person is already linked
				const { error } = await supabase.from("interview_people").upsert(
					{
						interview_id: interviewId,
						project_id: projectId,
						person_id: personId,
						role,
						transcript_key: transcriptKey,
						display_name: displayName,
					},
					{
						onConflict: "interview_id,person_id",
					}
				);
				if (error) throw new Error(error.message);
				return Response.json({ ok: true, created: true, personId });
			}
			case "create-and-link-person": {
				const name = (formData.get("name") as string | null)?.trim();
				if (!name) {
					return Response.json({ ok: false, error: "Person name is required" }, { status: 400 });
				}

				const { firstname, lastname } = parseFullName(name);
				const primaryEmail = (formData.get("primary_email") as string | null)?.trim() || null;
				const title = (formData.get("title") as string | null)?.trim() || null;
				const role = (formData.get("role") as string | null)?.trim() || null;

				// Create the person
				const { data: newPerson, error: createError } = await supabase
					.from("people")
					.insert({
						account_id: accountId,
						project_id: projectId,
						firstname,
						lastname,
						primary_email: primaryEmail,
						title,
					})
					.select()
					.single();

				if (createError || !newPerson) {
					consola.error("Failed to create person:", createError);
					return Response.json({ ok: false, error: "Failed to create person" }, { status: 500 });
				}

				// Link person to project
				await supabase.from("project_people").insert({
					project_id: projectId,
					person_id: newPerson.id,
				});

				// If title was provided, sync it to job_function facet
				if (title) {
					await syncTitleToJobTitleFacet({
						supabase,
						personId: newPerson.id,
						accountId,
						title,
					});
				}

				// Link the person to the interview
				const { error: linkError } = await supabase.from("interview_people").insert({
					interview_id: interviewId,
					project_id: projectId,
					person_id: newPerson.id,
					role,
					transcript_key: null,
					display_name: null,
				});

				if (linkError) {
					consola.error("Failed to link person to interview:", linkError);
					return Response.json(
						{
							ok: false,
							error: "Person created but failed to link to interview",
						},
						{ status: 500 }
					);
				}

				return Response.json({
					ok: true,
					created: true,
					personId: newPerson.id,
				});
			}
			case "link-organization": {
				const organizationId = formData.get("organizationId")?.toString();
				if (!organizationId) {
					return Response.json({ ok: false, error: "Missing organizationId" }, { status: 400 });
				}

				const { error } = await supabase.from("interview_organizations").upsert(
					{
						interview_id: interviewId,
						organization_id: organizationId,
						account_id: accountId,
						project_id: projectId,
					},
					{ onConflict: "interview_id,organization_id" }
				);

				if (error) throw new Error(error.message);
				return Response.json({ ok: true });
			}
			case "unlink-organization": {
				const interviewOrganizationId = formData.get("interviewOrganizationId")?.toString();
				if (!interviewOrganizationId) {
					return Response.json({ ok: false, error: "Missing interviewOrganizationId" }, { status: 400 });
				}

				const { error } = await supabase.from("interview_organizations").delete().eq("id", interviewOrganizationId);
				if (error) throw new Error(error.message);
				return Response.json({ ok: true, removed: true });
			}
			case "create-and-link-organization": {
				const organizationName = formData.get("organization_name")?.toString()?.trim();
				if (!organizationName) {
					return Response.json({ ok: false, error: "Organization name is required" }, { status: 400 });
				}

				const { data: organization, error: orgErr } = await supabase
					.from("organizations")
					.insert({
						account_id: accountId,
						project_id: projectId,
						name: organizationName,
					})
					.select("id")
					.single();

				if (orgErr || !organization) throw new Error(orgErr?.message || "Failed to create organization");

				const { error: linkErr } = await supabase.from("interview_organizations").upsert(
					{
						interview_id: interviewId,
						organization_id: organization.id,
						account_id: accountId,
						project_id: projectId,
					},
					{ onConflict: "interview_id,organization_id" }
				);

				if (linkErr) throw new Error(linkErr.message);
				return Response.json({
					ok: true,
					created: true,
					organizationId: organization.id,
				});
			}
			case "link-opportunity": {
				const opportunityId = formData.get("opportunityId")?.toString();
				if (!opportunityId) {
					return Response.json({ ok: false, error: "Missing opportunityId" }, { status: 400 });
				}

				const { error } = await supabase.from("interview_opportunities").upsert(
					{
						interview_id: interviewId,
						opportunity_id: opportunityId,
						account_id: accountId,
						project_id: projectId,
					},
					{ onConflict: "interview_id,opportunity_id" }
				);

				if (error) throw new Error(error.message);
				return Response.json({ ok: true });
			}
			case "unlink-opportunity": {
				const interviewOpportunityId = formData.get("interviewOpportunityId")?.toString();
				if (!interviewOpportunityId) {
					return Response.json({ ok: false, error: "Missing interviewOpportunityId" }, { status: 400 });
				}

				const { error } = await supabase.from("interview_opportunities").delete().eq("id", interviewOpportunityId);
				if (error) throw new Error(error.message);
				return Response.json({ ok: true, removed: true });
			}
			case "create-and-link-opportunity": {
				const opportunityTitle = formData.get("opportunity_title")?.toString()?.trim();
				if (!opportunityTitle) {
					return Response.json({ ok: false, error: "Opportunity title is required" }, { status: 400 });
				}

				const { data: opportunity, error: oppErr } = await supabase
					.from("opportunities")
					.insert({
						account_id: accountId,
						project_id: projectId,
						title: opportunityTitle,
					})
					.select("id")
					.single();

				if (oppErr || !opportunity) throw new Error(oppErr?.message || "Failed to create opportunity");

				const { error: linkErr } = await supabase.from("interview_opportunities").upsert(
					{
						interview_id: interviewId,
						opportunity_id: opportunity.id,
						account_id: accountId,
						project_id: projectId,
					},
					{ onConflict: "interview_id,opportunity_id" }
				);

				if (linkErr) throw new Error(linkErr.message);
				return Response.json({
					ok: true,
					created: true,
					opportunityId: opportunity.id,
				});
			}
			case "generate-evidence-thumbnails": {
				const { tasks } = await import("@trigger.dev/sdk");
				type GenEvThumb = typeof import("~/../../src/trigger/generate-evidence-thumbnails").generateEvidenceThumbnails;
				await tasks.trigger<GenEvThumb>("generate-evidence-thumbnails", {
					interviewId,
					force: formData.get("force") === "true",
				});
				return Response.json({ ok: true });
			}
			default:
				return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 });
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		consola.error("Participant action failed", message);
		return Response.json({ ok: false, error: message }, { status: 500 });
	}
}
export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId;
	const projectId = params.projectId;
	const interviewId = params.interviewId;

	// consola.info("🔍 Interview Detail Loader Started:", {
	// 	accountId,
	// 	projectId,
	// 	interviewId,
	// 	params,
	// })

	if (!accountId || !projectId || !interviewId) {
		consola.error("❌ Missing required parameters:", {
			accountId,
			projectId,
			interviewId,
		});
		throw new Response("Account ID, Project ID, and Interview ID are required", { status: 400 });
	}

	try {
		consola.info("📊 Fetching interview data...");
		// Fetch interview data from database (includes notes now)
		const { data: interviewData, error: interviewError } = await getInterviewById({
			supabase,
			accountId,
			projectId,
			id: interviewId,
		});

		if (interviewError) {
			// If interview was deleted (0 rows), redirect to interviews list instead of error
			if (interviewError.code === "PGRST116") {
				consola.info("Interview deleted or not found, redirecting to list");
				throw redirect(`/a/${accountId}/${projectId}/interviews`);
			}
			consola.error("❌ Error fetching interview:", interviewError);
			throw new Response(`Error fetching interview: ${interviewError.message}`, { status: 500 });
		}

		if (!interviewData) {
			consola.info("Interview not found, redirecting to list");
			throw redirect(`/a/${accountId}/${projectId}/interviews`);
		}

		consola.info("✅ Interview data fetched successfully:", {
			interviewId: interviewData.id,
			title: interviewData.title,
			hasObservations: !!interviewData.observations_and_notes,
			observationsLength: interviewData.observations_and_notes?.length || 0,
			sourceType: interviewData.source_type,
		});

		// Fetch participant data separately to avoid junction table query issues
		let participants: Array<{
			id: number;
			role: string | null;
			transcript_key: string | null;
			display_name: string | null;
			cross_project?: boolean;
			people?: {
				id?: string;
				name?: string | null;
				segment?: string | null;
				company?: string | null;
				project_id?: string | null;
				people_personas?: Array<{
					personas?: { id?: string; name?: string | null } | null;
				}>;
			};
		}> = [];
		let primaryParticipant: {
			id?: string;
			name?: string | null;
			segment?: string | null;
			project_id?: string | null;
		} | null = null;

		try {
			const { data: participantData, error: participantError } = await getInterviewParticipants({
				supabase,
				projectId,
				interviewId: interviewId,
			});
			if (participantError) {
				throw new Error(participantError.message);
			}

			participants = (participantData || []).map((row) => {
				const person = row.people as
					| {
							id: string;
							name: string | null;
							segment: string | null;
							project_id: string | null;
							person_type?: string | null;
							people_personas?: Array<{
								personas?: { id?: string; name?: string | null } | null;
							}>;
							[key: string]: unknown;
					  }
					| undefined;
				const valid = !!person && person.project_id === projectId;
				const minimal = person
					? {
							id: person.id,
							name: person.name,
							segment: person.segment,
							company: (person as any).default_organization?.name ?? null,
							project_id: person.project_id,
							person_type: person.person_type ?? null,
							people_personas: Array.isArray(person.people_personas)
								? person.people_personas.map((pp) => ({
										personas: pp?.personas ? { id: pp.personas.id, name: pp.personas.name } : null,
									}))
								: undefined,
						}
					: undefined;
				return {
					id: row.id,
					role: row.role ?? null,
					transcript_key: row.transcript_key ?? null,
					display_name: row.display_name ?? null,
					people: person ? minimal : undefined,
					cross_project: !!person && !valid,
				};
			});
			{
				const found = participants.find((p) => p.people)?.people;
				primaryParticipant = found ?? null;
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			throw new Response(`Error fetching participants: ${msg}`, {
				status: 500,
			});
		}

		const { data: peopleOptions, error: peopleError } = await getPeopleOptions({
			supabase,
			accountId,
			projectId,
		});

		if (peopleError) {
			consola.warn("Could not load people options for participant assignment:", peopleError.message);
		}

		const peopleLookup = new Map<string, { name: string | null; person_type?: string | null }>();
		for (const option of peopleOptions ?? []) {
			if (option?.id) {
				peopleLookup.set(option.id, {
					name: option.name ?? null,
					person_type: option.person_type ?? null,
				});
			}
		}
		for (const participant of participants) {
			const person = participant.people;
			if (person?.id) {
				peopleLookup.set(person.id, {
					name: person.name ?? null,
					person_type: (person as any).person_type ?? null,
				});
			}
		}
		if (primaryParticipant?.id) {
			peopleLookup.set(primaryParticipant.id, {
				name: primaryParticipant.name ?? null,
				person_type: (primaryParticipant as any).person_type ?? null,
			});
		}

		let salesLens: InterviewLensView | null = null;
		let linkedOpportunity: { id: string; title: string } | null = null;
		let lensTemplates: LensTemplate[] = [];
		let lensAnalyses: Record<string, LensAnalysisWithTemplate> = {};

		try {
			if (supabase) {
				// Load legacy sales lens (for backward compatibility)
				salesLens = await loadInterviewSalesLens({
					db: supabase,
					projectId,
					interviewId,
					peopleLookup,
				});

				// Load new generic lens system
				const [templates, analyses] = await Promise.all([
					loadLensTemplates(supabase),
					loadLensAnalyses(supabase, interviewId, accountId),
				]);
				lensTemplates = templates;
				lensAnalyses = analyses;

				// Check if interview is linked to an opportunity
				const { data: summaryData } = await supabase
					.from("sales_lens_summaries")
					.select("opportunity_id")
					.eq("interview_id", interviewId)
					.eq("project_id", projectId)
					.not("opportunity_id", "is", null)
					.limit(1)
					.single();

				if (summaryData?.opportunity_id) {
					const { data: oppData } = await supabase
						.from("opportunities")
						.select("id, title")
						.eq("id", summaryData.opportunity_id)
						.single();

					if (oppData) {
						linkedOpportunity = oppData;
					}
				}
			}
		} catch (error) {
			consola.warn("Failed to load sales lens for interview", {
				interviewId,
				error,
			});
		}

		// Read conversation analysis from the conversation-overview lens (primary)
		// with fallback to legacy JSONB blob for un-migrated interviews
		const overviewLens = lensAnalyses[CONVERSATION_OVERVIEW_TEMPLATE_KEY];
		const conversationAnalysis =
			overviewLens?.status === "completed"
				? parseConversationOverviewLens(
						overviewLens.analysis_data as Record<string, unknown>,
						overviewLens.processed_at
					)
				: parseConversationAnalysisLegacy(
						interviewData.conversation_analysis as Record<string, unknown> | null | undefined,
						interviewData.updated_at
					);

		// Check transcript availability without loading the actual content
		const { data: transcriptMeta, error: transcriptError } = await supabase
			.from("interviews")
			.select("transcript, transcript_formatted")
			.eq("id", interviewId)
			.eq("project_id", projectId)
			.single();

		if (transcriptError) {
			consola.warn("Could not check transcript availability:", transcriptError.message);
		}

		// Debug transcript availability
		consola.info("Transcript availability check:", {
			interviewId,
			hasTranscript: Boolean(transcriptMeta?.transcript),
			hasFormattedTranscript: Boolean(transcriptMeta?.transcript_formatted),
			transcriptLength: transcriptMeta?.transcript?.length || 0,
			transcriptFormattedType: typeof transcriptMeta?.transcript_formatted,
		});

		// Generate a fresh presigned URL for media access if needed
		let freshMediaUrl = interviewData.media_url;
		if (interviewData.media_url) {
			try {
				let r2Key = getR2KeyFromPublicUrl(interviewData.media_url);

				// If getR2KeyFromPublicUrl failed, try to extract key from malformed paths
				// Pattern: /a/{accountId}/{projectId}/interviews/interviews/{projectId}/{filename}
				// or interviews/{projectId}/{filename}
				if (!r2Key && !interviewData.media_url.startsWith("http")) {
					const pathParts = interviewData.media_url.split("/").filter(Boolean);
					// Look for "interviews" in the path and extract everything after it
					const interviewsIndex = pathParts.indexOf("interviews");
					if (interviewsIndex >= 0 && interviewsIndex < pathParts.length - 1) {
						// Check if next part is also "interviews" (doubled path bug)
						const startIndex =
							pathParts[interviewsIndex + 1] === "interviews" ? interviewsIndex + 2 : interviewsIndex + 1;
						r2Key = pathParts.slice(startIndex).join("/");
						// Add interviews prefix if not already there
						if (!r2Key.startsWith("interviews/")) {
							r2Key = `interviews/${r2Key}`;
						}
					}
				}

				if (r2Key) {
					// Generate a fresh presigned URL (valid for 1 hour)
					const presignedResult = createR2PresignedUrl({
						key: r2Key,
						expiresInSeconds: 60 * 60, // 1 hour
					});
					if (presignedResult) {
						freshMediaUrl = presignedResult.url;
					}
				}
			} catch (error) {
				consola.warn("Could not generate fresh presigned URL for media:", error);
				// Keep the original URL as fallback
			}
		}

		const interview = {
			...interviewData,
			media_url: freshMediaUrl, // Use fresh presigned URL
			participants,
			primaryParticipant,
			// Check transcript availability without loading content
			hasTranscript: !!transcriptMeta?.transcript,
			hasFormattedTranscript: !!transcriptMeta?.transcript_formatted,
		};

		// Extract analysis job information from interview.conversation_analysis
		const analysisJob = extractAnalysisFromInterview(interview);

		const { data: insightsData, error } = await getInterviewInsights({
			supabase,
			interviewId: interviewId,
		});

		if (error) {
			const msg = error instanceof Error ? error.message : String(error);
			consola.error("Error fetching insights for interview", {
				interviewId,
				error: msg,
			});
		}

		const insights = insightsData ?? [];

		// Fetch evidence related to this interview with person associations
		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence")
			.select(
				`
				*,
				evidence_people (
					person_id,
					role,
					people (
						id,
						name,
						segment
					)
				)
			`
			)
			.eq("interview_id", interviewId)
			.order("created_at", { ascending: false });

		if (evidenceError) {
			consola.warn("Could not fetch evidence:", evidenceError.message);
		}

		// Batch-fetch vote counts for all evidence in one query
		// Filter out any evidence items without valid IDs
		const evidenceIds = (evidence || [])
			.map((e) => e.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);
		const { data: evidenceVoteCounts } = evidenceIds.length
			? await getVoteCountsForEntities({
					supabase,
					projectId,
					entityType: "evidence",
					entityIds: evidenceIds,
					userId: ctx.claims.sub,
				})
			: { data: {} };

		const empathyMap = processEmpathyMap(evidence as any);

		// Fetch creator's name from user_settings
		let creatorName = "Unknown";
		if (interviewData.created_by) {
			const { data: creatorData } = await supabase
				.from("user_settings")
				.select("first_name, last_name, email")
				.eq("user_id", interviewData.created_by)
				.single();

			if (creatorData) {
				if (creatorData.first_name || creatorData.last_name) {
					creatorName = [creatorData.first_name, creatorData.last_name].filter(Boolean).join(" ");
				} else if (creatorData.email) {
					creatorName = creatorData.email;
				}
			}
		}

		let assistantMessages: UpsightMessage[] = [];
		const userId = ctx.claims.sub;
		if (userId) {
			const resourceId = `interviewStatusAgent-${userId}-${interviewId}`;
			try {
				const threads = await memory.listThreads({
					filter: { resourceId },
					orderBy: { field: "createdAt", direction: "DESC" },
					page: 0,
					perPage: 1,
				});
				const threadId = threads?.threads?.[0]?.id;
				if (threadId) {
					const { messages } = await memory.recall({
						threadId,
						perPage: 50,
					});
					assistantMessages = convertMessages(messages).to("AIV5.UI") as UpsightMessage[];
				}
			} catch (error) {
				consola.warn("Failed to load assistant history", { resourceId, error });
			}
		}

		// Match key takeaway evidence snippets to actual evidence records
		if (conversationAnalysis?.keyTakeaways && evidence?.length) {
			matchTakeawaysToEvidence(conversationAnalysis.keyTakeaways, evidence as EvidenceRecord[]);
		}

		const loaderResult = {
			accountId,
			projectId,
			interview,
			insights,
			evidence: evidence || [],
			evidenceVoteCounts: evidenceVoteCounts || {},
			empathyMap,
			peopleOptions: peopleOptions || [],
			creatorName,
			analysisJob,
			assistantMessages,
			conversationAnalysis,
			salesLens,
			linkedOpportunity,
			lensTemplates,
			lensAnalyses,
		};

		consola.info("✅ Loader completed successfully:", {
			accountId,
			projectId,
			interviewId: interview.id,
			insightsCount: insights?.length || 0,
			evidenceCount: evidence?.length || 0,
			assistantMessages: assistantMessages.length,
		});

		// Track interview_detail_viewed event for PLG instrumentation
		try {
			const posthogServer = getPostHogServerClient();
			if (posthogServer) {
				const userId = ctx.claims.sub;
				posthogServer.capture({
					distinctId: userId,
					event: "interview_detail_viewed",
					properties: {
						interview_id: interviewId,
						project_id: projectId,
						account_id: accountId,
						has_transcript: interview.hasTranscript,
						has_analysis: !!conversationAnalysis,
						evidence_count: evidence?.length || 0,
						insights_count: insights?.length || 0,
						$groups: { account: accountId },
					},
				});
			}
		} catch (trackingError) {
			consola.warn("[INTERVIEW_DETAIL] PostHog tracking failed:", trackingError);
			// Don't throw - tracking failure shouldn't block user flow
		}

		return loaderResult;
	} catch (error) {
		// Re-throw Response errors directly without wrapping
		if (error instanceof Response) {
			throw error;
		}

		const msg = error instanceof Error ? error.message : String(error);
		consola.error("❌ Loader caught error:", error);
		consola.error("Error details:", {
			message: msg,
			accountId,
			projectId,
			interviewId,
		});
		throw new Response(`Failed to load interview: ${msg}`, { status: 500 });
	}
}

/**
 * Force revalidation when explicitly triggered by revalidator
 * This ensures fresh data is fetched when interview processing completes
 */
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: any) {
	// Always revalidate when explicitly called via revalidator.revalidate()
	// This fixes the issue where completed interviews don't show fresh data
	return true;
}

export default function InterviewDetail({ enableRecording = false }: { enableRecording?: boolean }) {
	const {
		accountId,
		projectId,
		interview,
		insights,
		evidence,
		evidenceVoteCounts,
		empathyMap,
		peopleOptions,
		creatorName,
		analysisJob,
		assistantMessages,
		conversationAnalysis,
		salesLens,
		linkedOpportunity,
		lensTemplates,
		lensAnalyses,
	} = useLoaderData<typeof loader>();

	const is_missing_interview_data = !interview || !accountId || !projectId;
	const is_note_type =
		interview?.source_type === "note" ||
		interview?.media_type === "note" ||
		interview?.media_type === "meeting_notes" ||
		interview?.media_type === "voice_memo";
	const is_document_type =
		interview?.source_type === "document" ||
		(interview?.source_type === "transcript" && interview?.media_type !== "interview");

	const fetcher = useFetcher();
	const notesFetcher = useFetcher();
	const deleteFetcher = useFetcher<{
		success?: boolean;
		redirectTo?: string;
		error?: string;
	}>();
	const participantFetcher = useFetcher();
	const lensFetcher = useFetcher();
	const slotFetcher = useFetcher();
	const navigation = useNavigation();
	const navigate = useNavigate();
	const { accountId: contextAccountId, projectId: contextProjectId, projectPath } = useCurrentProject();
	const routes = useProjectRoutes(`/a/${contextAccountId}/${contextProjectId}`);
	const evidenceFilterLink = `${routes.evidence.index()}?interview_id=${encodeURIComponent(interview.id)}`;
	const shareProjectPath =
		projectPath || (contextAccountId && contextProjectId ? `/a/${contextAccountId}/${contextProjectId}` : "");
	const { isEnabled: salesCrmEnabled } = usePostHogFeatureFlag("ffSalesCRM");
	// Single source of truth for interview - updated by realtime subscription
	const [interviewState, setInterviewState] = useState(interview);
	const [analysisState, setAnalysisState] = useState<AnalysisJobSummary | null>(analysisJob);
	const [triggerAuth, setTriggerAuth] = useState<{
		runId: string;
		token: string;
	} | null>(null);
	const [tokenErrorRunId, setTokenErrorRunId] = useState<string | null>(null);
	const [_customLensOverrides, setCustomLensOverrides] = useState<Record<string, { summary?: string; notes?: string }>>(
		{}
	);
	const [_isChatOpen, _setIsChatOpen] = useState(() => assistantMessages.length > 0);
	const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
	const [regeneratePopoverOpen, setRegeneratePopoverOpen] = useState(false);
	const [regenerateInstructions, setRegenerateInstructions] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [verifyDrawerOpen, setVerifyDrawerOpen] = useState(false);
	const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
	const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<string | null>(null);

	// Create evidence map for lens timestamp hydration
	const evidenceMap = useMemo(() => {
		const map = new Map<
			string,
			{
				id: string;
				anchors?: unknown;
				start_ms?: number | null;
				gist?: string | null;
			}
		>();
		for (const e of evidence || []) {
			map.set(e.id, {
				id: e.id,
				anchors: e.anchors,
				start_ms: e.start_ms,
				gist: e.gist,
			});
		}
		return map;
	}, [evidence]);

	const activeRunId = analysisState?.trigger_run_id ?? null;
	const triggerAccessToken = triggerAuth?.runId === activeRunId ? triggerAuth.token : undefined;

	// Pass only minimal data to progress hook (avoids passing large transcript)
	const interviewProgressData = useMemo(
		() =>
			interviewState
				? {
						id: interviewState.id,
						status: interviewState.status,
						processing_metadata: interviewState.processing_metadata,
						conversation_analysis: interviewState.conversation_analysis,
					}
				: null,
		[
			interviewState?.id,
			interviewState?.status,
			interviewState?.processing_metadata,
			interviewState?.conversation_analysis,
		]
	);

	const { progressInfo, isRealtime } = useInterviewProgress({
		interview: interviewProgressData,
		runId: activeRunId ?? undefined,
		accessToken: triggerAccessToken,
	});
	const _progressPercent = Math.min(100, Math.max(0, progressInfo.progress));

	const revalidator = useRevalidator();
	const refreshTriggeredRef = useRef(false);
	const fetcherPrevStateRef = useRef(fetcher.state);
	const takeawaysPollTaskIdRef = useRef<string | null>(null);
	const takeawaysPollTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
	if (!Array.isArray(takeawaysPollTimeoutsRef.current)) {
		takeawaysPollTimeoutsRef.current = [];
	}

	const getTakeawaysPollTimeouts = useCallback((): Array<ReturnType<typeof setTimeout>> => {
		return Array.isArray(takeawaysPollTimeoutsRef.current) ? takeawaysPollTimeoutsRef.current : [];
	}, []);

	const clearTakeawaysPollTimeouts = useCallback(() => {
		for (const timeout of getTakeawaysPollTimeouts()) {
			clearTimeout(timeout);
		}
		takeawaysPollTimeoutsRef.current = [];
	}, [getTakeawaysPollTimeouts]);

	const submitInterviewFieldUpdate = (field_name: string, field_value: string) => {
		const target = field_name === "observations_and_notes" ? notesFetcher : fetcher;
		target.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId,
				projectId,
				fieldName: field_name,
				fieldValue: field_value,
			},
			{ method: "post", action: "/api/update-field" }
		);
	};

	const handleEvidenceSelect = (evidenceId: string) => {
		setSelectedEvidenceId(evidenceId);
		setVerifyDrawerOpen(true);
	};

	const handleSourceClick = useCallback((evidenceId: string) => {
		setHighlightedEvidenceId(evidenceId);
		setTimeout(() => setHighlightedEvidenceId(null), 2500);
	}, []);
	const handleParticipantsUpdated = useCallback(() => {
		revalidator.revalidate();
	}, [revalidator]);

	const getEvidenceSpeakerNames = useCallback((item: unknown): string[] => {
		if (!item || typeof item !== "object") return [];
		const record = item as {
			evidence_people?: Array<{ people?: { name?: string | null } | null }>;
			anchors?: unknown;
		};
		const links = Array.isArray(record.evidence_people) ? record.evidence_people : [];
		const names = links
			.map((link) => link?.people?.name?.trim())
			.filter((name): name is string => Boolean(name && name.length > 0));
		if (names.length > 0) return Array.from(new Set(names));

		const anchors = Array.isArray(record.anchors) ? record.anchors : [];
		const anchorSpeakers = anchors
			.map((anchor) => {
				if (!anchor || typeof anchor !== "object") return null;
				const speaker = (anchor as { speaker?: unknown; speaker_label?: unknown }).speaker;
				if (typeof speaker === "string" && speaker.trim().length > 0) return speaker.trim();
				const speakerLabel = (anchor as { speaker_label?: unknown }).speaker_label;
				if (typeof speakerLabel === "string" && speakerLabel.trim().length > 0) return speakerLabel.trim();
				return null;
			})
			.filter((name): name is string => Boolean(name && name.toLowerCase() !== "unknown speaker"));
		return Array.from(new Set(anchorSpeakers));
	}, []);

	const selectedEvidence = useMemo(() => {
		if (!selectedEvidenceId) return null;
		const item = evidence.find((e) => e.id === selectedEvidenceId);
		if (!item) return null;
		return {
			id: item.id,
			verbatim: item.verbatim ?? null,
			gist: item.gist ?? null,
			topic: item.topic ?? null,
			support: item.support ?? null,
			confidence: item.confidence ?? null,
			anchors: item.anchors,
			thumbnail_url: (item as { thumbnail_url?: string | null }).thumbnail_url ?? null,
			speakerNames: getEvidenceSpeakerNames(item),
		};
	}, [selectedEvidenceId, evidence, getEvidenceSpeakerNames]);

	useEffect(() => {
		const prevState = fetcherPrevStateRef.current;
		fetcherPrevStateRef.current = fetcher.state;
		if (prevState === "idle" || fetcher.state !== "idle") return;

		const data = fetcher.data as unknown;
		if (!data || typeof data !== "object") return;

		if ("success" in data && (data as { success?: boolean }).success) {
			revalidator.revalidate();
			return;
		}

		if ("ok" in data && (data as { ok?: boolean }).ok && "taskId" in data) {
			const taskId = (data as { taskId?: string }).taskId;
			if (!taskId) return;
			if (takeawaysPollTaskIdRef.current === taskId) return;

			takeawaysPollTaskIdRef.current = taskId;
			clearTakeawaysPollTimeouts();

			const intervals = [2000, 5000, 8000, 12000, 16000, 22000, 30000];
			const nextTimeouts = getTakeawaysPollTimeouts();
			for (const delay of intervals) {
				nextTimeouts.push(setTimeout(() => revalidator.revalidate(), delay));
			}
			takeawaysPollTimeoutsRef.current = nextTimeouts;
		}
	}, [fetcher.state, fetcher.data, revalidator, clearTakeawaysPollTimeouts, getTakeawaysPollTimeouts]);

	useEffect(() => {
		return () => {
			clearTakeawaysPollTimeouts();
		};
	}, [clearTakeawaysPollTimeouts]);

	useEffect(() => {
		if (deleteFetcher.state !== "idle") return;
		const redirectTo = deleteFetcher.data?.redirectTo;
		if (redirectTo) {
			navigate(redirectTo);
		}
	}, [deleteFetcher.state, deleteFetcher.data, navigate]);

	useEffect(() => {
		if (notesFetcher.state !== "idle") return;
		const data = notesFetcher.data as { success?: boolean; error?: string } | undefined;
		if (data && !data.success) {
			toast.error(data.error ?? "Failed to save notes");
		}
	}, [notesFetcher.state, notesFetcher.data]);

	// Helper function for date formatting
	function formatReadable(dateString: string) {
		const d = new Date(dateString);
		const parts = d.toLocaleString("en-US", {
			month: "short",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
		// Make AM/PM lower-case and use dash after month
		const lower = parts.replace(/AM|PM/, (m) => m.toLowerCase());
		return lower.replace(/^(\w{3}) (\d{2}), /, "$1-$2 ");
	}

	// Extract data needed for memoized computations
	const participants = interview.participants || [];
	const interviewTitle = interview.title || "Untitled Interview";
	const _primaryParticipant = participants[0]?.people;

	// Calculate transcript speakers for the Manage Participants dialog
	const transcriptSpeakers = useTranscriptSpeakers(interview.transcript_formatted);

	// Match takeaways to evidence for "See source" linking
	const aiKeyTakeaways = useMemo(() => {
		const takeaways = conversationAnalysis?.keyTakeaways ?? [];
		if (!takeaways.length || !evidence?.length) return takeaways;

		// Create mutable copies and match them to evidence
		const takeawaysWithEvidence = takeaways.map((t) => ({ ...t }));
		matchTakeawaysToEvidence(
			takeawaysWithEvidence,
			evidence.map((e) => ({ id: e.id, verbatim: e.verbatim, gist: e.gist }))
		);
		return takeawaysWithEvidence;
	}, [conversationAnalysis?.keyTakeaways, evidence]);
	const conversationUpdatedLabel =
		conversationAnalysis?.updatedAt && !Number.isNaN(new Date(conversationAnalysis.updatedAt).getTime())
			? formatReadable(conversationAnalysis.updatedAt)
			: null;

	// Simplified status-based processing indicator
	// Use interviewState (updated by realtime subscription) for live status checks
	const currentStatus = interviewState?.status ?? interview.status;
	const isRealtimeLive = interview.source_type === "realtime_recording" && currentStatus === "transcribing";
	const isProcessing =
		!isRealtimeLive &&
		(currentStatus === "uploading" ||
			currentStatus === "uploaded" ||
			currentStatus === "transcribing" ||
			currentStatus === "processing");
	const hasError = currentStatus === "error";

	// Get human-readable status label
	const getStatusLabel = (status: string): string => {
		switch (status) {
			case "uploading":
				return "Uploading file...";
			case "uploaded":
				return "Upload complete, preparing for transcription";
			case "transcribing":
				return "Transcribing audio";
			case "processing":
				return "Analyzing transcript and generating insights";
			case "ready":
				return "Analysis complete";
			case "error":
				return "Processing failed";
			default:
				return status;
		}
	};

	// Move all useMemo and useEffect hooks to the top
	const keyTakeawaysDraft = useMemo(
		() => normalizeMultilineText(interview.high_impact_themes).trim(),
		[interview.high_impact_themes]
	);
	const notesDraft = useMemo(
		() => normalizeMultilineText(interview.observations_and_notes).trim(),
		[interview.observations_and_notes]
	);
	const personalFacetSummary = usePersonalFacetSummary(participants);

	const _interviewSystemContext = useMemo(() => {
		const sections: string[] = [];
		sections.push(`Interview title: ${interviewTitle}`);
		if (interview.segment) sections.push(`Target segment: ${interview.segment}`);
		if (keyTakeawaysDraft) sections.push(`Key takeaways draft:\n${keyTakeawaysDraft}`);
		if (personalFacetSummary) sections.push(`Personal facets:\n${personalFacetSummary}`);
		if (notesDraft) sections.push(`Notes:\n${notesDraft}`);

		const combined = sections.filter(Boolean).join("\n\n");
		if (combined.length > 2000) {
			return `${combined.slice(0, 2000)}…`;
		}

		return combined;
	}, [interviewTitle, interview.segment, keyTakeawaysDraft, personalFacetSummary, notesDraft]);

	const _initialInterviewPrompt =
		"Summarize the key takeaways from this interview and list 2 next steps that consider the participant's personal facets.";
	const _hasAnalysisError = analysisState ? analysisState.status === "error" : false;
	const formatStatusLabel = (status: string) =>
		status
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	const _analysisStatusLabel = analysisState?.status ? formatStatusLabel(analysisState.status) : null;
	const _analysisStatusTone = analysisState?.status
		? ACTIVE_ANALYSIS_STATUSES.has(analysisState.status)
			? "bg-primary/10 text-primary"
			: analysisState.status === "error"
				? "bg-destructive/10 text-destructive"
				: "bg-muted text-muted-foreground"
		: "";

	const { uniqueSpeakers, personLenses: _personLenses } = useEmpathySpeakers(empathyMap);

	const _customLensDefaults = useCustomLensDefaults(conversationAnalysis, empathyMap, interview);

	useEffect(() => {
		setCustomLensOverrides({});
	}, [conversationAnalysis]);

	// Sync interview state when loader data changes (navigation to different interview)
	useEffect(() => {
		setInterviewState(interview);
	}, [interview]);

	useEffect(() => {
		setAnalysisState(analysisJob);
		// Reset trigger auth when navigating to a different interview or run
		if (!analysisJob?.trigger_run_id) {
			setTriggerAuth(null);
			setTokenErrorRunId(null);
		}
	}, [analysisJob]);

	// Check if any action is in progress
	const isActionPending = navigation.state === "loading" || navigation.state === "submitting";
	const isFetcherBusy = fetcher.state !== "idle" || participantFetcher.state !== "idle";
	const showBlockingOverlay = isActionPending || isFetcherBusy;
	const overlayLabel =
		navigation.state === "loading"
			? "Loading interview..."
			: navigation.state === "submitting" || isFetcherBusy
				? "Saving changes..."
				: "Processing...";

	useEffect(() => {
		if (!interview?.id) return;

		const supabase = getSupabaseClient();
		const channel = supabase
			.channel(`analysis-${interview.id}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "interviews",
					filter: `id=eq.${interview.id}`,
				},
				(payload) => {
					const raw = (
						payload as {
							new?: Database["public"]["Tables"]["interviews"]["Row"];
						}
					).new;
					if (!raw) return;

					// Update interview state (single source of truth)
					setInterviewState(raw as typeof interview);

					// Also update analysisState for backward compatibility
					setAnalysisState((prev) => {
						const nextSummary = extractAnalysisFromInterview(raw);
						if (!nextSummary) return prev;
						if (!prev) {
							return nextSummary;
						}

						const prevCreated = prev.created_at ? new Date(prev.created_at).getTime() : 0;
						const nextCreated = nextSummary.created_at ? new Date(nextSummary.created_at).getTime() : 0;

						if (nextSummary.id === prev.id || nextCreated >= prevCreated) {
							return nextSummary;
						}

						return prev;
					});
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [interview.id]);

	useEffect(() => {
		if (!analysisState?.trigger_run_id) return;
		if (!triggerAuth?.runId) return;
		if (analysisState.trigger_run_id === triggerAuth.runId) return;

		setTriggerAuth(null);
		setTokenErrorRunId(null);
	}, [analysisState?.trigger_run_id, triggerAuth?.runId]);

	useEffect(() => {
		const runId = analysisState?.trigger_run_id ?? null;
		const status = analysisState?.status;

		if (!runId || !status) {
			setTriggerAuth(null);
			setTokenErrorRunId(null);
			return;
		}

		if (TERMINAL_ANALYSIS_STATUSES.has(status)) {
			setTriggerAuth(null);
			setTokenErrorRunId(null);
			return;
		}

		if (triggerAuth?.runId === runId) {
			return;
		}

		if (tokenErrorRunId === runId) {
			return;
		}

		let isCancelled = false;

		const fetchToken = async () => {
			try {
				const response = await fetch("/api/trigger-run-token", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ runId }),
					credentials: "same-origin",
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch Trigger.dev token (${response.status})`);
				}

				const data = (await response.json()) as { token?: string };

				if (!isCancelled && data?.token) {
					setTriggerAuth({ runId, token: data.token });
					setTokenErrorRunId(null);
				}
			} catch (error) {
				consola.warn("Failed to fetch Trigger.dev access token", error);
				if (!isCancelled) {
					setTriggerAuth(null);
					setTokenErrorRunId(runId);
				}
			}
		};

		fetchToken();

		return () => {
			isCancelled = true;
		};
	}, [analysisState?.trigger_run_id, analysisState?.status, triggerAuth?.runId, tokenErrorRunId]);

	const badgeStylesForPriority = (
		priority: "high" | "medium" | "low"
	): {
		variant: "default" | "secondary" | "destructive" | "outline";
		color?: "blue" | "green" | "red" | "purple" | "yellow" | "orange" | "indigo";
	} => {
		switch (priority) {
			case "high":
				return { variant: "destructive", color: "red" };
			case "medium":
				return { variant: "secondary", color: "orange" };
			default:
				return { variant: "outline", color: "green" };
		}
	};

	useEffect(() => {
		if (!progressInfo.isComplete) {
			refreshTriggeredRef.current = false;
			return;
		}

		if (!refreshTriggeredRef.current) {
			refreshTriggeredRef.current = true;
			revalidator.revalidate();
		}
	}, [progressInfo.isComplete, revalidator]);

	// Fallback polling: periodically revalidate while processing to catch completion
	// when realtime subscriptions (Supabase / Trigger.dev) fail to deliver updates
	useEffect(() => {
		if (!isProcessing) return;

		const interval = setInterval(() => {
			if (revalidator.state === "idle") {
				revalidator.revalidate();
			}
		}, 10_000);

		return () => clearInterval(interval);
	}, [isProcessing, revalidator]);

	const _handleCustomLensUpdate = (lensId: string, field: "summary" | "notes", value: string) => {
		setCustomLensOverrides((prev) => ({
			...prev,
			[lensId]: {
				...(prev[lensId] ?? {}),
				[field]: value,
			},
		}));

		if (!interview?.id) return;

		try {
			lensFetcher.submit(
				{
					interviewId: interview.id,
					projectId,
					accountId,
					lensId,
					field,
					value,
				},
				{ method: "post", action: "/api/update-lens" }
			);
		} catch (error) {
			consola.error("Failed to update custom lens", error);
		}
	};

	const _handleSlotUpdate = (slotId: string, field: "summary" | "textValue", value: string) => {
		try {
			// Convert textValue to text_value for database column name
			const dbField = field === "textValue" ? "text_value" : field;

			slotFetcher.submit(
				{
					slotId,
					field: dbField,
					value,
				},
				{ method: "post", action: "/api/update-slot" }
			);
		} catch (error) {
			consola.error("Failed to update slot", error);
		}
	};

	const _activeLensUpdateId =
		lensFetcher.state !== "idle" && lensFetcher.formData
			? (lensFetcher.formData.get("lensId")?.toString() ?? null)
			: null;

	if (is_missing_interview_data) {
		return <div>Error: Missing interview data</div>;
	}

	if (is_note_type) {
		return <NoteViewer interview={interview} projectId={projectId} />;
	}

	if (is_document_type) {
		return <DocumentViewer interview={interview} />;
	}

	return (
		<>
			<div className="relative mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
				{/* Loading Overlay */}
				{showBlockingOverlay && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
						<div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-6 shadow-lg">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="font-medium text-sm">{overlayLabel}</p>
						</div>
					</div>
				)}

				{/* Scorecard (full width) */}
				<InterviewScorecard
					interview={interview}
					accountId={contextAccountId ?? accountId}
					projectId={projectId}
					evidenceCount={evidence.length}
					creatorName={creatorName}
					currentStatus={currentStatus}
					isProcessing={isProcessing}
					isRealtimeLive={isRealtimeLive}
					hasError={hasError}
					routes={routes}
					linkedOpportunity={linkedOpportunity}
					shareProjectPath={shareProjectPath}
					onFieldUpdate={submitInterviewFieldUpdate}
					onOpenParticipantsDialog={() => setParticipantsDialogOpen(true)}
				/>

				{/* 2-column layout: Insights (left ~58%) + Sources (right ~42%) */}
				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
					{/* Left column: Insights & Analysis */}
					<div className="space-y-6">
						<InterviewInsights
							aiKeyTakeaways={aiKeyTakeaways}
							conversationUpdatedLabel={conversationUpdatedLabel}
							onSourceClick={handleSourceClick}
						/>

						<InterviewRecommendations
							recommendations={conversationAnalysis?.recommendations ?? []}
							openQuestions={conversationAnalysis?.openQuestions ?? []}
						/>

						{/* Conversation Lenses */}
						<div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
							<div className="flex items-center gap-2">
								<Filter className="h-5 w-5 text-amber-500" />
								<h3 className="font-semibold text-base text-foreground">Conversation Lenses</h3>
							</div>
							{lensTemplates.length > 0 ? (
								<LensAccordion
									interviewId={interview.id}
									templates={lensTemplates}
									analyses={lensAnalyses}
									editable
									evidenceMap={evidenceMap}
									onLensApplied={() => revalidator.revalidate()}
								/>
							) : (
								<div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center dark:bg-muted/10">
									<p className="text-muted-foreground text-sm">Conversation Lenses not available</p>
									<p className="mt-1 text-muted-foreground text-xs">Lenses will appear once analysis is complete</p>
								</div>
							)}
						</div>

						{/* Notes */}
						<div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
							<div className="flex items-center gap-2">
								<Pencil className="h-5 w-5 text-amber-500" />
								<h3 className="font-semibold text-base text-foreground">Notes</h3>
							</div>
							<InlineEdit
								textClassName="text-foreground"
								value={(interview.observations_and_notes as string) ?? ""}
								multiline
								markdown
								placeholder="Add your notes here..."
								onSubmit={(value) => {
									try {
										submitInterviewFieldUpdate("observations_and_notes", value);
									} catch (error) {
										consola.error("Failed to update notes:", error);
									}
								}}
							/>
						</div>
					</div>

					{/* Right column: Sources (sticky) */}
					<div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
						<InterviewSourcePanel
							interview={interview}
							evidence={evidence}
							evidenceVoteCounts={evidenceVoteCounts}
							accountId={accountId}
							projectId={projectId}
							onSpeakerClick={() => setParticipantsDialogOpen(true)}
							onEvidenceSelect={handleEvidenceSelect}
							highlightedEvidenceId={highlightedEvidenceId}
							onClearHighlight={() => setHighlightedEvidenceId(null)}
						/>
					</div>
				</div>
			</div>

			{/* Participants Management Dialog */}
			<Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Manage Participants</DialogTitle>
					</DialogHeader>
					<p className="mb-4 text-muted-foreground text-sm">
						Link speakers from the transcript to people in your project. This helps track insights across conversations.
					</p>
					<ManagePeopleAssociations
						interviewId={interview.id}
						participants={participants.map((p) => ({
							id: String(p.id),
							role: p.role,
							transcript_key: p.transcript_key,
							display_name: p.display_name,
							people: p.people
								? {
										id: (p.people as any).id,
										name: (p.people as any).name,
										person_type: (p.people as any).person_type,
									}
								: null,
						}))}
						availablePeople={peopleOptions.map((p) => ({
							id: p.id,
							name: p.name,
							person_type: (p as any).person_type,
						}))}
						transcriptSpeakers={transcriptSpeakers}
						onUpdate={handleParticipantsUpdated}
					/>
				</DialogContent>
			</Dialog>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete interview</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the interview and associated data. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteFetcher.state !== "idle"}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleteFetcher.state !== "idle"}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								deleteFetcher.submit(
									{ interviewId: interview.id, projectId },
									{ method: "post", action: "/api/interviews/delete" }
								);
							}}
						>
							{deleteFetcher.state !== "idle" ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<EvidenceVerificationDrawer
				open={verifyDrawerOpen}
				onOpenChange={setVerifyDrawerOpen}
				selectedEvidence={selectedEvidence}
				allEvidence={evidence
					.filter((e) => e.id && typeof e.id === "string")
					.map((e) => ({
						id: e.id,
						verbatim: e.verbatim ?? null,
						gist: e.gist ?? null,
						topic: e.topic ?? null,
						support: e.support ?? null,
						confidence: e.confidence ?? null,
						anchors: e.anchors,
						thumbnail_url: (e as { thumbnail_url?: string | null }).thumbnail_url ?? null,
						speakerNames: getEvidenceSpeakerNames(e),
					}))}
				interview={interview}
				evidenceDetailRoute={routes.evidence.detail}
			/>
		</>
	);
}
