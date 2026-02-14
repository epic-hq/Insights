import { createStep, createWorkflow } from "@mastra/core/workflows";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { openai } from "../../lib/billing/instrumented-openai.server";
import { getLangfuseClient } from "../../lib/langfuse.server";

const StateSchema = z.object({
	name: z.string().optional(),
	problem: z.string().optional(),
	need_to_learn: z.string().optional(),
	challenges: z.string().optional(),
	content_types: z.string().optional(),
	other_feedback: z.string().optional(),
});

const InputSchema = z.object({
	message: z.string().describe("Latest user message"),
	state: StateSchema.default({}),
	user_id: z.string().optional(),
});

const OutputSchema = z.object({
	reply: z.string(),
	state: StateSchema,
	completed: z.boolean(),
});

const normalizeMessage = (s: string) => s.trim();

const chooseNextKey = (state: z.infer<typeof StateSchema>) => {
	if (!state.name) return "name" as const;
	if (!state.problem) return "problem" as const;
	if (!state.need_to_learn) return "need_to_learn" as const;
	if (!state.challenges) return "challenges" as const;
	if (!state.content_types) return "content_types" as const;
	return null;
};

const MergeAnswerStep = createStep({
	id: "merge-answer",
	description: "Assign the message to the next missing field if appropriate",
	inputSchema: InputSchema,
	outputSchema: z.object({
		state: StateSchema,
		assigned: z.boolean(),
		assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
		message: z.string(),
		user_id: z.string().optional(),
	}),
	execute: async ({ inputData, requestContext }) => {
		let { message, state, user_id } = inputData;
		const clean = normalizeMessage(message);

		// Heuristic: ignore very short/reactive messages
		const looksValid = clean.length > 2 && /[a-zA-Z0-9]/.test(clean);

		// If no state provided but we have a user_id, try loading existing partial state
		const hasAnyState = !!(
			state.name ||
			state.problem ||
			state.need_to_learn ||
			state.challenges ||
			state.content_types ||
			state.other_feedback
		);
		if (!hasAnyState && user_id) {
			try {
				const supabase =
					(requestContext?.get("supabase") as any) ||
					createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
				const { data } = await supabase
					.from("user_settings")
					.select("signup_data")
					.eq("user_id", user_id)
					.maybeSingle();
				const existing = (data?.signup_data || {}) as any;
				state = {
					name: existing.name,
					problem: existing.problem,
					need_to_learn: existing.need_to_learn,
					challenges: existing.challenges,
					content_types: existing.content_types,
					other_feedback: existing.other_feedback,
				};
			} catch {}
		}

		const nextKey = chooseNextKey(state);
		if (!nextKey) {
			return {
				state,
				assigned: false,
				assigned_key: null,
				message: clean,
				user_id,
			};
		}

		if (!looksValid) {
			return {
				state,
				assigned: false,
				assigned_key: nextKey,
				message: clean,
				user_id,
			};
		}

		// Basic inline cleanup for name: first token, capitalized
		let value = clean;
		if (nextKey === "name") {
			const token = clean.split(/\s+/)[0] || "";
			value = token.replace(/[^a-zA-Z'-]/g, "");
			value = value.charAt(0).toUpperCase() + value.slice(1);
		}

		const newState = { ...state, [nextKey]: value };
		return {
			state: newState,
			assigned: true,
			assigned_key: nextKey,
			message: clean,
			user_id,
		};
	},
});

// Optional normalization using LLM for non-name fields
const NormalizeAssignedStep = createStep({
	id: "normalize-assigned",
	description: "Normalize the newly assigned value using LLM for clarity/spelling",
	inputSchema: z.object({
		state: StateSchema,
		assigned: z.boolean(),
		assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
		message: z.string(),
		user_id: z.string().optional(),
	}),
	outputSchema: z.object({
		state: StateSchema,
		assigned: z.boolean(),
		assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
		message: z.string(),
		user_id: z.string().optional(),
	}),
	execute: async ({ inputData }) => {
		const { state, assigned, assigned_key, message, user_id } = inputData;
		if (!assigned || !assigned_key || assigned_key === "name") return inputData;
		try {
			const prompt = `Rewrite the user's input succinctly as a clean value for the field "${assigned_key}".
Fix spelling and grammar. Keep it short (max ~12 words). Do not add new facts.
User input: "${message}"`;
			const langfuse = getLangfuseClient();
			const trace = (langfuse as any).trace?.({
				name: "llm.normalize-assigned",
			});
			const gen = trace?.generation?.({ name: "llm.normalize-assigned" });
			const { text } = await generateText({
				model: openai("gpt-4o-mini"),
				messages: [{ role: "user", content: prompt }],
			});
			gen?.update?.({
				input: { assigned_key, promptLen: prompt.length },
				output: { text },
			});
			gen?.end?.();
			const cleaned = (text || state[assigned_key] || "").toString().trim();
			const newState = { ...state, [assigned_key]: cleaned };
			return { state: newState, assigned, assigned_key, message, user_id };
		} catch {
			return inputData;
		}
	},
});

const BuildReplyStep = createStep({
	id: "build-reply",
	description: "Decide next question or completion message",
	inputSchema: z.object({
		state: StateSchema,
		assigned: z.boolean(),
		assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
		message: z.string(),
		user_id: z.string().optional(),
	}),
	outputSchema: z.object({
		reply: z.string(),
		state: StateSchema,
		completed: z.boolean(),
		user_id: z.string().optional(),
	}),
	execute: async ({ inputData }) => {
		const { state, assigned, assigned_key, message, user_id } = inputData;
		const nextKey = chooseNextKey(state);

		const questions: Record<string, string> = {
			name: "What's your name?",
			problem: "What business objective are you trying to achieve?",
			need_to_learn: "What do you need to learn to help achieve that goal?",
			challenges: "What are the challenges in getting those answers?",
			content_types:
				"What content types do you want to analyze (interview recordings, transcripts, notes, docs, etc.)?",
		};

		if (nextKey === null) {
			const friendly = state.name ? `All set, ${state.name}.` : "All set.";
			return {
				reply: `${friendly} Redirecting to /home in a few seconds…`,
				state,
				completed: true,
				user_id,
			};
		}

		// Keep short, no filler; prefer name + next question or just the question.
		const question = questions[nextKey];
		const reply = state.name ? `${state.name}, ${question}` : question;
		return { reply, state, completed: false, user_id };
	},
});

const SaveIfCompleteStep = createStep({
	id: "save-if-complete",
	description: "Persist state if completed",
	inputSchema: z.object({
		reply: z.string(),
		state: StateSchema,
		completed: z.boolean(),
		user_id: z.string().optional(),
	}),
	outputSchema: OutputSchema,
	execute: async ({ inputData, requestContext }) => {
		const { reply, state, completed, user_id } = inputData;
		if (!completed) return { reply, state, completed };

		try {
			const supabase =
				(requestContext?.get("supabase") as any) ||
				createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

			if (!user_id) {
				// No user context; just return reply
				return {
					reply,
					state: { ...state, completed: true } as any,
					completed: true,
				};
			}

			const { error } = await supabase.rpc("upsert_signup_data", {
				p_user_id: user_id,
				p_signup_data: { ...state, completed: true },
			});

			if (error) {
				// Return reply but mark incomplete to avoid redirect loop
				return {
					reply: `${reply} (Note: we hit a save hiccup, please try again shortly)`,
					state,
					completed: false,
				};
			}

			return {
				reply,
				state: { ...state, completed: true } as any,
				completed: true,
			};
		} catch {
			return {
				reply: `${reply} (Note: couldn't save right now)`,
				state,
				completed: false,
			};
		}
	},
});

export const signupOnboardingWorkflow = createWorkflow({
	id: "signupOnboardingWorkflow",
	description: "Guide signup chat turn-by-turn and persist when complete",
	inputSchema: InputSchema,
	outputSchema: OutputSchema,
})
	.then(MergeAnswerStep)
	.then(NormalizeAssignedStep)
	.then(
		createStep({
			id: "save-progress",
			description: "Persist partial state after assignment",
			inputSchema: z.object({
				state: StateSchema,
				assigned: z.boolean(),
				assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
				message: z.string(),
				user_id: z.string().optional(),
			}),
			outputSchema: z.object({
				state: StateSchema,
				assigned: z.boolean(),
				assigned_key: z.enum(["name", "problem", "need_to_learn", "challenges", "content_types"]).nullable(),
				message: z.string(),
				user_id: z.string().optional(),
			}),
			execute: async ({ inputData, requestContext }) => {
				const { state, assigned, assigned_key, message, user_id } = inputData;
				if (assigned && user_id) {
					try {
						const supabase =
							(requestContext?.get("supabase") as any) ||
							createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
						await supabase.rpc("upsert_signup_data", {
							p_user_id: user_id,
							p_signup_data: { ...state, completed: false },
						});
					} catch {}
				}
				return { state, assigned, assigned_key, message, user_id };
			},
		})
	)
	.then(BuildReplyStep)
	.then(SaveIfCompleteStep);

signupOnboardingWorkflow.commit();

type SignupWorkflowInput = z.infer<typeof InputSchema>;
type SignupWorkflowOutput = z.infer<typeof OutputSchema>;
