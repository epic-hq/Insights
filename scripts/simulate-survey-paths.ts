#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getNextQuestionId } from "../app/features/research-links/branching";

type Question = {
	id: string;
	prompt: string;
	type?: string;
	options?: string[] | null;
	hidden?: boolean;
	branching?: unknown;
};

function resolveSurveyIdArg(): string {
	const fromArg = process.argv[2]?.trim();
	if (!fromArg) {
		throw new Error("Usage: pnpm tsx scripts/simulate-survey-paths.ts <surveyId>");
	}
	return fromArg;
}

async function main() {
	dotenv.config({ path: ".env" });
	const surveyId = resolveSurveyIdArg();
	const supabaseUrl = process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
	const { data, error } = await supabase
		.from("research_links")
		.select("id, name, questions")
		.eq("id", surveyId)
		.single();
	if (error || !data) {
		throw new Error(`Failed to load survey ${surveyId}: ${error?.message ?? "not found"}`);
	}

	const questions = (Array.isArray(data.questions) ? data.questions : []) as Question[];
	const activeQuestions = questions.filter((question) => !question.hidden);
	if (activeQuestions.length === 0) {
		throw new Error(`Survey ${surveyId} has no active questions.`);
	}

	const roleQuestion = activeQuestions[0];
	const roleOptions = Array.isArray(roleQuestion.options) ? roleQuestion.options.filter(Boolean) : [];
	if (roleOptions.length === 0) {
		throw new Error(
			"Question 1 has no options. Provide a survey whose first question is single-select with options for simulation."
		);
	}

	console.log(`Survey: ${data.name} (${data.id})`);
	console.log(`Simulating ${roleOptions.length} paths based on Q1 options...\n`);

	for (const option of roleOptions) {
		const responses: Record<string, string | string[]> = {
			[roleQuestion.id]: option,
		};
		const visited: string[] = [];
		let current = activeQuestions[0] ?? null;
		let guard = 0;

		while (current && guard < activeQuestions.length * 3) {
			visited.push(current.prompt);
			const nextId = getNextQuestionId(current as any, activeQuestions as any, responses);
			if (!nextId) break;
			const next = activeQuestions.find((question) => question.id === nextId) ?? null;
			if (!next) break;
			current = next;
			guard += 1;
		}

		console.log(`Role option: ${option}`);
		console.log(`Visited count: ${visited.length}`);
		for (const [index, prompt] of visited.entries()) {
			console.log(`${index + 1}. ${prompt}`);
		}
		console.log("");
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
