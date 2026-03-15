/**
 * Interview Detail page — server action handling all form intents.
 * Extracted from detail.tsx for maintainability.
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getPeopleOptions, verifyPersonBelongsToProject } from "~/features/people/db";
import { syncTitleToJobTitleFacet } from "~/features/people/syncTitleToFacet.server";
import { requireUserSupabase, userContext } from "~/server/user-context";
import { parseFullName } from "../lib/interviewDetailHelpers";

export async function action({ context, params, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = requireUserSupabase(ctx);
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
			case "create-task": {
				const title = formData.get("title")?.toString()?.trim();
				if (!title) {
					return Response.json({ ok: false, error: "Task title is required" }, { status: 400 });
				}

				const description = formData.get("description")?.toString()?.trim() || undefined;
				const cluster = formData.get("cluster")?.toString()?.trim() || undefined;
				const priorityRaw = formData.get("priority")?.toString();
				const priority = priorityRaw ? Number(priorityRaw) : undefined;
				const due_date = formData.get("due_date")?.toString()?.trim() || undefined;

				const { createTask, createTaskLink } = await import("~/features/tasks/db");

				const task = await createTask({
					supabase,
					accountId,
					projectId,
					userId: ctx.claims?.sub ?? null,
					data: { title, description, cluster, priority, due_date },
				});

				const userId = ctx.claims?.sub ?? "system";

				// Link task to interview
				await createTaskLink({
					supabase,
					userId,
					data: {
						task_id: task.id,
						entity_type: "interview",
						entity_id: interviewId,
					},
				});

				// Auto-associate external participants with the task
				const { data: participants } = await supabase
					.from("interview_people")
					.select("person_id, role")
					.eq("interview_id", interviewId)
					.not("person_id", "is", null);

				if (participants?.length) {
					for (const p of participants) {
						if (!p.person_id) continue;
						// Only link external people (non-interviewer roles)
						const isExternal = !p.role || p.role !== "interviewer";
						if (isExternal) {
							await createTaskLink({
								supabase,
								userId,
								data: {
									task_id: task.id,
									entity_type: "person",
									entity_id: p.person_id,
								},
							});
						}
					}
				}

				return Response.json({ ok: true, created: true, taskId: task.id });
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
