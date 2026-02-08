import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { createTask } from "~/features/tasks/db";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const { client: supabase, user } = getServerClient(request);
		const body = await request.json();

		const { projectId, title, content, noteType, associations, tags } = body;

		if (!projectId) {
			return Response.json({ error: "projectId is required" }, { status: 400 });
		}

		// Get account_id from project
		const { data: project } = await supabase.from("projects").select("account_id").eq("id", projectId).single();

		if (!project) {
			return Response.json({ error: "Project not found" }, { status: 404 });
		}

		// Handle task creation
		if (noteType === "task") {
			if (!title) {
				return Response.json({ error: "Title is required for tasks" }, { status: 400 });
			}

			const task = await createTask({
				supabase,
				accountId: project.account_id,
				projectId,
				userId: user?.id || null,
				data: {
					title,
					description: content || null,
					tags: tags || [],
					status: "backlog",
					cluster: "Product", // Default cluster for quick-created tasks
				},
			});

			consola.info("Task created successfully", {
				projectId,
				taskId: task.id,
				title,
			});

			return Response.json({
				success: true,
				id: task.id,
				type: "task",
				message: "Task created successfully",
			});
		}

		// Handle note creation (default behavior)
		if (!content) {
			return Response.json({ error: "Content is required for notes" }, { status: 400 });
		}

		// Build metadata for conversation_analysis field
		const metadata = {
			note_type: noteType,
			associations: associations || {},
			tags: tags || [],
		};

		// Insert into interviews table
		const { data: interview, error } = await supabase
			.from("interviews")
			.insert({
				account_id: project.account_id,
				project_id: projectId,
				title: title || `Note - ${new Date().toLocaleDateString()}`,
				observations_and_notes: content,
				source_type: "note",
				media_type: "note",
				status: "ready",
				conversation_analysis: metadata as any,
				created_by: user?.id,
			})
			.select("id")
			.single();

		if (error) {
			throw new Error(error.message || "Failed to save note");
		}

		consola.info("Note created successfully", {
			projectId,
			noteId: interview?.id,
			hasAssociations: Object.keys(associations || {}).length > 0,
		});

		return Response.json({
			success: true,
			id: interview?.id,
			type: "note",
			message: "Note saved successfully",
		});
	} catch (error) {
		consola.error("Failed to create note/task:", error);
		return Response.json(
			{
				error: "Failed to create note/task",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
