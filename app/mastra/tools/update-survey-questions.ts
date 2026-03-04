/**
 * Tool for granular question editing on surveys (research_links).
 * Supports update, reorder, hide, unhide, delete, and add operations.
 * Includes branching dependency warnings when hiding/deleting branch targets.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { areCanonicallyEqual, asQuestionArray, resolveBoundSurveyTarget } from "./survey-mutation-guards";

/**
 * Check if any visible question's branching targets a given question ID.
 * Returns warning strings for each dependency found.
 */
function checkBranchDependencies(
	questions: Array<{
		id: string;
		prompt: string;
		hidden?: boolean;
		branching?: { rules?: Array<{ targetQuestionId?: string }> } | null;
	}>,
	targetQuestionIds: Set<string>
): string[] {
	const warnings: string[] = [];
	for (const q of questions) {
		if (q.hidden || targetQuestionIds.has(q.id)) continue;
		if (!q.branching?.rules) continue;
		for (const rule of q.branching.rules) {
			if (rule.targetQuestionId && targetQuestionIds.has(rule.targetQuestionId)) {
				const targetQ = questions.find((tq) => tq.id === rule.targetQuestionId);
				const targetLabel = targetQ ? `"${targetQ.prompt.slice(0, 60)}"` : rule.targetQuestionId;
				warnings.push(
					`Question "${q.prompt.slice(0, 60)}" has a branch rule targeting ${targetLabel} which will be hidden/deleted. The branch will fall through to linear order.`
				);
			}
		}
	}
	return warnings;
}

export const updateSurveyQuestionsTool = createTool({
	id: "update-survey-questions",
	description: `Granular question editing for surveys. Supports: update (edit fields), reorder, hide, unhide, delete, add.
Use this when the user wants to modify individual questions rather than recreate the entire survey.
Returns warnings if hiding/deleting questions that are branch targets.`,
	inputSchema: z.object({
		surveyId: z.string().nullish().describe("The survey ID to modify (defaults to active survey in context)"),
		action: z.enum(["update", "reorder", "hide", "unhide", "delete", "add"]).describe("The operation to perform"),
		// For update: array of partial question updates
		updates: z
			.array(
				z.object({
					questionId: z.string(),
					prompt: z.string().nullish(),
					type: z.string().nullish(),
					options: z.array(z.string()).nullish(),
					required: z.boolean().nullish(),
					helperText: z.string().nullish(),
					hidden: z.boolean().nullish(),
				})
			)
			.nullish()
			.describe("For 'update' action: partial updates keyed by questionId"),
		// For hide/unhide/delete: which questions
		questionIds: z.array(z.string()).nullish().describe("For hide/unhide/delete: question IDs to act on"),
		// For reorder: full ordered list of question IDs
		orderedIds: z.array(z.string()).nullish().describe("For 'reorder': the complete ordered list of question IDs"),
		// For add: new questions + insertion point
		newQuestions: z
			.array(
				z.object({
					prompt: z.string(),
					type: z.string().optional(),
					options: z.array(z.string()).optional(),
					required: z.boolean().optional(),
					helperText: z.string().optional(),
				})
			)
			.nullish()
			.describe("For 'add': new questions to insert"),
		insertAfterQuestionId: z
			.string()
			.nullish()
			.describe("For 'add': insert after this question ID (null = append at end)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		updatedCount: z.number(),
		warnings: z.array(z.string()).nullish(),
		surveyId: z.string().nullish(),
		questionCount: z.number().nullish(),
	}),
	execute: async (input, context?) => {
		try {
			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			const { survey, surveyId, projectId } = await resolveBoundSurveyTarget({
				context,
				toolName: "update-survey-questions",
				supabase,
				surveyIdInput: input.surveyId,
				select: "id, name, questions, project_id, account_id",
			});

			let questions = asQuestionArray(survey.questions);
			const initialQuestionCount = questions.length;
			const warnings: string[] = [];
			let changedCount = 0;

			switch (input.action) {
				case "update": {
					if (!input.updates?.length) {
						return { success: false, message: "No updates provided.", updatedCount: 0 };
					}
					let updated = 0;
					for (const upd of input.updates) {
						const idx = questions.findIndex((q) => q.id === upd.questionId);
						if (idx < 0) continue;
						const q = { ...questions[idx] };
						if (upd.prompt != null) q.prompt = upd.prompt;
						if (upd.type != null) q.type = upd.type;
						if (upd.options !== undefined) q.options = upd.options;
						if (upd.required != null) q.required = upd.required;
						if (upd.helperText !== undefined) q.helperText = upd.helperText;
						if (upd.hidden != null) q.hidden = upd.hidden;
						questions[idx] = q;
						updated += 1;
					}
					if (updated === 0) {
						return { success: false, message: "No matching questions found to update.", updatedCount: 0 };
					}
					changedCount = updated;
					break;
				}

				case "reorder": {
					if (!input.orderedIds?.length) {
						return { success: false, message: "No orderedIds provided.", updatedCount: 0 };
					}
					const idMap = new Map(questions.map((q) => [q.id as string, q]));
					const reordered: Array<Record<string, unknown>> = [];
					for (const id of input.orderedIds) {
						const q = idMap.get(id);
						if (q) {
							reordered.push(q);
							idMap.delete(id);
						}
					}
					// Append any questions not in orderedIds at the end
					for (const q of idMap.values()) {
						reordered.push(q);
					}
					questions = reordered;
					changedCount = questions.length;
					break;
				}

				case "hide": {
					if (!input.questionIds?.length) {
						return { success: false, message: "No questionIds provided.", updatedCount: 0 };
					}
					const hideSet = new Set(input.questionIds);
					// Check branch dependencies before hiding
					const branchWarnings = checkBranchDependencies(
						questions as Array<{
							id: string;
							prompt: string;
							hidden?: boolean;
							branching?: { rules?: Array<{ targetQuestionId?: string }> } | null;
						}>,
						hideSet
					);
					warnings.push(...branchWarnings);
					let hidden = 0;
					questions = questions.map((q) => {
						if (hideSet.has(q.id as string)) {
							hidden++;
							return { ...q, hidden: true };
						}
						return q;
					});
					if (hidden === 0) {
						return {
							success: false,
							message: "No matching questions found to hide.",
							updatedCount: 0,
							warnings: warnings.length > 0 ? warnings : null,
						};
					}
					changedCount = hidden;
					break;
				}

				case "unhide": {
					if (!input.questionIds?.length) {
						return { success: false, message: "No questionIds provided.", updatedCount: 0 };
					}
					const unhideSet = new Set(input.questionIds);
					let unhidden = 0;
					questions = questions.map((q) => {
						if (unhideSet.has(q.id as string)) {
							unhidden++;
							return { ...q, hidden: false };
						}
						return q;
					});
					if (unhidden === 0) {
						return { success: false, message: "No matching questions found to unhide.", updatedCount: 0 };
					}
					changedCount = unhidden;
					break;
				}

				case "delete": {
					if (!input.questionIds?.length) {
						return { success: false, message: "No questionIds provided.", updatedCount: 0 };
					}
					const deleteSet = new Set(input.questionIds);
					// Check branch dependencies before deleting
					const deleteWarnings = checkBranchDependencies(
						questions as Array<{
							id: string;
							prompt: string;
							hidden?: boolean;
							branching?: { rules?: Array<{ targetQuestionId?: string }> } | null;
						}>,
						deleteSet
					);
					warnings.push(...deleteWarnings);
					const before = questions.length;
					questions = questions.filter((q) => !deleteSet.has(q.id as string));
					const deleted = before - questions.length;
					if (deleted === 0) {
						return {
							success: false,
							message: "No matching questions found to delete.",
							updatedCount: 0,
							warnings: warnings.length > 0 ? warnings : null,
						};
					}
					changedCount = deleted;
					break;
				}

				case "add": {
					if (!input.newQuestions?.length) {
						return { success: false, message: "No newQuestions provided.", updatedCount: 0 };
					}
					const newQs = input.newQuestions.map((nq) => ({
						id: crypto.randomUUID(),
						prompt: nq.prompt,
						type: nq.type ?? "auto",
						required: nq.required ?? false,
						placeholder: null,
						helperText: nq.helperText ?? null,
						options: nq.options ?? null,
						allowOther: true,
						likertScale: null,
						likertLabels: null,
						imageOptions: null,
						mediaUrl: null,
						videoUrl: null,
						hidden: false,
					}));
					if (input.insertAfterQuestionId) {
						const insertIdx = questions.findIndex((q) => q.id === input.insertAfterQuestionId);
						if (insertIdx >= 0) {
							questions.splice(insertIdx + 1, 0, ...newQs);
						} else {
							questions.push(...newQs);
						}
					} else {
						questions.push(...newQs);
					}
					changedCount = newQs.length;
					break;
				}
			}

			// Save back to database
			const { error: updateError } = await supabase
				.from("research_links")
				.update({ questions })
				.eq("id", surveyId)
				.eq("project_id", projectId);

			if (updateError) {
				consola.error("update-survey-questions: save error", updateError);
				return { success: false, message: `Failed to save: ${updateError.message}`, updatedCount: 0 };
			}

			const { data: persisted, error: persistedError } = await supabase
				.from("research_links")
				.select("id, questions")
				.eq("id", surveyId)
				.eq("project_id", projectId)
				.single();

			if (persistedError || !persisted) {
				return {
					success: false,
					message: "Saved changes but failed to verify persisted survey state. Please refresh and retry.",
					updatedCount: 0,
					surveyId,
					questionCount: null,
					warnings: warnings.length > 0 ? warnings : null,
				};
			}

			const persistedQuestions = asQuestionArray(persisted.questions);
			if (!areCanonicallyEqual(questions, persistedQuestions)) {
				consola.error("update-survey-questions: post-write verification mismatch", {
					surveyId,
					action: input.action,
					expectedCount: questions.length,
					actualCount: persistedQuestions.length,
				});
				return {
					success: false,
					message:
						"Survey write verification failed. The database state differs from the intended update, so no success was reported.",
					updatedCount: 0,
					surveyId,
					questionCount: persistedQuestions.length,
					warnings: warnings.length > 0 ? warnings : null,
				};
			}

			const actionMessages: Record<string, string> = {
				update: `Updated ${changedCount} question(s).`,
				reorder: `Reordered ${changedCount} question(s).`,
				hide: `Hid ${changedCount} question(s).`,
				unhide: `Unhid ${changedCount} question(s).`,
				delete: `Deleted ${changedCount} question(s).`,
				add: `Added ${changedCount} question(s).`,
			};
			const totalQuestions = persistedQuestions.length;
			const countDelta = totalQuestions - initialQuestionCount;
			const totalText =
				input.action === "add" || input.action === "delete"
					? ` Survey now has ${totalQuestions} questions (${countDelta >= 0 ? "+" : ""}${countDelta}).`
					: ` Survey has ${totalQuestions} questions.`;

			return {
				success: true,
				message: `${actionMessages[input.action] ?? "Done."}${totalText}`,
				updatedCount: changedCount,
				warnings: warnings.length > 0 ? warnings : null,
				surveyId,
				questionCount: totalQuestions,
			};
		} catch (error) {
			consola.error("update-survey-questions: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error",
				updatedCount: 0,
			};
		}
	},
});
