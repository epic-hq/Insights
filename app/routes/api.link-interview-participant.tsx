/**
 * API route to link an interview participant (speaker) to a person record
 */

import type { ActionFunctionArgs } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server");
		const { user: claims } = await getAuthenticatedUser(request);
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request);

		const formData = await request.formData();
		const participantId = formData.get("participant_id")?.toString();
		const personId = formData.get("person_id")?.toString();
		const createPerson = formData.get("create_person")?.toString() === "true";
		const personName = formData.get("person_name")?.toString();
		const _interviewId = formData.get("interview_id")?.toString();

		if (!participantId) {
			return Response.json({ ok: false, error: "Missing participant_id" }, { status: 400 });
		}

		// Verify participant exists and get interview context
		const { data: participant, error: participantError } = await userDb
			.from("interview_people")
			.select("id, interview_id, person_id, interviews(project_id, account_id)")
			.eq("id", participantId)
			.single();

		if (participantError || !participant) {
			return Response.json({ ok: false, error: "Participant not found" }, { status: 404 });
		}

		const projectId = (participant.interviews as any)?.project_id;
		const accountId = (participant.interviews as any)?.account_id;

		if (!projectId || !accountId) {
			return Response.json({ ok: false, error: "Invalid participant data" }, { status: 400 });
		}

		let finalPersonId = personId;

		// If creating a new person
		if (createPerson && personName) {
			const { data: newPerson, error: createError } = await userDb
				.from("people")
				.insert({
					account_id: accountId,
					project_id: projectId,
					name: personName,
					created_by: claims.sub,
				})
				.select("id")
				.single();

			if (createError || !newPerson) {
				return Response.json(
					{
						ok: false,
						error: `Failed to create person: ${createError?.message}`,
					},
					{ status: 500 }
				);
			}

			finalPersonId = newPerson.id;
		}

		// Smart speaker swap: If the target person is already linked to another
		// participant in this interview, swap them instead of just overwriting
		const swappedWith: string | null = null;
		const currentPersonId = participant.person_id;

		if (finalPersonId) {
			// Check if target person is already linked to another participant
			const { data: existingLink } = await userDb
				.from("interview_people")
				.select("id, person_id, role, transcript_key, display_name, project_id")
				.eq("interview_id", participant.interview_id)
				.eq("person_id", finalPersonId)
				.neq("id", participantId)
				.maybeSingle();

			if (existingLink) {
				// Swap via delete + reinsert to avoid the UNIQUE(interview_id, person_id) constraint
				// violation that occurs when both rows temporarily share the same person_id.
				// person_id is NOT NULL so we cannot use a null intermediate value.
				const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
				const adminDb = createSupabaseAdminClient();

				// 1. Delete the conflicting row
				const { error: deleteError } = await adminDb.from("interview_people").delete().eq("id", existingLink.id);

				if (deleteError) {
					return Response.json(
						{
							ok: false,
							error: `Failed to swap participants: ${deleteError.message}`,
						},
						{ status: 500 }
					);
				}

				// 2. Update main participant to the target person
				const { error: updateMainError } = await adminDb
					.from("interview_people")
					.update({ person_id: finalPersonId })
					.eq("id", participantId);

				if (updateMainError) {
					return Response.json(
						{
							ok: false,
							error: `Failed to swap participants: ${updateMainError.message}`,
						},
						{ status: 500 }
					);
				}

				// 3. Re-insert the deleted row with the old person (if one existed)
				if (currentPersonId) {
					const { error: reinsertError } = await adminDb.from("interview_people").insert({
						interview_id: participant.interview_id,
						person_id: currentPersonId,
						project_id: existingLink.project_id ?? null,
						role: existingLink.role ?? null,
						transcript_key: existingLink.transcript_key ?? null,
						display_name: existingLink.display_name ?? null,
						created_by: claims.sub,
					});

					if (reinsertError) {
						return Response.json(
							{
								ok: false,
								error: `Failed to swap participants: ${reinsertError.message}`,
							},
							{ status: 500 }
						);
					}
				}

				return Response.json({
					ok: true,
					swapped: true,
					message: "Speakers swapped successfully",
				});
			}
		}

		// Update the interview_people record to link/unlink person
		// If personId is empty string, unlink by setting to null
		const { error: updateError } = await userDb
			.from("interview_people")
			.update({
				person_id: finalPersonId || null,
			})
			.eq("id", participantId);

		if (updateError) {
			return Response.json(
				{
					ok: false,
					error: `Failed to update participant: ${updateError.message}`,
				},
				{ status: 500 }
			);
		}

		return Response.json({
			ok: true,
			swapped: !!swappedWith,
			message: finalPersonId
				? swappedWith
					? "Speakers swapped successfully"
					: createPerson
						? "Person created and linked successfully"
						: "Person linked successfully"
				: "Person unlinked successfully",
		});
	} catch (error: any) {
		console.error("[link-interview-participant] Error:", error);
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to update participant",
			},
			{ status: 500 }
		);
	}
}
